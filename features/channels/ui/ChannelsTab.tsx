"use client";
// Quản lý kênh: mỗi kênh là 1 thẻ, bên trong là bảng "Khóa live YouTube" của kênh.
import { useState } from "react";
import { ProCard } from "@ant-design/pro-components";
import { Button, Empty, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import { ExternalLink, Eye, EyeOff, KeyRound, Pencil, Plus, Trash, Tv } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import { ChannelForm, ChannelKeyForm } from "./ChannelForms";
import type { ChannelKeyView, ChannelView } from "../types";

const { Text, Paragraph } = Typography;

function KeyCell({ channelId, k }: { channelId: string; k: ChannelKeyView }) {
  const { run, can } = useApp();
  const [shown, setShown] = useState("");
  const toggle = async () => {
    if (shown) return setShown("");
    const r = await run(() => api<{ key: string }>(`/api/channels/${channelId}/keys/${k.id}`));
    if (r) setShown(r.key);
  };
  return (
    <Space size={2}>
      <Text code style={{ fontSize: 12 }}>{shown || k.keyMasked}</Text>
      {can("streams.operate") && <Tooltip title={shown ? "Ẩn khóa" : "Hiện khóa"}><Button type="text" size="small" icon={shown ? <EyeOff size={14} /> : <Eye size={14} />} onClick={toggle} /></Tooltip>}
      {shown && <CopyButton text={shown} label="Sao chép khóa" iconOnly />}
    </Space>
  );
}

function ChannelCard({ c, onEdit, onAddKey, onEditKey }: { c: ChannelView; onEdit: () => void; onAddKey: () => void; onEditKey: (k: ChannelKeyView) => void }) {
  const { run, busy, can } = useApp();
  const manage = can("streams.operate");
  return (
    <ProCard
      headerBordered
      style={{ marginBottom: 16 }}
      title={<Space><Tv size={18} />{c.name}{c.url && <a href={c.url} target="_blank" rel="noreferrer" title="Mở kênh trên YouTube"><ExternalLink size={14} /></a>}</Space>}
      subTitle={`${c.keys.length} khóa · ${c.streamCount} live`}
      extra={manage && (
        <Space size={4}>
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={onAddKey}>Thêm khóa</Button>
          <Tooltip title="Sửa kênh"><Button size="small" type="text" icon={<Pencil size={15} />} onClick={onEdit} /></Tooltip>
          <Popconfirm title={`Xóa kênh “${c.name}”?`} description="Toàn bộ khóa live của kênh cũng bị xóa." okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}
            disabled={c.streamCount > 0} onConfirm={() => run(() => api(`/api/channels/${c.id}`, { method: "DELETE" }), "Đã xóa kênh.")}>
            <Tooltip title={c.streamCount ? "Kênh còn live đang gắn vào" : "Xóa kênh"}>
              <Button size="small" type="text" danger icon={<Trash size={15} />} disabled={busy || c.streamCount > 0} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )}
    >
      {c.description && <Paragraph type="secondary" style={{ marginTop: -4 }}>{c.description}</Paragraph>}
      <Table<ChannelKeyView>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={c.keys}
        scroll={{ x: 700 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có khóa live nào." /> }}
        columns={[
          { title: "Tên khóa", dataIndex: "name", width: 200, render: (v: string) => <Space size={6}><KeyRound size={14} /><Text strong>{v}</Text></Space> },
          { title: "Khóa live", key: "key", width: 260, render: (_, k) => <KeyCell channelId={c.id} k={k} /> },
          { title: "Mô tả", dataIndex: "description", render: (v?: string) => (v ? <Text style={{ fontSize: 13 }}>{v}</Text> : <Text type="secondary">—</Text>) },
          { title: "Đang dùng", dataIndex: "usedBy", width: 100, align: "center", render: (n: number) => (n ? `${n} live` : <Text type="secondary">—</Text>) },
          ...(manage ? [{
            title: "", key: "act", width: 90, align: "right" as const, render: (_: unknown, k: ChannelKeyView) => (
              <Space size={0}>
                <Tooltip title="Sửa khóa"><Button type="text" size="small" icon={<Pencil size={15} />} onClick={() => onEditKey(k)} /></Tooltip>
                <Popconfirm title={`Xóa khóa “${k.name}”?`} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} disabled={k.usedBy > 0}
                  onConfirm={() => run(() => api(`/api/channels/${c.id}/keys/${k.id}`, { method: "DELETE" }), "Đã xóa khóa live.")}>
                  <Tooltip title={k.usedBy ? "Khóa còn live đang dùng" : "Xóa khóa"}>
                    <Button type="text" size="small" danger icon={<Trash size={15} />} disabled={busy || k.usedBy > 0} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          }] : []),
        ]}
      />
    </ProCard>
  );
}

export function ChannelsTab() {
  const { data, can } = useApp();
  const [channelForm, setChannelForm] = useState<{ channel?: ChannelView } | null>(null);
  const [keyForm, setKeyForm] = useState<{ channel: ChannelView; keyItem?: ChannelKeyView } | null>(null);
  const channels = data?.channels ?? [];

  return (
    <>
      <ProCard
        title={`Danh sách kênh (${channels.length})`}
        headerBordered
        style={{ marginBottom: 16 }}
        extra={can("streams.operate") && <Button type="primary" icon={<Plus size={14} />} onClick={() => setChannelForm({})}>Thêm kênh</Button>}
      >
        <Text type="secondary">
          Lưu sẵn các khóa live YouTube theo từng kênh. Khi tạo Phiên live chỉ cần chọn kênh rồi chọn khóa, không phải dán lại khóa mỗi lần.
        </Text>
      </ProCard>
      {!channels.length
        ? <ProCard><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có kênh nào. Bấm “Thêm kênh” để bắt đầu." /></ProCard>
        : channels.map((c) => (
          <ChannelCard key={c.id} c={c} onEdit={() => setChannelForm({ channel: c })} onAddKey={() => setKeyForm({ channel: c })} onEditKey={(k) => setKeyForm({ channel: c, keyItem: k })} />
        ))}
      {channelForm && <ChannelForm channel={channelForm.channel} onClose={() => setChannelForm(null)} />}
      {keyForm && <ChannelKeyForm channel={keyForm.channel} keyItem={keyForm.keyItem} onClose={() => setKeyForm(null)} />}
    </>
  );
}
