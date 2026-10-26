export type AssetStatus = "pending" | "waiting" | "downloading" | "queued" | "normalizing" | "uploading" | "ready" | "error";

export interface Asset {
  id: string;
  name: string;
  sourceUrl?: string | null;     // link Google Drive (trống nếu tải thẳng từ máy tính)
  presetId: string;
  machineId: string;             // video nằm trên máy nào (mỗi máy một bản ghi riêng)
  status: AssetStatus;
  source?: string;               // drive · upload · manual-copy · move-autocopy
  copyFromUrl?: string;          // chép VPS→VPS: địa chỉ máy nguồn
  copyFromAssetId?: string;
  copyOptional?: boolean;        // chép hỏng thì lui về tải Drive
  sizeMb?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  error?: string;
  progressPct?: number | null;
  downloadedMb?: number | null;
  totalMb?: number | null;
  queueAhead?: number | null;
  dlMbPerMin?: number | null;
  createdAt?: string;
  createdBy?: string;
}

export const ASSET_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  waiting: "Đang xếp hàng",
  downloading: "Đang tải",
  queued: "Chờ nén",
  normalizing: "Đang chuẩn hoá",
  uploading: "Đang nhận file",
  ready: "Sẵn sàng",
  error: "Lỗi",
};

export const isProcessing = (a: Pick<Asset, "status">) => !["ready", "error"].includes(a.status);
