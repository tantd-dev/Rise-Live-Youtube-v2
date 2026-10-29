import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { addChannelKey, type ChannelKeyInput } from "@/features/channels/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  return json({ ok: true, id: await addChannelKey((await params).id, await readBody<ChannelKeyInput>(req), user.email) });
});
