"use client";
import { useMemo, useState } from "react";
import { ProCard } from "@ant-design/pro-components";
import { Button, Empty, Input, Segmented, Space } from "antd";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { StreamCard } from "./StreamCard";
import { StreamForm } from "./StreamForm";
import { MoveDialog } from "./MoveDialog";
import type { StreamView } from "../types";

const FILTERS = [
  { id: "all", label: "Tất cả", test: () => true },
  { id: "live", label: "Đang bật", test: (s: StreamView) => !!s.shouldBeLive },
  { id: "issue", label: "Có sự cố", test: (s: StreamView) => !!(s.ytIssue || s.needsHuman || s.restartHalted || s.health === "error" || s.slow || (s.black && !s.allowBlack)) },
  { id: "schedule", label: "Hẹn giờ", test: (s: StreamView) => s.control === "schedule" },
  { id: "stopped", label: "Đã dừng", test: (s: StreamView) => !s.shouldBeLive },
];

export function StreamsTab() {
  const { data, can, run, busy } = useApp();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ stream?: StreamView } | null>(null);
  const [moving, setMoving] = useState<StreamView | null>(null);
  const streams = data?.streams ?? [];
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const needle = q.trim().toLowerCase();
    return streams.filter((s) => f.test(s) && (!needle || s.name.toLowerCase().includes(needle)));
  }, [streams, filter, q]);

  return (
    <>
      <ProCard
        title={`Danh sách luồng (${streams.length})`}
        headerBordered
        extra={can("streams.operate") && (
          <Space wrap>
            {data?.config.ytApiKey && <Button icon={<RefreshCw size={14} />} disabled={busy} onClick={() => run(() => api<{ checked: number }>("/api/youtube/check", { body: {} }), (r) => `Đã kiểm tra ${r.checked} luồng trên YouTube.`)}>Kiểm tra YouTube</Button>}
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setForm({})}>Tạo luồng</Button>
          </Space>
        )}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ maxWidth: "100%", overflowX: "auto" }}>
            <Segmented value={filter} onChange={(v) => setFilter(String(v))}
              options={FILTERS.map((f) => ({ value: f.id, label: `${f.label} (${streams.filter(f.test).length})` }))} />
          </div>
          <Input allowClear prefix={<Search size={14} />} placeholder="Tìm theo tên luồng…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260, maxWidth: "100%" }} />
        </div>
        {!shown.length
          ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={streams.length ? "Không có luồng nào khớp bộ lọc." : "Chưa có luồng nào. Cần có: 1 máy phát trực tuyến, 1 video sẵn sàng trên máy đó và khóa luồng YouTube."} />
          : <Space direction="vertical" size={12} style={{ width: "100%" }}>{shown.map((s) => <StreamCard key={s.id} s={s} onEdit={() => setForm({ stream: s })} onMove={() => setMoving(s)} />)}</Space>}
      </ProCard>
      {form && <StreamForm stream={form.stream} onClose={() => setForm(null)} />}
      {moving && <MoveDialog stream={moving} onClose={() => setMoving(null)} />}
    </>
  );
}
