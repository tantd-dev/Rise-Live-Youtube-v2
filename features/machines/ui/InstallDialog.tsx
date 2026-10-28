"use client";
// Mã máy + lệnh cài worker (kèm mã xác thực riêng của máy) để dán vào SSH.
import { useEffect, useState } from "react";
import { Alert, Modal, Space, Spin, Typography } from "antd";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import type { MachineView } from "../types";

const { Paragraph, Text, Title } = Typography;

export function InstallDialog({ machine, onClose }: { machine: MachineView; onClose: () => void }) {
  const [res, setRes] = useState<{ script: string; token: string } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ script: string; token: string }>(`/api/machines/${machine.id}/install`).then(setRes).catch((e) => setErr(e.message));
  }, [machine.id]);
  const localEnv = res ? `RISE_LIVE_MACHINE=${machine.id}\nRISE_LIVE_TOKEN=${res.token}` : "";
  return (
    <Modal open title={`Cài worker cho máy “${machine.name}”`} onCancel={onClose} footer={null} width={900} destroyOnHidden>
      <Space align="center" style={{ marginBottom: 12 }}>
        <Text>Mã máy:</Text><Text code>{machine.id}</Text><CopyButton text={machine.id} label="Sao chép mã máy" />
      </Space>
      {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} />}
      {!res && !err && <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>}
      {res && (
        <>
          <Title level={5}>Cài trên VPS (Ubuntu): SSH vào máy rồi dán toàn bộ lệnh dưới đây</Title>
          <Paragraph type="secondary">
            Lệnh sẽ tự cài python3, ffmpeg, yt-dlp, gdown, tải worker và tạo dịch vụ systemd tự khởi động lại.
            Chạy lại lệnh này để cập nhật worker. Mã xác thực riêng của máy đã được điền sẵn.
          </Paragraph>
          <pre className="code">{res.script}</pre>
          <CopyButton text={res.script} label="Sao chép lệnh cài" />
          <Title level={5} style={{ marginTop: 20 }}>Chạy thử trên máy tính của bạn (WSL)</Title>
          <Paragraph type="secondary">Thêm 2 dòng sau vào <Text code>.env.local</Text> rồi chạy <Text code>npm run worker</Text>:</Paragraph>
          <pre className="code">{localEnv}</pre>
          <CopyButton text={localEnv} />
        </>
      )}
      <Alert type="info" showIcon style={{ marginTop: 20 }}
        message="Máy sẽ chuyển sang trạng thái Trực tuyến khoảng 20 giây sau khi worker chạy."
        description="Lỗi HTTP 404 = sai mã máy · HTTP 401 = sai mã xác thực." />
    </Modal>
  );
}
