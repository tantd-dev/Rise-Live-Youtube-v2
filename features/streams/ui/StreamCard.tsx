"use client";
// Thẻ 1 live: trạng thái, số liệu phát, YouTube, và các nút thao tác.
import { useState, type ReactNode } from "react";
import { Button, Card, Collapse, Dropdown, Select, Space, Tooltip, Typography, type MenuProps } from "antd";
import {
  ArrowLeftRight, CircleCheck, Clock, Ellipsis, ExternalLink, Eye, EyeOff, Film, Flag, FlagOff, KeyRound, LifeBuoy, Link2,
  CircleStop, Moon, Pencil, Play, Radio, RefreshCw, Server, Square, Trash, Tv, TvMinimalPlay, Type, Zap,
} from "lucide-react";
import { useApp } from "@/components/app/AppContext";
import { Pill, TONE_HEX } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import { api } from "@/lib/client/api";
import { fmtAgo, fmtDuration, fmtTime } from "@/lib/client/format";
import { IMPORTANCE_LABEL, MODE_LABEL, type StreamView } from "../types";
import { streamBadge } from "../rules";

const { Text } = Typography;

function Meta({ icon, children, danger }: { icon?: ReactNode; children: ReactNode; danger?: boolean }) {
  return (
    <Text type={danger ? "danger" : "secondary"} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "baseline", overflowWrap: "anywhere" }}>
      {icon && <span style={{ flex: "none", position: "relative", top: 2 }}>{icon}</span>}
      <span>{children}</span>
    </Text>
  );
}

export function StreamCard({ s, onEdit, onMove }: { s: StreamView; onEdit: () => void; onMove: () => void }) {
  const { data, run, busy, can, confirm, prompt } = useApp();
  const [key, setKey] = useState("");
  const [thumbErr, setThumbErr] = useState(false);
  const machine = data?.machines.find((m) => m.id === s.machineId);
  const channel = s.channelId ? data?.channels.find((c) => c.id === s.channelId) : undefined;
  const channelKey = channel?.keys.find((k) => k.id === s.channelKeyId);
  const assetNames = (s.assetIds?.length ? s.assetIds : [s.assetId]).map((id) => data?.assets.find((a) => a.id === id)?.name ?? "(video đã xóa)");
  const badge = streamBadge(s, !!machine?.online);
  const op = can("streams.operate");
  const live = s.status === "live" && s.shouldBeLive;
  // "Xem live" khi live còn đang phát (VPS đang đẩy, hoặc YouTube báo đang live); hết live → "Xem trên YouTube".
  const onAir = !s.endedAt && (live || s.yt?.liveBroadcastContent === "live");
  const call = (path: string, body: unknown, ok: string, method = "POST") => run(() => api(`/api/streams/${s.id}${path}`, { method, body }), ok);

  const reveal = async () => {
    if (key) return setKey("");
    const r = await run(() => api<{ streamKey: string }>(`/api/streams/${s.id}/key`));
    if (r) setKey(r.streamKey);
  };
  const rename = async () => {
    const v = await prompt({ title: "Đổi tên live", initial: s.name, required: true });
    if (v != null && v !== s.name) void call("", { name: v }, "Đã đổi tên live.", "PATCH");
  };
  const editWatchUrl = async () => {
    const v = await prompt({ title: "Link xem trên YouTube", label: "Dán mã buổi live hoặc link YouTube (hệ thống tự đổi thành youtube.com/watch?v=…):", initial: s.watchUrl ?? "" });
    if (v != null && v !== (s.watchUrl ?? "")) void call("", { watchUrl: v }, "Đã lưu link xem.", "PATCH");
  };
  const flagYoutube = async () => {
    const note = await prompt({ title: "Báo YouTube chặn/đình chỉ live", label: "Worker sẽ DỪNG đẩy live này lên YouTube. Ghi chú (không bắt buộc):", okText: "Gắn cờ" });
    if (note != null) void call("/youtube-issue", { flag: true, note }, "Đã gắn cờ. Worker đã dừng đẩy live.");
  };
  const stop = async () => {
    if (await confirm({ title: `Dừng live “${s.name}”?`, okText: "Dừng phát", danger: true })) void call("/control", { desired: "stopped" }, "Đã gửi lệnh dừng.");
  };
  const end = async () => {
    const ok = await confirm({
      title: `Kết thúc live “${s.name}”?`,
      content: <>VPS sẽ ngừng phát và phiên live này được đánh dấu <b>đã kết thúc</b>, không thể lên sóng lại (muốn phát tiếp thì bấm “Sửa” để cập nhật link/khóa mới). Buổi live trên YouTube sẽ tự kết thúc nếu đã bật “Tự động dừng” trong YouTube Studio.</>,
      okText: "Kết thúc live", danger: true,
    });
    if (ok) void call("/end", {}, "Đã kết thúc live.");
  };
  const remove = async () => {
    if (await confirm({ title: `Xóa live “${s.name}”?`, content: "Thao tác này không thể hoàn tác.", okText: "Xóa", danger: true })) void call("", undefined, "Đã xóa live.", "DELETE");
  };
  const convert = async () => {
    if (await confirm({ title: "Chuyển live này thành Live 24/7?", okText: "Chuyển" })) void call("/convert", {}, "Đã chuyển sang Live 24/7.");
  };

  const more: NonNullable<MenuProps["items"]> = [
    { key: "rename", icon: <Type size={14} />, label: "Đổi tên", onClick: rename },
    { key: "watch", icon: <Link2 size={14} />, label: "Sửa link xem", onClick: editWatchUrl },
    ...(s.watchUrl && data?.config.ytApiKey ? [{ key: "check", icon: <RefreshCw size={14} />, label: "Kiểm tra trên YouTube", onClick: () => void run(() => api("/api/youtube/check", { body: { streamIds: [s.id] } }), "Đã kiểm tra trạng thái trên YouTube.") }] : []),
    ...(s.black ? [{ key: "black", icon: <Moon size={14} />, label: s.allowBlack ? "Bật lại cảnh báo màn hình đen" : "Đánh dấu màn hình tối là chủ ý", onClick: () => void call("", { allowBlack: !s.allowBlack }, "Đã lưu.", "PATCH") }] : []),
    s.ytIssue
      ? { key: "unflag", icon: <FlagOff size={14} />, label: "Gỡ cờ YouTube chặn", onClick: () => void call("/youtube-issue", { flag: false }, "Đã gỡ cờ YouTube.") }
      : { key: "flag", icon: <Flag size={14} />, label: "Báo YouTube chặn/đình chỉ", onClick: flagYoutube },
    ...(s.mode === "live-pub" ? [{ key: "convert", icon: <Zap size={14} />, label: "Chuyển thành Live 24/7", onClick: convert }] : []),
    ...(!s.shouldBeLive ? [{ type: "divider" as const }, { key: "delete", icon: <Trash size={14} />, label: "Xóa live", danger: true, onClick: remove }] : []),
  ];

  const ytStatus = s.yt && (s.yt.found
    ? <> · YouTube: {s.yt.liveBroadcastContent === "live" ? `đang phát trực tiếp${s.yt.concurrentViewers != null ? `, ${s.yt.concurrentViewers.toLocaleString("vi-VN")} người xem` : ""}` : s.yt.actualEndTime ? "đã kết thúc" : s.yt.liveBroadcastContent === "upcoming" ? "sắp phát" : s.yt.liveBroadcastContent ?? "không rõ"} (kiểm tra {fmtAgo(s.yt.checkedAt)})</>
    : <Text type="danger"> · YouTube: không tìm thấy video</Text>);

  return (
    <Card className="stream-card" size="small" style={{ borderInlineStart: `4px solid ${TONE_HEX[badge.tone]}` }}>
      <div className="stream-thumb">
        {live && !thumbErr
          ? <img src={`/api/thumbs/${s.id}?t=${Math.floor(Date.now() / 60000)}`} alt={`Ảnh đang phát của ${s.name}`} onError={() => setThumbErr(true)} />
          : <Space direction="vertical" align="center" size={4}><TvMinimalPlay size={24} />{live ? "Chưa có ảnh xem trước" : "Không phát"}</Space>}
      </div>
      <div className="stream-card-body">
        <Space size={6} wrap>
          <Text strong style={{ fontSize: 15 }}>{s.name}</Text>
          <Pill tone={badge.tone}>{badge.text}</Pill>
          {channel && <Pill tone="blue" icon={<Tv size={12} />} title={channel.description || undefined}>{channel.name}</Pill>}
          <Pill>{MODE_LABEL[s.mode]}</Pill>
          {s.importance && s.importance !== "normal" && <Pill tone="amber">{IMPORTANCE_LABEL[s.importance]}</Pill>}
          {s.failoverMode === "automatic" && <Pill tone="blue" icon={<LifeBuoy size={12} />}>Dự phòng tự động</Pill>}
        </Space>
        <Meta icon={<Server size={13} />}>
          {machine?.name ?? "(máy đã xóa)"}
          <span style={{ margin: "0 6px" }}>·</span>
          <Film size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
          {assetNames.join(", ")}{assetNames.length > 1 ? ` (${s.playMode === "random" ? "phát ngẫu nhiên" : "phát lần lượt"})` : ""}
        </Meta>
        {s.control === "schedule" && s.schedule && (
          <Meta icon={<Clock size={13} />}>
            Hẹn giờ từ {fmtTime(s.schedule.start)}{s.schedule.durationMin ? ` · ${s.schedule.durationMin} phút${s.schedule.repeat === "daily" ? " · hằng ngày" : ""}` : " · phát liên tục"}{s.nextStartISO ? ` · lần tới: ${fmtTime(s.nextStartISO)}` : ""}
          </Meta>
        )}
        {live && (
          <Meta icon={<Play size={13} />}>
            Phát từ {fmtTime(s.liveSince)} · {s.bitrateKbps != null ? `${(s.bitrateKbps / 1000).toFixed(1)} Mbps` : "—"} · tốc độ {s.speed != null ? `${s.speed}×` : "—"} · đã chạy liên tục {fmtDuration(s.uptimeSec)} · tự khởi động lại {s.restarts ?? 0} lần
          </Meta>
        )}
        {(s.haltReason || (s.health === "error" && s.error)) && <Meta danger>Lý do: {s.haltReason || s.error}</Meta>}
        {s.endedAt && <Meta icon={<CircleStop size={13} />}>Đã kết thúc lúc {fmtTime(s.endedAt)}{s.endedBy ? ` bởi ${s.endedBy}` : ""}</Meta>}
        {s.ytIssue && <Meta danger>YouTube: {s.ytIssue.note || "bị gắn cờ chặn/đình chỉ"} ({s.ytIssue.by ?? (s.ytIssue.source === "auto" ? "tự động" : "thủ công")}, {fmtTime(s.ytIssue.at)})</Meta>}
        <Meta icon={<KeyRound size={13} />}>
          {channelKey && (
            <Tooltip title={channelKey.description || undefined}>
              <span style={{ marginRight: 6 }}>{channelKey.name}</span>
            </Tooltip>
          )}
          <Text code style={{ fontSize: 12 }}>{key || s.streamKeyMasked}</Text>
          {op && <Tooltip title={key ? "Ẩn khóa live" : "Hiện khóa live"}><Button type="text" size="small" icon={key ? <EyeOff size={14} /> : <Eye size={14} />} onClick={reveal} /></Tooltip>}
          {key && <CopyButton text={key} label="Sao chép khóa live" iconOnly />}
          {!s.watchUrl && <Text type="secondary"> · Chưa có link xem</Text>}
          {ytStatus}
        </Meta>
        {!!s.recentIncidents?.length && (
          <Collapse ghost size="small" style={{ marginInline: -8 }} items={[{
            key: "inc",
            label: <Text type="secondary" style={{ fontSize: 13 }}><CircleCheck size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{s.incidentCount ?? s.recentIncidents.length} lần gián đoạn đã tự phục hồi</Text>,
            children: <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{s.recentIncidents.map((ev, i) => <li key={i}>{fmtTime(ev.at)} · mất sóng {fmtDuration(ev.downSec)} · {ev.reason || ev.kind}</li>)}</ul>,
          }]} />
        )}
        <Space size={8} wrap style={{ marginTop: 4 }}>
          {op && !s.endedAt && (s.shouldBeLive
            ? <Button danger type="primary" icon={<Square size={14} />} disabled={busy} onClick={stop}>Dừng phát</Button>
            : <Button type="primary" icon={<Play size={14} />} disabled={busy} onClick={() => call("/control", { desired: "live" }, "Đã gửi lệnh lên sóng. VPS sẽ nhận lệnh sau vài giây.")}>Lên sóng</Button>)}
          {s.watchUrl && (onAir
            ? <Button href={s.watchUrl} target="_blank" icon={<Radio size={14} color="#dc2626" />}>Xem live</Button>
            : <Button href={s.watchUrl} target="_blank" icon={<ExternalLink size={14} />}>Xem trên YouTube</Button>)}
          {op && !s.shouldBeLive && <Button icon={<Pencil size={14} />} disabled={busy} onClick={onEdit}>Sửa</Button>}
          {op && s.shouldBeLive && !s.moveState && <Button icon={<ArrowLeftRight size={14} />} disabled={busy} onClick={onMove}>Chuyển máy</Button>}
          {op && !s.endedAt && <Button danger icon={<CircleStop size={14} />} disabled={busy || !!s.moveState} onClick={end}>Kết thúc live</Button>}
          {op && !s.endedAt && (
            <Select size="middle" value={s.importance ?? "normal"} disabled={busy} style={{ width: 140 }} title="Mức ưu tiên"
              onChange={(v) => call("", { importance: v }, "Đã đổi mức ưu tiên.", "PATCH")}
              options={[{ value: "normal", label: "Bình thường" }, { value: "priority", label: "Ưu tiên" }, { value: "critical", label: "Quan trọng" }]} />
          )}
          {op && (
            <Dropdown menu={{ items: more }} trigger={["click"]} disabled={busy}>
              <Button icon={<Ellipsis size={14} />}>Khác</Button>
            </Dropdown>
          )}
        </Space>
      </div>
    </Card>
  );
}
