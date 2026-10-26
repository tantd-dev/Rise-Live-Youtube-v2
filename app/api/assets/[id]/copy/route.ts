import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { copyAsset } from "@/features/assets/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("assets.manage");
  const b = await readBody<{ targetMachineId?: string }>(req);
  return json({ ok: true, id: await copyAsset((await params).id, String(b.targetMachineId ?? ""), user.email) });
});
