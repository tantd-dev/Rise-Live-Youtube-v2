// Trả địa chỉ + vé để trình duyệt PUT file thẳng lên worker của máy đã chọn.
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { uploadTarget } from "@/features/assets/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("assets.manage");
  const b = await readBody<{ machineId?: string }>(req);
  return json({ ok: true, ...(await uploadTarget(String(b.machineId ?? ""), user.email)), email: user.email });
});
