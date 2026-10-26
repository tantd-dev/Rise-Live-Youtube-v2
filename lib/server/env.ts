// Mọi biến môi trường phía máy chủ đọc qua đây — một chỗ duy nhất, tên giữ y như bản cũ.
const num = (v: string | undefined, def: number, min = -Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : def;
};

export const env = {
  liveEnabled: () => process.env.RISE_WORK_LIVE === "1",
  workerToken: () => process.env.RISE_LIVE_WORKER_TOKEN || "",
  leaseOn: () => process.env.RISE_LIVE_LEASE === "1",
  leaseGraceSec: () => Math.round(num(process.env.RISE_LIVE_LEASE_GRACE_SEC, 60, 20)),
  autoFailover: () => process.env.RISE_LIVE_AUTOFAILOVER === "1",
  failoverOffEnv: () => process.env.RISE_LIVE_FAILOVER_OFF === "1",
  failoverOfflineSec: () => Math.round(num(process.env.RISE_LIVE_FAILOVER_OFFLINE_SEC, 90, 30)),
  thumbPushSec: () => Math.max(60, num(process.env.RISE_LIVE_THUMB_PUSH_SEC, 300)),
  minFreeGb: () => Math.round(num(process.env.RISE_LIVE_MIN_FREE_GB, 20, 5)),
  uploadToken: () => process.env.RISE_LIVE_UPLOAD_TOKEN || "",
  uploadPort: () => num(process.env.RISE_LIVE_UPLOAD_PORT, 8099),
  /** Chỉ để chạy thử: đẩy về máy chủ RTMP cục bộ thay vì YouTube. */
  rtmpBase: () => (process.env.RISE_LIVE_RTMP_BASE || "rtmp://a.rtmp.youtube.com/live2").replace(/\/+$/, ""),
  ytApiKey: () => process.env.RISE_YT_API_KEY || "",
  cronSecret: () => process.env.REPORT_REMINDER_SECRET || "",
  appBaseUrl: () => (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  devLogin: () => process.env.ALLOW_DEV_LOGIN === "1" && !!process.env.FIRESTORE_EMULATOR_HOST,
  devLoginEmail: () => process.env.DEV_LOGIN_EMAIL || "dev@local.test",
  resendKey: () => process.env.RESEND_API_KEY || "",
  emailFrom: () => process.env.EMAIL_FROM || "",
  alertEmails: () => (process.env.RISE_LIVE_ALERT_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean),
  /** Bộ hẹn giờ nội bộ (failover/cảnh báo/YouTube) — tắt khi đã có Cloud Scheduler gọi /api/cron. */
  internalCron: () => process.env.RISE_LIVE_INTERNAL_CRON !== "0",
};
