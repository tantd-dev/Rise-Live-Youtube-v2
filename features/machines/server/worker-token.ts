// Vé xác thực worker. Chấp nhận: vé CHUNG (RISE_LIVE_WORKER_TOKEN) hoặc vé RIÊNG từng máy =
// HMAC(vé chung, machineId) — không lưu bí mật trong Firestore, máy này không giả danh máy khác được.
import crypto from "node:crypto";
import { env } from "@/lib/server/env";

export function machineToken(machineId: string): string | null {
  const secret = env.workerToken();
  if (!secret || !machineId) return null;
  return crypto.createHmac("sha256", secret).update("machine:" + machineId).digest("hex").slice(0, 40);
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function verifyWorkerToken(machineId: string, given: string): boolean {
  const shared = env.workerToken();
  if (!given || !shared) return false;
  if (safeEq(given, shared)) return true;
  const mt = machineToken(machineId);
  return !!mt && safeEq(given, mt);
}
