// Chuyển live đang phát sang máy khác (bàn giao an toàn 2 pha).
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { previewMove, startMove } from "@/features/failover/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Danh sách máy đích + lý do không chọn được. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  await requireUser("streams.operate");
  return json({ ok: true, candidates: await previewMove((await params).id) });
});

export const POST = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  const b = await readBody<{ targetId?: string }>(req);
  await startMove((await params).id, String(b.targetId ?? ""), user);
  return json({ ok: true });
});
