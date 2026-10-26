"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Card, Empty } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import type { IncidentRow } from "../types";

export function IncidentsTab() {
  const { data } = useApp();
  const [rows, setRows] = useState<IncidentRow[] | null>(null);
  const [err, setErr] = useState("");
  const [machine, setMachine] = useState("");
  const load = () => api<{ rows: IncidentRow[] }>("/api/incidents").then((r) => { setRows(r.rows); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  const mName = (id: string) => data?.machines.find((m) => m.id === id)?.name ?? id;
  const shown = (rows ?? []).filter((r) => !machine || r.machineId === machine);
  return (
    <Card title="🛠 Nhật ký sự cố" action={
      <div className="row-actions">
        <select value={machine} onChange={(e) => setMachine(e.target.value)}>
          <option value="">Mọi máy</option>
          {data?.machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button onClick={load}>Làm mới</button>
      </div>
    }>
      {err && <p className="err">{err}</p>}
      {!rows ? <p className="muted">Đang tải…</p> : !shown.length ? <Empty>Chưa có sự cố nào.</Empty> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Lúc</th><th>Luồng</th><th>Máy</th><th>Loại</th><th>Chi tiết</th><th>Mất sóng</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td className="small nowrap">{fmtTime(r.at)}</td>
                  <td>{r.streamName}</td>
                  <td className="small">{mName(r.machineId)}</td>
                  <td>{r.kind}</td>
                  <td className="small">{r.detail}</td>
                  <td className="small">{r.downSec != null ? `${r.downSec}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
