// Bộ hẹn giờ nội bộ cho việc nền (tự cứu, cảnh báo, YouTube).
// Tắt bằng RISE_LIVE_INTERNAL_CRON=0 khi đã dùng Cloud Scheduler gọi /api/cron/<tên>.
import { env } from "@/lib/server/env";
import { JOBS } from "@/features/jobs/server/jobs";

if (env.internalCron() && env.liveEnabled()) {
  for (const [name, job] of Object.entries(JOBS)) {
    let running = false;
    setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const r = await job.run();
        if (r && typeof r === "object" && "moved" in r && Number(r.moved) > 0) console.log(`[cron:${name}]`, r);
      } catch (e) {
        console.error(`[cron:${name}]`, e instanceof Error ? e.message : e);
      } finally {
        running = false;
      }
    }, job.everySec * 1000);
  }
}
