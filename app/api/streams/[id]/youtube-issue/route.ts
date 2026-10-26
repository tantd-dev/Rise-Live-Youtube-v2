// Gắn / gỡ cờ "YouTube chặn/đình chỉ" (có cờ → worker dừng đẩy).
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { setYtIssue } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("streams.operate");
  const b = await readBody<{ flag?: boolean; note?: string }>(req);
  await setYtIssue((await params).id, b.flag === true, String(b.note ?? ""), user);
  return json({ ok: true });
});
