"use client";
// Form thêm/sửa kênh và thêm/sửa khóa live (dùng ở trang Quản lý kênh và ngay trong form Tạo Phiên live).
import { Form, Input, Modal } from "antd";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { checkStreamKey } from "@/features/streams/stream-key";
import type { ChannelKeyView, ChannelView } from "../types";

export function ChannelForm({ channel, onClose, onSaved }: { channel?: ChannelView; onClose: () => void; onSaved?: (id: string) => void }) {
  const { run, busy } = useApp();
  const [form] = Form.useForm<{ name: string; url: string; description: string }>();
  const submit = async (v: { name: string; url: string; description: string }) => {
    const r = channel
      ? await run(() => api(`/api/channels/${channel.id}`, { method: "PATCH", body: v }), "Đã lưu kênh.")
      : await run(() => api<{ id: string }>("/api/channels", { body: v }), "Đã thêm kênh.");
    if (r) { onClose(); onSaved?.(channel ? channel.id : String((r as { id: string }).id)); }
  };
  return (
    <Modal open title={channel ? `Sửa kênh “${channel.name}”` : "Thêm kênh"} onCancel={onClose} destroyOnHidden
      okText={channel ? "Lưu" : "Thêm kênh"} cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" onFinish={submit}
        initialValues={{ name: channel?.name ?? "", url: channel?.url ?? "", description: channel?.description ?? "" }}>
        <Form.Item name="name" label="Tên kênh" rules={[{ required: true, whitespace: true, message: "Nhập tên kênh" }]}>
          <Input placeholder="VD: Nhạc Thiền Chill" />
        </Form.Item>
        <Form.Item name="url" label="Link kênh YouTube" rules={[{ pattern: /^$|^https?:\/\//i, message: "Link phải bắt đầu bằng https://" }]}>
          <Input placeholder="https://www.youtube.com/@ten-kenh" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} placeholder="Ghi chú về kênh (không bắt buộc)" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

const fromCheck = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? Promise.resolve() : Promise.reject(new Error(r.error)));

/** Thêm khóa (không truyền `keyItem`) hoặc sửa khóa. Khi sửa, để trống ô khóa = giữ khóa cũ. */
export function ChannelKeyForm({ channel, keyItem, onClose, onSaved }: {
  channel: Pick<ChannelView, "id" | "name">; keyItem?: ChannelKeyView; onClose: () => void; onSaved?: (keyId: string) => void;
}) {
  const { run, busy } = useApp();
  const [form] = Form.useForm<{ name: string; key: string; description: string }>();
  const submit = async (v: { name: string; key: string; description: string }) => {
    const body = { name: v.name, description: v.description, key: v.key.trim() || undefined };
    const r = keyItem
      ? await run(() => api(`/api/channels/${channel.id}/keys/${keyItem.id}`, { method: "PATCH", body }), "Đã lưu khóa live.")
      : await run(() => api<{ id: string }>(`/api/channels/${channel.id}/keys`, { body }), "Đã thêm khóa live.");
    if (r) { onClose(); onSaved?.(keyItem ? keyItem.id : String((r as { id: string }).id)); }
  };
  return (
    <Modal open title={keyItem ? `Sửa khóa “${keyItem.name}”` : `Thêm khóa live cho kênh “${channel.name}”`} onCancel={onClose} destroyOnHidden
      okText={keyItem ? "Lưu" : "Thêm khóa"} cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" onFinish={submit}
        initialValues={{ name: keyItem?.name ?? "", key: "", description: keyItem?.description ?? "" }}>
        <Form.Item name="name" label="Tên khóa" rules={[{ required: true, whitespace: true, message: "Nhập tên khóa" }]}>
          <Input placeholder="VD: Khóa chính 1080p" />
        </Form.Item>
        <Form.Item name="key" label="Khóa live YouTube"
          rules={[...(keyItem ? [] : [{ required: true, whitespace: true, message: "Dán khóa live từ YouTube Studio" }]), { validator: (_, v) => (v ? fromCheck(checkStreamKey(v)) : Promise.resolve()) }]}
          extra={keyItem ? `Đang dùng ${keyItem.keyMasked}. Để trống nếu muốn giữ khóa hiện tại.` : "Lấy tại YouTube Studio › Phát trực tiếp › Khóa live."}>
          <Input.Password placeholder="xxxx-xxxx-xxxx-xxxx-xxxx" autoComplete="off" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} placeholder="VD: Dùng cho live nhạc buổi tối, độ phân giải 1080p" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
