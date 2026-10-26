// npm run emulator — Firestore emulator (Windows hoặc Linux; cần Java 11+).
//  · Cổng lấy theo FIRESTORE_EMULATOR_HOST trong .env.local (mặc định 8080) → đổi 1 chỗ là app + emulator khớp.
//  · Dùng ĐÚNG project của app (GOOGLE_CLOUD_PROJECT) để giao diện emulator thấy dữ liệu app ghi.
//  · Lưu dữ liệu vào .emulator-data khi tắt (Ctrl+C), lần sau nạp lại.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, loadEnvLocal, requirePort } from "./lib.mjs";

loadEnvLocal();
const project = process.env.GOOGLE_CLOUD_PROJECT || "demo-rise-live";
const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const port = Number(portStr) || 8080;
const uiPort = Number(process.env.RISE_LIVE_EMULATOR_UI_PORT) || 4000;

await requirePort(port, "Firestore emulator", "đổi FIRESTORE_EMULATOR_HOST trong .env.local, vd 127.0.0.1:8180.");
await requirePort(uiPort, "giao diện emulator", "đặt RISE_LIVE_EMULATOR_UI_PORT trong .env.local, vd 4100.");

const config = path.join(ROOT, ".firebase.local.json");
writeFileSync(config, JSON.stringify({ emulators: { firestore: { host, port }, ui: { enabled: true, port: uiPort } } }, null, 2));
const data = path.join(ROOT, ".emulator-data");
mkdirSync(data, { recursive: true });

console.log(`Firestore emulator — project ${project} · ${host}:${port} · giao diện http://127.0.0.1:${uiPort} · dữ liệu .emulator-data`);
const child = spawn("npx", ["firebase", "emulators:start", "--only", "firestore", "--project", project, "--config", config, "--import", data, "--export-on-exit", data],
  { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
child.on("exit", (code) => process.exit(code ?? 0));
