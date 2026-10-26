"use client";
// Form thêm / sửa máy.
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/client/api";
import type { MachineView } from "../types";

export function MachineForm({ machine, onClose, onCreated }: { machine?: MachineView; onClose: () => void; onCreated?: (id: string) => void }) {
  const { run, busy } = useApp();
  const [f, setF] = useState({
    name: machine?.name ?? "", ip: machine?.ip ?? "", role: machine?.role ?? "stream-247", provider: machine?.provider ?? "", region: machine?.region ?? "",
    uploadMbps: machine?.uploadMbpsManual ? String(machine.uploadMbps ?? "") : "", uploadHttpsUrl: machine?.uploadHttpsUrl ?? "",
    costAmount: machine?.costAmount != null ? String(machine.costAmount) : "", costPeriod: machine?.costPeriod ?? "month", costRenewAt: machine?.costRenewAt ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    const body = { ...f, uploadMbps: f.uploadMbps === "" ? 0 : Number(f.uploadMbps), costAmount: f.costAmount === "" ? null : Number(f.costAmount) };
    const r = machine
      ? await run(() => api(`/api/machines/${machine.id}`, { method: "PATCH", body }), "Đã lưu máy.")
      : await run(() => api<{ id: string }>("/api/machines", { body }), "Đã thêm máy — giờ cài worker lên VPS.");
    if (r) { onClose(); if (!machine && r && typeof r === "object" && "id" in r) onCreated?.(String(r.id)); }
  };
  return (
    <Modal title={machine ? `Sửa máy "${machine.name}"` : "Thêm máy live (VPS)"} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Tên máy"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="VPS 01" /></Field>
        <Field label="IP" hint="Dùng để máy khác chép video VPS→VPS (cổng 8099). Chạy thử trên máy mình: 127.0.0.1"><input value={f.ip} onChange={(e) => set("ip", e.target.value)} /></Field>
        <Field label="Vai trò">
          <select value={f.role} onChange={(e) => set("role", e.target.value)}>
            <option value="stream-247">Live 24/7</option><option value="live-pub">Live Pub</option><option value="shared">Dùng chung</option>
          </select>
        </Field>
        <Field label="Nhà cung cấp"><input value={f.provider} onChange={(e) => set("provider", e.target.value)} /></Field>
        <Field label="Khu vực"><input value={f.region} onChange={(e) => set("region", e.target.value)} /></Field>
        <Field label="Băng thông đẩy (Mbps)" hint="Bỏ trống = worker tự đo (speedtest). Nhập số = đặt tay."><input type="number" min={0} value={f.uploadMbps} onChange={(e) => set("uploadMbps", e.target.value)} /></Field>
        <Field label="Địa chỉ HTTPS nhận file (tuỳ chọn)" hint="VD https://live1.ten-mien.vn — khối cài sẽ tự dựng Caddy."><input value={f.uploadHttpsUrl} onChange={(e) => set("uploadHttpsUrl", e.target.value)} /></Field>
        <Field label="Giá thuê"><input type="number" min={0} value={f.costAmount} onChange={(e) => set("costAmount", e.target.value)} /></Field>
        <Field label="Chu kỳ"><select value={f.costPeriod} onChange={(e) => set("costPeriod", e.target.value)}><option value="month">tháng</option><option value="year">năm</option></select></Field>
        <Field label="Hết hạn thuê (để nhắc gia hạn)"><input type="date" value={f.costRenewAt} onChange={(e) => set("costRenewAt", e.target.value)} /></Field>
      </div>
      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>Huỷ</button>
        <button className="btn-primary" disabled={busy || !f.name || !f.ip} onClick={submit}>{machine ? "Lưu" : "Thêm máy"}</button>
      </div>
    </Modal>
  );
}
