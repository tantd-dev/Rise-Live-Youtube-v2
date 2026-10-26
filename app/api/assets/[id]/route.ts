import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteAsset, renameAsset } from "@/features/assets/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("assets.manage");
  const b = await readBody<{ name?: string }>(req);
  await renameAsset((await params).id, String(b.name ?? ""), user.email);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("assets.manage");
  await deleteAsset((await params).id, user.email);
  return json({ ok: true });
});
