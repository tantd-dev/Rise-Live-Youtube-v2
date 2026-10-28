"use client";
import { useState } from "react";
import { ProCard, ProTable, type ProColumns } from "@ant-design/pro-components";
import { Button, Dropdown, Popconfirm, Progress, Select, Space, Tabs, Tooltip, Typography } from "antd";
import { Copy, ExternalLink, Pencil, Plus, Trash } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDuration, fmtMb, fmtTime } from "@/lib/client/format";
import { AddAssetForm } from "./AddAssetForm";
import { UploadForm } from "./UploadForm";
import { ASSET_STATUS_LABEL, type Asset } from "../types";

const { Text } = Typography;

function StatusCell({ a }: { a: Asset }) {
  const tone = a.status === "ready" ? "green" : a.status === "error" ? "red" : "blue";
  return (
    <Space direction="vertical" size={2} style={{ minWidth: 140 }}>
      <Pill tone={tone}>{ASSET_STATUS_LABEL[a.status] ?? a.status}</Pill>
      {a.progressPct != null && <Progress percent={a.progressPct} size="small" />}
      {a.progressPct != null && <Text type="secondary" style={{ fontSize: 12 }}>{fmtMb(a.downloadedMb)} / {fmtMb(a.totalMb)}</Text>}
      {a.queueAhead ? <Text type="secondary" style={{ fontSize: 12 }}>Còn {a.queueAhead} video xếp hàng phía trước</Text> : null}
      {a.status === "error" && a.error && <Text type="danger" style={{ fontSize: 12 }}>{a.error}</Text>}
    </Space>
  );
}

function sourceLabel(a: Asset): string {
  if (a.copyFromAssetId) return "Bản sao";
  if (a.source === "upload") return "Tải lên trực tiếp";
  return "";
}

export function AssetsTab() {
  const { data, can, run, busy, prompt } = useApp();
  const [machineFilter, setMachineFilter] = useState<string>();
  const machines = data?.machines ?? [];
  const mName = (id: string) => machines.find((m) => m.id === id)?.name ?? "(máy đã xóa)";
  const assets = (data?.assets ?? []).filter((a) => !machineFilter || a.machineId === machineFilter);
  const usedBy = (id: string) => (data?.streams ?? []).filter((s) => (s.assetIds?.length ? s.assetIds : [s.assetId]).includes(id)).map((s) => s.name);
  const manage = can("assets.manage");

  const rename = async (a: Asset) => {
    const n = await prompt({ title: "Đổi tên video", initial: a.name, required: true });
    if (n && n !== a.name) void run(() => api(`/api/assets/${a.id}`, { method: "PATCH", body: { name: n } }), "Đã đổi tên video.");
  };
  const copyTo = (a: Asset, targetMachineId: string) =>
    run(() => api(`/api/assets/${a.id}/copy`, { body: { targetMachineId } }), "Đã tạo bản sao. Máy đích đang tải file về.");

  const columns: ProColumns<Asset>[] = [
    {
      title: "Tên video", dataIndex: "name", render: (_, a) => (
        <Space direction="vertical" size={0}>
          <Text strong>{a.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {a.sourceUrl ? <a href={a.sourceUrl} target="_blank" rel="noreferrer"><Space size={4}>Google Drive<ExternalLink size={12} /></Space></a> : null}
            {a.sourceUrl && sourceLabel(a) ? " · " : ""}{sourceLabel(a)}
          </Text>
        </Space>
      ),
    },
    { title: "Máy phát", dataIndex: "machineId", render: (_, a) => mName(a.machineId) },
    { title: "Trạng thái", dataIndex: "status", render: (_, a) => <StatusCell a={a} /> },
    {
      title: "Thông tin", key: "info", render: (_, a) => {
        const users = usedBy(a.id);
        return (
          <Space direction="vertical" size={0} style={{ fontSize: 13 }}>
            <span>{a.width ? `${a.width}×${a.height}` : "—"} · {fmtDuration(a.durationSec)} · {fmtMb(a.sizeMb)}</span>
            {users.length ? <Text type="secondary" style={{ fontSize: 12 }}>Đang dùng ở: {users.join(", ")}</Text> : null}
          </Space>
        );
      },
    },
    { title: "Ngày thêm", dataIndex: "createdAt", width: 160, render: (_, a) => <Text style={{ fontSize: 13 }}>{fmtTime(a.createdAt)}</Text> },
  ];
  if (manage) {
    columns.push({
      title: "Thao tác", key: "actions", fixed: "right", width: 130, render: (_, a) => {
        const users = usedBy(a.id);
        const targets = machines.filter((m) => m.id !== a.machineId);
        return (
          <Space size={0}>
            <Dropdown disabled={busy || a.status !== "ready" || !targets.length} trigger={["click"]}
              menu={{ items: targets.map((m) => ({ key: m.id, label: m.name })), onClick: ({ key }) => void copyTo(a, key) }}>
              <Tooltip title={a.status !== "ready" ? "Chỉ sao chép được video đã sẵn sàng" : "Sao chép sang máy phát khác"}>
                <Button type="text" size="small" icon={<Copy size={15} />} disabled={busy || a.status !== "ready" || !targets.length} />
              </Tooltip>
            </Dropdown>
            <Tooltip title="Đổi tên"><Button type="text" size="small" icon={<Pencil size={15} />} disabled={busy} onClick={() => rename(a)} /></Tooltip>
            <Popconfirm title={`Xóa video “${a.name}”?`} description="File trên máy phát cũng sẽ bị xóa." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}
              disabled={users.length > 0} onConfirm={() => run(() => api(`/api/assets/${a.id}`, { method: "DELETE" }), "Đã xóa video.")}>
              <Tooltip title={users.length ? "Video đang được Phiên live sử dụng" : "Xóa"}>
                <Button type="text" size="small" danger icon={<Trash size={15} />} disabled={busy || users.length > 0} />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    });
  }

  return (
    <>
      {manage && (
        <ProCard title={<Space><Plus size={18} />Thêm video</Space>} headerBordered style={{ marginBottom: 16 }}>
          <Tabs items={[
            { key: "drive", label: "Từ Google Drive", children: <AddAssetForm /> },
            { key: "upload", label: "Tải lên từ máy tính", children: <UploadForm /> },
          ]} />
        </ProCard>
      )}
      <ProTable<Asset>
        rowKey="id"
        headerTitle={`Danh sách video (${assets.length})`}
        dataSource={assets}
        columns={columns}
        search={false}
        options={false}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: "Chưa có video nào." }}
        toolBarRender={() => [
          <Select key="m" allowClear placeholder="Tất cả máy phát" style={{ minWidth: 200 }} value={machineFilter} onChange={setMachineFilter}
            options={machines.map((m) => ({ value: m.id, label: m.name }))} />,
        ]}
      />
    </>
  );
}
