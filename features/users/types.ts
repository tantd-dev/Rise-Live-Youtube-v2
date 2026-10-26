// Người dùng + phân quyền. THUẦN (không đụng Firestore) — dùng được ở cả giao diện lẫn máy chủ.
export type Role = "admin" | "operator" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị (máy, người dùng, cài đặt)",
  operator: "Vận hành (luồng, video)",
  viewer: "Chỉ xem",
};

export type Permission =
  | "view"
  | "streams.operate"   // tạo/sửa/bật/dừng/xoá luồng
  | "assets.manage"     // thêm/sao chép/xoá video
  | "machines.manage"   // thêm/sửa/xoá máy, xem lệnh cài worker
  | "users.manage"      // gán vai trò
  | "settings.manage";  // công tắc tự cứu…

const ROLE_PERMS: Record<Role, Permission[]> = {
  viewer: ["view"],
  operator: ["view", "streams.operate", "assets.manage"],
  admin: ["view", "streams.operate", "assets.manage", "machines.manage", "users.manage", "settings.manage"],
};

export interface UserRow { email: string; fullName: string; role: Role; status: string; hasPassword: boolean }

export interface SessionUser {
  email: string;
  fullName: string;
  role: Role;
}

export function can(user: Pick<SessionUser, "role"> | null | undefined, perm: Permission): boolean {
  return !!user && ROLE_PERMS[user.role]?.includes(perm);
}

/** Chuẩn hoá vai trò từ bản ghi users (kể cả bản ghi của bản cũ: role "admin" + quyền "riseLive"). */
export function normalizeRole(data: { role?: unknown; liveRole?: unknown; extraPermissions?: unknown }): Role {
  const r = String(data.liveRole ?? data.role ?? "");
  if (r === "admin" || r === "operator" || r === "viewer") return r;
  if (Array.isArray(data.extraPermissions) && data.extraPermissions.includes("riseLive")) return "operator";
  return "viewer";
}
