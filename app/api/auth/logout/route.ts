import { clearSession } from "@/features/users/server/session";
import { redirectTo } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return redirectTo("/login");
}
