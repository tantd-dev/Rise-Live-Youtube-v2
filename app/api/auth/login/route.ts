import { db, COL } from "@/lib/server/firestore";
import { bad, json, readBody, route, str } from "@/lib/server/http";
import { createSession } from "@/features/users/server/session";
import { verifyPassword } from "@/features/users/server/password";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const b = await readBody<{ email?: string; password?: string }>(req);
  const email = str(b.email, 200).toLowerCase();
  const u = (await db.collection(COL.users).doc(email).get()).data();
  if (!u || (u.status && u.status !== "active") || !verifyPassword(String(b.password ?? ""), String(u.passwordHash ?? "")))
    throw bad("Sai email hoặc mật khẩu.");
  await createSession(email);
  return json({ ok: true });
});
