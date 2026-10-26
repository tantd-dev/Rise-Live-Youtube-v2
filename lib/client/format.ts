// Định dạng hiển thị (giờ VN).
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

export function fmtAgo(iso: string | null | undefined, nowMs = Date.now()): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "chưa có";
  const s = Math.max(0, Math.round((nowMs - t) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}

export function fmtDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} ngày ${h % 24} giờ`;
  if (h) return `${h} giờ ${m} phút`;
  if (m) return `${m} phút`;
  return `${s} giây`;
}

export const fmtMb = (mb: number | null | undefined) => (mb == null ? "—" : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);
