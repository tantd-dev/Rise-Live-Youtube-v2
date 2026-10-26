"use client";
// Chuyển luồng đang phát sang máy khác — chỉ chọn được máy đã có sẵn video.
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import type { MoveCandidate } from "@/features/failover/rules";
import type { StreamView } from "../types";

export function MoveDialog({ stream, onClose }: { stream: StreamView; onClose: () => void }) {
  const { run, busy } = useApp();
  const [cands, setCands] = useState<MoveCandidate[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ candidates: MoveCandidate[] }>(`/api/streams/${stream.id}/move`).then((r) => setCands(r.candidates)).catch((e) => setErr(e.message));
  }, [stream.id]);
  const move = async (c: MoveCandidate) => {
    if (!confirm(`Chuyển "${stream.name}" sang "${c.name}"?\nMáy cũ dừng trước, máy mới mới bật — mất sóng vài giây.`)) return;
    if (await run(() => api(`/api/streams/${stream.id}/move`, { body: { targetId: c.machineId } }), "Đang chuyển máy — theo dõi trạng thái luồng.")) onClose();
  };
  return (
    <Modal title={`Chuyển máy: ${stream.name}`} onClose={onClose}>
      {err && <p className="err">{err}</p>}
      {!cands ? <p className="muted">Đang kiểm các máy…</p> : !cands.length ? <p className="muted">Không có máy nào khác.</p> : (
        <table>
          <thead><tr><th>Máy</th><th>Tình trạng</th><th>Còn trống</th><th /></tr></thead>
          <tbody>
            {cands.map((c) => (
              <tr key={c.machineId}>
                <td><b>{c.name}</b></td>
                <td>{c.ok ? <Pill tone="green">Chuyển được</Pill> : <span className="err">{c.reasons.join(", ")}</span>}</td>
                <td>{c.freeMbps != null ? `${c.freeMbps} Mbps` : "—"}</td>
                <td><button className="btn-small" disabled={!c.ok || busy} onClick={() => move(c)}>Chuyển</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Máy đích phải có sẵn bản video (Kho video → Sao chép sang máy…).</p>
    </Modal>
  );
}
