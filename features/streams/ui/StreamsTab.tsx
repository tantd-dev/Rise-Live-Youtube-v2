"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Card, Empty } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { StreamCard } from "./StreamCard";
import { StreamForm } from "./StreamForm";
import { MoveDialog } from "./MoveDialog";
import type { StreamView } from "../types";

const FILTERS = [
  { id: "all", label: "Tất cả", test: () => true },
  { id: "live", label: "Đang đặt phát", test: (s: StreamView) => s.shouldBeLive },
  { id: "issue", label: "Có vấn đề", test: (s: StreamView) => !!(s.ytIssue || s.needsHuman || s.restartHalted || s.health === "error" || s.slow || (s.black && !s.allowBlack)) },
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
      <Card
        title={`🔴 Luồng phát (${streams.length})`}
        action={can("streams.operate") && (
          <div className="row-actions">
            {data?.config.ytApiKey && <button disabled={busy} onClick={() => run(() => api<{ checked: number }>("/api/youtube/check", { body: {} }), (r) => `Đã kiểm ${r.checked} luồng trên YouTube.`)}>Kiểm YouTube</button>}
            <button className="btn-primary" onClick={() => setForm({})}>+ Tạo luồng</button>
          </div>
        )}
      >
        <div className="filters">
          {FILTERS.map((f) => <button key={f.id} className={filter === f.id ? "chip on" : "chip"} onClick={() => setFilter(f.id)}>{f.label} ({streams.filter(f.test).length})</button>)}
          <input className="search" placeholder="Tìm theo tên…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!shown.length ? <Empty>{streams.length ? "Không có luồng khớp bộ lọc." : "Chưa có luồng nào. Cần: 1 máy online + 1 video sẵn sàng trên máy đó + khoá luồng YouTube."}</Empty>
          : <div className="stream-list">{shown.map((s) => <StreamCard key={s.id} s={s} onEdit={() => setForm({ stream: s })} onMove={() => setMoving(s)} />)}</div>}
      </Card>
      {form && <StreamForm stream={form.stream} onClose={() => setForm(null)} />}
      {moving && <MoveDialog stream={moving} onClose={() => setMoving(null)} />}
    </>
  );
}
