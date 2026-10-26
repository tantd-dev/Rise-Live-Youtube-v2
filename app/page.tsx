import { getSessionUser } from "@/features/users/server/session";
import { env } from "@/lib/server/env";
import { LiveApp } from "@/components/app/LiveApp";
import { LoginForm } from "@/features/users/ui/LoginForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!env.liveEnabled()) {
    return <main className="login"><div className="card"><h2>AB Live đang tắt</h2><p>Đặt <code>RISE_WORK_LIVE=1</code> trong .env.local rồi khởi động lại.</p></div></main>;
  }
  let user;
  try {
    user = await getSessionUser();
  } catch (e) {
    return (
      <main className="login"><div className="card">
        <h2>Không kết nối được Firestore</h2>
        <p className="err">{e instanceof Error ? e.message : String(e)}</p>
        <p>Kiểm tra đã chạy <code>npm run emulator</code> và <code>FIRESTORE_EMULATOR_HOST</code> trong .env.local.</p>
      </div></main>
    );
  }
  return user ? <LiveApp /> : <LoginForm devLogin={env.devLogin()} />;
}
