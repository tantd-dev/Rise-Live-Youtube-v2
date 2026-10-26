// Nhật ký sự cố CỐ ĐỊNH (giữ cả sau khi luồng dừng/xoá) + sự cố tự phục hồi worker báo về.
export interface IncidentLog {
  id: string;
  streamId: string;
  streamName: string;
  machineId: string;
  streamOwner: string;
  cause: string;
  reason: string;
  startedAt: string;
  resolvedAt?: string;
  resolution?: string;      // stopped · cleared_yt_flag · failover · move_done · move_failed
  resolvedBy?: string;
  createdAt: string;
}

/** 1 dòng hiển thị ở tab Nhật ký (gộp sự cố cố định + các lần tự khởi động lại gần đây). */
export interface IncidentRow {
  key: string;
  at: string;
  streamName: string;
  machineId: string;
  kind: string;
  detail: string;
  downSec?: number;
}
