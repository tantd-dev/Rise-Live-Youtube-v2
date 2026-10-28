"use client";
import { useState } from "react";
import { ProTable, type ProColumns } from "@ant-design/pro-components";
import { Button, Dropdown, Progress, Space, Tooltip, Typography } from "antd";
import { Ellipsis, Pencil, Play, Plus, Power, Terminal, Trash, Wrench } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import { fmtAgo } from "@/lib/client/format";
import { SAFETY_FACTOR } from "@/features/assets/presets";
import { daysToRenew } from "../rules";
import { MACHINE_ROLE_LABEL, type MachineView } from "../types";
import { MachineForm } from "./MachineForm";
import { InstallDialog } from "./InstallDialog";

const { Text } = Typography;
const small = { fontSize: 12 } as const;

function StatusPill({ m }: { m: MachineView }) {
  if (m.forceOffline) return <Pill tone="red">Đã ngắt</Pill>;
  if (m.maintenance) return <Pill tone="amber">Bảo trì</Pill>;
  return m.online ? <Pill tone="green">Trực tuyến</Pill> : <Pill tone="gray">Ngoại tuyến</Pill>;
}

function Bandwidth({ m }: { m: MachineView }) {
  if (!m.uploadMbps) return <Text type="secondary">Chưa đo</Text>;
  const pct = m.txMbps != null ? Math.round((m.txMbps / m.uploadMbps) * 100) : null;
  return (
    <div style={{ minWidth: 130 }}>
      <Tooltip title={m.txMbps != null ? "Đang dùng / tổng băng thông tải lên" : "Tổng băng thông tải lên"}>
        <span>{m.txMbps != null ? `${m.txMbps}/` : ""}{m.uploadMbps} Mbps</span>
      </Tooltip>
      {m.uploadMbpsManual && <Text type="secondary" style={small}> (thủ công)</Text>}
      {pct != null && <Progress percent={Math.min(100, pct)} size="small" showInfo={false} status={pct >= SAFETY_FACTOR * 100 ? "exception" : "normal"} />}
    </div>
  );
}

export function MachinesTab() {
  const { data, can, run, busy, confirm } = useApp();
  const [form, setForm] = useState<{ machine?: MachineView } | null>(null);
  const [install, setInstall] = useState<MachineView | null>(null);
  const machines = data?.machines ?? [];
  const admin = can("machines.manage");
  const patch = (m: MachineView, body: Record<string, unknown>, ok: string) => run(() => api(`/api/machines/${m.id}`, { method: "PATCH", body }), ok);

  const toggleOffline = async (m: MachineView) => {
    if (!m.forceOffline && !(await confirm({ title: `Ngắt máy “${m.name}”?`, content: "Tất cả live đang phát trên máy này sẽ DỪNG. Các live có bật dự phòng sẽ được chuyển sang máy khác.", okText: "Ngắt máy", danger: true }))) return;
    void patch(m, { forceOffline: !m.forceOffline }, m.forceOffline ? "Đã bật lại máy phát." : "Đã ngắt máy phát.");
  };
  const remove = async (m: MachineView) => {
    if (await confirm({ title: `Xóa máy “${m.name}”?`, content: "Các video trên máy này cũng sẽ bị xóa khỏi kho.", okText: "Xóa", danger: true }))
      void run(() => api(`/api/machines/${m.id}`, { method: "DELETE" }), "Đã xóa máy phát.");
  };

  const columns: ProColumns<MachineView>[] = [
    {
      title: "Máy phát", dataIndex: "name", width: 260, render: (_, m) => (
        <Space direction="vertical" size={0}>
          <Space size={6}><Text strong>{m.name}</Text><Text type="secondary">· {MACHINE_ROLE_LABEL[m.role] ?? m.role}</Text></Space>
          <Text style={small}><Text code style={small}>{m.ip}</Text>{[m.provider, m.region].filter(Boolean).length ? ` · ${[m.provider, m.region].filter(Boolean).join(" · ")}` : ""}</Text>
          <Space size={2}><Text type="secondary" style={small}>Mã máy: <Text code style={small}>{m.id}</Text></Text><CopyButton text={m.id} label="Sao chép mã máy" iconOnly /></Space>
        </Space>
      ),
    },
    {
      title: "Tình trạng", dataIndex: "online", width: 200, render: (_, m) => (
        <Space direction="vertical" size={2}>
          <StatusPill m={m} />
          <Text type="secondary" style={small}>Tín hiệu cuối: {fmtAgo(m.lastHeartbeatAt)}</Text>
          {m.agentVersion && <Text type="secondary" style={small}>Worker {m.agentVersion}{m.ytdlpVersion ? ` · yt-dlp ${m.ytdlpVersion}` : ""}</Text>}
          {m.toolError && <Text type="danger" style={small}>{m.toolError}</Text>}
        </Space>
      ),
    },
    {
      title: "Cấu hình", key: "spec", render: (_, m) => (
        <Space direction="vertical" size={0} style={{ fontSize: 13 }}>
          <span>{m.vcpu ? `${m.vcpu} vCPU · ${m.ramGb} GB RAM` : "—"}</span>
          {m.diskFreeGb != null && <Text type="secondary" style={small}>Ổ đĩa trống {m.diskFreeGb}/{m.diskGb} GB</Text>}
          {m.loadAvg != null && <Text type="secondary" style={small}>Tải CPU {m.loadAvg}</Text>}
        </Space>
      ),
    },
    { title: "Băng thông", key: "bw", render: (_, m) => <Bandwidth m={m} /> },
    { title: "Số live", dataIndex: "liveCount", width: 90, align: "center" },
    {
      title: "Chi phí thuê", key: "cost", render: (_, m) => {
        const days = daysToRenew(m);
        return (
          <Space direction="vertical" size={0} style={{ fontSize: 13 }}>
            <span>{m.costAmount ? `${m.costAmount.toLocaleString("vi-VN")} đ/${m.costPeriod === "year" ? "năm" : "tháng"}` : "—"}</span>
            {days != null && <Text type={days <= 5 ? "danger" : "secondary"} style={small}>
              {days < 0 ? `Đã quá hạn ${-days} ngày` : `Hết hạn sau ${days} ngày`} ({m.costRenewAt?.split("-").reverse().join("/")})
            </Text>}
          </Space>
        );
      },
    },
  ];
  if (admin) {
    columns.push({
      title: "Thao tác", key: "actions", fixed: "right", width: 180, render: (_, m) => (
        <Space size={4}>
          <Button size="small" icon={<Terminal size={14} />} onClick={() => setInstall(m)}>Cài worker</Button>
          <Dropdown trigger={["click"]} disabled={busy} menu={{
            items: [
              { key: "edit", icon: <Pencil size={14} />, label: "Sửa thông tin" },
              {
                key: "maint", icon: <Wrench size={14} />, label: m.maintenance ? "Tắt chế độ bảo trì" : "Bật chế độ bảo trì",
                title: "Bảo trì: không nhận live MỚI; các live đang phát không bị ảnh hưởng."
              },
              { key: "offline", icon: m.forceOffline ? <Play size={14} /> : <Power size={14} />, label: m.forceOffline ? "Bật lại máy" : "Ngắt máy", danger: !m.forceOffline },
              ...(m.liveCount === 0 ? [{ type: "divider" as const }, { key: "delete", icon: <Trash size={14} />, label: "Xóa máy", danger: true }] : []),
            ],
            onClick: ({ key }) => {
              if (key === "edit") setForm({ machine: m });
              if (key === "maint") void patch(m, { maintenance: !m.maintenance }, m.maintenance ? "Đã tắt chế độ bảo trì." : "Đã bật chế độ bảo trì.");
              if (key === "offline") void toggleOffline(m);
              if (key === "delete") void remove(m);
            },
          }}>
            <Button size="small" icon={<Ellipsis size={14} />} aria-label="Thao tác khác" />
          </Dropdown>
        </Space>
      ),
    });
  }

  return (
    <>
      <ProTable<MachineView>
        rowKey="id"
        headerTitle={`Danh sách máy phát (${machines.length})`}
        dataSource={machines}
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: 1100 }}
        pagination={false}
        locale={{ emptyText: "Chưa có máy phát nào. Hãy thêm máy rồi bấm “Cài worker” để lấy lệnh cài lên VPS." }}
        toolBarRender={() => (admin ? [<Button key="add" type="primary" icon={<Plus size={14} />} onClick={() => setForm({})}>Thêm máy phát</Button>] : [])}
      />
      {form && <MachineForm machine={form.machine} onClose={() => setForm(null)} onCreated={(id) => { const m = data?.machines.find((x) => x.id === id); setInstall(m ?? ({ id, name: "máy mới" } as MachineView)); }} />}
      {install && <InstallDialog machine={install} onClose={() => setInstall(null)} />}
    </>
  );
}
