// API cho WORKER trên VPS (giữ đường dẫn của bản cũ). Xác thực bằng header x-rise-live-token.
// 404 = máy chưa đăng ký (sai RISE_LIVE_MACHINE) · 401 = sai vé.
import { json, readBody, route } from "@/lib/server/http";
import { handleAgentSync } from "@/features/worker-api/server/agent";
import type { AgentRequest } from "@/features/worker-api/protocol";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) =>
  json(await handleAgentSync(await readBody<AgentRequest>(req), req.headers.get("x-rise-live-token") ?? "")));
