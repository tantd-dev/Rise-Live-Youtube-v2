"use client";
// Thêm video từ link Google Drive → worker trên máy đã chọn tự tải về.
import { Button, Form, Input, Select } from "antd";
import { Plus } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { checkDriveLink } from "../drive-link";

interface Values { name: string; sourceUrl: string; machineId: string }

export function AddAssetForm() {
  const { data, run, busy } = useApp();
  const [form] = Form.useForm<Values>();
  const submit = async (v: Values) => {
    const r = await run(() => api<{ reused?: boolean }>("/api/assets", { body: v }),
      (x) => x.reused ? "Đã thêm. Máy khác đã có video này nên hệ thống sao chép trực tiếp từ máy đó (không tải lại từ Drive)." : "Đã thêm. VPS sẽ tự tải video về.");
    if (r) form.setFieldsValue({ name: "", sourceUrl: "" });
  };
  return (
    <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 16 }}>
        <Form.Item name="name" label="Tên video" rules={[{ required: true, whitespace: true, message: "Nhập tên video" }]}>
          <Input placeholder="VD: Nhạc thiền 10 giờ" />
        </Form.Item>
        <Form.Item name="sourceUrl" label="Link Google Drive" tooltip="File phải được chia sẻ ở chế độ “Bất kỳ ai có đường liên kết”."
          rules={[{ required: true, message: "Dán link Google Drive" }, { validator: (_, v) => { if (!v) return Promise.resolve(); const r = checkDriveLink(v); return r.ok ? Promise.resolve() : Promise.reject(new Error(r.error)); } }]}>
          <Input placeholder="https://drive.google.com/file/d/…/view" />
        </Form.Item>
        <Form.Item name="machineId" label="Tải về VPS" rules={[{ required: true, message: "Chọn VPS" }]}>
          <Select placeholder="Chọn VPS" options={data?.machines.map((m) => ({ value: m.id, label: `${m.name}${m.online ? "" : " (ngoại tuyến)"}` }))} />
        </Form.Item>
        <Form.Item label=" ">
          <Button type="primary" htmlType="submit" loading={busy} icon={<Plus size={14} />} block>Thêm video</Button>
        </Form.Item>
      </div>
    </Form>
  );
}
