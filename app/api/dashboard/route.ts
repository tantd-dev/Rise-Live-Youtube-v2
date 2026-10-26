import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { buildDashboard } from "@/features/dashboard/server/snapshot";

export const dynamic = "force-dynamic";

export const GET = route(async () => json(await buildDashboard(await requireUser("view"))));
