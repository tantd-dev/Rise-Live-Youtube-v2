import { NextResponse } from "next/server";
import { clearSession } from "@/features/users/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
