import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteStream, editStream, patchStream, type StreamInput } from "@/features/streams/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Sửa toàn bộ (chỉ khi luồng đã dừng). */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  await editStream((await params).id, await readBody<StreamInput>(req), user);
  return json({ ok: true });
});

/** Đổi tên / link xem / nền đen chủ ý / mức ưu tiên / chế độ dự phòng (được cả khi đang phát). */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  await patchStream((await params).id, await readBody(req), user);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  await deleteStream((await params).id, user);
  return json({ ok: true });
});
