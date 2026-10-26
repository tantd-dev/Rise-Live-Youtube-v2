"use client";
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Card, Empty, Pill } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import { fmtAgo } from "@/lib/client/format";
import { SAFETY_FACTOR } from "@/features/assets/presets";
import { daysToRenew } from "../rules";
import { MACHINE_ROLE_LABEL, type MachineView } from "../types";
import { MachineForm } from "./MachineForm";
import { InstallDialog } from "./InstallDialog";

function StatusPill({ m }: { m: MachineView }) {
  if (m.forceOffline) return <Pill tone="red">⛔ Đã ngắt</Pill>;
  if (m.maintenance) return <Pill tone="amber">🛠 Bảo trì</Pill>;
  return m.online ? <Pill tone="green">🟢 Online</Pill> : <Pill tone="gray">Offline</Pill>;
}

function Bandwidth({ m }: { m: MachineView }) {
  if (!m.uploadMbps) return <span className="muted">chưa đo</span>;
  const pct = m.txMbps != null ? Math.round((m.txMbps / m.uploadMbps) * 100) : null;
  return (
    <>
      {m.txMbps != null ? `${m.txMbps}/` : ""}{m.uploadMbps} Mbps{m.uploadMbpsManual ? " (đặt tay)" : ""}
      {pct != null && <div className="progress"><div className={pct >= SAFETY_FACTOR * 100 ? "bar-red" : ""} style={{ width: `${Math.min(100, pct)}%` }} /></div>}
    </>
  );
}

export function MachinesTab() {
  const { data, can, run, busy } = useApp();
  const [form, setForm] = useState<{ machine?: MachineView } | null>(null);
  const [install, setInstall] = useState<MachineView | null>(null);
  const machines = data?.machines ?? [];
  const admin = can("machines.manage");
  const patch = (m: MachineView, body: Record<string, unknown>, ok: string) => run(() => api(`/api/machines/${m.id}`, { method: "PATCH", body }), ok);

  return (
    <>
      <Card title={`🖥 Máy live (${machines.length})`} action={admin && <button className="btn-primary" onClick={() => setForm({})}>+ Thêm máy</button>}>
        {!machines.length ? <Empty>Chưa có máy. Thêm máy rồi bấm "Cài worker" để lấy khối lệnh cài lên VPS.</Empty> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Máy</th><th>Tình trạng</th><th>Cấu hình</th><th>Băng thông</th><th>Luồng</th><th>Thuê</th><th /></tr></thead>
              <tbody>
                {machines.map((m) => {
                  const days = daysToRenew(m);
                  return (
                    <tr key={m.id}>
                      <td>
                        <b>{m.name}</b> <span className="muted">· {MACHINE_ROLE_LABEL[m.role] ?? m.role}</span>
                        <div className="small"><code>{m.ip}</code>{[m.provider, m.region].filter(Boolean).length ? ` · ${[m.provider, m.region].filter(Boolean).join(" · ")}` : ""}</div>
                        <div className="small muted">mã: <code>{m.id}</code> <CopyButton text={m.id} label="chép" /></div>
                      </td>
                      <td>
                        <StatusPill m={m} />
                        <div className="small muted">nhịp tim {fmtAgo(m.lastHeartbeatAt)}</div>
                        {m.agentVersion && <div className="small muted">worker {m.agentVersion}{m.ytdlpVersion ? ` · yt-dlp ${m.ytdlpVersion}` : ""}</div>}
                        {m.toolError && <div className="small err">{m.toolError}</div>}
                      </td>
                      <td className="small">{m.vcpu ? `${m.vcpu} nhân · ${m.ramGb} GB RAM` : "—"}{m.diskFreeGb != null ? ` · trống ${m.diskFreeGb}/${m.diskGb} GB` : ""}{m.loadAvg != null ? ` · tải ${m.loadAvg}` : ""}</td>
                      <td className="small"><Bandwidth m={m} /></td>
                      <td>{m.liveCount}</td>
                      <td className="small">{m.costAmount ? `${m.costAmount.toLocaleString("vi-VN")}/${m.costPeriod === "year" ? "năm" : "tháng"}` : "—"}{days != null && <div className={days <= 5 ? "err" : "muted"}>hạn {m.costRenewAt} ({days} ngày)</div>}</td>
                      <td>
                        {admin && (
                          <div className="row-actions">
                            <button onClick={() => setInstall(m)}>Cài worker</button>
                            <button onClick={() => setForm({ machine: m })}>Sửa</button>
                            <button disabled={busy} title="Bảo trì: không gán luồng MỚI; luồng đang chạy không bị đụng." onClick={() => patch(m, { maintenance: !m.maintenance }, m.maintenance ? "Đã bỏ bảo trì." : "Đã đặt bảo trì.")}>{m.maintenance ? "Bỏ bảo trì" : "Bảo trì"}</button>
                            <button disabled={busy} className={m.forceOffline ? "" : "danger"} title="Ngắt máy: worker dừng hết luồng; luồng tự cứu sẽ chuyển sang máy khác."
                              onClick={() => (m.forceOffline || confirm(`NGẮT máy "${m.name}"? Mọi luồng trên máy sẽ DỪNG.`)) && patch(m, { forceOffline: !m.forceOffline }, m.forceOffline ? "Đã bật lại máy." : "Đã ngắt máy.")}>
                              {m.forceOffline ? "▶ Bật lại máy" : "⛔ Ngắt máy"}
                            </button>
                            {m.liveCount === 0 && <button className="btn-ghost danger" disabled={busy} onClick={() => confirm(`Xoá máy "${m.name}"? Video trên máy cũng bị dọn khỏi kho.`) && run(() => api(`/api/machines/${m.id}`, { method: "DELETE" }), "Đã xoá máy.")}>Xoá</button>}
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
      {form && <MachineForm machine={form.machine} onClose={() => setForm(null)} onCreated={(id) => { const m = data?.machines.find((x) => x.id === id); setInstall(m ?? ({ id, name: "máy mới" } as MachineView)); }} />}
      {install && <InstallDialog machine={install} onClose={() => setInstall(null)} />}
    </>
  );
}
