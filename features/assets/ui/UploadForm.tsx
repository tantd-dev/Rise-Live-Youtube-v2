"use client";
// Tải file video TRỰC TIẾP từ máy tính lên worker của 1 máy (worker nghe cổng 8099; nên có HTTPS qua Caddy).
import { useState } from "react";
import { Alert, Button, Form, Progress, Select, Upload } from "antd";
import { CloudUpload, FileVideoCamera } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { ORIGINAL_PRESET_ID } from "../presets";

function putWithProgress(url: string, file: File, onPct: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded * 100) / e.total)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`VPS trả lỗi ${x.status}: ${x.responseText.slice(0, 200)}`)));
    x.onerror = () => reject(new Error("Không kết nối được tới VPS (kiểm tra cổng 8099 hoặc địa chỉ HTTPS của máy)."));
    x.send(file);
  });
}

export function UploadForm() {
  const { data, toast, reload } = useApp();
  const [machineId, setMachineId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  if (!data?.config.uploadEnabled) {
    return <Alert type="info" showIcon message="Chức năng tải lên trực tiếp đang tắt" description={<>Đặt <code>RISE_LIVE_UPLOAD_TOKEN</code> trên máy chủ điều khiển và trong lệnh cài worker để bật.</>} />;
  }

  const upload = async () => {
    if (!file || !machineId) return;
    try {
      const t = await api<{ url: string; token: string; email: string }>("/api/assets/upload-target", { body: { machineId } });
      const qs = new URLSearchParams({ token: t.token, name: file.name.replace(/\.[^.]+$/, ""), email: t.email, preset: ORIGINAL_PRESET_ID });
      setPct(0);
      await putWithProgress(`${t.url}/upload?${qs}`, file, setPct);
      toast("Đã tải lên. Video sẽ xuất hiện trong kho sau vài giây.");
      setFile(null);
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setPct(null);
    }
  };
  return (
    <Form layout="vertical" requiredMark={false}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 16 }}>
        <Form.Item label="File video" tooltip="Nên dùng file .mp4 đã chuẩn hóa sẵn (H.264/AAC) để phát không cần chuyển mã.">
          <Upload
            accept="video/*" maxCount={1} disabled={pct !== null}
            beforeUpload={(f) => { setFile(f); return false; }}
            onRemove={() => setFile(null)}
            fileList={file ? [{ uid: "1", name: file.name, status: "done" }] : []}
          >
            <Button icon={<FileVideoCamera size={14} />}>Chọn file…</Button>
          </Upload>
        </Form.Item>
        <Form.Item label="Tải lên VPS">
          <Select value={machineId} onChange={setMachineId} placeholder="Chọn VPS"
            options={data.machines.map((m) => ({ value: m.id, label: `${m.name}${m.uploadHttpsUrl ? " (HTTPS)" : ""}` }))} />
        </Form.Item>
        <Form.Item label=" ">
          <Button type="primary" block disabled={!file || !machineId} loading={pct !== null} onClick={upload} icon={<CloudUpload size={14} />}>
            {pct !== null ? `Đang tải lên ${pct}%` : "Tải lên"}
          </Button>
          {pct !== null && <Progress percent={pct} size="small" />}
        </Form.Item>
      </div>
    </Form>
  );
}
