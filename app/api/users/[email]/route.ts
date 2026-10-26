import { json, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteUser } from "@/features/users/server/service";

export const dynamic = "force-dynamic";

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ email: string }> }) => {
  const user = await requireUser("users.manage");
  await deleteUser(decodeURIComponent((await params).email), user.email);
  return json({ ok: true });
});
