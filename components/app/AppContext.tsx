"use client";
// Trạng thái dùng chung toàn app: dữ liệu tổng (tự làm mới), thông báo nhanh, hộp xác nhận/nhập, chạy thao tác.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { App, Input } from "antd";
import { api } from "@/lib/client/api";
import type { DashboardData } from "@/features/dashboard/types";
import { can, type Permission } from "@/features/users/types";

interface ConfirmOpts { title: string; content?: ReactNode; okText?: string; danger?: boolean }
interface PromptOpts { title: string; label?: ReactNode; initial?: string; placeholder?: string; okText?: string; required?: boolean; multiline?: boolean }

interface AppCtx {
  data: DashboardData | null;
  loadError: string;
  busy: boolean;
  reload: () => Promise<void>;
  toast: (text: string, tone?: "ok" | "err") => void;
  /** Hộp xác nhận — trả true nếu người dùng đồng ý. */
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  /** Hộp nhập 1 dòng chữ — trả chuỗi đã nhập (đã cắt khoảng trắng) hoặc null nếu hủy. */
  prompt: (o: PromptOpts) => Promise<string | null>;
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
  const { message, modal } = App.useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    if (tone === "err") void message.error({ content: text, duration: 8 });
    else void message.success({ content: text, duration: 4 });
  }, [message]);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    modal.confirm({
      title: o.title, content: o.content, okText: o.okText ?? "Đồng ý", cancelText: "Hủy",
      okButtonProps: o.danger ? { danger: true } : undefined,
      onOk: () => resolve(true), onCancel: () => resolve(false),
    });
  }), [modal]);

  const prompt = useCallback((o: PromptOpts) => new Promise<string | null>((resolve) => {
    let value = o.initial ?? "";
    const Field = o.multiline ? Input.TextArea : Input;
    modal.confirm({
      title: o.title, icon: null, okText: o.okText ?? "Lưu", cancelText: "Hủy",
      content: (
        <div style={{ marginTop: 8 }}>
          {o.label && <div style={{ marginBottom: 6, opacity: 0.75 }}>{o.label}</div>}
          <Field autoFocus defaultValue={value} placeholder={o.placeholder} onChange={(e: { target: { value: string } }) => { value = e.target.value; }} />
        </div>
      ),
      onOk: () => {
        const v = value.trim();
        if (o.required && !v) { void message.warning("Vui lòng nhập nội dung."); return Promise.reject(); }
        resolve(v);
      },
      onCancel: () => resolve(null),
    });
  }), [modal, message]);

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

  const value: AppCtx = { data, loadError, busy, reload, toast, confirm, prompt, run, can: (p) => can(data?.user, p) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
