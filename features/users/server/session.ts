// Phiên đăng nhập: cookie chứa token ngẫu nhiên, Firestore chỉ lưu BĂM của token.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, COL, nowISO } from "@/lib/server/firestore";
import { HttpError } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { can, normalizeRole, type Permission, type SessionUser } from "../types";

const COOKIE = "rise_live_session";
const SESSION_MS = 7 * 24 * 3600 * 1000;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function loadUser(email: string): Promise<SessionUser | null> {
  const d = await db.collection(COL.users).doc(email).get();
  const u = d.data();
  if (!d.exists || !u || (u.status && u.status !== "active")) return null;
  return { email, fullName: String(u.fullName || email), role: normalizeRole(u) };
}

export async function createSession(email: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.collection(COL.sessions).doc(hashToken(token)).set({
    email, createdAt: nowISO(), expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_MS / 1000),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.collection(COL.sessions).doc(hashToken(token)).delete().catch(() => undefined);
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const ref = db.collection(COL.sessions).doc(hashToken(token));
  const s = (await ref.get()).data();
  if (!s?.email || Date.parse(s.expiresAt ?? "") <= Date.now()) {
    await ref.delete().catch(() => undefined);
    return null;
  }
  return loadUser(String(s.email));
}

/** Bắt buộc đăng nhập (+ quyền nếu truyền). Ném HttpError 401/403 để route trả đúng mã. */
export async function requireUser(perm: Permission = "view"): Promise<SessionUser> {
  if (!env.liveEnabled()) throw new HttpError(503, "Rise Live đang tắt (đặt RISE_WORK_LIVE=1).");
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Chưa đăng nhập.");
  if (!can(user, perm)) throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
  return user;
}
