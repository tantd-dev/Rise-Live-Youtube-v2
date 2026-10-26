// Ảnh chụp toàn cảnh gửi cho giao diện (1 lần gọi /api/dashboard = đủ dữ liệu mọi tab).
import type { Alert } from "@/features/alerts/compute";
import type { Asset } from "@/features/assets/types";
import type { MachineView } from "@/features/machines/types";
import type { StreamView } from "@/features/streams/types";
import type { SessionUser } from "@/features/users/types";
import type { FailoverSwitch } from "@/features/failover/types";

export interface Overview {
  streamsLive: number;
  streamsWanted: number;
  streamsError: number;
  machinesOnline: number;
  machinesTotal: number;
  assetsReady: number;
  assetsProcessing: number;
  assetsError: number;
  alertsCritical: number;
  alertsWarn: number;
}

export interface DashboardData {
  user: SessionUser;
  serverTime: string;
  overview: Overview;
  alerts: Alert[];
  machines: MachineView[];
  assets: Asset[];
  streams: StreamView[];
  failover: FailoverSwitch | null;   // chỉ Quản trị
  config: {
    uploadEnabled: boolean;
    ytApiKey: boolean;
    autoFailover: boolean;
    lease: boolean;
    rtmpBase: string;
  };
}
