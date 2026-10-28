import { json, readBody, route } from "@/lib/server/http";
import { requireUser } from "@/features/users/server/session";
import { listUsers, upsertUser } from "@/features/users/server/service";
import type { Role } from "@/features/users/types";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("users.manage");
  return json({ ok: true, users: await listUsers() });
});

/** Thêm / sửa người dùng (vai trò, mật khẩu, khóa tài khoản). */
export const POST = route(async (req: Request) => {
  const user = await requireUser("users.manage");
  const b = await readBody<{ email?: string; fullName?: string; role?: Role; password?: string; active?: boolean }>(req);
  await upsertUser({ email: String(b.email ?? ""), fullName: b.fullName, role: b.role ?? "viewer", password: b.password, active: b.active }, user.email);
  return json({ ok: true });
});
