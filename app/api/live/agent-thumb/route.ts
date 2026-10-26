// Worker đẩy ảnh đang phát của 1 luồng lên (JPG base64).
import { json, readBody, route } from "@/lib/server/http";
import { saveThumb } from "@/features/thumbs/server/service";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  await saveThumb(await readBody(req), req.headers.get("x-rise-live-token") ?? "");
  return json({ ok: true });
});
