import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { addChannel, type ChannelInput } from "@/features/channels/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("streams.operate");
  return json({ ok: true, id: await addChannel(await readBody<ChannelInput>(req), user.email) });
});
