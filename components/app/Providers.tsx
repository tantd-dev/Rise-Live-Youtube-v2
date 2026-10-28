"use client";
// Bọc toàn app: antd (tiếng Việt, sáng/tối theo hệ điều hành) + App để dùng message/modal theo theme.
import "@ant-design/v5-patch-for-react-19";
import { useEffect, useState, type ReactNode } from "react";
import { App, ConfigProvider, theme } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

export function Providers({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: "#2563eb", borderRadius: 8, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
