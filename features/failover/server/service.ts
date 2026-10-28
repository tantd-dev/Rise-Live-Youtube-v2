// Chuyển máy (tay) + tự cứu khi máy chết. Bàn giao 2 pha an toàn — KHÔNG bao giờ 2 máy cùng phát:
//   stopping_source (máy nguồn dừng) → cutover machineId sang đích → starting_target → verifying → xong.
// Tiến trình bàn giao do nhịp worker đẩy đi (advanceMoves, gọi từ API worker).
import { db, COL, nowISO, readAll, readOne } from "@/lib/server/firestore";
import { bad, notFound } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { audit } from "@/lib/server/audit";
import type { Asset } from "@/features/assets/types";
import type { Machine } from "@/features/machines/types";
import { isOnline, quietSec } from "@/features/machines/rules";
import { isAutoProtected, shouldBeLive, streamAssetIds } from "@/features/streams/rules";
import type { Stream } from "@/features/streams/types";
import type { SessionUser } from "@/features/users/types";
import { logIncident } from "@/features/incidents/server/service";
import { MOVE_TIMEOUT_SEC, VERIFY_GRACE_SEC, moveCandidates, remapAssetIds } from "../rules";
import type { FailoverSwitch } from "../types";

const CLEAR_MOVE = {
  moveState: null, moveSourceId: null, moveTargetId: null, moveExecId: null, moveDeadlineAt: null,
  moveVerifyAt: null, moveType: null, moveTargetAssetIds: null, movePrevAssetIds: null,
};
const deadline = () => new Date(Date.now() + MOVE_TIMEOUT_SEC * 1000).toISOString();

// ── Công tắc TẮT KHẨN tự cứu (chỉ dừng phần TỰ chuyển; live vẫn phát, cảnh báo vẫn chạy) ──
export async function getSwitch(): Promise<FailoverSwitch> {
  if (env.failoverOffEnv()) return { disabled: true, envOff: true, reason: "RISE_LIVE_FAILOVER_OFF=1" };
  const d = (await db.collection(COL.settings).doc("failover").get()).data();
  return { disabled: d?.disabled === true, by: d?.disabledBy, at: d?.disabledAt, reason: d?.reason ?? "" };
}

export async function setSwitch(off: boolean, reason: string, user: SessionUser) {
  if (off && !reason.trim()) throw bad("Cho biết lý do tắt (để người sau hiểu vì sao).");
  await db.collection(COL.settings).doc("failover").set(
    off ? { disabled: true, disabledBy: user.email, disabledAt: nowISO(), reason: reason.trim().slice(0, 300) }
      : { disabled: false, enabledBy: user.email, enabledAt: nowISO(), reason: "" }, { merge: true });
  await audit(user.email, off ? "failover.off" : "failover.on", "failover", reason);
}

// ── Chuyển tay ──
export async function previewMove(streamId: string) {
  const [stream, machines, streams, assets] = await Promise.all([
    readOne<Stream>(COL.streams, streamId), readAll<Machine>(COL.machines, 500), readAll<Stream>(COL.streams, 5000), readAll<Asset>(COL.assets, 8000),
  ]);
  if (!stream) throw notFound("live không tồn tại.");
  return moveCandidates(stream, machines, streams, assets);
}

export async function startMove(streamId: string, targetId: string, user: SessionUser) {
  const [stream, machines, streams, assets] = await Promise.all([
    readOne<Stream>(COL.streams, streamId), readAll<Machine>(COL.machines, 500), readAll<Stream>(COL.streams, 5000), readAll<Asset>(COL.assets, 8000),
  ]);
  if (!stream) throw notFound("live không tồn tại.");
  if (stream.moveState) throw bad("live đang trong một lần chuyển khác.");
  if (!shouldBeLive(stream)) throw bad("Chỉ chuyển được live ĐANG phát. Với live đã dừng, hãy bấm “Sửa” để đổi máy.");
  const cand = moveCandidates(stream, machines, streams, assets).find((c) => c.machineId === targetId);
  if (!cand) throw bad("Máy đích không hợp lệ.");
  if (!cand.ok) throw bad(`Không chuyển được sang "${cand.name}": ${cand.reasons.join(", ")}.${cand.hasVideo ? "" : " Hãy sao chép video sang máy đó trước (Kho video → Sao chép sang máy khác)."}`);
  const targetIds = remapAssetIds(stream, targetId, assets)!;
  const exec = await db.collection(COL.moves).add({
    streamId, streamName: stream.name, moveType: "manual_safe_move", sourceMachineId: stream.machineId, targetMachineId: targetId,
    startedAt: nowISO(), state: "stopping_source", initiatedBy: user.email,
  });
  await db.collection(COL.streams).doc(streamId).set({
    moveState: "stopping_source", moveSourceId: stream.machineId, moveTargetId: targetId, moveType: "manual_safe_move",
    moveTargetAssetIds: targetIds, movePrevAssetIds: streamAssetIds(stream), moveExecId: exec.id,
    moveDeadlineAt: deadline(), updatedAt: nowISO(),
  }, { merge: true });
  await audit(user.email, "stream.move", streamId, `→ ${cand.name}`);
}

// ── Tự cứu: máy chết → chuyển live được bảo vệ sang máy khác (bỏ pha dừng nguồn vì nguồn đã chết) ──
export async function runAutoFailover(): Promise<{ moved: number; skipped?: string }> {
  if (!env.autoFailover()) return { moved: 0, skipped: "RISE_LIVE_AUTOFAILOVER chưa bật" };
  const sw = await getSwitch();
  if (sw.disabled) return { moved: 0, skipped: "dự phòng tự động đang TẮT" };
  const [machines, streams, assets] = await Promise.all([readAll<Machine>(COL.machines, 500), readAll<Stream>(COL.streams, 5000), readAll<Asset>(COL.assets, 8000)]);
  const nowMs = Date.now();
  const byId = new Map(machines.map((m) => [m.id, m]));
  const dead = (m: Machine | undefined) => !!m && !m.maintenance && (m.forceOffline === true || (!isOnline(m, nowMs) && quietSec(m, nowMs) >= env.failoverOfflineSec()));
  // Nhiều máy cùng im → nghi lỗi PHÍA HỆ THỐNG, không chuyển hàng loạt.
  const deadCount = machines.filter((m) => !m.forceOffline && dead(m) && streams.some((s) => s.machineId === m.id && shouldBeLive(s, nowMs))).length;
  if (deadCount >= 2) return { moved: 0, skipped: `${deadCount} máy cùng im — nghi lỗi phía hệ thống, không tự chuyển` };

  let moved = 0;
  const planned = [...streams];
  for (const s of streams) {
    if (!isAutoProtected(s) || !shouldBeLive(s, nowMs) || s.moveState || s.ytIssue) continue;
    if (s.cooldownUntil && Date.parse(s.cooldownUntil) > nowMs) continue;
    if (!dead(byId.get(s.machineId))) continue;
    const cand = moveCandidates(s, machines, planned, assets, nowMs).find((c) => c.ok);
    if (!cand) continue;
    const targetIds = remapAssetIds(s, cand.machineId, assets)!;
    const exec = await db.collection(COL.moves).add({
      streamId: s.id, streamName: s.name, moveType: "automatic_failover", sourceMachineId: s.machineId,
      targetMachineId: cand.machineId, startedAt: nowISO(), state: "starting_target", initiatedBy: "system",
    });
    await db.collection(COL.streams).doc(s.id).set({
      machineId: cand.machineId, assetIds: targetIds, assetId: targetIds[0], fencingToken: (Number(s.fencingToken) || 0) + 1,
      moveState: "starting_target", moveSourceId: s.machineId, moveTargetId: cand.machineId, moveType: "automatic_failover",
      movePrevAssetIds: streamAssetIds(s), moveExecId: exec.id, moveDeadlineAt: deadline(), updatedAt: nowISO(),
    }, { merge: true });
    await logIncident({
      streamId: s.id, streamName: s.name, machineId: s.machineId, streamOwner: s.createdBy ?? "", cause: "VPS gặp sự cố — tự động chuyển máy",
      reason: `chuyển sang ${cand.name}`, startedAt: byId.get(s.machineId)?.lastHeartbeatAt ?? nowISO(), resolution: "failover", resolvedBy: "system",
    });
    planned.push({ ...s, machineId: cand.machineId });
    moved++;
  }
  return { moved };
}

// ── Tiến trình bàn giao — gọi trên MỖI nhịp worker (máy nguồn lẫn máy đích) ──
/** Trả về id các live vừa CUTOVER khỏi máy này (không gửi xuống máy này nữa). */
export async function advanceMoves(machineId: string, reported: Record<string, string>, streams: Stream[]): Promise<Set<string>> {
  const movedAway = new Set<string>();
  const nowMs = Date.now();
  for (const s of streams) {
    if (!s.moveState || s.machineId !== machineId) continue;
    const overdue = !!s.moveDeadlineAt && nowMs > Date.parse(s.moveDeadlineAt);
    const st = reported[s.id];
    if (s.moveState === "stopping_source") {
      if (st === "live") { if (overdue) await rollback(s); continue; }
      // Nguồn đã dừng → giao quyền phát sang máy đích, đổi video sang bản trên máy đích.
      const tIds = s.moveTargetAssetIds ?? [];
      await db.collection(COL.streams).doc(s.id).set({
        machineId: s.moveTargetId, fencingToken: (Number(s.fencingToken) || 0) + 1, moveState: "starting_target",
        ...(tIds.length ? { assetIds: tIds, assetId: tIds[0] } : {}), updatedAt: nowISO(),
      }, { merge: true });
      if (s.moveExecId) await db.collection(COL.moves).doc(s.moveExecId).set({ sourceStoppedAt: nowISO(), state: "starting_target" }, { merge: true });
      movedAway.add(s.id);
    } else if (s.moveState === "starting_target") {
      if (st === "live") await db.collection(COL.streams).doc(s.id).set({ moveState: "verifying", moveVerifyAt: nowISO(), updatedAt: nowISO() }, { merge: true });
      else if (overdue) await rollback(s);
    } else if (s.moveState === "verifying") {
      if (st === "live" && nowMs - (Date.parse(s.moveVerifyAt ?? "") || 0) > VERIFY_GRACE_SEC * 1000) await finish(s);
      else if (st !== "live" && overdue) await rollback(s);
    }
  }
  return movedAway;
}

async function finish(s: Stream) {
  await db.collection(COL.streams).doc(s.id).set({ ...CLEAR_MOVE, updatedAt: nowISO() }, { merge: true });
  if (s.moveExecId) await db.collection(COL.moves).doc(s.moveExecId).set({ completedAt: nowISO(), state: "done", result: "success" }, { merge: true });
}

async function rollback(s: Stream) {
  if (s.moveType === "automatic_failover") {
    // Nguồn đã chết: không quay về; giữ máy đích tự thử tiếp, chặn tự cứu lại 10 phút.
    await db.collection(COL.streams).doc(s.id).set({ ...CLEAR_MOVE, cooldownUntil: new Date(Date.now() + 600_000).toISOString(), updatedAt: nowISO() }, { merge: true });
    if (s.moveExecId) await db.collection(COL.moves).doc(s.moveExecId).set({ completedAt: nowISO(), state: "failed", result: "failover_failed" }, { merge: true });
    return;
  }
  const prev = s.movePrevAssetIds ?? [];
  await db.collection(COL.streams).doc(s.id).set({
    machineId: s.moveSourceId ?? s.machineId, ...(prev.length ? { assetIds: prev, assetId: prev[0] } : {}), ...CLEAR_MOVE, updatedAt: nowISO(),
  }, { merge: true });
  if (s.moveExecId) await db.collection(COL.moves).doc(s.moveExecId).set({ completedAt: nowISO(), state: "failed", result: "rolled_back" }, { merge: true });
}
