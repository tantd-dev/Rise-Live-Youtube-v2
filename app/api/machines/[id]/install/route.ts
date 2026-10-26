// Khối lệnh cài worker cho 1 máy — có VÉ RIÊNG của máy đó, nên chỉ Quản trị được xem (ghi nhật ký).
import { COL, readOne } from "@/lib/server/firestore";
import { env } from "@/lib/server/env";
import { bad, json, notFound, route } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { requireUser } from "@/features/users/server/session";
import { machineToken } from "@/features/machines/server/worker-token";
import { installScript } from "@/features/machines/install-script";
import type { Machine } from "@/features/machines/types";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("machines.manage");
  const { id } = await params;
  const m = await readOne<Machine>(COL.machines, id);
  if (!m) throw notFound("Máy không tồn tại.");
  const token = machineToken(id);
  if (!token) throw bad("Máy chủ chưa đặt RISE_LIVE_WORKER_TOKEN.");
  let uploadHost = "";
  try { uploadHost = m.uploadHttpsUrl ? new URL(m.uploadHttpsUrl).hostname : ""; } catch { uploadHost = ""; }
  // Địa chỉ máy chủ mà VPS gọi về: APP_BASE_URL (đặt đúng tên miền công khai khi triển khai).
  const serverUrl = process.env.APP_BASE_URL ? env.appBaseUrl() : new URL(req.url).origin;
  await audit(user.email, "machine.install_script", id);
  return json({
    machineId: id, token,
    script: installScript({ serverUrl, machineId: id, token, uploadToken: env.uploadToken(), uploadPort: env.uploadPort(), uploadHost }),
  });
});
