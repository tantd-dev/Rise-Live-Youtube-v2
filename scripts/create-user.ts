// Tạo / cập nhật người dùng từ dòng lệnh (dùng để tạo tài khoản Quản trị ĐẦU TIÊN khi triển khai thật):
//   npm run create-user -- <email> <mật khẩu> [admin|operator|viewer] [Họ tên]
// Đọc .env.local (GOOGLE_CLOUD_PROJECT, FIRESTORE_EMULATOR_HOST…) giống app.
import { readFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const [email, password, role = "admin", ...name] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Cách dùng: npm run create-user -- <email> <mật khẩu> [admin|operator|viewer] [Họ tên]");
    process.exit(1);
  }
  const { upsertUser } = await import("../features/users/server/service");
  await upsertUser({ email, password, role: role as "admin", fullName: name.join(" ") || undefined }, "cli");
  console.log(`Đã lưu ${email} (${role}).`);
  process.exit(0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
