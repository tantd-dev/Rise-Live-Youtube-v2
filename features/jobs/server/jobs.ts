// Việc chạy nền định kỳ. Gọi được 2 cách:
//   · bộ hẹn giờ nội bộ (instrumentation.ts) — tiện khi chạy 1 máy chủ;
//   · POST /api/cron/<tên> với header x-cron-secret — cho Cloud Scheduler khi chạy nhiều bản sao.
import { runAutoFailover } from "@/features/failover/server/service";
import { runAlertJob } from "@/features/alerts/server/notify";
import { checkYoutube } from "@/features/youtube/server/check";

export const JOBS = {
  failover: { everySec: 30, run: () => runAutoFailover() },
  alerts: { everySec: 60, run: () => runAlertJob() },
  youtube: { everySec: 300, run: () => checkYoutube() },
} as const;

export type JobName = keyof typeof JOBS;
export const isJobName = (s: string): s is JobName => s in JOBS;
