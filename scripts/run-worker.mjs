// npm run worker — worker chỉ chạy trên Linux.
//  · Linux / WSL: chạy thẳng scripts/run-worker.sh.
//  · Windows (PowerShell): tự gọi vào WSL bản Ubuntu (KHÔNG dùng bản WSL mặc định — có thể là docker-desktop,
//    không có bash). Đổi bằng RISE_LIVE_WSL_DISTRO. App chạy trên Windows thì "localhost" trong WSL KHÔNG phải
//    Windows → tự đổi RISE_LIVE_URL sang địa chỉ của Windows nhìn từ WSL.
import { execFileSync, spawn } from "node:child_process";
import { ROOT, loadEnvLocal } from "./lib.mjs";

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: "inherit", ...opts });
  child.on("exit", (code) => process.exit(code ?? 0));
}

if (process.platform !== "win32") {
  run("bash", ["scripts/run-worker.sh"], { cwd: ROOT });
} else {
  loadEnvLocal();
  const distro = process.env.RISE_LIVE_WSL_DISTRO || "Ubuntu";
  const wsl = (args) => execFileSync("wsl.exe", ["-d", distro, "--", ...args], { encoding: "utf8" }).trim();
  try {
    wsl(["true"]);
  } catch {
    console.error(`✖ Không mở được WSL "${distro}". Xem danh sách: wsl -l -v — rồi đặt RISE_LIVE_WSL_DISTRO=<tên> trong .env.local.`);
    process.exit(1);
  }
  const env = {};
  let url = (process.env.RISE_LIVE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const u = new URL(url);
  if (["localhost", "127.0.0.1"].includes(u.hostname)) {
    // Trong WSL (chế độ mạng NAT), Windows là "default gateway".
    // (Tách IP ở đây, không dùng awk '$3' — wsl.exe cho shell mở rộng mất ký tự $.)
    const gw = wsl(["ip", "route", "show", "default"]).match(/via\s+(\d+\.\d+\.\d+\.\d+)/)?.[1];
    if (gw) {
      u.hostname = gw;
      url = u.origin;
      console.log(`App chạy trên Windows → worker trong WSL gọi về ${url} (thay cho localhost).`);
      console.log("Nếu worker báo 'timed out': cho phép Node.js qua Windows Firewall (mạng Public), hoặc chạy cả app trong WSL.");
    }
  }
  env.RISE_LIVE_URL = url;
  // Truyền mọi biến RISE_LIVE_* (từ .env.local hoặc đặt trong PowerShell) sang WSL qua WSLENV —
  // không đưa vé lên dòng lệnh.
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("RISE_LIVE_") && !(k in env) && v != null) env[k] = v;
  const wslenv = [process.env.WSLENV, ...Object.keys(env)].filter(Boolean).join(":");
  run("wsl.exe", ["-d", distro, "--cd", ROOT, "--", "bash", "scripts/run-worker.sh"], { env: { ...process.env, ...env, WSLENV: wslenv } });
}
