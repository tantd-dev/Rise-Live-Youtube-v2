import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteChannel, updateChannel, type ChannelInput } from "@/features/channels/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  await updateChannel((await params).id, await readBody<ChannelInput>(req), user.email);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  await deleteChannel((await params).id, user.email);
  return json({ ok: true });
});
