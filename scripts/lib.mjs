// Tiện ích chung cho các script npm — chạy được trên Windows (PowerShell) lẫn Linux/WSL.
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Nạp .env.local vào process.env (biến đã đặt sẵn trên dòng lệnh được ưu tiên). */
export function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
}

/** Cổng còn trống trên máy này không (thử cả 127.0.0.1 — nơi WSL chuyển tiếp cổng của nó ra Windows). */
export function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

/** Thoát với câu báo dễ hiểu nếu cổng đã bị chiếm. */
export async function requirePort(port, what, howToChange) {
  if (await portFree(port)) return;
  console.error(`\n✖ Cổng ${port} (${what}) đang bị chương trình khác dùng.`);
  console.error("  Thường gặp: bản AB Live CŨ đang chạy trong WSL (cổng 3000 / 8080 / 4000 / 8099) — tắt nó trước,");
  console.error(`  hoặc ${howToChange}\n`);
  process.exit(1);
}
