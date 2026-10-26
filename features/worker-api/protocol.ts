// Giao thức worker ⇄ máy chủ (POST /api/live/agent, header x-rise-live-token).
// GIỮ NGUYÊN hình dạng của bản cũ → worker bản cũ (r2.x) lẫn worker V2 đều nói chuyện được.
export interface AgentRequest {
  machineId: string;
  agentVersion?: string;
  heartbeat?: {
    vcpu?: number; ramGb?: number; diskGb?: number; diskFreeGb?: number; loadAvg?: number;
    uploadMbps?: number; txMbps?: number; ytdlpVersion?: string; gdownOk?: boolean; toolError?: string;
  };
  assets?: AgentAssetReport[];
  streams?: AgentStreamReport[];
  uploaded?: AgentUploaded[];       // video tải thẳng lên máy, chờ đăng ký
  incidents?: AgentIncident[];      // các lần luồng rớt rồi tự bật lại
}

export interface AgentAssetReport {
  id: string; status?: string; normalizedPath?: string; sizeMb?: number; durationSec?: number;
  width?: number; height?: number; error?: string | null;
  progressPct?: number | null; downloadedMb?: number | null; totalMb?: number | null; queueAhead?: number | null; dlMbPerMin?: number | null;
}

export interface AgentStreamReport {
  id: string; status?: string; health?: string; restarts?: number; uptimeSec?: number;
  bitrateKbps?: number | null; speed?: number | null; black?: boolean;
  restartHalted?: boolean; needsHuman?: boolean; haltReason?: string | null; error?: string;
}

export interface AgentUploaded { id: string; name?: string; uploaderEmail?: string; presetId?: string; sizeMb?: number; width?: number; height?: number; durationSec?: number }
export interface AgentIncident { streamId: string; kind?: string; at?: string; downSec?: number; reason?: string }

export interface DesiredAsset {
  id: string;
  status: string;
  driveFileId: string;
  copyFrom: { url: string; assetId: string; optional: boolean } | null;
  preset: { width: number; height: number; fps: number; videoBitrateKbps: number; audioBitrateKbps: number; keepOriginal: boolean } | null;
}

export interface DesiredStream {
  id: string;
  assetId: string;
  assetIds: string[];
  playMode: "sequence" | "random";
  desiredState: "live" | "stopped";
  mode: string;
  rtmpBase: string;
  streamKey: string;
  leaseEnabled: boolean;
}

export interface AgentResponse {
  ok: true;
  machineId: string;
  assets: DesiredAsset[];
  streams: DesiredStream[];
  pollSeconds: number;
  leaseGraceSec: number;
  thumbPushSec: number;
}

/** Nhịp hỏi: 20s khi ổn định; 3s trong ~60s sau khi có thay đổi (bấm Bật thấy ngay). */
export const POLL_SLOW_SEC = 20;
export const POLL_FAST_SEC = 3;
export const POLL_FAST_WINDOW_MS = 60_000;
