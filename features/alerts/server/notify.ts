// Gửi email cảnh báo (Resend) cho các sự cố nghiêm trọng MỚI. Không cấu hình → bỏ qua (chỉ hiện trong app).
// Chống gửi trùng: nhớ fingerprint đã gửi trong liveAlertState; gửi lại sau 6 giờ nếu vẫn còn.
import { db, COL, nowISO, readAll } from "@/lib/server/firestore";
import { env } from "@/lib/server/env";
import type { Asset } from "@/features/assets/types";
import type { Machine } from "@/features/machines/types";
import type { Stream } from "@/features/streams/types";
import { computeAlerts, EMAIL_KINDS, type Alert } from "../compute";

const RESEND_AFTER_MS = 6 * 3600_000;

export async function runAlertJob(): Promise<{ active: number; emailed: number; skipped?: string }> {
  const [machines, streams, assets] = await Promise.all([readAll<Machine>(COL.machines, 500), readAll<Stream>(COL.streams, 5000), readAll<Asset>(COL.assets, 8000)]);
  const alerts = computeAlerts(machines, streams, assets).filter((a) => a.level === "critical" && (EMAIL_KINDS.has(a.kind) || a.priority));
  if (!env.resendKey() || !env.emailFrom() || !env.alertEmails().length) return { active: alerts.length, emailed: 0, skipped: "chưa cấu hình email (RESEND_API_KEY / EMAIL_FROM / RISE_LIVE_ALERT_EMAILS)" };

  const ref = db.collection(COL.alertState).doc("email");
  const sent: Record<string, string> = (await ref.get()).data()?.sent ?? {};
  const now = Date.now();
  const fresh = alerts.filter((a) => !sent[a.fingerprint] || now - Date.parse(sent[a.fingerprint]) > RESEND_AFTER_MS);
  if (fresh.length) {
    await sendEmail(fresh);
    fresh.forEach((a) => { sent[a.fingerprint] = nowISO(); });
  }
  // Quên các cảnh báo đã hết để lần sau tái phát thì gửi lại.
  const still = new Set(alerts.map((a) => a.fingerprint));
  for (const k of Object.keys(sent)) if (!still.has(k)) delete sent[k];
  await ref.set({ sent, at: nowISO() });
  return { active: alerts.length, emailed: fresh.length };
}

async function sendEmail(alerts: Alert[]) {
  const html = `<p>AB Live có ${alerts.length} sự cố cần xử lý:</p><ul>${alerts.map((a) => `<li><b>[${a.code}]</b> ${escapeHtml(a.text)}</li>`).join("")}</ul><p><a href="${env.appBaseUrl()}">Mở AB Live</a></p>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom(), to: env.alertEmails(), subject: `[AB Live] ${alerts.length} sự cố cần xử lý`, html }),
  });
  if (!r.ok) throw new Error(`Gửi email lỗi (${r.status}).`);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
