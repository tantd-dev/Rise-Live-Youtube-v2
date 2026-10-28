"use client";
// Form tạo / sửa live.
import { useMemo } from "react";
import { Checkbox, DatePicker, Divider, Empty, Form, Input, InputNumber, Modal, Select, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useApp } from "@/components/app/AppContext";
import { api } from "@/lib/client/api";
import { fmtDuration } from "@/lib/client/format";
import { checkStreamKey } from "../stream-key";
import { checkWatchUrl } from "@/features/youtube/types";
import { WatchUrlInput } from "@/features/youtube/ui/WatchUrlInput";
import type { StreamView } from "../types";

interface FormState {
  name: string; mode: string; machineId?: string; assetIds: string[]; playMode: string; streamKey: string; watchUrl: string;
  control: string; scheduleStart: Dayjs | null; scheduleDurationMin: number | null; scheduleRepeat: string;
  importance: string; failoverMode: string; allowBlack: boolean;
}

function initial(s?: StreamView): FormState {
  return {
    name: s?.name ?? "", mode: s?.mode ?? "stream-247", machineId: s?.machineId || undefined, assetIds: s?.assetIds?.length ? s.assetIds : s?.assetId ? [s.assetId] : [],
    playMode: s?.playMode ?? "sequence", streamKey: "", watchUrl: s?.watchUrl ?? "",
    control: s?.control ?? "manual", scheduleStart: s?.schedule?.start ? dayjs(s.schedule.start) : null, scheduleDurationMin: s?.schedule?.durationMin || null,
    scheduleRepeat: s?.schedule?.repeat ?? "none", importance: s?.importance ?? "normal", failoverMode: s?.failoverMode ?? "disabled", allowBlack: !!s?.allowBlack,
  };
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", columnGap: 16 } as const;
const fromCheck = (r: { ok: true } | { ok: false; error: string }) => (r.ok ? Promise.resolve() : Promise.reject(new Error(r.error)));

export function StreamForm({ stream, onClose }: { stream?: StreamView; onClose: () => void }) {
  const { data, run, busy } = useApp();
  const [form] = Form.useForm<FormState>();
  const machineId = Form.useWatch("machineId", form);
  const mode = Form.useWatch("mode", form) ?? initial(stream).mode;
  const control = Form.useWatch("control", form) ?? initial(stream).control;
  const importance = Form.useWatch("importance", form) ?? initial(stream).importance;
  const assetIds: string[] = Form.useWatch("assetIds", form) ?? [];
  const machines = data?.machines ?? [];
  const ready = useMemo(() => (data?.assets ?? []).filter((a) => a.status === "ready" && a.machineId === machineId), [data, machineId]);

  const submit = async (v: FormState) => {
    const body = {
      ...v,
      machineId: v.machineId ?? "",
      streamKey: v.streamKey.trim() || undefined,
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
    <Modal open title={stream ? `Sửa live “${stream.name}”` : "Tạo Phiên live"} onCancel={onClose} width={900} destroyOnHidden
      okText={stream ? "Lưu" : control === "manual" ? "Tạo và lên sóng" : "Tạo live hẹn giờ"} cancelText="Hủy" confirmLoading={busy} onOk={() => form.submit()}>
      <Form form={form} layout="vertical" initialValues={initial(stream)} onFinish={submit}
        onValuesChange={(ch) => {
          if ("machineId" in ch) form.setFieldValue("assetIds", []);
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
          <Form.Item name="streamKey" label="Khóa live YouTube"
            rules={[...(stream ? [] : [{ required: true, whitespace: true, message: "Dán khóa live từ YouTube Studio" }]), { validator: (_, v) => (v ? fromCheck(checkStreamKey(v)) : Promise.resolve()) }]}
            extra={stream ? "Để trống nếu muốn giữ khóa live hiện tại." : "Lấy tại YouTube Studio › Phát trực tiếp › Khóa live. Địa chỉ RTMP đã được cấu hình sẵn."}>
            <Input.Password placeholder={stream ? stream.streamKeyMasked : "xxxx-xxxx-xxxx-xxxx-xxxx"} autoComplete="off" visibilityToggle />
          </Form.Item>
          <Form.Item name="watchUrl" label="Link xem buổi live trên YouTube"
            rules={[{ required: true, message: "Dán mã hoặc link buổi live" }, { validator: (_, v) => (v ? fromCheck(checkWatchUrl(v)) : Promise.resolve()) }]}
            extra="Chỉ cần dán MÃ buổi live — hệ thống tự đổi thành https://www.youtube.com/watch?v=<mã>.">
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
            <Checkbox.Group style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflow: "auto", padding: 8, border: "1px solid rgba(127,127,127,.25)", borderRadius: 8 }}
              options={ready.map((a) => ({
                value: a.id,
                label: <span>{a.name} <Typography.Text type="secondary">{[a.width ? `${a.width}×${a.height}` : "", a.durationSec ? fmtDuration(a.durationSec) : ""].filter(Boolean).join(" · ")}</Typography.Text></span>,
              }))} />
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
    </Modal>
  );
}
