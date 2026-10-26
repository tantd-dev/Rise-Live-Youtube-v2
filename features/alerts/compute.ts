// Cảnh báo suy ra từ trạng thái máy / luồng / video. THUẦN — dùng cho Tổng quan và email.
// Gom theo MÁY: máy mất liên lạc → 1 cảnh báo máy (nêu số luồng ảnh hưởng), không bắn rời từng luồng.
import type { Asset } from "@/features/assets/types";
import type { Machine } from "@/features/machines/types";
import { daysToRenew, isOnline, quietSec } from "@/features/machines/rules";
import { isPriority, shouldBeLive } from "@/features/streams/rules";
import type { Stream } from "@/features/streams/types";

export type AlertLevel = "critical" | "warn" | "info";

export interface Alert {
  level: AlertLevel;
  code: string;         // mã tra cứu (giữ họ mã RL-XXX của bản cũ)
  kind: string;
  text: string;
  fingerprint: string;  // khoá chống gửi trùng
  priority: boolean;    // liên quan luồng ưu tiên
  streamId?: string;
  machineId?: string;
}

const MACHINE_QUIET_SERIOUS_SEC = 180;
const BLACK_ALERT_MS = 120_000;        // + 60s worker tự đếm ≈ 3 phút đen
const ASSET_MISSING_ALERT_MS = 120_000;
const DISK_LOW_GB = 15;

export function computeAlerts(machines: Machine[], streams: Stream[], assets: Asset[], nowMs = Date.now()): Alert[] {
  const out: Alert[] = [];
  const add = (a: Omit<Alert, "fingerprint" | "priority"> & { id: string; priority?: boolean }) =>
    out.push({ ...a, fingerprint: `${a.kind}:${a.id}`, priority: !!a.priority });
  const wanting = (m: Machine) => streams.filter((s) => s.machineId === m.id && shouldBeLive(s, nowMs));

  // Nhiều máy cùng im = gần như chắc lỗi PHÍA HỆ THỐNG (mạng máy chủ), không phải từng VPS.
  const quiet = machines.filter((m) => !m.forceOffline && !m.maintenance && !isOnline(m, nowMs) && wanting(m).length > 0);
  if (quiet.length >= 2) {
    add({ level: "critical", code: "RL-NET-006", kind: "cluster_quiet", id: "cluster", priority: true,
      text: `Mất liên lạc với ${quiet.length}/${machines.length} máy cùng lúc (${quiet.map((m) => `"${m.name}"`).join(", ")}) — nghi lỗi phía HỆ THỐNG. Luồng đi thẳng VPS → YouTube nên có thể vẫn đang phát; kiểm trên YouTube trước.` });
  }

  for (const m of machines) {
    const live = wanting(m);
    if (!isOnline(m, nowMs) && live.length && !m.maintenance && !m.forceOffline && quiet.length < 2) {
      const sec = quietSec(m, nowMs);
      const prio = live.filter(isPriority).length;
      add({ level: sec >= MACHINE_QUIET_SERIOUS_SEC ? "critical" : "warn", code: "RL-NET-003", kind: "machine_offline", id: m.id, machineId: m.id, priority: prio > 0,
        text: `Máy "${m.name}" mất liên lạc ${sec < 120 ? sec + " giây" : Math.round(sec / 60) + " phút"} — ${live.length} luồng đặt phát trên máy này${prio ? ` (⭐ ${prio} ưu tiên)` : ""}. Luồng có thể vẫn phát (VPS → YouTube); kiểm worker / VPS.` });
    }
    if (m.forceOffline && live.length) {
      add({ level: "warn", code: "RL-OPS-001", kind: "machine_forced_off", id: m.id, machineId: m.id,
        text: `Máy "${m.name}" đang bị NGẮT — ${live.length} luồng trên máy đang dừng. Bấm "Bật lại máy" khi xong.` });
    }
    if (isOnline(m, nowMs) && m.diskFreeGb != null && m.diskFreeGb < DISK_LOW_GB) {
      add({ level: "warn", code: "RL-RES-002", kind: "disk_low", id: m.id, machineId: m.id,
        text: `Máy "${m.name}" chỉ còn ${Math.round(m.diskFreeGb)} GB trống — worker sẽ chặn tải video mới. Xoá bớt video không dùng.` });
    }
    if (isOnline(m, nowMs) && m.toolError) {
      add({ level: "warn", code: "RL-RES-005", kind: "tool_error", id: m.id, machineId: m.id, text: `Máy "${m.name}": ${m.toolError}` });
    }
    const missing = m.assetMissing ?? [];
    if (missing.length && m.assetMissingSince && nowMs - Date.parse(m.assetMissingSince) > ASSET_MISSING_ALERT_MS) {
      add({ level: "warn", code: "RL-AST-004", kind: "asset_missing", id: m.id, machineId: m.id,
        text: `Máy "${m.name}": ${missing.length} video sổ ghi "sẵn sàng" nhưng worker không còn giữ file — luồng dùng chúng sẽ không chạy. Tải lại / sao chép lại video.` });
    }
    const days = daysToRenew(m, nowMs);
    if (days != null && days <= 5) {
      add({ level: days <= 1 ? "critical" : "warn", code: "RL-OPS-002", kind: "renew_due", id: m.id, machineId: m.id,
        text: days < 0 ? `Máy "${m.name}" đã QUÁ HẠN thuê ${-days} ngày — gia hạn ngay kẻo mất cả máy.` : `Máy "${m.name}" hết hạn thuê sau ${days} ngày (${m.costRenewAt}) — nhớ gia hạn.` });
    }
  }

  const machineById = new Map(machines.map((m) => [m.id, m]));
  for (const s of streams) {
    if (!shouldBeLive(s, nowMs)) continue;
    const m = machineById.get(s.machineId);
    if (!m || !isOnline(m, nowMs)) continue;   // đã có cảnh báo cấp máy
    const base = { id: s.id, streamId: s.id, machineId: s.machineId, priority: isPriority(s) };
    if (s.ytIssue) add({ ...base, level: "critical", code: "RL-YTB-006", kind: "yt_issue", text: `Luồng "${s.name}" bị gắn cờ YouTube chặn/đình chỉ${s.ytIssue.note ? ` — ${s.ytIssue.note}` : ""}. Worker đã dừng đẩy; kiểm YouTube Studio rồi bấm Lên sóng lại.` });
    else if (s.needsHuman) add({ ...base, level: "critical", code: "RL-PRC-005", kind: "stream_source_error", text: `Luồng "${s.name}" DỪNG vì lỗi nguồn/file video${s.haltReason ? ` (${s.haltReason})` : ""} — tải lại video hoặc đổi video rồi bật lại.` });
    else if (s.restartHalted) add({ ...base, level: "warn", code: "RL-PRC-003", kind: "stream_flapping", text: `Luồng "${s.name}" chớp tắt liên tục — đang tạm ngừng, sẽ tự thử lại${s.haltReason ? ` (lý do: ${s.haltReason})` : ""}. Nếu lặp lại, kiểm khoá luồng / mạng VPS.` });
    else if (s.health === "error" || s.status === "error") add({ ...base, level: "critical", code: "RL-PRC-001", kind: "stream_error", text: `Luồng "${s.name}" đang lỗi${s.error ? `: ${s.error}` : ""} — worker đang tự bật lại.` });
    if (s.slow) add({ ...base, level: "warn", code: "RL-NET-004", kind: "stream_slow", text: `Luồng "${s.name}" đang TỤT tốc độ (${s.speed ?? "?"}×) — nghi nghẽn băng thông/CPU, người xem có thể bị giật.` });
    if (s.blackSince && !s.allowBlack && nowMs - Date.parse(s.blackSince) >= BLACK_ALERT_MS)
      add({ ...base, level: "warn", code: "RL-VID-002", kind: "stream_black", text: `Luồng "${s.name}" MÀN ĐEN kéo dài — kiểm video. Nếu nền tối là chủ ý, bấm "Nền đen chủ ý" ở luồng.` });
    if (s.yt && s.yt.found === false && s.watchUrl) add({ ...base, level: "warn", code: "RL-YTB-002", kind: "yt_not_found", text: `Luồng "${s.name}": link xem trên YouTube không còn tồn tại / không công khai — kiểm lại buổi live (có thể đã bị gỡ).` });
    else if (s.yt?.actualEndTime) add({ ...base, level: "warn", code: "RL-YTB-003", kind: "yt_ended", text: `Luồng "${s.name}": YouTube báo buổi live đã KẾT THÚC lúc ${new Date(s.yt.actualEndTime).toLocaleString("vi-VN")} — cập nhật link xem mới nếu YouTube đã tạo buổi khác.` });
  }

  for (const a of assets) {
    if (a.status === "error") add({ level: "info", code: "RL-AST-001", kind: "asset_error", id: a.id, text: `Video "${a.name}" lỗi: ${a.error ?? "không rõ"}` });
  }

  const rank = { critical: 0, warn: 1, info: 2 } as const;
  return out.sort((x, y) => rank[x.level] - rank[y.level] || Number(y.priority) - Number(x.priority));
}

/** Loại cảnh báo đáng gửi email (giữ ít để khỏi spam). */
export const EMAIL_KINDS = new Set(["machine_offline", "cluster_quiet", "stream_error", "stream_source_error", "yt_issue", "renew_due"]);
