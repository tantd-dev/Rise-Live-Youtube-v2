"use client";
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Card, Empty, Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDuration, fmtMb, fmtTime } from "@/lib/client/format";
import { AddAssetForm } from "./AddAssetForm";
import { UploadForm } from "./UploadForm";
import { ASSET_STATUS_LABEL, type Asset } from "../types";

function StatusCell({ a }: { a: Asset }) {
  const tone = a.status === "ready" ? "green" : a.status === "error" ? "red" : "blue";
  return (
    <>
      <Pill tone={tone}>{ASSET_STATUS_LABEL[a.status] ?? a.status}</Pill>
      {a.progressPct != null && <div className="progress"><div style={{ width: `${a.progressPct}%` }} /></div>}
      {a.progressPct != null && <div className="muted small">{a.progressPct}% · {fmtMb(a.downloadedMb)} / {fmtMb(a.totalMb)}</div>}
      {a.queueAhead ? <div className="muted small">còn {a.queueAhead} video phía trước</div> : null}
      {a.status === "error" && a.error && <div className="err small">{a.error}</div>}
    </>
  );
}

export function AssetsTab() {
  const { data, can, run, busy } = useApp();
  const [machineFilter, setMachineFilter] = useState("");
  const [copyTarget, setCopyTarget] = useState<Record<string, string>>({});
  const machines = data?.machines ?? [];
  const mName = (id: string) => machines.find((m) => m.id === id)?.name ?? "(máy đã xoá)";
  const assets = (data?.assets ?? []).filter((a) => !machineFilter || a.machineId === machineFilter);
  const usedBy = (id: string) => (data?.streams ?? []).filter((s) => (s.assetIds?.length ? s.assetIds : [s.assetId]).includes(id)).map((s) => s.name);
  const manage = can("assets.manage");

  return (
    <>
      {manage && (
        <Card title="➕ Thêm video">
          <h4>Từ Google Drive</h4>
          <AddAssetForm />
          <h4>Tải thẳng từ máy tính</h4>
          <UploadForm />
        </Card>
      )}
      <Card title={`🎞 Kho video (${assets.length})`} action={
        <select value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
          <option value="">Mọi máy</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      }>
        {!assets.length ? <Empty>Chưa có video.</Empty> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Tên</th><th>Máy</th><th>Trạng thái</th><th>Thông tin</th><th>Thêm lúc</th><th /></tr></thead>
              <tbody>
                {assets.map((a) => {
                  const users = usedBy(a.id);
                  return (
                    <tr key={a.id}>
                      <td><b>{a.name}</b>{a.sourceUrl ? <div className="muted small"><a href={a.sourceUrl} target="_blank" rel="noreferrer">Drive</a>{a.copyFromAssetId ? " · bản sao" : ""}</div> : <div className="muted small">{a.source === "upload" ? "tải thẳng" : a.copyFromAssetId ? "bản sao" : ""}</div>}</td>
                      <td>{mName(a.machineId)}</td>
                      <td><StatusCell a={a} /></td>
                      <td className="small">{a.width ? `${a.width}×${a.height}` : "—"} · {fmtDuration(a.durationSec)} · {fmtMb(a.sizeMb)}{users.length ? <div className="muted">dùng bởi: {users.join(", ")}</div> : null}</td>
                      <td className="small">{fmtTime(a.createdAt)}</td>
                      <td className="nowrap">
                        {manage && (
                          <div className="row-actions">
                            <select value={copyTarget[a.id] ?? ""} onChange={(e) => setCopyTarget({ ...copyTarget, [a.id]: e.target.value })} disabled={a.status !== "ready"}>
                              <option value="">Sao chép sang…</option>
                              {machines.filter((m) => m.id !== a.machineId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            {copyTarget[a.id] && <button disabled={busy} onClick={() => run(() => api(`/api/assets/${a.id}/copy`, { body: { targetMachineId: copyTarget[a.id] } }), "Đã tạo bản sao — máy đích đang kéo file.")}>Chép</button>}
                            <button disabled={busy} onClick={() => { const n = prompt("Tên mới:", a.name); if (n && n !== a.name) void run(() => api(`/api/assets/${a.id}`, { method: "PATCH", body: { name: n } }), "Đã đổi tên."); }}>Đổi tên</button>
                            <button className="btn-ghost danger" disabled={busy || users.length > 0} title={users.length ? "Đang được luồng dùng" : ""} onClick={() => confirm(`Xoá video "${a.name}"? File trên máy cũng bị dọn.`) && run(() => api(`/api/assets/${a.id}`, { method: "DELETE" }), "Đã xoá video.")}>Xoá</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
