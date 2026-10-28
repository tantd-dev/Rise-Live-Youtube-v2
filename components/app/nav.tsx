// Danh sách trang trong menu (mỗi mục = 1 route của App Router).
import type { ReactNode } from "react";
import { Film, LayoutDashboard, Radio, ScrollText, Server, Users } from "lucide-react";
import type { Permission } from "@/features/users/types";

export interface NavItem { path: string; label: string; icon: ReactNode; perm: Permission; badge?: "alerts" | "streams" | "assets" | "machines" }

export const NAV: NavItem[] = [
  { path: "/", label: "Dashboard", icon: <LayoutDashboard size={16} />, perm: "view", badge: "alerts" },
  { path: "/streams", label: "Lives", icon: <Radio size={16} />, perm: "view", badge: "streams" },
  { path: "/assets", label: "Videos", icon: <Film size={16} />, perm: "view", badge: "assets" },
  { path: "/machines", label: "VPS", icon: <Server size={16} />, perm: "view", badge: "machines" },
  { path: "/incidents", label: "Logs", icon: <ScrollText size={16} />, perm: "view" },
  { path: "/users", label: "Users", icon: <Users size={16} />, perm: "users.manage" },
];

/** Mục menu ứng với đường dẫn hiện tại. */
export const navFor = (pathname: string): NavItem =>
  NAV.find((n) => n.path !== "/" && (pathname === n.path || pathname.startsWith(n.path + "/"))) ?? NAV[0];
