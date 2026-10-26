"use client";
// Thêm video từ link Google Drive → worker trên máy đã chọn tự tải về.
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Field } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { checkDriveLink } from "../drive-link";

export function AddAssetForm() {
  const { data, run, busy } = useApp();
  const [f, setF] = useState({ name: "", sourceUrl: "", machineId: "" });
  const linkErr = f.sourceUrl ? (() => { const r = checkDriveLink(f.sourceUrl); return r.ok ? "" : r.error; })() : "";
  const submit = async () => {
    const r = await run(() => api<{ reused?: boolean }>("/api/assets", { body: f }),
      (x) => x.reused ? "Đã thêm — máy khác đã có video này, hệ chép thẳng từ máy đó (không tải lại Drive)." : "Đã thêm — máy sẽ tự tải video về.");
    if (r) setF({ name: "", sourceUrl: "", machineId: f.machineId });
  };
  return (
    <div className="form-grid">
      <Field label="Tên video"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Link Google Drive (chia sẻ: bất kỳ ai có link)" hint={linkErr && <span className="err">{linkErr}</span>}>
        <input value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} placeholder="https://drive.google.com/file/d/…/view" />
      </Field>
      <Field label="Tải về máy">
        <select value={f.machineId} onChange={(e) => setF({ ...f, machineId: e.target.value })}>
          <option value="">— chọn máy —</option>
          {data?.machines.map((m) => <option key={m.id} value={m.id}>{m.name}{m.online ? "" : " (offline)"}</option>)}
        </select>
      </Field>
      <div className="field"><span className="field-label">&nbsp;</span><button className="btn-primary" disabled={busy || !!linkErr || !f.name || !f.sourceUrl || !f.machineId} onClick={submit}>Thêm video</button></div>
    </div>
  );
}
