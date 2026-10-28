// Quy tắc về live. THUẦN.
import { isWithinSchedule } from "./schedule";
import type { Stream } from "./types";

/** live ĐÁNG LẼ đang phát: bật tay, hoặc hẹn giờ đang trong khung. */
export function shouldBeLive(s: Pick<Stream, "desiredState" | "control" | "schedule">, nowMs = Date.now()): boolean {
  return s.desiredState === "live" || (s.control === "schedule" && isWithinSchedule(s.schedule, nowMs));
}

export const isPriority = (s: Pick<Stream, "importance">) => s.importance === "priority" || s.importance === "critical";

/** live được TỰ CỨU (tự chuyển máy khi máy chết): automatic hoặc ưu tiên — trừ Live Pub. */
export function isAutoProtected(s: Pick<Stream, "mode" | "importance" | "failoverMode">): boolean {
  if (s.mode === "live-pub") return false;
  return s.failoverMode === "automatic" || isPriority(s);
}

export const streamAssetIds = (s: Pick<Stream, "assetIds" | "assetId">): string[] =>
  Array.isArray(s.assetIds) && s.assetIds.length ? s.assetIds.map(String) : s.assetId ? [String(s.assetId)] : [];

/** Trạng thái hiển thị gọn cho 1 live. */
export function streamBadge(s: Stream | (Omit<Stream, "streamKey"> & { shouldBeLive?: boolean }), machineOnline: boolean): { tone: "green" | "amber" | "red" | "gray" | "blue"; text: string } {
  const want = "shouldBeLive" in s && s.shouldBeLive != null ? s.shouldBeLive : shouldBeLive(s as Stream);
  if (s.moveState) return { tone: "blue", text: "Đang chuyển máy" };
  if (s.ytIssue) return { tone: "red", text: "Bị YouTube chặn" };
  if (s.needsHuman) return { tone: "red", text: "Đã dừng — lỗi nguồn video" };
  if (!want) return s.control === "schedule" ? { tone: "gray", text: "Chờ đến giờ" } : { tone: "gray", text: "Đã dừng" };
  if (!machineOnline) return { tone: "amber", text: "Máy mất liên lạc" };
  if (s.restartHalted) return { tone: "amber", text: "Tạm ngừng, sẽ tự thử lại" };
  if (s.status === "live") {
    if (s.black && !s.allowBlack) return { tone: "amber", text: "Màn hình đen" };
    if (s.slow) return { tone: "amber", text: "Phát chậm" };
    return { tone: "green", text: s.health === "good" ? "Đang phát" : "Đang khởi động" };
  }
  if (s.health === "error") return { tone: "red", text: "Lỗi — đang tự khởi động lại" };
  return { tone: "blue", text: "Chờ máy phát nhận lệnh" };
}
