// Trạng thái buổi live trên YouTube (đọc bằng API key từ link xem).
export interface YoutubeState {
  found: boolean;                 // video còn tồn tại / công khai được
  title?: string;
  channelTitle?: string;
  liveBroadcastContent?: string;  // live · upcoming · none
  concurrentViewers?: number | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  privacyStatus?: string;
  checkedAt: string;
  error?: string;
}

/** Lấy videoId từ link YouTube: watch?v= · youtu.be/ · /live/ · /shorts/ · /embed/. */
export function youtubeVideoId(url: string | null | undefined): string | null {
  const u = String(url ?? "").trim();
  if (!u) return null;
  return u.match(/[?&]v=([\w-]{11})(?:[&?/#]|$)/)?.[1]
    ?? u.match(/youtu\.be\/([\w-]{11})/)?.[1]
    ?? u.match(/youtube\.com\/(?:live|shorts|embed)\/([\w-]{11})/)?.[1]
    ?? u.match(/studio\.youtube\.com\/video\/([\w-]{11})/)?.[1]   // link copy từ YouTube Studio
    ?? null;
}

export const watchUrlOf = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

/** Mã buổi live YouTube: đúng 11 ký tự chữ/số/-/_ */
const VIDEO_ID = /^[\w-]{11}$/;

/**
 * Chuẩn hóa thứ người dùng dán vào ô "Link xem": chỉ MÃ buổi live (11 ký tự) hoặc bất kỳ dạng link YouTube nào
 * (youtu.be/…, /live/…, watch?v=…&t=…) → "https://www.youtube.com/watch?v=<mã>". Không nhận ra → trả nguyên văn.
 */
export function normalizeWatchInput(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (VIDEO_ID.test(s)) return watchUrlOf(s);
  const id = /youtube\.com|youtu\.be/i.test(s) ? youtubeVideoId(s) : null;
  return id ? watchUrlOf(id) : s;
}

/** Kiểm link xem: phải là link 1 VIDEO (không phải link kênh @handle). Nhận cả mã buổi live trần. */
export function checkWatchUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  const url = normalizeWatchInput(raw);
  if (!url) return { ok: false, error: "Cần dán MÃ hoặc LINK buổi live (YouTube Studio › Phát trực tiếp › Chia sẻ, dạng youtube.com/watch?v=…)." };
  if (!/youtube\.com|youtu\.be/i.test(url)) return { ok: false, error: "Không nhận ra: dán mã buổi live (11 ký tự, vd dQw4w9WgXcQ) hoặc link YouTube của buổi live." };
  if (!youtubeVideoId(url)) return { ok: false, error: "Đây là link KÊNH, không phải link buổi live. Dán mã hoặc link dạng youtube.com/watch?v=… của buổi phát." };
  return { ok: true, url: url.slice(0, 300) };
}
