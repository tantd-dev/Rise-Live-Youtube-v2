// Next.js gọi register() 1 lần khi máy chủ khởi động. Phần chạy việc nền chỉ chạy trên Node
// (điều kiện NEXT_RUNTIME được thay tĩnh lúc build → không gói firebase-admin cho edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
