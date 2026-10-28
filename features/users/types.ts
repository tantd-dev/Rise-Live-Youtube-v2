// Người dùng + phân quyền. THUẦN (không đụng Firestore) — dùng được ở cả giao diện lẫn máy chủ.
export type Role = "admin" | "operator" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị viên",
  operator: "Vận hành viên",
  viewer: "Người xem",
};

/** Mô tả quyền của từng vai trò (hiện cạnh ô chọn vai trò). */
export const ROLE_HINT: Record<Role, string> = {
  admin: "Toàn quyền: máy phát, người dùng, cài đặt hệ thống",
  operator: "Quản lý luồng phát và kho video",
  viewer: "Chỉ xem, không thao tác",
};

export type Permission =
  | "view"
  | "streams.operate"   // tạo/sửa/bật/dừng/xóa luồng
  | "assets.manage"     // thêm/sao chép/xóa video
  | "machines.manage"   // thêm/sửa/xóa máy, xem lệnh cài worker
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

/** Chuẩn hóa vai trò từ bản ghi users (kể cả bản ghi của bản cũ: role "admin" + quyền "riseLive"). */
export function normalizeRole(data: { role?: unknown; liveRole?: unknown; extraPermissions?: unknown }): Role {
  const r = String(data.liveRole ?? data.role ?? "");
  if (r === "admin" || r === "operator" || r === "viewer") return r;
  if (Array.isArray(data.extraPermissions) && data.extraPermissions.includes("riseLive")) return "operator";
  return "viewer";
}
