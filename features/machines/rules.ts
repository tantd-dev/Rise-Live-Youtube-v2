// Quy tắc về máy: online, sức chứa băng thông, chặn nhận video. THUẦN.
import { SAFETY_FACTOR, streamMbps, type QualityPreset } from "@/features/assets/presets";
import type { Machine } from "./types";

/** Không thấy nhịp tim quá 60 giây → coi là mất liên lạc. */
export const MACHINE_ONLINE_MS = 60_000;

export function isOnline(m: Pick<Machine, "lastHeartbeatAt" | "forceOffline">, nowMs = Date.now()): boolean {
  const t = Date.parse(String(m.lastHeartbeatAt ?? ""));
  return Number.isFinite(t) && nowMs - t < MACHINE_ONLINE_MS && m.forceOffline !== true;
}

export const quietSec = (m: Pick<Machine, "lastHeartbeatAt">, nowMs = Date.now()) =>
  Math.max(0, Math.round((nowMs - (Date.parse(String(m.lastHeartbeatAt ?? "")) || nowMs)) / 1000));

/** Lên sóng thêm 1 luồng có vượt 70% băng thông máy không? Trả câu lỗi hoặc null. Thiếu dữ kiện → cho qua. */
export function capacityBlock(m: Machine, preset: QualityPreset | null, liveCount: number): string | null {
  const up = Number(m.uploadMbps) || 0;
  const per = streamMbps(preset);
  if (up <= 0 || per <= 0 || preset?.keepOriginal) return null;
  const used = m.txMbps != null ? Number(m.txMbps) : liveCount * per;
  if (Math.floor((up * SAFETY_FACTOR - used) / per) > 0) return null;
  return `Máy "${m.name}" đã đầy băng thông an toàn (~${up} Mbps, chừa 30% dự phòng). Chọn máy khác hoặc dừng bớt luồng.`;
}

/** Máy đầy băng thông / sắp hết ổ → không nhận video mới. Bản sao lưu chỉ bị chặn theo ổ cứng. */
export function intakeBlock(m: Machine, minFreeGb: number, opts: { backupOnly?: boolean } = {}): string | null {
  if (!opts.backupOnly) {
    const up = Number(m.uploadMbps) || 0, tx = Number(m.txMbps);
    if (up > 0 && Number.isFinite(tx) && tx <= up * 1.05 && tx / up >= SAFETY_FACTOR)
      return `Máy "${m.name}" đã chạm ngưỡng ${Math.round(SAFETY_FACTOR * 100)}% băng thông (${Math.round(tx)}/${Math.round(up)} Mbps) — không nhận thêm video mới.`;
  }
  // const free = Number(m.diskFreeGb);
  // if (Number.isFinite(free) && m.diskFreeGb != null && free < minFreeGb)
  //   return `Máy "${m.name}" chỉ còn ${Math.round(free)} GB trống (tối thiểu ${minFreeGb} GB) — không nhận thêm video.`;
  // return null;
}

/** Số ngày tới hạn gia hạn thuê máy (âm = đã quá hạn). null nếu chưa nhập. */
export function daysToRenew(m: Pick<Machine, "costRenewAt">, nowMs = Date.now()): number | null {
  if (!m.costRenewAt) return null;
  const t = Date.parse(m.costRenewAt + "T00:00:00+07:00");
  return Number.isFinite(t) ? Math.ceil((t - nowMs) / 86_400_000) : null;
}
