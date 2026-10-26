"use client";
import { useApp } from "@/components/app/AppContext";
import { Card, Pill, Stat } from "@/components/ui/primitives";
import { AlertList } from "@/features/alerts/ui/AlertList";
import { FailoverSwitchCard } from "@/features/failover/ui/FailoverSwitchCard";

export function OverviewTab({ onGo }: { onGo: (tab: string) => void }) {
  const { data } = useApp();
  if (!data) return null;
  const o = data.overview;
  return (
    <>
      <div className="stats">
        <Stat label="Luồng đang phát" value={`${o.streamsLive}/${o.streamsWanted}`} tone={o.streamsLive < o.streamsWanted ? "amber" : "green"} />
        <Stat label="Luồng lỗi" value={o.streamsError} tone={o.streamsError ? "red" : undefined} />
        <Stat label="Máy online" value={`${o.machinesOnline}/${o.machinesTotal}`} tone={o.machinesOnline < o.machinesTotal ? "amber" : "green"} />
        <Stat label="Video sẵn sàng" value={o.assetsReady} />
        <Stat label="Video đang xử lý" value={o.assetsProcessing} tone={o.assetsProcessing ? "blue" : undefined} />
        <Stat label="Cảnh báo" value={`${o.alertsCritical} / ${o.alertsWarn}`} tone={o.alertsCritical ? "red" : o.alertsWarn ? "amber" : "green"} />
      </div>

      <Card title="⚠ Cảnh báo" action={<span className="muted">tự làm mới · {new Date(data.serverTime).toLocaleTimeString("vi-VN")}</span>}>
        <AlertList alerts={data.alerts} onPick={(a) => onGo(a.streamId ? "streams" : a.machineId ? "machines" : "assets")} />
      </Card>

      <Card title="Cấu hình hệ thống">
        <div className="chips">
          <Pill tone={data.config.autoFailover ? "green" : "gray"}>Tự cứu khi máy chết: {data.config.autoFailover ? "BẬT" : "tắt"}</Pill>
          <Pill tone={data.config.lease ? "green" : "gray"}>Tự dừng khi cô lập (lease): {data.config.lease ? "BẬT" : "tắt"}</Pill>
          <Pill tone={data.config.ytApiKey ? "green" : "gray"}>Kiểm YouTube bằng API key: {data.config.ytApiKey ? "có" : "chưa có RISE_YT_API_KEY"}</Pill>
          <Pill tone={data.config.uploadEnabled ? "green" : "gray"}>Tải thẳng lên VPS: {data.config.uploadEnabled ? "có" : "chưa có RISE_LIVE_UPLOAD_TOKEN"}</Pill>
          <Pill tone="gray">RTMP: {data.config.rtmpBase}</Pill>
        </div>
      </Card>

      {data.failover && <FailoverSwitchCard sw={data.failover} />}
    </>
  );
}
