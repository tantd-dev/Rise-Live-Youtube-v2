import type { Schedule } from "./schedule";
import type { YoutubeState } from "@/features/youtube/types";

export type StreamMode = "stream-247" | "live-pub";
export type StreamControl = "manual" | "schedule";
export type Importance = "normal" | "priority" | "critical";
export type FailoverMode = "disabled" | "manual" | "automatic";
export type MoveState = "" | "stopping_source" | "starting_target" | "verifying";

export const MODE_LABEL: Record<StreamMode, string> = { "stream-247": "Live 24/7", "live-pub": "Live Pub" };
export const IMPORTANCE_LABEL: Record<Importance, string> = { normal: "Bình thường", priority: "Ưu tiên", critical: "Quan trọng" };

export interface StreamIncident { kind: string; at: string; downSec: number; reason: string; machineId?: string }

export interface YtIssue { type: string; note: string; source: "manual" | "auto"; by?: string; at: string }

export interface Stream {
  id: string;
  name: string;
  assetId: string;
  assetIds: string[];              // danh sách phát (1 hoặc nhiều video, cùng máy)
  playMode: "sequence" | "random";
  machineId: string;
  presetId: string;
  mode: StreamMode;
  rtmpBase: string;
  streamKey: string;               // KHÔNG bao giờ gửi nguyên văn ra giao diện (xem StreamView)
  channelId?: string | null;       // kênh YouTube (Quản lý kênh) — trống với live cũ nhập khóa tay
  channelKeyId?: string | null;    // khóa live của kênh đã chọn; streamKey là bản chép của khóa này
  control: StreamControl;
  schedule: Schedule | null;
  desiredState: "live" | "stopped";
  endedAt?: string | null;         // đã bấm "Kết thúc live": phiên live này xong hẳn, không lên sóng lại (muốn phát tiếp → Sửa, đổi link/khóa)
  endedBy?: string | null;
  watchUrl?: string | null;        // link xem trên YouTube (youtube.com/watch?v=…)
  allowBlack?: boolean;            // nội dung tối/đen chủ ý → bỏ qua cảnh báo màn đen
  importance?: Importance;
  failoverMode?: FailoverMode;
  // Worker báo về:
  status?: string;
  health?: string;
  restarts?: number;
  uptimeSec?: number;
  bitrateKbps?: number | null;
  speed?: number | null;
  restartHalted?: boolean;
  needsHuman?: boolean;
  haltReason?: string | null;
  error?: string;
  black?: boolean;
  blackSince?: string | null;
  slow?: boolean;
  slowSince?: string | null;
  liveSince?: string | null;
  lastHeartbeatAt?: string;
  recentIncidents?: StreamIncident[];
  incidentCount?: number;
  ytIssue?: YtIssue | null;
  yt?: YoutubeState | null;
  // Chuyển máy:
  moveState?: MoveState | null;
  moveSourceId?: string | null;
  moveTargetId?: string | null;
  moveExecId?: string | null;
  moveDeadlineAt?: string | null;
  moveVerifyAt?: string | null;
  moveType?: string | null;
  moveTargetAssetIds?: string[] | null;
  movePrevAssetIds?: string[] | null;
  cooldownUntil?: string | null;
  fencingToken?: number;
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
}

/** live gửi ra giao diện: che khóa live, thêm trường suy ra. */
export interface StreamView extends Omit<Stream, "streamKey"> {
  streamKeyMasked: string;
  scheduleActive: boolean;
  nextStartISO: string | null;
  shouldBeLive: boolean;
}
