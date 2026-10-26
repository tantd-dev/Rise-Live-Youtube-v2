// Lên sóng / Dừng.
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { setDesired } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("streams.operate");
  const b = await readBody<{ desired?: string }>(req);
  return json({ ok: true, ...(await setDesired((await params).id, b.desired === "live" ? "live" : "stopped", user)) });
});
