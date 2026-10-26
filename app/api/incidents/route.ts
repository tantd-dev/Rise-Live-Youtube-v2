import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { listIncidents } from "@/features/incidents/server/service";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("view");
  return json({ ok: true, rows: await listIncidents() });
});
