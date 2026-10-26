"use client";
// Form tạo / sửa luồng.
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/AppContext";
import { Field } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/client/api";
import { fmtDuration } from "@/lib/client/format";
import { checkStreamKey } from "../stream-key";
import { checkWatchUrl } from "@/features/youtube/types";
import type { StreamView } from "../types";

interface FormState {
  name: string; mode: string; machineId: string; assetIds: string[]; playMode: string; streamKey: string; watchUrl: string;
  control: string; scheduleStart: string; scheduleDurationMin: string; scheduleRepeat: string;
  importance: string; failoverMode: string; allowBlack: boolean;
}

function initial(s?: StreamView): FormState {
  return {
    name: s?.name ?? "", mode: s?.mode ?? "stream-247", machineId: s?.machineId ?? "", assetIds: s?.assetIds?.length ? s.assetIds : s?.assetId ? [s.assetId] : [],
    playMode: s?.playMode ?? "sequence", streamKey: "", watchUrl: s?.watchUrl ?? "",
    control: s?.control ?? "manual", scheduleStart: s?.schedule?.start ?? "", scheduleDurationMin: s?.schedule?.durationMin ? String(s.schedule.durationMin) : "",
    scheduleRepeat: s?.schedule?.repeat ?? "none", importance: s?.importance ?? "normal", failoverMode: s?.failoverMode ?? "disabled", allowBlack: !!s?.allowBlack,
  };
}

export function StreamForm({ stream, onClose }: { stream?: StreamView; onClose: () => void }) {
  const { data, run, busy } = useApp();
  const [f, setF] = useState<FormState>(() => initial(stream));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const machines = data?.machines ?? [];
  const ready = useMemo(() => (data?.assets ?? []).filter((a) => a.status === "ready" && a.machineId === f.machineId), [data, f.machineId]);
  const keyErr = f.streamKey ? (() => { const r = checkStreamKey(f.streamKey); return r.ok ? "" : r.error; })() : "";
  const watchErr = f.watchUrl ? (() => { const r = checkWatchUrl(f.watchUrl); return r.ok ? "" : r.error; })() : "";

  const submit = async () => {
    const body = { ...f, streamKey: f.streamKey.trim() || undefined };
    const r = await run(
      () => stream ? api(`/api/streams/${stream.id}`, { method: "PUT", body }) : api<{ warnings?: string[] }>("/api/streams", { body }),
      (res) => [stream ? "Đã lưu luồng." : f.control === "manual" ? "Đã tạo luồng — máy sẽ lên sóng trong vài giây." : "Đã tạo luồng hẹn giờ.", ...((res as { warnings?: string[] })?.warnings ?? [])].join(" "),
    );
    if (r) onClose();
  };

  return (
    <Modal title={stream ? `Sửa luồng "${stream.name}"` : "Tạo luồng phát"} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Tên luồng"><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Nhạc thiền 24/7 — kênh A" /></Field>
        <Field label="Kiểu phát">
          <select value={f.mode} onChange={(e) => set("mode", e.target.value)}>
            <option value="stream-247">Live 24/7 (lặp liên tục, rớt thì tự nối lại)</option>
            <option value="live-pub">Live Pub (phát 1 buổi, rớt quá 90 giây là kết thúc)</option>
          </select>
        </Field>
        <Field label="Máy phát">
          <select value={f.machineId} onChange={(e) => setF((x) => ({ ...x, machineId: e.target.value, assetIds: [] }))}>
            <option value="">— chọn máy —</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id} disabled={m.maintenance}>
                {m.name} · {m.online ? "online" : "offline"}{m.maintenance ? " · bảo trì" : ""} · {m.liveCount} luồng
              </option>
            ))}
          </select>
        </Field>
        <Field label="Khoá luồng YouTube" hint={keyErr ? <span className="err">{keyErr}</span> : stream ? "Để trống = giữ khoá cũ." : "YouTube Studio › Phát trực tiếp › Khoá luồng. RTMP đã đặt sẵn."}>
          <input value={f.streamKey} onChange={(e) => set("streamKey", e.target.value)} placeholder={stream ? stream.streamKeyMasked : "xxxx-xxxx-xxxx-xxxx-xxxx"} autoComplete="off" />
        </Field>
        <Field label="Link xem buổi live trên YouTube" hint={watchErr ? <span className="err">{watchErr}</span> : "Dạng https://www.youtube.com/watch?v=… — để theo dõi buổi live bằng API."}>
          <input value={f.watchUrl} onChange={(e) => set("watchUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
        </Field>
        <Field label="Điều khiển">
          <select value={f.control} onChange={(e) => set("control", e.target.value)}>
            <option value="manual">Bật tay (lên sóng ngay sau khi tạo)</option>
            <option value="schedule">Hẹn giờ</option>
          </select>
        </Field>
        {f.control === "schedule" && (
          <>
            <Field label="Bắt đầu lúc (giờ VN)"><input type="datetime-local" value={f.scheduleStart} onChange={(e) => set("scheduleStart", e.target.value)} /></Field>
            {f.mode === "live-pub" ? (
              <>
                <Field label="Thời lượng (phút)"><input type="number" min={1} value={f.scheduleDurationMin} onChange={(e) => set("scheduleDurationMin", e.target.value)} /></Field>
                <Field label="Lặp lại">
                  <select value={f.scheduleRepeat} onChange={(e) => set("scheduleRepeat", e.target.value)}>
                    <option value="none">1 lần</option><option value="daily">Hằng ngày cùng giờ</option>
                  </select>
                </Field>
              </>
            ) : <p className="muted">Live 24/7 hẹn giờ: phát liên tục từ giờ bắt đầu.</p>}
          </>
        )}
        <Field label="Mức ưu tiên">
          <select value={f.importance} onChange={(e) => set("importance", e.target.value)}>
            <option value="normal">Thường</option><option value="priority">⭐ Ưu tiên (tự cứu khi máy chết)</option><option value="critical">🔥 Trọng yếu</option>
          </select>
        </Field>
        <Field label="Dự phòng khi máy chết">
          <select value={f.importance !== "normal" ? "automatic" : f.failoverMode} disabled={f.importance !== "normal"} onChange={(e) => set("failoverMode", e.target.value)}>
            <option value="disabled">Không</option><option value="manual">Chuyển tay</option><option value="automatic">Tự động chuyển máy</option>
          </select>
        </Field>
      </div>

      <Field label={`Video trên máy đã chọn (${f.assetIds.length} đã chọn)`} hint={f.machineId && !ready.length ? "Máy này chưa có video sẵn sàng — thêm hoặc sao chép video sang máy này ở tab Kho video." : "Chọn nhiều video = danh sách phát nối tiếp, lặp vòng."}>
        <div className="checklist">
          {!f.machineId ? <span className="muted">Chọn máy trước.</span> : ready.map((a) => (
            <label key={a.id} className="check">
              <input type="checkbox" checked={f.assetIds.includes(a.id)} onChange={(e) => set("assetIds", e.target.checked ? [...f.assetIds, a.id] : f.assetIds.filter((x) => x !== a.id))} />
              {a.name} <span className="muted">· {a.width ? `${a.width}×${a.height}` : ""} {a.durationSec ? `· ${fmtDuration(a.durationSec)}` : ""}</span>
            </label>
          ))}
        </div>
      </Field>
      {f.assetIds.length > 1 && (
        <Field label="Thứ tự phát">
          <select value={f.playMode} onChange={(e) => set("playMode", e.target.value)}><option value="sequence">Lần lượt</option><option value="random">Ngẫu nhiên</option></select>
        </Field>
      )}
      <label className="check"><input type="checkbox" checked={f.allowBlack} onChange={(e) => set("allowBlack", e.target.checked)} /> Nội dung tối/đen chủ ý (không cảnh báo màn đen)</label>

      <div className="actions">
        <button className="btn-ghost" onClick={onClose}>Huỷ</button>
        <button className="btn-primary" disabled={busy || !!keyErr || !!watchErr} onClick={submit}>{stream ? "Lưu" : f.control === "manual" ? "Tạo & lên sóng" : "Tạo luồng hẹn giờ"}</button>
      </div>
    </Modal>
  );
}
