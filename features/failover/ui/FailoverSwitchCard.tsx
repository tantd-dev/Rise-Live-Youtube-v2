"use client";
import { useApp } from "@/components/app/AppContext";
import { Card, Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import type { FailoverSwitch } from "../types";

/** Công tắc tắt khẩn tự cứu — chỉ dừng phần TỰ chuyển máy; luồng vẫn phát, cảnh báo vẫn chạy. */
export function FailoverSwitchCard({ sw }: { sw: FailoverSwitch }) {
  const { run, busy } = useApp();
  const toggle = () => {
    if (sw.disabled) return void run(() => api("/api/settings/failover", { body: { off: false } }), "Đã BẬT lại tự cứu.");
    const reason = prompt("Lý do TẮT tự cứu (bắt buộc):");
    if (reason) void run(() => api("/api/settings/failover", { body: { off: true, reason } }), "Đã TẮT tự cứu.");
  };
  return (
    <Card title="🛟 Cơ chế tự cứu (tự chuyển luồng khi máy chết)">
      <p>
        {sw.disabled
          ? <><Pill tone="red">ĐANG TẮT</Pill> {sw.envOff ? "bởi biến môi trường RISE_LIVE_FAILOVER_OFF=1" : `bởi ${sw.by ?? "?"} lúc ${fmtTime(sw.at)}`} {sw.reason && `— ${sw.reason}`}</>
          : <><Pill tone="green">Đang bật</Pill> Luồng ưu tiên / đặt "tự động" sẽ được chuyển sang máy khác khi máy đang phát chết.</>}
      </p>
      {!sw.envOff && <button className={sw.disabled ? "btn-primary" : "btn-danger"} disabled={busy} onClick={toggle}>{sw.disabled ? "Bật lại tự cứu" : "Tắt khẩn tự cứu"}</button>}
    </Card>
  );
}
