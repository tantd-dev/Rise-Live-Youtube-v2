"use client";
import type { ReactNode } from "react";
import { ProCard, StatisticCard } from "@ant-design/pro-components";
import { Col, Row, Typography } from "antd";
import { Bell, CircleAlert, Film, Loader, Radio, Server } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { TONE_HEX, type Tone } from "@/components/ui/primitives";
import { AlertList } from "@/features/alerts/ui/AlertList";
import { FailoverSwitchCard } from "@/features/failover/ui/FailoverSwitchCard";

function Stat({ title, value, tone, icon, hint }: { title: string; value: ReactNode; tone?: Tone; icon: ReactNode; hint?: string }) {
  return (
    <Col xs={12} md={8} xl={4}>
      <StatisticCard style={{ height: "100%" }}
        statistic={{ title, value: value as string, valueStyle: tone ? { color: TONE_HEX[tone] } : undefined, icon, description: hint && <Typography.Text type="secondary">{hint}</Typography.Text> }}
      />
    </Col>
  );
}

export function OverviewTab({ onGo }: { onGo: (tab: string) => void }) {
  const { data } = useApp();
  if (!data) return null;
  const o = data.overview;
  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Stat title="live đang phát" value={`${o.streamsLive}/${o.streamsWanted}`} hint="đang phát / cần phát" icon={<Radio size={28} color="#dc2626" />} tone={o.streamsLive < o.streamsWanted ? "amber" : "green"} />
        <Stat title="live lỗi" value={o.streamsError} icon={<CircleAlert size={28} color="#dc2626" />} tone={o.streamsError ? "red" : undefined} />
        <Stat title="Máy phát trực tuyến" value={`${o.machinesOnline}/${o.machinesTotal}`} icon={<Server size={28} color="#2563eb" />} tone={o.machinesOnline < o.machinesTotal ? "amber" : "green"} />
        <Stat title="Video sẵn sàng" value={o.assetsReady} icon={<Film size={28} color="#16a34a" />} />
        <Stat title="Video đang xử lý" value={o.assetsProcessing} icon={<Loader size={28} color="#2563eb" />} tone={o.assetsProcessing ? "blue" : undefined} />
        <Stat title="Cảnh báo" value={`${o.alertsCritical} / ${o.alertsWarn}`} hint="nghiêm trọng / cảnh báo" icon={<Bell size={28} color="#d97706" />} tone={o.alertsCritical ? "red" : o.alertsWarn ? "amber" : "green"} />
      </Row>

      <ProCard
        title="Cảnh báo"
        headerBordered
        extra={<Typography.Text type="secondary">Tự làm mới · cập nhật lúc {new Date(data.serverTime).toLocaleTimeString("vi-VN")}</Typography.Text>}
        style={{ marginBottom: 16 }}
      >
        <AlertList alerts={data.alerts} onPick={(a) => onGo(a.streamId ? "streams" : a.machineId ? "machines" : "assets")} />
      </ProCard>

      {data.failover && <FailoverSwitchCard sw={data.failover} />}
    </>
  );
}
