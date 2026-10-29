import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { deleteChannelKey, revealChannelKey, updateChannelKey, type ChannelKeyInput } from "@/features/channels/server/service";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; keyId: string }> };

/** Hiện khóa live đầy đủ (ẩn mặc định như mật khẩu; ghi nhật ký người xem). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  const { id, keyId } = await params;
  return json({ ok: true, key: await revealChannelKey(id, keyId, user.email) });
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  const { id, keyId } = await params;
  await updateChannelKey(id, keyId, await readBody<ChannelKeyInput>(req), user.email);
  return json({ ok: true });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("streams.operate");
  const { id, keyId } = await params;
  await deleteChannelKey(id, keyId, user.email);
  return json({ ok: true });
});
