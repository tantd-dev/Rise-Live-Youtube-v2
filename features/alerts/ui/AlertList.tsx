"use client";
import { Empty, List, Space, Tag, Typography } from "antd";
import { CircleAlert, Info, Star, TriangleAlert } from "lucide-react";
import { Pill } from "@/components/ui/primitives";
import type { Alert } from "../compute";

const LEVEL = {
  critical: { tone: "red", label: "Nghiêm trọng", icon: <CircleAlert size={16} color="#dc2626" /> },
  warn: { tone: "amber", label: "Cảnh báo", icon: <TriangleAlert size={16} color="#d97706" /> },
  info: { tone: "gray", label: "Thông tin", icon: <Info size={16} color="#64748b" /> },
} as const;

export function AlertList({ alerts, onPick }: { alerts: Alert[]; onPick?: (a: Alert) => void }) {
  if (!alerts.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có cảnh báo nào — mọi thứ đang ổn." />;
  return (
    <List
      dataSource={alerts}
      rowKey="fingerprint"
      renderItem={(a) => {
        const lv = LEVEL[a.level];
        return (
          <List.Item style={{ cursor: onPick ? "pointer" : undefined }} onClick={onPick ? () => onPick(a) : undefined}
            extra={<Tag bordered={false} style={{ fontFamily: "monospace" }}>{a.code}</Tag>}>
            <List.Item.Meta
              avatar={lv.icon}
              title={<Space size={6} wrap>
                <Pill tone={lv.tone}>{lv.label}</Pill>
                {a.priority && <Pill tone="amber" icon={<Star size={12} />}>Ưu tiên</Pill>}
              </Space>}
              description={<Typography.Text>{a.text}</Typography.Text>}
            />
          </List.Item>
        );
      }}
    />
  );
}
