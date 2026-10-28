import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/server/session";
import { env } from "@/lib/server/env";
import { LoginForm } from "@/features/users/ui/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đăng nhập · AB Live" };

export default async function LoginPage() {
  // Lỗi Firestore / app tắt sẽ hiện ở trang chính, ở đây chỉ cần biết đã đăng nhập hay chưa.
  const user = await getSessionUser().catch(() => null);
  if (user) redirect("/");
  return <LoginForm devLogin={env.devLogin()} />;
}
