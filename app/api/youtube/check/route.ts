// Kiểm ngay trạng thái YouTube của các live (nút "Kiểm YouTube").
import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { checkYoutube } from "@/features/youtube/server/check";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  await requireUser("streams.operate");
  const b = await readBody<{ streamIds?: string[] }>(req);
  return json({ ok: true, ...(await checkYoutube(Array.isArray(b.streamIds) ? { streamIds: b.streamIds.map(String) } : { all: true })) });
});
