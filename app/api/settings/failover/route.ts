// Công tắc TẮT KHẨN cơ chế tự cứu (chỉ dừng phần tự chuyển máy).
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { setSwitch } from "@/features/failover/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const b = await readBody<{ off?: boolean; reason?: string }>(req);
  await setSwitch(b.off === true, String(b.reason ?? ""), user);
  return json({ ok: true });
});
