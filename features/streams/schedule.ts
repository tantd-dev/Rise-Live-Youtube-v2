// Lịch phát (hẹn giờ). THUẦN — truyền nowMs để test được.
//  · Live 24/7 hẹn giờ: durationMin = 0 → phát LIÊN TỤC từ giờ bắt đầu.
//  · Live Pub: có thời lượng, lặp hằng ngày hoặc 1 lần.
export interface Schedule {
  start: string;              // "YYYY-MM-DDTHH:mm" (giờ VN nếu không có múi giờ)
  durationMin: number;
  repeat: "none" | "daily";
}

const DAY_MS = 86_400_000;

function startMs(start: string): number {
  const s = String(start ?? "");
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "+07:00");
  return Number.isFinite(t) ? t : NaN;
}

export function isWithinSchedule(sch: Schedule | null | undefined, nowMs: number): boolean {
  if (!sch?.start) return false;
  const st = startMs(sch.start);
  if (!Number.isFinite(st) || nowMs < st) return false;
  if (!(sch.durationMin > 0)) return true;
  const dur = sch.durationMin * 60_000;
  if (sch.repeat === "daily") return (nowMs - st) % DAY_MS < dur;
  return nowMs < st + dur;
}

/** Mốc bắt đầu của khung giờ ĐANG chạy (để "Live từ" ổn định suốt khung). */
export function currentWindowStartMs(sch: Schedule | null | undefined, nowMs: number): number | null {
  if (!sch || !isWithinSchedule(sch, nowMs)) return null;
  const st = startMs(sch.start);
  if (sch.durationMin > 0 && sch.repeat === "daily") return st + Math.floor((nowMs - st) / DAY_MS) * DAY_MS;
  return st;
}

/** Lần phát kế tiếp (để hiện "sắp phát lúc…"). */
export function nextStartMs(sch: Schedule | null | undefined, nowMs: number): number | null {
  if (!sch?.start) return null;
  const st = startMs(sch.start);
  if (!Number.isFinite(st)) return null;
  if (nowMs < st) return st;
  if (sch.durationMin > 0 && sch.repeat === "daily") return st + Math.ceil((nowMs - st) / DAY_MS) * DAY_MS;
  return null;
}

/** Hai lịch có chồng giờ trong ngày không (24/7 liên tục chồng mọi lịch). Không chắc → không chồng. */
export function schedulesOverlap(a: Schedule | null, b: Schedule | null): boolean {
  if (!a || !b) return false;
  if (!(a.durationMin > 0) || !(b.durationMin > 0)) return true;
  const mins = (s: string) => { const t = startMs(s); if (!Number.isFinite(t)) return null; const d = new Date(t + 7 * 3600_000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  const as = mins(a.start), bs = mins(b.start);
  if (as == null || bs == null) return false;
  return as < bs + b.durationMin && bs < as + a.durationMin;
}
