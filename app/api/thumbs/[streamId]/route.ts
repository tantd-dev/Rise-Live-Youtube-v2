// Ảnh đang phát của 1 live (cho giao diện). Cần đăng nhập.
import { route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { loadThumb } from "@/features/thumbs/server/service";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ streamId: string }> }) => {
  await requireUser("view");
  const t = await loadThumb((await params).streamId);
  if (!t) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(t.jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" } });
});
