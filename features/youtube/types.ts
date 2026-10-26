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
    ?? null;
}

/** Kiểm link xem: phải là link 1 VIDEO (không phải link kênh @handle). */
export function checkWatchUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  const url = String(raw ?? "").trim();
  if (!url) return { ok: false, error: "Cần dán LINK VIDEO LIVE (YouTube Studio › Phát trực tiếp › Chia sẻ, dạng youtube.com/watch?v=…)." };
  if (!/youtube\.com|youtu\.be/i.test(url)) return { ok: false, error: "Link xem phải là link YouTube." };
  if (!youtubeVideoId(url)) return { ok: false, error: "Đây là link KÊNH, không phải link buổi live. Dán link dạng youtube.com/watch?v=… của buổi phát." };
  return { ok: true, url: url.slice(0, 300) };
}

export const watchUrlOf = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
