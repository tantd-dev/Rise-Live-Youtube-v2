import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "AB Live" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
