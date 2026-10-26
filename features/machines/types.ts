export type MachineRole = "stream-247" | "live-pub" | "shared";

export const MACHINE_ROLE_LABEL: Record<MachineRole, string> = {
  "stream-247": "Live 24/7",
  "live-pub": "Live Pub",
  shared: "Dùng chung",
};

export interface Machine {
  id: string;
  name: string;
  ip: string;
  role: MachineRole;
  provider?: string;
  region?: string;
  uploadMbps?: number;           // băng thông đẩy (worker tự đo, hoặc đặt tay)
  uploadMbpsManual?: boolean;    // true = đặt tay, worker không ghi đè
  uploadHttpsUrl?: string;       // địa chỉ HTTPS nhận file tải thẳng (Caddy → cổng 8099)
  maintenance?: boolean;         // bảo trì: không gán luồng MỚI
  forceOffline?: boolean;        // ngắt máy: worker dừng hết luồng
  costAmount?: number | null;
  costPeriod?: "month" | "year";
  costRenewAt?: string | null;   // YYYY-MM-DD — nhắc gia hạn
  // Worker tự báo:
  status?: string;
  lastHeartbeatAt?: string;
  agentVersion?: string;
  vcpu?: number;
  ramGb?: number;
  diskGb?: number;
  diskFreeGb?: number;
  loadAvg?: number;
  txMbps?: number;
  ytdlpVersion?: string;
  gdownOk?: boolean;
  toolError?: string;
  assetMissing?: string[];
  assetMissingSince?: string | null;
  createdAt?: string;
  createdBy?: string;
}

/** Máy kèm số liệu suy ra để hiển thị. */
export interface MachineView extends Machine {
  online: boolean;
  liveCount: number;
}
