"use client";
// Ô "Link xem buổi live": dán MÃ buổi live (vd dQw4w9WgXcQ) hoặc bất kỳ link YouTube nào
// → tự đổi thành https://www.youtube.com/watch?v=<mã>.
import { useRef, useState } from "react";
import { Button, Input, Space, Typography, type InputRef } from "antd";
import { ClipboardPaste } from "lucide-react";
import { normalizeWatchInput } from "../types";

export function WatchUrlInput({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const ref = useRef<InputRef>(null);
  const [hint, setHint] = useState("");
  const v = value ?? "";
  const set = (x: string) => onChange?.(x);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return setHint("Bộ nhớ tạm đang trống.");
      set(normalizeWatchInput(text));
      setHint("");
    } catch {
      // Trình duyệt chặn đọc bộ nhớ tạm (trang không phải https/localhost, hoặc bị từ chối quyền).
      ref.current?.focus();
      setHint("Trình duyệt không cho đọc bộ nhớ tạm — hãy bấm vào ô rồi nhấn Ctrl+V.");
    }
  };

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          ref={ref}
          value={v}
          onChange={(e) => set(e.target.value)}
          onPaste={(e) => { e.preventDefault(); set(normalizeWatchInput(e.clipboardData.getData("text"))); setHint(""); }}
          onBlur={() => { const n = normalizeWatchInput(v); if (n !== v) set(n); }}
          placeholder="Mã buổi live hoặc https://www.youtube.com/watch?v=…"
        />
        <Button onClick={pasteFromClipboard} title="Dán mã hoặc link buổi live từ bộ nhớ tạm" icon={<ClipboardPaste size={14} />}>Dán</Button>
      </Space.Compact>
      {hint && <Typography.Text type="warning" style={{ fontSize: 12 }}>{hint}</Typography.Text>}
    </>
  );
}
