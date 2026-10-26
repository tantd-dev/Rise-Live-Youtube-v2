import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { addDriveAsset } from "@/features/assets/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("assets.manage");
  return json({ ok: true, ...(await addDriveAsset(await readBody(req), user.email)) });
});
