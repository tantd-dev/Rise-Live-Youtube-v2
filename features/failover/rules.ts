// Chuyển máy / tự cứu: chọn máy đích + ánh xạ video sang bản trên máy đích. THUẦN.
import type { Asset } from "@/features/assets/types";
import { findPreset, streamMbps, SAFETY_FACTOR } from "@/features/assets/presets";
import type { Machine } from "@/features/machines/types";
import { isOnline } from "@/features/machines/rules";
import { shouldBeLive, streamAssetIds } from "@/features/streams/rules";
import type { Stream } from "@/features/streams/types";

/** Hạn bàn giao: quá hạn mà máy đích chưa lên sóng → hoàn tác (chuyển tay) / thôi (khẩn cấp). */
export const MOVE_TIMEOUT_SEC = 180;
/** Máy đích báo live rồi thì chờ thêm bấy nhiêu giây (ổn định) mới chốt xong. */
export const VERIFY_GRACE_SEC = 20;

/** "Danh tính" video không phụ thuộc máy: link Drive, hoặc id bản gốc (lần theo chuỗi sao chép). */
export function videoKey(a: Asset, byId: Map<string, Asset>): string {
  if (a.sourceUrl) return "url:" + a.sourceUrl;
  let cur = a;
  for (let i = 0; i < 6 && cur.copyFromAssetId && byId.has(cur.copyFromAssetId); i++) cur = byId.get(cur.copyFromAssetId)!;
  if (cur.sourceUrl) return "url:" + cur.sourceUrl;
  return "id:" + (cur.copyFromAssetId || cur.id);
}

/** Id các video tương ứng trên máy đích (đủ & sẵn sàng), hoặc null nếu máy đích còn thiếu. */
export function remapAssetIds(stream: Stream, targetId: string, assets: Asset[]): string[] | null {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const onTarget = assets.filter((a) => a.machineId === targetId && a.status === "ready");
  const out: string[] = [];
  for (const id of streamAssetIds(stream)) {
    const src = byId.get(id);
    if (!src) return null;
    const k = videoKey(src, byId);
    const hit = onTarget.find((a) => videoKey(a, byId) === k);
    if (!hit) return null;
    out.push(hit.id);
  }
  return out.length ? out : null;
}

export interface MoveCandidate {
  machineId: string;
  name: string;
  ok: boolean;
  hasVideo: boolean;
  reasons: string[];     // vì sao KHÔNG chọn được
  freeMbps: number | null;
}

/** Chấm các máy đích khả dĩ cho 1 live (đã sắp: hợp lệ + còn nhiều băng thông lên đầu). */
export function moveCandidates(stream: Stream, machines: Machine[], streams: Stream[], assets: Asset[], nowMs = Date.now()): MoveCandidate[] {
  const per = streamMbps(findPreset(stream.presetId));
  return machines.filter((m) => m.id !== stream.machineId).map((m) => {
    const reasons: string[] = [];
    if (!isOnline(m, nowMs)) reasons.push("máy đang ngoại tuyến");
    if (m.maintenance) reasons.push("đang bảo trì");
    const hasVideo = !!remapAssetIds(stream, m.id, assets);
    if (!hasVideo) reasons.push("chưa có video sẵn sàng");
    const up = Number(m.uploadMbps) || 0;
    let freeMbps: number | null = null;
    if (up > 0) {
      const used = m.txMbps != null ? Number(m.txMbps) : streams.filter((s) => s.machineId === m.id && shouldBeLive(s, nowMs)).length * per;
      freeMbps = Math.round(up * SAFETY_FACTOR - used);
      if (per > 0 && freeMbps < per && !findPreset(stream.presetId)?.keepOriginal) reasons.push("hết băng thông an toàn");
    }
    return { machineId: m.id, name: m.name, ok: reasons.length === 0, hasVideo, reasons, freeMbps };
  }).sort((a, b) => Number(b.ok) - Number(a.ok) || (b.freeMbps ?? 0) - (a.freeMbps ?? 0));
}
