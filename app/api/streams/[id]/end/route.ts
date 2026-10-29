// Kết thúc live (dừng hẳn phiên live, khác "Dừng phát" là tạm dừng).
import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { endStream } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("streams.operate");
  await endStream((await params).id, user);
  return json({ ok: true });
});
