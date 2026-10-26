"use client";
// Tải file video THẲNG từ máy tính lên worker của 1 máy (worker nghe cổng 8099; nên có HTTPS qua Caddy).
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Field } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { ORIGINAL_PRESET_ID } from "../presets";

function putWithProgress(url: string, file: File, onPct: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded * 100) / e.total)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Máy trả lỗi ${x.status}: ${x.responseText.slice(0, 200)}`)));
    x.onerror = () => reject(new Error("Không kết nối được tới máy (kiểm cổng 8099 / HTTPS của máy)."));
    x.send(file);
  });
}

export function UploadForm() {
  const { data, toast, reload } = useApp();
  const [machineId, setMachineId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  if (!data?.config.uploadEnabled) return <p className="muted">Tải thẳng đang tắt — đặt RISE_LIVE_UPLOAD_TOKEN trên máy chủ và trong khối cài worker.</p>;

  const upload = async () => {
    if (!file || !machineId) return;
    try {
      const t = await api<{ url: string; token: string; email: string }>("/api/assets/upload-target", { body: { machineId } });
      const qs = new URLSearchParams({ token: t.token, name: file.name.replace(/\.[^.]+$/, ""), email: t.email, preset: ORIGINAL_PRESET_ID });
      setPct(0);
      await putWithProgress(`${t.url}/upload?${qs}`, file, setPct);
      toast("Đã tải lên — video hiện trong kho sau vài giây.");
      setFile(null);
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setPct(null);
    }
  };
  return (
    <div className="form-grid">
      <Field label="File video (.mp4 đã chuẩn hoá sẵn)"><input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
      <Field label="Lên máy">
        <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">— chọn máy —</option>
          {data.machines.map((m) => <option key={m.id} value={m.id}>{m.name}{m.uploadHttpsUrl ? " (HTTPS)" : ""}</option>)}
        </select>
      </Field>
      <div className="field"><span className="field-label">&nbsp;</span>
        <button className="btn-primary" disabled={!file || !machineId || pct !== null} onClick={upload}>{pct !== null ? `Đang tải ${pct}%` : "Tải lên"}</button>
      </div>
    </div>
  );
}
