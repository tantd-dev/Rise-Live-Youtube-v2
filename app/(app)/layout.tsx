// Khu vực cần đăng nhập: kiểm tra app bật / Firestore / phiên đăng nhập, rồi bọc khung menu cho mọi trang con.
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/server/session";
import { env } from "@/lib/server/env";
import { LiveApp } from "@/components/app/LiveApp";
import { StatusScreen } from "@/components/ui/StatusScreen";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!env.liveEnabled()) {
    return (
      <StatusScreen status="info" title="AB Live đang tắt">
        Đặt <code>RISE_WORK_LIVE=1</code> trong <code>.env.local</code> rồi khởi động lại máy chủ.
      </StatusScreen>
    );
  }
  let user;
  try {
    user = await getSessionUser();
  } catch (e) {
    return (
      <StatusScreen status="error" title="Không kết nối được Firestore" detail={e instanceof Error ? e.message : String(e)}>
        Kiểm tra đã chạy <code>npm run emulator</code> và biến <code>FIRESTORE_EMULATOR_HOST</code> trong <code>.env.local</code>.
      </StatusScreen>
    );
  }
  if (!user) redirect("/login");
  return <LiveApp>{children}</LiveApp>;
}
