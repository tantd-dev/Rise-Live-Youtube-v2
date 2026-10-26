// Kiểm buổi live trên YouTube bằng API key (YouTube Data API v3, videos.list) từ link xem của luồng.
// Chỉ ĐỌC: có còn tồn tại, đang live / đã kết thúc, số người xem. Không điều khiển gì trên YouTube.
import { db, COL, nowISO, readAll } from "@/lib/server/firestore";
import { bad } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import type { Stream } from "@/features/streams/types";
import { shouldBeLive } from "@/features/streams/rules";
import { youtubeVideoId, type YoutubeState } from "../types";

interface YtVideo {
  id: string;
  snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string };
  status?: { privacyStatus?: string };
  liveStreamingDetails?: { concurrentViewers?: string; actualStartTime?: string; actualEndTime?: string };
}

async function fetchVideos(ids: string[], key: string): Promise<Map<string, YtVideo>> {
  const out = new Map<string, YtVideo>();
  for (let i = 0; i < ids.length; i += 50) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,liveStreamingDetails&id=${ids.slice(i, i + 50).join(",")}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`YouTube API lỗi (${r.status}).`);
    const j = (await r.json()) as { items?: YtVideo[] };
    (j.items ?? []).forEach((v) => out.set(v.id, v));
  }
  return out;
}

/** Kiểm các luồng có link xem (mặc định: luồng đang đặt phát; `all` = mọi luồng). */
export async function checkYoutube(opts: { streamIds?: string[]; all?: boolean } = {}): Promise<{ checked: number; skipped?: string }> {
  const key = env.ytApiKey();
  if (!key) {
    if (opts.streamIds) throw bad("Chưa cấu hình RISE_YT_API_KEY — không kiểm được YouTube.");
    return { checked: 0, skipped: "thiếu RISE_YT_API_KEY" };
  }
  const streams = (await readAll<Stream>(COL.streams, 5000)).filter((s) =>
    s.watchUrl && youtubeVideoId(s.watchUrl) && (opts.streamIds ? opts.streamIds.includes(s.id) : opts.all || shouldBeLive(s)));
  if (!streams.length) return { checked: 0 };
  const videos = await fetchVideos(Array.from(new Set(streams.map((s) => youtubeVideoId(s.watchUrl)!))), key);
  const batch = db.batch();
  for (const s of streams) {
    const v = videos.get(youtubeVideoId(s.watchUrl)!);
    const yt: YoutubeState = v ? {
      found: true, title: v.snippet?.title, channelTitle: v.snippet?.channelTitle, liveBroadcastContent: v.snippet?.liveBroadcastContent,
      concurrentViewers: v.liveStreamingDetails?.concurrentViewers != null ? Number(v.liveStreamingDetails.concurrentViewers) : null,
      actualStartTime: v.liveStreamingDetails?.actualStartTime ?? null, actualEndTime: v.liveStreamingDetails?.actualEndTime ?? null,
      privacyStatus: v.status?.privacyStatus, checkedAt: nowISO(),
    } : { found: false, checkedAt: nowISO() };
    batch.set(db.collection(COL.streams).doc(s.id), { yt }, { merge: true });
  }
  await batch.commit();
  return { checked: streams.length };
}
