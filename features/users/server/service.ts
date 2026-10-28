// Quản lý người dùng AB Live (chỉ Quản trị).
import { db, COL, nowISO } from "@/lib/server/firestore";
import { bad } from "@/lib/server/http";
import { normalizeRole, type Role, type UserRow } from "../types";
import { hashPassword } from "./password";

export async function listUsers(): Promise<UserRow[]> {
  const snap = await db.collection(COL.users).limit(500).get();
  return snap.docs.map((d) => {
    const u = d.data();
    return { email: d.id, fullName: String(u.fullName || d.id), role: normalizeRole(u), status: String(u.status || "active"), hasPassword: !!u.passwordHash };
  }).sort((a, b) => a.email.localeCompare(b.email));
}

export async function upsertUser(input: { email: string; fullName?: string; role: Role; password?: string; active?: boolean }, by: string): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw bad("Email không hợp lệ.");
  if (!["admin", "operator", "viewer"].includes(input.role)) throw bad("Vai trò không hợp lệ.");
  if (input.password != null && input.password !== "" && input.password.length < 8) throw bad("Mật khẩu tối thiểu 8 ký tự.");
  const patch: Record<string, unknown> = {
    email, liveRole: input.role, status: input.active === false ? "disabled" : "active", updatedAt: nowISO(), updatedBy: by,
  };
  if (input.fullName) patch.fullName = input.fullName.trim().slice(0, 80);
  if (input.password) patch.passwordHash = hashPassword(input.password);
  await db.collection(COL.users).doc(email).set(patch, { merge: true });
}

export async function deleteUser(email: string, by: string): Promise<void> {
  if (email === by) throw bad("Không tự xóa tài khoản của chính mình.");
  await db.collection(COL.users).doc(email).delete();
}
