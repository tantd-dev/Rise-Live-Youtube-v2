// Xử lý 1 nhịp hỏi/đáp của worker:
//   1. ghi nhịp tim + cấu hình máy   2. ghi trạng thái video/luồng worker báo
//   3. ghi sự cố tự phục hồi + đăng ký video tải thẳng   4. đẩy tiến trình chuyển máy
//   5. trả DANH SÁCH MONG MUỐN (video cần có, luồng cần phát) cho đúng máy đó.
// Dùng update() (không set-merge) cho video/luồng: bản ghi vừa bị xóa thì báo trễ không tạo lại "bản ma".
import { db, COL, nowISO } from "@/lib/server/firestore";
import { HttpError } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { verifyWorkerToken } from "@/features/machines/server/worker-token";
import type { Machine } from "@/features/machines/types";
import type { Asset } from "@/features/assets/types";
import { driveFileId } from "@/features/assets/drive-link";
import { findPreset, presetForWorker } from "@/features/assets/presets";
import type { Stream, StreamIncident } from "@/features/streams/types";
import { currentWindowStartMs, isWithinSchedule } from "@/features/streams/schedule";
import { isAutoProtected, shouldBeLive } from "@/features/streams/rules";
import { redactKeys } from "@/features/streams/stream-key";
import { advanceMoves } from "@/features/failover/server/service";
import {
  POLL_FAST_SEC, POLL_FAST_WINDOW_MS, POLL_SLOW_SEC,
  type AgentRequest, type AgentResponse, type DesiredAsset, type DesiredStream,
} from "../protocol";

const NUM_FIELDS = ["vcpu", "ramGb", "diskGb", "uploadMbps", "loadAvg", "diskFreeGb", "txMbps"] as const;
const finite = (v: unknown) => v != null && Number.isFinite(Number(v));

export async function handleAgentSync(body: AgentRequest, token: string): Promise<AgentResponse> {
  if (!env.liveEnabled()) throw new HttpError(503, "AB Live đang tắt (RISE_WORK_LIVE).");
  if (!env.workerToken()) throw new HttpError(503, "Worker chưa cấu hình (thiếu RISE_LIVE_WORKER_TOKEN).");
  const machineId = String(body.machineId ?? "");
  if (!machineId) throw new HttpError(400, "Thiếu machineId.");
  if (!verifyWorkerToken(machineId, token)) throw new HttpError(401, "Token không hợp lệ.");
  const mRef = db.collection(COL.machines).doc(machineId);
  const mDoc = await mRef.get();
  if (!mDoc.exists) throw new HttpError(404, "Máy chưa đăng ký.");
  const machine = { id: machineId, ...mDoc.data() } as Machine;

  // 1) Nhịp tim + cấu hình máy tự báo. Băng thông đặt tay thì worker không ghi đè.
  const hb = body.heartbeat ?? {};
  const mPatch: Record<string, unknown> = { lastHeartbeatAt: nowISO(), status: "online", agentVersion: String(body.agentVersion ?? "") };
  for (const k of NUM_FIELDS) {
    if (k === "uploadMbps" && machine.uploadMbpsManual) continue;
    if (finite(hb[k])) mPatch[k] = Number(hb[k]);
  }
  if (hb.ytdlpVersion != null) mPatch.ytdlpVersion = String(hb.ytdlpVersion).slice(0, 40);
  if (hb.gdownOk != null) mPatch.gdownOk = !!hb.gdownOk;
  if (hb.toolError != null) mPatch.toolError = String(hb.toolError).slice(0, 300);

  // Đọc video + luồng của máy MỘT lần cho cả nhịp.
  const [aSnap, sSnap] = await Promise.all([
    db.collection(COL.assets).where("machineId", "==", machineId).limit(1000).get(),
    db.collection(COL.streams).where("machineId", "==", machineId).limit(1000).get(),
  ]);
  const assets = new Map(aSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Asset]));
  const streams = new Map(sSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Stream]));

  await applyAssetReports(body, assets);
  await applyStreamReports(body, streams, machineId);
  const justUploaded = await registerUploads(body, machineId, assets);
  checkMissingAssets(body, assets, justUploaded, machine, mPatch);
  await mRef.set(mPatch, { merge: true });

  // 4) Chuyển máy: luồng vừa cutover khỏi máy này thì thôi gửi xuống.
  const reported: Record<string, string> = {};
  for (const r of body.streams ?? []) if (r?.id) reported[String(r.id)] = String(r.status ?? "");
  const movedAway = await advanceMoves(machineId, reported, [...streams.values()]);

  // 5) Danh sách mong muốn.
  const nowMs = Date.now();
  const desiredAssets: DesiredAsset[] = [...assets.values()].map((a) => ({
    id: a.id, status: String(a.status ?? "pending"), driveFileId: driveFileId(a.sourceUrl),
    copyFrom: a.copyFromUrl ? { url: a.copyFromUrl, assetId: String(a.copyFromAssetId ?? ""), optional: a.copyOptional === true } : null,
    preset: presetForWorker(findPreset(a.presetId)),
  }));
  const desiredStreams: DesiredStream[] = [...streams.values()].filter((s) => !movedAway.has(s.id)).map((s) => ({
    id: s.id, assetId: String(s.assetId ?? ""), assetIds: (s.assetIds ?? []).map(String),
    playMode: s.playMode === "random" ? "random" : "sequence",
    desiredState: desiredStateFor(s, machine, nowMs),
    mode: String(s.mode ?? "stream-247"), rtmpBase: String(s.rtmpBase || env.rtmpBase()), streamKey: String(s.streamKey ?? ""),
    leaseEnabled: env.leaseOn() && isAutoProtected(s),
  }));

  const recent = (iso?: string) => { const t = Date.parse(String(iso ?? "")); return Number.isFinite(t) && nowMs - t <= POLL_FAST_WINDOW_MS; };
  const busy = [...streams.values()].some((s) => recent(s.updatedAt)) || [...assets.values()].some((a) => recent(a.createdAt));
  return {
    ok: true, machineId, assets: desiredAssets, streams: desiredStreams,
    pollSeconds: busy ? POLL_FAST_SEC : POLL_SLOW_SEC, leaseGraceSec: env.leaseGraceSec(), thumbPushSec: env.thumbPushSec(),
  };
}

/** Máy bị ngắt / YouTube chặn / đang dừng nguồn để chuyển máy → dừng; còn lại theo lịch hoặc nút bấm. */
function desiredStateFor(s: Stream, machine: Machine, nowMs: number): "live" | "stopped" {
  if (machine.forceOffline || s.ytIssue) return "stopped";
  if (s.moveState === "stopping_source") return "stopped";
  if (s.control === "schedule") return isWithinSchedule(s.schedule, nowMs) ? "live" : "stopped";
  return s.desiredState === "live" ? "live" : "stopped";
}

// 2a) Video: chỉ ghi khi THẬT SỰ đổi (worker báo lại toàn bộ mỗi nhịp).
async function applyAssetReports(body: AgentRequest, assets: Map<string, Asset>) {
  for (const a of body.assets ?? []) {
    const id = String(a.id ?? "");
    const cur = assets.get(id);
    if (!id || !cur) continue;
    const next: Record<string, unknown> = {};
    if (a.status) next.status = String(a.status);
    for (const k of ["sizeMb", "durationSec", "width", "height", "dlMbPerMin"] as const) if (a[k] != null) next[k] = Number(a[k]) || 0;
    if (a.error != null) next.error = String(a.error).slice(0, 300);
    if (a.progressPct != null) next.progressPct = Math.max(0, Math.min(100, Number(a.progressPct) || 0));
    for (const k of ["downloadedMb", "totalMb", "queueAhead"] as const) if (a[k] != null) next[k] = Number(a[k]) || 0;
    if (next.status === "ready" || next.status === "error") Object.assign(next, { progressPct: null, downloadedMb: null, totalMb: null, queueAhead: null });
    if (next.status === "ready") next.error = null;
    const curRec = cur as unknown as Record<string, unknown>;
    if (Object.keys(next).every((k) => (curRec[k] ?? null) === (next[k] ?? null))) continue;
    await db.collection(COL.assets).doc(id).update({ ...next, updatedAt: nowISO() }).catch(() => undefined);
    assets.set(id, { ...cur, ...next } as Asset);
  }
}

// 2b) Luồng: trạng thái + mốc "live từ" + cờ tụt tốc độ / màn đen kéo dài + sự cố tự phục hồi.
async function applyStreamReports(body: AgentRequest, streams: Map<string, Stream>, machineId: string) {
  const nowMs = Date.now();
  const incidents = new Map<string, StreamIncident[]>();
  for (const ev of body.incidents ?? []) {
    const sid = String(ev.streamId ?? "");
    if (!sid) continue;
    const list = incidents.get(sid) ?? [];
    list.push({ kind: String(ev.kind ?? "restart"), at: String(ev.at ?? nowISO()), downSec: Math.max(0, Number(ev.downSec) || 0), reason: redactKeys(ev.reason).slice(0, 200), machineId });
    incidents.set(sid, list);
  }
  for (const r of body.streams ?? []) {
    const id = String(r.id ?? "");
    const cur = streams.get(id);
    if (!id || !cur) continue;
    const up: Record<string, unknown> = {
      lastHeartbeatAt: nowISO(),
      bitrateKbps: finite(r.bitrateKbps) ? Number(r.bitrateKbps) : null,
      speed: finite(r.speed) ? Number(r.speed) : null,
      restartHalted: r.restartHalted === true,
      needsHuman: r.needsHuman === true,
      haltReason: r.haltReason != null ? redactKeys(r.haltReason).slice(0, 200) : null,
      black: r.black === true,
    };
    if (r.status) up.status = String(r.status);
    if (r.health) up.health = String(r.health);
    if (r.restarts != null) up.restarts = Number(r.restarts) || 0;
    if (r.uptimeSec != null) up.uptimeSec = Math.max(0, Number(r.uptimeSec) || 0);
    if (r.error != null) up.error = redactKeys(r.error).slice(0, 300);

    if (r.status === "live") {
      // "Live từ": hẹn giờ = đầu khung giờ hiện tại; thủ công = lần đầu lên sóng (không reset khi tự bật lại).
      if (cur.control === "schedule" && cur.schedule) {
        const w = currentWindowStartMs(cur.schedule, nowMs);
        const iso = w != null ? new Date(w).toISOString() : cur.liveSince || nowISO();
        if (cur.liveSince !== iso) up.liveSince = iso;
      } else if (!cur.liveSince) up.liveSince = nowISO();
      const want = shouldBeLive(cur, nowMs);
      // Tụt tốc độ: speed < 0.92× liên tục ≥ 90s.
      if (want && up.speed != null && Number(up.speed) < 0.92) {
        const since = cur.slowSince || nowISO();
        up.slowSince = since;
        up.slow = nowMs - Date.parse(since) > 90_000;
      } else { up.slow = false; up.slowSince = null; }
      // Màn đen: worker báo đen ≥ 60s; máy chủ đếm thêm → cảnh báo khi đen ~3 phút.
      if (want && r.black === true && !cur.allowBlack) up.blackSince = cur.blackSince || nowISO();
      else if (r.black !== true) up.blackSince = null;
    }
    const evs = incidents.get(id);
    if (evs?.length) {
      up.recentIncidents = [...evs, ...(cur.recentIncidents ?? [])].slice(0, 10);
      up.incidentCount = (Number(cur.incidentCount) || 0) + evs.length;
      incidents.delete(id);
    }
    await db.collection(COL.streams).doc(id).update(up).catch(() => undefined);
    streams.set(id, { ...cur, ...up } as Stream);
  }
  // Sự cố của luồng không có trong báo cáo trạng thái nhịp này.
  for (const [sid, evs] of incidents) {
    const cur = streams.get(sid);
    if (!cur) continue;
    await db.collection(COL.streams).doc(sid).update({
      recentIncidents: [...evs, ...(cur.recentIncidents ?? [])].slice(0, 10),
      incidentCount: (Number(cur.incidentCount) || 0) + evs.length,
    }).catch(() => undefined);
  }
}

// 3) Video tải thẳng lên máy → tạo bản ghi "sẵn sàng" và đưa NGAY vào danh sách trả về
//    (thiếu là worker tưởng video đã bị xóa và dọn mất file vừa nhận).
async function registerUploads(body: AgentRequest, machineId: string, assets: Map<string, Asset>): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const u of body.uploaded ?? []) {
    const id = String(u.id ?? "");
    if (!id) continue;
    const rec: Omit<Asset, "id"> = {
      name: String(u.name || "Video tải lên").slice(0, 120), presetId: String(u.presetId || "livepreset:original"),
      machineId, status: "ready", source: "upload", createdBy: String(u.uploaderEmail ?? "").toLowerCase(),
      sizeMb: Number(u.sizeMb) || 0, width: Number(u.width) || 0, height: Number(u.height) || 0, durationSec: Number(u.durationSec) || 0,
      createdAt: nowISO(),
    };
    await db.collection(COL.assets).doc(id).set(rec, { merge: true });
    assets.set(id, { id, ...rec });
    ids.add(id);
  }
  return ids;
}

// 3c) Đối chiếu: sổ ghi video "sẵn sàng" mà worker không giữ → ghi lại để cảnh báo (nếu lệch kéo dài).
function checkMissingAssets(body: AgentRequest, assets: Map<string, Asset>, justUploaded: Set<string>, machine: Machine, mPatch: Record<string, unknown>) {
  const held = new Set((body.assets ?? []).map((a) => String(a.id ?? "")));
  const missing = [...assets.values()].filter((a) => a.status === "ready" && !held.has(a.id) && !justUploaded.has(a.id)).map((a) => a.id);
  const prev = machine.assetMissing ?? [];
  const same = missing.length === prev.length && missing.every((x) => prev.includes(x));
  if (same && machine.assetMissing !== undefined) return;
  mPatch.assetMissing = missing.slice(0, 50);
  mPatch.assetMissingSince = missing.length ? (prev.length ? machine.assetMissingSince ?? nowISO() : nowISO()) : null;
}
