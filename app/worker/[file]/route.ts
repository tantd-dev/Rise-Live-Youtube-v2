// Phát worker cho VPS tải về (khối lệnh cài gọi tới đây):
//   /worker/rise-live-worker.pyz  — gói Python đóng từ thư mục worker/ (chạy: python3 rise-live-worker.pyz)
//   /worker/requirements.txt      — yt-dlp, gdown
// Công khai (không chứa bí mật) giống bản cũ phát rise-live-agent.py trong public/.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { zipStore } from "@/lib/server/zip";

export const dynamic = "force-dynamic";
const WORKER_DIR = path.join(process.cwd(), "worker");

async function buildPyz(): Promise<Buffer> {
  const files: { name: string; data: Buffer }[] = [{ name: "__main__.py", data: await readFile(path.join(WORKER_DIR, "__main__.py")) }];
  const pkg = path.join(WORKER_DIR, "rise_live_worker");
  for (const f of (await readdir(pkg)).filter((x) => x.endsWith(".py")).sort())
    files.push({ name: `rise_live_worker/${f}`, data: await readFile(path.join(pkg, f)) });
  return zipStore(files);
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === "rise-live-worker.pyz") {
    return new Response(new Uint8Array(await buildPyz()), { headers: { "Content-Type": "application/zip", "Cache-Control": "no-store" } });
  }
  if (file === "requirements.txt") {
    return new Response(await readFile(path.join(WORKER_DIR, "requirements.txt"), "utf8"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response("not found", { status: 404 });
}
