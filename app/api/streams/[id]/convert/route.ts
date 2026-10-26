// Live Pub → Live 24/7.
import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { convertTo247 } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("streams.operate");
  await convertTo247((await params).id, user);
  return json({ ok: true });
});
