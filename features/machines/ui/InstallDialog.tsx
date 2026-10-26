"use client";
// Mã máy + khối lệnh cài worker (có vé riêng của máy) để dán vào SSH.
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import type { MachineView } from "../types";

export function InstallDialog({ machine, onClose }: { machine: MachineView; onClose: () => void }) {
  const [res, setRes] = useState<{ script: string; token: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ script: string; token: string }>(`/api/machines/${machine.id}/install`).then(setRes).catch((e) => setErr(e.message));
  }, [machine.id]);
  const localEnv = res ? `RISE_LIVE_MACHINE=${machine.id}\nRISE_LIVE_TOKEN=${res.token}` : "";
  return (
    <Modal title={`Cài worker cho "${machine.name}"`} onClose={onClose} wide>
      <p>Mã máy: <code>{machine.id}</code> <CopyButton text={machine.id} label="Chép mã máy" /></p>
      {err && <p className="err">{err}</p>}
      {res && (
        <>
          <h4>Trên VPS (Ubuntu) — SSH vào rồi dán nguyên khối</h4>
          <p className="muted">Tự cài python3 · ffmpeg · yt-dlp · gdown, tải worker, tạo dịch vụ systemd tự khởi động lại. Chạy lại = cập nhật worker. Vé RIÊNG của máy đã điền sẵn.</p>
          <pre className="code">{res.script}</pre>
          <CopyButton text={res.script} label="Chép khối lệnh" />
          <h4>Chạy thử trên máy mình (WSL)</h4>
          <p className="muted">Ghi 2 dòng này vào <code>.env.local</code> rồi chạy <code>npm run worker</code>:</p>
          <pre className="code">{localEnv}</pre>
          <CopyButton text={localEnv} />
        </>
      )}
      <p className="muted">Máy chuyển sang 🟢 Online trong ~20 giây sau khi worker chạy. 404 = sai mã máy · 401 = sai vé.</p>
    </Modal>
  );
}
