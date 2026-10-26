"use client";
// Thẻ 1 luồng: trạng thái, số liệu phát, YouTube, và các nút thao tác.
import { useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Pill } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import { fmtAgo, fmtDuration, fmtTime } from "@/lib/client/format";
import { IMPORTANCE_LABEL, MODE_LABEL, type StreamView } from "../types";
import { streamBadge } from "../rules";

export function StreamCard({ s, onEdit, onMove }: { s: StreamView; onEdit: () => void; onMove: () => void }) {
  const { data, run, busy, can } = useApp();
  const [key, setKey] = useState("");
  const [thumbErr, setThumbErr] = useState(false);
  const machine = data?.machines.find((m) => m.id === s.machineId);
  const assetNames = (s.assetIds?.length ? s.assetIds : [s.assetId]).map((id) => data?.assets.find((a) => a.id === id)?.name ?? "(video đã xoá)");
  const badge = streamBadge(s, !!machine?.online);
  const op = can("streams.operate");
  const live = s.status === "live" && s.shouldBeLive;
  const call = (path: string, body: unknown, ok: string, method = "POST") => run(() => api(`/api/streams/${s.id}${path}`, { method, body }), ok);

  const reveal = async () => {
    if (key) return setKey("");
    const r = await run(() => api<{ streamKey: string }>(`/api/streams/${s.id}/key`));
    if (r) setKey(r.streamKey);
  };
  const promptPatch = (label: string, field: "name" | "watchUrl", cur: string) => {
    const v = prompt(label, cur);
    if (v != null && v.trim() !== cur) void call("", { [field]: v.trim() }, "Đã lưu.", "PATCH");
  };

  return (
    <div className={`stream-card tone-${badge.tone}`}>
      <div className="thumb">
        {live && !thumbErr
          ? <img src={`/api/thumbs/${s.id}?t=${Math.floor(Date.now() / 60000)}`} alt="" onError={() => setThumbErr(true)} />
          : <span>{live ? "chưa có ảnh" : "—"}</span>}
      </div>
      <div className="stream-body">
        <div className="stream-title">
          <b>{s.name}</b>
          <Pill tone={badge.tone}>{badge.text}</Pill>
          <Pill>{MODE_LABEL[s.mode]}</Pill>
          {s.importance && s.importance !== "normal" && <Pill tone="amber">{IMPORTANCE_LABEL[s.importance]}</Pill>}
          {s.failoverMode === "automatic" && <Pill tone="blue">🛟 tự cứu</Pill>}
        </div>
        <div className="meta">
          🖥 {machine?.name ?? "(máy đã xoá)"} · 🎞 {assetNames.join(", ")}{assetNames.length > 1 ? ` (${s.playMode === "random" ? "ngẫu nhiên" : "lần lượt"})` : ""}
        </div>
        {s.control === "schedule" && s.schedule && (
          <div className="meta">⏰ Hẹn giờ từ {fmtTime(s.schedule.start)}{s.schedule.durationMin ? ` · ${s.schedule.durationMin} phút${s.schedule.repeat === "daily" ? " · hằng ngày" : ""}` : " · liên tục"}{s.nextStartISO ? ` · lần tới ${fmtTime(s.nextStartISO)}` : ""}</div>
        )}
        {live && (
          <div className="meta">
            Live từ {fmtTime(s.liveSince)} · {s.bitrateKbps != null ? `${(s.bitrateKbps / 1000).toFixed(1)} Mbps` : "—"} · tốc độ {s.speed != null ? `${s.speed}×` : "—"} · chạy liền {fmtDuration(s.uptimeSec)} · tự bật lại {s.restarts ?? 0} lần
          </div>
        )}
        {(s.haltReason || (s.health === "error" && s.error)) && <div className="meta err">Lý do: {s.haltReason || s.error}</div>}
        {s.ytIssue && <div className="meta err">YouTube: {s.ytIssue.note || "bị gắn cờ chặn/đình chỉ"} ({s.ytIssue.by ?? s.ytIssue.source}, {fmtTime(s.ytIssue.at)})</div>}
        <div className="meta">
          🔑 <code>{key || s.streamKeyMasked}</code>{op && <button className="btn-link" onClick={reveal}>{key ? "ẩn" : "hiện"}</button>}{key && <CopyButton text={key} />}
          {" · "}▶ {s.watchUrl ? <a href={s.watchUrl} target="_blank" rel="noreferrer">xem trên YouTube</a> : <span className="muted">chưa có link xem</span>}
          {s.yt && (s.yt.found
            ? <span className="muted"> · YouTube: {s.yt.liveBroadcastContent === "live" ? `🔴 đang live${s.yt.concurrentViewers != null ? `, ${s.yt.concurrentViewers} người xem` : ""}` : s.yt.actualEndTime ? "đã kết thúc" : s.yt.liveBroadcastContent ?? "?"} ({fmtAgo(s.yt.checkedAt)})</span>
            : <span className="err"> · YouTube: không tìm thấy video</span>)}
        </div>
        {!!s.recentIncidents?.length && (
          <details className="meta"><summary>{s.incidentCount ?? s.recentIncidents.length} lần gián đoạn tự phục hồi</summary>
            <ul>{s.recentIncidents.map((ev, i) => <li key={i}>{fmtTime(ev.at)} · mất {ev.downSec}s · {ev.reason || ev.kind}</li>)}</ul>
          </details>
        )}
        {op && (
          <div className="row-actions">
            {s.shouldBeLive
              ? <button className="btn-danger" disabled={busy} onClick={() => confirm(`Dừng luồng "${s.name}"?`) && call("/control", { desired: "stopped" }, "Đã gửi lệnh dừng.")}>⏹ Dừng</button>
              : <button className="btn-primary" disabled={busy} onClick={() => call("/control", { desired: "live" }, "Đã gửi lệnh lên sóng — máy nhận trong vài giây.")}>▶ Lên sóng</button>}
            {!s.shouldBeLive && <button disabled={busy} onClick={onEdit}>✎ Sửa</button>}
            {s.shouldBeLive && !s.moveState && <button disabled={busy} onClick={onMove}>⇄ Chuyển máy</button>}
            <button disabled={busy} onClick={() => promptPatch("Tên luồng mới:", "name", s.name)}>Đổi tên</button>
            <button disabled={busy} onClick={() => promptPatch("Link xem buổi live (youtube.com/watch?v=…):", "watchUrl", s.watchUrl ?? "")}>Link xem</button>
            {s.watchUrl && data?.config.ytApiKey && <button disabled={busy} onClick={() => run(() => api("/api/youtube/check", { body: { streamIds: [s.id] } }), "Đã kiểm YouTube.")}>Kiểm YouTube</button>}
            {s.black && <button disabled={busy} onClick={() => call("", { allowBlack: !s.allowBlack }, "Đã lưu.", "PATCH")}>{s.allowBlack ? "Bật lại cảnh báo đen" : "✓ Nền đen chủ ý"}</button>}
            {s.ytIssue
              ? <button disabled={busy} onClick={() => call("/youtube-issue", { flag: false }, "Đã gỡ cờ YouTube.")}>Gỡ cờ YouTube</button>
              : <button disabled={busy} onClick={() => { const note = prompt("Báo YouTube chặn/đình chỉ luồng này (worker sẽ DỪNG đẩy). Ghi chú:"); if (note != null) void call("/youtube-issue", { flag: true, note }, "Đã gắn cờ — worker dừng đẩy."); }}>Báo YouTube chặn</button>}
            {s.mode === "live-pub" && <button disabled={busy} onClick={() => confirm("Chuyển luồng này thành Live 24/7?") && call("/convert", {}, "Đã chuyển sang Live 24/7.")}>→ 24/7</button>}
            <select value={s.importance ?? "normal"} disabled={busy} onChange={(e) => call("", { importance: e.target.value }, "Đã đổi mức ưu tiên.", "PATCH")} title="Mức ưu tiên">
              <option value="normal">Thường</option><option value="priority">⭐ Ưu tiên</option><option value="critical">🔥 Trọng yếu</option>
            </select>
            {!s.shouldBeLive && <button className="btn-ghost danger" disabled={busy} onClick={() => confirm(`Xoá luồng "${s.name}"?`) && call("", undefined, "Đã xoá luồng.", "DELETE")}>Xoá</button>}
          </div>
        )}
      </div>
    </div>
  );
}
