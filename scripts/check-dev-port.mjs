// Chạy trước `next dev`: báo rõ nếu cổng app đã bị chiếm (thay vì Next tự nhảy sang cổng khác
// trong khi worker vẫn gọi về cổng cũ — tức là gọi nhầm sang chương trình khác).
import { loadEnvLocal, requirePort } from "./lib.mjs";

loadEnvLocal();
const port = Number(process.env.PORT) || 3000;
await requirePort(port, "app Next.js", "chạy với cổng khác (PowerShell: $env:PORT=3100; npm run dev) và sửa APP_BASE_URL / RISE_LIVE_URL theo.");
