"use client";
import { ProCard } from "@ant-design/pro-components";
import { Button, Space, Typography } from "antd";
import { LifeBuoy, ShieldCheck, ShieldOff } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import type { FailoverSwitch } from "../types";

export function FailoverSwitchCard({ sw }: { sw: FailoverSwitch }) {
  const { run, busy, prompt } = useApp();
  const toggle = async () => {
    if (sw.disabled) return void run(() => api("/api/settings/failover", { body: { off: false } }), "Đã bật lại dự phòng tự động.");
    const reason = await prompt({ title: "Tắt dự phòng tự động", label: "Lý do tắt (bắt buộc, để người sau biết vì sao):", okText: "Tắt dự phòng", required: true });
    if (reason) void run(() => api("/api/settings/failover", { body: { off: true, reason } }), "Đã tắt dự phòng tự động.");
  };
  return (
    <ProCard
      title={<Space><LifeBuoy size={18} />Dự phòng tự động</Space>}
      subTitle="Tự chuyển luồng sang máy phát khác khi máy đang phát gặp sự cố"
      headerBordered
      extra={!sw.envOff && (
        <Button type={sw.disabled ? "primary" : "default"} danger={!sw.disabled} disabled={busy} onClick={toggle}
          icon={sw.disabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}>
          {sw.disabled ? "Bật lại" : "Tắt dự phòng"}
        </Button>
      )}
    >
      {sw.disabled ? (
        <Space wrap>
          <Pill tone="red">Đang tắt</Pill>
          <Typography.Text>
            {sw.envOff ? <>bởi biến môi trường <code>RISE_LIVE_FAILOVER_OFF=1</code></> : `bởi ${sw.by ?? "không rõ"} lúc ${fmtTime(sw.at)}`}
            {sw.reason && ` — Lý do: ${sw.reason}`}
          </Typography.Text>
        </Space>
      ) : (
        <Space wrap>
          <Pill tone="green">Đang bật</Pill>
          <Typography.Text type="secondary">Khi một máy phát mất liên lạc, các luồng có bật dự phòng sẽ tự chuyển sang máy khác đã có sẵn video.</Typography.Text>
        </Space>
      )}
    </ProCard>
  );
}
