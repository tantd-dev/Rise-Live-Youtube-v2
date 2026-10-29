"use client";
// Form tạo / sửa live.
import { useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, Divider, Empty, Form, Input, InputNumber, Modal, Select, Tooltip, Typography } from "antd";
import { Info, KeyRound, Plus } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { fmtDuration } from "@/lib/client/format";
import { checkWatchUrl } from "@/features/youtube/types";
import { WatchUrlInput } from "@/features/youtube/ui/WatchUrlInput";
import { ChannelForm, ChannelKeyForm } from "@/features/channels/ui/ChannelForms";
import type { StreamView } from "../types";

interface FormState {
  name: string; mode: string; machineId?: string; assetIds: string[]; playMode: string; channelId?: string; channelKeyId?: string; watchUrl: string;
  control: string; scheduleStart: Dayjs | null; scheduleDurationMin: number | null; scheduleRepeat: string;
  importance: string; failoverMode: string; allowBlack: boolean;
}

function initial(s?: StreamView): FormState {
  return {
    name: s?.name ?? "", mode: s?.mode ?? "stream-247", machineId: s?.machineId || undefined, assetIds: s?.assetIds?.length ? s.assetIds : s?.assetId ? [s.assetId] : [],
    playMode: s?.playMode ?? "sequence", channelId: s?.channelId || undefined, channelKeyId: s?.channelKeyId || undefined, watchUrl: s?.watchUrl ?? "",
    control: s?.control ?? "manual", scheduleStart: s?.schedule?.start ? dayjs(s.schedule.start) : null, scheduleDurationMin: s?.schedule?.durationMin || null,
    scheduleRepeat: s?.schedule?.repeat ?? "none", importance: s?.importance ?? "normal", failoverMode: s?.failoverMode ?? "disabled", allowBlack: !!s?.allowBlack,
  };
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", columnGap: 16 } as const;
const fromCheck = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? Promise.resolve() : Promise.reject(new Error(r.error)));
// Live cũ (tạo trước khi có Quản lý kênh) dùng khóa nhập tay → khi sửa được phép giữ nguyên, không bắt chọn khóa.
const isLegacyKey = (s?: StreamView) => !!s && !s.channelKeyId;

export function StreamForm({ stream, onClose }: { stream?: StreamView; onClose: () => void }) {
  const { data, run, busy } = useApp();
  const [form] = Form.useForm<FormState>();
  const machineId = Form.useWatch("machineId", form);
  const mode = Form.useWatch("mode", form) ?? initial(stream).mode;
  const control = Form.useWatch("control", form) ?? initial(stream).control;
  const importance = Form.useWatch("importance", form) ?? initial(stream).importance;
  const assetIds: string[] = Form.useWatch("assetIds", form) ?? [];
  const channelId: string | undefined = Form.useWatch("channelId", form);
  const [newChannel, setNewChannel] = useState(false);
  const [newKey, setNewKey] = useState(false);
  const machines = data?.machines ?? [];
  const channels = data?.channels ?? [];
  const channel = channels.find((c) => c.id === channelId);
  const legacy = isLegacyKey(stream);
  const ready = useMemo(() => (data?.assets ?? []).filter((a) => a.status === "ready" && a.machineId === machineId), [data, machineId]);

  const submit = async (v: FormState) => {
    const body = {
      ...v,
      machineId: v.machineId ?? "",
      channelId: v.channelId ?? "",
      channelKeyId: v.channelKeyId ?? "",
      scheduleStart: v.scheduleStart ? v.scheduleStart.format("YYYY-MM-DDTHH:mm") : "",
      scheduleDurationMin: v.scheduleDurationMin ? String(v.scheduleDurationMin) : "",
      failoverMode: v.importance !== "normal" ? "automatic" : v.failoverMode,
    };
    const r = await run(
      () => stream ? api(`/api/streams/${stream.id}`, { method: "PUT", body }) : api<{ warnings?: string[] }>("/api/streams", { body }),
      (res) => [stream ? "Đã lưu Phiên live." : v.control === "manual" ? "Đã tạo live. VPS sẽ lên sóng sau vài giây." : "Đã tạo live hẹn giờ.", ...((res as { warnings?: string[] })?.warnings ?? [])].join(" "),
    );
    if (r) onClose();
  };

  return (
    <Modal open title={stream ? `Sửa live “${stream.name}”` : "Tạo Phiên live"} onCancel={onClose} width={1120} style={{ maxWidth: "calc(100vw - 32px)" }} destroyOnHidden
      okText={stream ? "Lưu" : control === "manual" ? "Tạo và lên sóng" : "Tạo live hẹn giờ"} cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" initialValues={initial(stream)} onFinish={submit}
        onValuesChange={(ch) => {
          if ("machineId" in ch) form.setFieldValue("assetIds", []);
          if ("channelId" in ch) form.setFieldValue("channelKeyId", undefined);
          if (ch.importance && ch.importance !== "normal") form.setFieldValue("failoverMode", "automatic");
        }}>
        <div style={grid}>
          <Form.Item name="name" label="Tên live" rules={[{ required: true, whitespace: true, message: "Nhập tên live" }]}>
            <Input placeholder="VD: Nhạc thiền 24/7 — kênh A" />
          </Form.Item>
          <Form.Item name="mode" label="Kiểu phát">
            <Select options={[
              { value: "stream-247", label: "Live 24/7 — phát lặp liên tục, mất kết nối thì tự nối lại" },
              { value: "live-pub", label: "Live Pub — phát một buổi, mất kết nối quá 90 giây thì kết thúc" },
            ]} />
          </Form.Item>
          <Form.Item name="machineId" label="VPS" rules={[{ required: true, message: "Chọn VPS" }]}>
            <Select placeholder="Chọn VPS" options={machines.map((m) => ({
              value: m.id, disabled: m.maintenance,
              label: `${m.name} · ${m.online ? "trực tuyến" : "ngoại tuyến"}${m.maintenance ? " · đang bảo trì" : ""} · ${m.liveCount} live`,
            }))} />
          </Form.Item>
          <Form.Item name="channelId" label="Kênh YouTube" rules={legacy ? [] : [{ required: true, message: "Chọn kênh" }]}>
            <Select placeholder="Chọn kênh" showSearch optionFilterProp="label"
              options={channels.map((c) => ({ value: c.id, label: c.name }))}
              notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có kênh nào" />}
              popupRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: "4px 0" }} />
                  <Button type="text" block icon={<Plus size={14} />} style={{ textAlign: "left" }} onClick={() => setNewChannel(true)}>Thêm kênh mới</Button>
                </>
              )} />
          </Form.Item>
          <Form.Item label="Khóa live YouTube" required={!legacy}
            tooltip={{ title: "Rê chuột vào từng khóa để xem mô tả. Địa chỉ RTMP đã được cấu hình sẵn.", icon: <Info size={14} /> }}
            extra={legacy ? `Live này đang dùng khóa nhập tay (${stream?.streamKeyMasked}). Chọn khóa của kênh để thay, hoặc để trống để giữ nguyên.` : undefined}>
            <div style={{ display: "flex", gap: 8 }}>
              <Form.Item name="channelKeyId" noStyle rules={legacy ? [] : [{ required: true, message: "Chọn khóa live" }]}>
                <Select placeholder={channel ? (channel.keys.length ? "Chọn khóa live" : "Kênh chưa có khóa — tạo khóa mới") : "Chọn kênh trước"}
                  disabled={!channel} allowClear={legacy} style={{ flex: 1, minWidth: 0 }} popupMatchSelectWidth={360}
                  options={(channel?.keys ?? []).map((k) => ({ value: k.id, label: `${k.name} (${k.keyMasked})` }))}
                  optionRender={(o) => {
                    const k = channel?.keys.find((x) => x.id === o.value);
                    if (!k) return o.label;
                    return (
                      <Tooltip title={k.description || "Chưa có mô tả"} placement="right" mouseEnterDelay={0.2}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <KeyRound size={14} />
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</span>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{k.keyMasked}{k.usedBy ? ` · ${k.usedBy} live` : ""}</Typography.Text>
                        </div>
                      </Tooltip>
                    );
                  }}
                  popupRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: "4px 0" }} />
                      <Button type="text" block icon={<Plus size={14} />} style={{ textAlign: "left" }} onClick={() => setNewKey(true)}>Tạo khóa mới cho kênh này</Button>
                    </>
                  )} />
              </Form.Item>
              <Tooltip title={channel ? "Tạo khóa live mới cho kênh này" : "Chọn kênh trước"}>
                <Button icon={<Plus size={14} />} disabled={!channel} onClick={() => setNewKey(true)}>Khóa mới</Button>
              </Tooltip>
            </div>
          </Form.Item>
          <Form.Item name="watchUrl" label="Link xem buổi live trên YouTube" style={{ gridColumn: "1 / -1" }}
            rules={[{ required: true, message: "Dán mã hoặc link buổi live" }, { validator: (_, v) => (v ? fromCheck(checkWatchUrl(v)) : Promise.resolve()) }]}
            tooltip={{ title: "Chỉ cần dán MÃ buổi live — hệ thống tự đổi thành https://www.youtube.com/watch?v=<mã>.", icon: <Info size={14} /> }}>
            <WatchUrlInput />
          </Form.Item>
          <Form.Item name="control" label="Cách bật live">
            <Select options={[{ value: "manual", label: "Thủ công (lên sóng ngay sau khi tạo)" }, { value: "schedule", label: "Hẹn giờ" }]} />
          </Form.Item>
          {control === "schedule" && (
            <>
              <Form.Item name="scheduleStart" label="Bắt đầu lúc (giờ Việt Nam)" rules={[{ required: true, message: "Chọn thời điểm bắt đầu" }]}>
                <DatePicker showTime={{ format: "HH:mm" }} format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} />
              </Form.Item>
              {mode === "live-pub" ? (
                <>
                  <Form.Item name="scheduleDurationMin" label="Thời lượng (phút)" rules={[{ required: true, message: "Nhập thời lượng" }]}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="scheduleRepeat" label="Lặp lại">
                    <Select options={[{ value: "none", label: "Chỉ một lần" }, { value: "daily", label: "Hằng ngày vào cùng giờ" }]} />
                  </Form.Item>
                </>
              ) : (
                <Form.Item label=" "><Typography.Text type="secondary">Live 24/7 hẹn giờ sẽ phát liên tục kể từ thời điểm bắt đầu.</Typography.Text></Form.Item>
              )}
            </>
          )}
          <Form.Item name="importance" label="Mức ưu tiên">
            <Select options={[
              { value: "normal", label: "Bình thường" },
              { value: "priority", label: "Ưu tiên (tự động dự phòng khi máy gặp sự cố)" },
              { value: "critical", label: "Quan trọng" },
            ]} />
          </Form.Item>
          <Form.Item name="failoverMode" label="Dự phòng khi VPS gặp sự cố"
            extra={importance !== "normal" ? "live ưu tiên/quan trọng luôn được tự động chuyển máy." : undefined}>
            <Select disabled={importance !== "normal"}
              options={[{ value: "disabled", label: "Không dự phòng" }, { value: "manual", label: "Chuyển máy thủ công" }, { value: "automatic", label: "Tự động chuyển máy" }]} />
          </Form.Item>
        </div>

        <Divider style={{ margin: "4px 0 16px" }} />
        <Form.Item name="assetIds" label={`Video phát (đã chọn ${assetIds.length})`} rules={[{ required: true, type: "array", min: 1, message: "Chọn ít nhất 1 video" }]}
          extra={machineId && !ready.length ? "Máy này chưa có video nào sẵn sàng — hãy thêm hoặc sao chép video sang máy này ở tab Kho video." : "Chọn nhiều video để tạo danh sách phát nối tiếp, lặp vòng."}>
          {!machineId ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chọn VPS trước." /> : (
            <Checkbox.Group style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto", padding: 8, border: "1px solid rgba(127,127,127,.25)", borderRadius: 8 }}>
              {ready.map((a) => (
                <Checkbox key={a.id} value={a.id}>
                  {a.name} <Typography.Text type="secondary">{[a.width ? `${a.width}×${a.height}` : "", a.durationSec ? fmtDuration(a.durationSec) : ""].filter(Boolean).join(" · ")}</Typography.Text>
                </Checkbox>
              ))}
            </Checkbox.Group>
          )}
        </Form.Item>
        {assetIds.length > 1 && (
          <Form.Item name="playMode" label="Thứ tự phát" style={{ maxWidth: 300 }}>
            <Select options={[{ value: "sequence", label: "Lần lượt" }, { value: "random", label: "Ngẫu nhiên" }]} />
          </Form.Item>
        )}
        <Form.Item name="allowBlack" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Video có cảnh tối/đen là chủ ý (không cảnh báo màn hình đen)</Checkbox>
        </Form.Item>
      </Form>
      {newChannel && <ChannelForm onClose={() => setNewChannel(false)} onSaved={(id) => form.setFieldsValue({ channelId: id, channelKeyId: undefined })} />}
      {newKey && channel && <ChannelKeyForm channel={channel} onClose={() => setNewKey(false)} onSaved={(id) => form.setFieldValue("channelKeyId", id)} />}
    </Modal>
  );
}
