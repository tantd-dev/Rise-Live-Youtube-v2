/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // firebase-admin chỉ chạy phía máy chủ — không gói vào bundle.
  serverExternalPackages: ["firebase-admin"],
  // Route phục vụ gói worker đọc file Python trong thư mục worker/.
  outputFileTracingIncludes: { "/worker/[file]": ["./worker/**/*"] },
};
export default nextConfig;
