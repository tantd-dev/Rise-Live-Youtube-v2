import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { createStream, type StreamInput } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("streams.operate");
  return json({ ok: true, ...(await createStream(await readBody<StreamInput>(req), user)) });
});
