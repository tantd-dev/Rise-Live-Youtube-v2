"use client";
// Form thêm / sửa VPS.
import { DatePicker, Form, Input, InputNumber, Modal, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { MACHINE_ROLE_LABEL, type MachineView } from "../types";

interface Values {
  name: string; ip: string; role: string; provider: string; region: string;
  uploadMbps: number | null; uploadHttpsUrl: string; costAmount: number | null; costPeriod: string; costRenewAt: Dayjs | null;
}

export function MachineForm({ machine, onClose, onCreated }: { machine?: MachineView; onClose: () => void; onCreated?: (id: string) => void }) {
  const { run, busy } = useApp();
  const [form] = Form.useForm<Values>();
  const initial: Values = {
    name: machine?.name ?? "", ip: machine?.ip ?? "", role: machine?.role ?? "stream-247", provider: machine?.provider ?? "", region: machine?.region ?? "",
    uploadMbps: machine?.uploadMbpsManual ? machine.uploadMbps ?? null : null, uploadHttpsUrl: machine?.uploadHttpsUrl ?? "",
    costAmount: machine?.costAmount ?? null, costPeriod: machine?.costPeriod ?? "month", costRenewAt: machine?.costRenewAt ? dayjs(machine.costRenewAt) : null,
  };
  const submit = async (v: Values) => {
    const body = { ...v, uploadMbps: v.uploadMbps ?? 0, costAmount: v.costAmount ?? null, costRenewAt: v.costRenewAt ? v.costRenewAt.format("YYYY-MM-DD") : "" };
    const r = machine
      ? await run(() => api(`/api/machines/${machine.id}`, { method: "PATCH", body }), "Đã lưu thông tin VPS.")
      : await run(() => api<{ id: string }>("/api/machines", { body }), "Đã thêm VPS. Bước tiếp theo: cài worker lên VPS.");
    if (r) { onClose(); if (!machine && r && typeof r === "object" && "id" in r) onCreated?.(String(r.id)); }
  };
  return (
    <Modal open title={machine ? `Sửa VPS “${machine.name}”` : "Thêm VPS (VPS)"} onCancel={onClose} width={860} destroyOnHidden
      okText={machine ? "Lưu" : "Thêm máy"} cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 16 }}>
          <Form.Item name="name" label="Tên máy" rules={[{ required: true, whitespace: true, message: "Nhập tên máy" }]}><Input placeholder="VD: VPS 01" /></Form.Item>
          <Form.Item name="ip" label="Địa chỉ IP" rules={[{ required: true, whitespace: true, message: "Nhập địa chỉ IP" }]}
            tooltip="Dùng để các máy khác sao chép video trực tiếp (cổng 8099). Khi chạy thử trên máy tính của bạn, nhập 127.0.0.1.">
            <Input placeholder="VD: 103.20.30.40" />
          </Form.Item>
          <Form.Item name="role" label="Vai trò">
            <Select options={Object.entries(MACHINE_ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="provider" label="Nhà cung cấp"><Input placeholder="VD: Vultr, Viettel IDC…" /></Form.Item>
          <Form.Item name="region" label="Khu vực"><Input placeholder="VD: Singapore" /></Form.Item>
          <Form.Item name="uploadMbps" label="Băng thông tải lên (Mbps)" tooltip="Để trống thì worker tự đo bằng speedtest. Nhập số để đặt thủ công.">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Tự đo" />
          </Form.Item>
          <Form.Item name="uploadHttpsUrl" label="Địa chỉ HTTPS nhận file" tooltip="Không bắt buộc. VD: https://live1.ten-mien.vn — lệnh cài sẽ tự cấu hình Caddy."
            rules={[{ pattern: /^$|^https:\/\//, message: "Địa chỉ phải bắt đầu bằng https://" }]}>
            <Input placeholder="https://live1.ten-mien.vn" />
          </Form.Item>
          <Form.Item name="costAmount" label="Giá thuê (VNĐ)">
            <InputNumber<number> min={0} style={{ width: "100%" }} formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} parser={(v) => (v ?? "").replace(/\D/g, "") as unknown as number} />
          </Form.Item>
          <Form.Item name="costPeriod" label="Chu kỳ thanh toán">
            <Select options={[{ value: "month", label: "Theo tháng" }, { value: "year", label: "Theo năm" }]} />
          </Form.Item>
          <Form.Item name="costRenewAt" label="Ngày hết hạn thuê" tooltip="Hệ thống sẽ nhắc gia hạn trước ngày này.">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
