"use client";
// Bọc toàn app: antd (tiếng Việt, sáng/tối) + App để dùng message/modal theo theme.
// Chế độ sáng/tối: mặc định theo hệ điều hành; người dùng bấm chuyển thì nhớ lựa chọn trong localStorage.
import "@ant-design/v5-patch-for-react-19";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { App, ConfigProvider, theme } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";

dayjs.locale("vi");

const THEME_KEY = "rl.theme";

const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => undefined });
/** Chế độ sáng/tối hiện tại + hàm chuyển đổi. */
export const useTheme = () => useContext(ThemeCtx);
/** Giao diện đang ở chế độ tối? */
export const useIsDark = () => useContext(ThemeCtx).dark;

function savedTheme(): "light" | "dark" | null {
  try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; }
}

export function Providers({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const saved = savedTheme();
    setDark(saved ? saved === "dark" : mq.matches);
    // Chỉ theo hệ điều hành khi người dùng chưa tự chọn.
    const on = () => { if (!savedTheme()) setDark(mq.matches); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);

  const toggle = useCallback(() => setDark((d) => {
    try { localStorage.setItem(THEME_KEY, d ? "light" : "dark"); } catch { /* không có localStorage */ }
    return !d;
  }), []);

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: "#2563eb", borderRadius: 8, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
      }}
    >
      <ThemeCtx.Provider value={{ dark, toggle }}><App>{children}</App></ThemeCtx.Provider>
    </ConfigProvider>
  );
}
