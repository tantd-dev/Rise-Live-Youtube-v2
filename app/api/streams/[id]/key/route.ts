// Hiện khoá luồng đầy đủ (ẩn mặc định như mật khẩu; ghi nhật ký người xem).
import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { revealKey } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("streams.operate");
  return json({ ok: true, streamKey: await revealKey((await params).id, user) });
});
