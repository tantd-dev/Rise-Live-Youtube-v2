// Phiên live: tạo / sửa / bật / dừng / xóa + các thao tác phụ. Worker đọc desiredState để khớp theo.
import { db, COL, nowISO, readOne } from "@/lib/server/firestore";
import { bad, notFound, str } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { audit } from "@/lib/server/audit";
import { capacityBlock, isOnline } from "@/features/machines/rules";
import type { Machine } from "@/features/machines/types";
import type { Asset } from "@/features/assets/types";
import { findPreset } from "@/features/assets/presets";
import { checkWatchUrl } from "@/features/youtube/types";
import type { SessionUser } from "@/features/users/types";
import { checkStreamKey, maskKey } from "../stream-key";
import { schedulesOverlap, type Schedule } from "../schedule";
import { isPriority, shouldBeLive, streamAssetIds } from "../rules";
import type { FailoverMode, Importance, Stream, StreamMode } from "../types";
import { logIncident } from "@/features/incidents/server/service";

export interface StreamInput {
  name?: string; machineId?: string; streamKey?: string; mode?: string; assetIds?: string[]; playMode?: string;
  control?: string; scheduleStart?: string; scheduleDurationMin?: number | string; scheduleRepeat?: string;
  watchUrl?: string; allowBlack?: boolean; importance?: string; failoverMode?: string;
}

async function getStream(id: string): Promise<Stream> {
  const s = await readOne<Stream>(COL.streams, id);
  if (!s) throw notFound("live không tồn tại.");
  return s;
}

/** Kiểm + chuẩn hóa dữ liệu form tạo/sửa live. */
async function validate(b: StreamInput, excludeId: string | null) {
  const name = str(b.name, 120), machineId = str(b.machineId, 80), streamKey = str(b.streamKey, 200);
  const mode: StreamMode = b.mode === "live-pub" ? "live-pub" : "stream-247";
  if (!name) throw bad("Thiếu tên live.");
  if (!machineId) throw bad("Chọn VPS.");
  const key = checkStreamKey(streamKey);
  if (!key.ok) throw bad(key.error);
  const watch = checkWatchUrl(b.watchUrl);
  if (!watch.ok) throw bad(watch.error);

  const machine = await readOne<Machine>(COL.machines, machineId);
  if (!machine) throw bad("Máy không tồn tại.");

  // Danh sách phát: mọi video phải SẴN SÀNG và nằm trên ĐÚNG máy đã chọn (worker phát file cục bộ).
  const ids = Array.from(new Set((b.assetIds ?? []).map(String).filter(Boolean)));
  if (!ids.length) throw bad("Chưa chọn video.");
  const assets = await Promise.all(ids.map((id) => readOne<Asset>(COL.assets, id)));
  for (const a of assets) {
    if (!a) throw bad("Có video không tồn tại.");
    if (a.status !== "ready") throw bad(`Video "${a.name}" chưa sẵn sàng.`);
    if (a.machineId !== machineId) throw bad(`Video "${a.name}" không nằm trên máy "${machine.name}". Sao chép video sang máy đó trước.`);
  }

  const control = b.control === "schedule" ? "schedule" : "manual";
  let schedule: Schedule | null = null;
  if (control === "schedule") {
    const start = str(b.scheduleStart, 40);
    if (!start) throw bad("Lịch phát chưa có thời điểm bắt đầu.");
    if (mode === "live-pub") {
      const durationMin = Math.round(Number(b.scheduleDurationMin) || 0);
      if (durationMin <= 0) throw bad("Live Pub hẹn giờ cần nhập thời lượng (phút).");
      schedule = { start, durationMin, repeat: b.scheduleRepeat === "daily" ? "daily" : "none" };
    } else {
      schedule = { start, durationMin: 0, repeat: "none" };
    }
  }

  // Trùng khóa live với live khác đang phát / lịch chồng giờ → YouTube không nhận 2 nguồn 1 khóa.
  const sameKey = await db.collection(COL.streams).where("streamKey", "==", streamKey).get();
  for (const d of sameKey.docs) {
    if (d.id === excludeId) continue;
    const o = d.data() as Stream;
    if (shouldBeLive(o)) throw bad(`Khóa live này ĐANG được live "${o.name}" dùng. Đổi khóa hoặc dừng live kia trước.`);
    if (control === "schedule" && o.control === "schedule" && schedulesOverlap(schedule, o.schedule))
      throw bad(`Khóa live này trùng live "${o.name}" và hai lịch chồng giờ.`);
  }

  const importance: Importance = ["priority", "critical"].includes(String(b.importance)) ? (b.importance as Importance) : "normal";
  let failoverMode: FailoverMode = ["manual", "automatic"].includes(String(b.failoverMode)) ? (b.failoverMode as FailoverMode) : "disabled";
  if (importance !== "normal") failoverMode = "automatic";   // live ưu tiên luôn được tự cứu

  return {
    machine, assets: assets as Asset[],
    data: {
      name, machineId, streamKey, mode, control, schedule, watchUrl: watch.url,
      assetIds: ids, assetId: ids[0], presetId: (assets[0] as Asset).presetId,
      playMode: b.playMode === "random" ? "random" : "sequence",
      allowBlack: b.allowBlack === true, importance, failoverMode,
      rtmpBase: env.rtmpBase(),
    } satisfies Partial<Stream>,
  };
}

async function liveCountOn(machineId: string, excludeId?: string): Promise<number> {
  const snap = await db.collection(COL.streams).where("machineId", "==", machineId).get();
  return snap.docs.filter((d) => d.id !== excludeId && shouldBeLive(d.data() as Stream)).length;
}

/** Kiểm trước khi lên sóng NGAY: máy online, không bảo trì, còn băng thông. */
async function preflightGoLive(machine: Machine, presetId: string, streamId?: string): Promise<string[]> {
  if (machine.maintenance) throw bad(`Máy "${machine.name}" đang BẢO TRÌ — không nhận live mới.`);
  if (!isOnline(machine)) throw bad(`Máy "${machine.name}" đang ngoại tuyến — chưa thể phát ngay. Hãy kiểm tra worker trên máy.`);
  const cap = capacityBlock(machine, findPreset(presetId), await liveCountOn(machine.id, streamId));
  if (cap) throw bad(cap);
  return machine.uploadMbps ? [] : [`Chưa biết băng thông máy "${machine.name}" — không ước tính được máy còn nhận thêm bao nhiêu live.`];
}

export async function createStream(b: StreamInput, user: SessionUser) {
  const { machine, data } = await validate(b, null);
  const warnings = data.control === "manual" ? await preflightGoLive(machine, data.presetId) : [];
  if (data.control === "schedule" && machine.maintenance) throw bad(`Máy "${machine.name}" đang BẢO TRÌ.`);
  const ref = await db.collection(COL.streams).add({
    ...data,
    desiredState: data.control === "schedule" ? "stopped" : "live",
    status: "queued", health: "unknown", restarts: 0,
    createdAt: nowISO(), createdBy: user.email, createdByName: user.fullName,
  });
  await audit(user.email, "stream.create", ref.id, `${data.name} → ${maskKey(data.streamKey)}`);
  return { id: ref.id, warnings };
}

/** Sửa live — chỉ khi đã dừng (tránh đổi khóa/video/máy khi đang phát). */
export async function editStream(id: string, b: StreamInput, user: SessionUser) {
  const cur = await getStream(id);
  if (shouldBeLive(cur)) throw bad("live đang phát — hãy DỪNG trước khi sửa.");
  if (cur.moveState) throw bad("live đang chuyển máy — chờ xong rồi sửa.");
  const { data } = await validate({ ...b, streamKey: b.streamKey || cur.streamKey }, id);
  await db.collection(COL.streams).doc(id).set({ ...data, desiredState: "stopped", updatedAt: nowISO(), updatedBy: user.email }, { merge: true });
  await audit(user.email, "stream.edit", id, data.name);
}

/** Bật / dừng live. */
export async function setDesired(id: string, desired: "live" | "stopped", user: SessionUser) {
  const s = await getStream(id);
  const patch: Record<string, unknown> = { desiredState: desired, updatedAt: nowISO(), updatedBy: user.email };
  let warnings: string[] = [];
  if (desired === "live") {
    const machine = await readOne<Machine>(COL.machines, s.machineId);
    if (!machine) throw bad("Máy của live không còn tồn tại — sửa live chọn máy khác.");
    const assets = await Promise.all(streamAssetIds(s).map((a) => readOne<Asset>(COL.assets, a)));
    if (assets.some((a) => !a || a.status !== "ready")) throw bad("Có video của live chưa sẵn sàng hoặc đã bị xóa.");
    warnings = await preflightGoLive(machine, s.presetId, id);
    const sameKey = await db.collection(COL.streams).where("streamKey", "==", s.streamKey).get();
    const clash = sameKey.docs.find((d) => d.id !== id && shouldBeLive(d.data() as Stream));
    if (clash) throw bad(`Khóa live đang được live "${(clash.data() as Stream).name}" dùng.`);
    if (s.ytIssue) patch.ytIssue = null;   // người dùng đã kiểm tra YouTube → gỡ cờ để worker đẩy lại
  } else {
    // Dừng tay: xóa mốc "live từ"; live hẹn giờ về THỦ CÔNG để không tự bật lại theo lịch.
    Object.assign(patch, { liveSince: null, status: "stopped", health: "idle", ...(s.control === "schedule" ? { control: "manual" } : {}) });
    if (s.status === "error" || s.health === "error" || s.ytIssue || s.restartHalted || s.needsHuman) {
      await logIncident({
        streamId: id, streamName: s.name, machineId: s.machineId, streamOwner: s.createdBy ?? "",
        cause: s.ytIssue ? "YouTube chặn/đình chỉ" : s.needsHuman ? "Lỗi nguồn/file" : s.restartHalted ? "Chớp tắt — đã tạm dừng" : "live lỗi",
        reason: String(s.ytIssue?.note || s.haltReason || s.error || ""),
        startedAt: s.ytIssue?.at ?? s.lastHeartbeatAt ?? nowISO(), resolution: "stopped", resolvedBy: user.email,
      });
    }
  }
  await db.collection(COL.streams).doc(id).set(patch, { merge: true });
  await audit(user.email, "stream.set", id, desired);
  return { warnings };
}

export async function deleteStream(id: string, user: SessionUser) {
  const s = await getStream(id);
  if (shouldBeLive(s)) throw bad("live đang phát — hãy dừng trước khi xóa.");
  await db.collection(COL.streams).doc(id).delete();
  await audit(user.email, "stream.delete", id, s.name);
}

/** Đổi các thuộc tính an toàn cả khi đang phát (worker không đọc các trường này). */
export async function patchStream(id: string, b: { name?: string; watchUrl?: string; allowBlack?: boolean; importance?: string; failoverMode?: string }, user: SessionUser) {
  const s = await getStream(id);
  const up: Partial<Stream> = { updatedAt: nowISO() };
  if (b.name !== undefined) { const n = str(b.name, 120); if (!n) throw bad("Tên không được trống."); up.name = n; }
  if (b.watchUrl !== undefined) { const w = checkWatchUrl(b.watchUrl); if (!w.ok) throw bad(w.error); up.watchUrl = w.url; up.yt = null; }
  if (typeof b.allowBlack === "boolean") up.allowBlack = b.allowBlack;
  if (b.importance !== undefined && ["normal", "priority", "critical"].includes(b.importance)) up.importance = b.importance as Importance;
  if (b.failoverMode !== undefined && ["disabled", "manual", "automatic"].includes(b.failoverMode)) up.failoverMode = b.failoverMode as FailoverMode;
  if (isPriority({ importance: up.importance ?? s.importance })) up.failoverMode = "automatic";
  await db.collection(COL.streams).doc(id).set(up, { merge: true });
  await audit(user.email, "stream.patch", id, JSON.stringify(b).slice(0, 200));
}

export async function revealKey(id: string, user: SessionUser): Promise<string> {
  const s = await getStream(id);
  await audit(user.email, "stream.reveal_key", id, s.name);
  return s.streamKey;
}

/** Live Pub → Live 24/7 (phát liên tục, bỏ thời lượng lịch). An toàn cả khi đang phát. */
export async function convertTo247(id: string, user: SessionUser) {
  const s = await getStream(id);
  if (s.mode !== "live-pub") throw bad("live này đã là Live 24/7.");
  const up: Partial<Stream> = { mode: "stream-247", updatedAt: nowISO() };
  if (s.control === "schedule" && s.schedule) up.schedule = { ...s.schedule, durationMin: 0, repeat: "none" };
  await db.collection(COL.streams).doc(id).set(up, { merge: true });
  await audit(user.email, "stream.convert_247", id, s.name);
}

/** Gắn / gỡ cờ "YouTube chặn/đình chỉ". Có cờ → worker DỪNG đẩy cho tới khi bấm Lên sóng lại. */
export async function setYtIssue(id: string, flag: boolean, note: string, user: SessionUser) {
  const s = await getStream(id);
  if (flag) {
    await db.collection(COL.streams).doc(id).set({ ytIssue: { type: "policy", note: str(note, 300), source: "manual", by: user.email, at: nowISO() } }, { merge: true });
  } else {
    if (s.ytIssue) await logIncident({
      streamId: id, streamName: s.name, machineId: s.machineId, streamOwner: s.createdBy ?? "", cause: "YouTube chặn/đình chỉ",
      reason: s.ytIssue.note, startedAt: s.ytIssue.at, resolution: "cleared_yt_flag", resolvedBy: user.email,
    });
    await db.collection(COL.streams).doc(id).set({ ytIssue: null }, { merge: true });
  }
  await audit(user.email, flag ? "stream.flag_yt" : "stream.clear_yt", id, note);
}
