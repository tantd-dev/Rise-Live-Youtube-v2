"use client";
// Chuyển luồng đang phát sang máy khác — chỉ chọn được máy đã có sẵn video.
import { useEffect, useState } from "react";
import { Alert, Button, Modal, Table, Typography } from "antd";
import { ArrowLeftRight } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import type { MoveCandidate } from "@/features/failover/rules";
import type { StreamView } from "../types";

export function MoveDialog({ stream, onClose }: { stream: StreamView; onClose: () => void }) {
  const { run, busy, confirm } = useApp();
  const [cands, setCands] = useState<MoveCandidate[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ candidates: MoveCandidate[] }>(`/api/streams/${stream.id}/move`).then((r) => setCands(r.candidates)).catch((e) => setErr(e.message));
  }, [stream.id]);
  const move = async (c: MoveCandidate) => {
    if (!(await confirm({ title: `Chuyển “${stream.name}” sang “${c.name}”?`, content: "Máy cũ sẽ dừng trước, sau đó máy mới mới bắt đầu phát — luồng sẽ mất sóng vài giây.", okText: "Chuyển máy" }))) return;
    if (await run(() => api(`/api/streams/${stream.id}/move`, { body: { targetId: c.machineId } }), "Đang chuyển máy. Theo dõi trạng thái ở thẻ luồng.")) onClose();
  };
  return (
    <Modal open title={`Chuyển máy phát: ${stream.name}`} onCancel={onClose} footer={null} width={640} destroyOnHidden>
      {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 12 }} />}
      <Table<MoveCandidate>
        rowKey="machineId"
        size="small"
        loading={!cands && !err}
        dataSource={cands ?? []}
        pagination={false}
        locale={{ emptyText: "Không có máy phát nào khác." }}
        columns={[
          { title: "Máy phát", dataIndex: "name", render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
          { title: "Khả năng chuyển", key: "ok", render: (_, c) => (c.ok ? <Pill tone="green">Chuyển được</Pill> : <Typography.Text type="danger">{c.reasons.join(", ")}</Typography.Text>) },
          { title: "Băng thông còn trống", dataIndex: "freeMbps", render: (v: number | null) => (v != null ? `${v} Mbps` : "—") },
          { key: "act", align: "right", render: (_, c) => <Button size="small" type="primary" icon={<ArrowLeftRight size={14} />} disabled={!c.ok || busy} onClick={() => move(c)}>Chuyển</Button> },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        Máy đích phải có sẵn video của luồng (vào Kho video → Sao chép sang máy khác).
      </Typography.Paragraph>
    </Modal>
  );
}
