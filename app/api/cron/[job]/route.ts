// Chạy 1 việc nền theo yêu cầu (Cloud Scheduler / gọi tay). Bảo vệ bằng header x-cron-secret.
import { env } from "@/lib/server/env";
import { HttpError, json, route } from "@/lib/server/http";
import { JOBS, isJobName } from "@/features/jobs/server/jobs";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ job: string }> }) => {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("x-cron-secret") !== secret) throw new HttpError(401, "Sai hoặc thiếu x-cron-secret.");
  const { job } = await params;
  if (!isJobName(job)) throw new HttpError(404, `Không có việc "${job}". Có: ${Object.keys(JOBS).join(", ")}.`);
  return json({ ok: true, job, result: await JOBS[job].run() });
});
