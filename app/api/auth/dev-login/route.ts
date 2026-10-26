// Đăng nhập thử (tài khoản Quản trị). CHỈ chạy khi ALLOW_DEV_LOGIN=1 VÀ đang dùng Firestore emulator.
import { NextResponse } from "next/server";
import { db, COL, nowISO } from "@/lib/server/firestore";
import { env } from "@/lib/server/env";
import { createSession } from "@/features/users/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!env.devLogin()) return NextResponse.json({ error: "Đăng nhập thử đang tắt (cần ALLOW_DEV_LOGIN=1 và FIRESTORE_EMULATOR_HOST)." }, { status: 404 });
  const email = env.devLoginEmail();
  await db.collection(COL.users).doc(email).set({ email, fullName: "Dev Admin", liveRole: "admin", status: "active", updatedAt: nowISO() }, { merge: true });
  await createSession(email);
  return NextResponse.redirect(new URL("/", req.url));
}
