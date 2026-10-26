"use client";
// Trạng thái dùng chung toàn app: dữ liệu tổng (tự làm mới), thông báo nhanh, chạy thao tác.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import type { DashboardData } from "@/features/dashboard/types";
import { can, type Permission } from "@/features/users/types";

interface Toast { id: number; text: string; tone: "ok" | "err" }

interface AppCtx {
  data: DashboardData | null;
  loadError: string;
  busy: boolean;
  reload: () => Promise<void>;
  toast: (text: string, tone?: "ok" | "err") => void;
  /** Chạy 1 thao tác: bật cờ bận, báo lỗi/thành công, làm mới dữ liệu. Trả kết quả hoặc null nếu lỗi. */
  run: <T>(fn: () => Promise<T>, okText?: string | ((r: T) => string)) => Promise<T | null>;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp phải nằm trong <AppProvider>");
  return c;
}

/** Nhịp làm mới: nhanh khi đang có việc chuyển tiếp (chờ lên sóng, đang tải video, chuyển máy). */
function nextDelay(d: DashboardData | null): number {
  if (!d) return 5000;
  const transitioning = d.streams.some((s) => s.moveState || (s.shouldBeLive && s.status !== "live") || (!s.shouldBeLive && s.status === "live"))
    || d.assets.some((a) => a.status !== "ready" && a.status !== "error");
  return transitioning ? 4000 : 15000;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "err" ? 8000 : 4000);
  }, []);

  const reload = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let d: DashboardData | null = null;
    try {
      d = await api<DashboardData>("/api/dashboard");
      setData(d);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
    timer.current = setTimeout(() => void reload(), nextDelay(d));
  }, []);

  useEffect(() => {
    void reload();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [reload]);

  const run = useCallback(async <T,>(fn: () => Promise<T>, okText?: string | ((r: T) => string)) => {
    setBusy(true);
    try {
      const r = await fn();
      const msg = typeof okText === "function" ? okText(r) : okText;
      if (msg) toast(msg);
      await reload();
      return r;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
      return null;
    } finally {
      setBusy(false);
    }
  }, [reload, toast]);

  const value: AppCtx = { data, loadError, busy, reload, toast, run, can: (p) => can(data?.user, p) };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`} role="status">{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}
