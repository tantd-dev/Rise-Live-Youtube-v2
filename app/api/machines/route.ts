import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { addMachine, type MachineInput } from "@/features/machines/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const user = await requireUser("machines.manage");
  return json({ ok: true, id: await addMachine(await readBody<MachineInput>(req), user.email) });
});
