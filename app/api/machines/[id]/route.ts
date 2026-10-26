import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteMachine, updateMachine, type MachineInput } from "@/features/machines/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("machines.manage");
  await updateMachine((await params).id, await readBody<MachineInput>(req), user.email);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("machines.manage");
  return json({ ok: true, cleaned: await deleteMachine((await params).id, user.email) });
});
