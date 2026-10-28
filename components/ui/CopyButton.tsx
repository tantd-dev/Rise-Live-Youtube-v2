"use client";
import { useState } from "react";
import { Button, Tooltip } from "antd";
import { Check, Copy } from "lucide-react";
import { ICON } from "./primitives";

/** Nút sao chép chữ vào clipboard (có dự phòng cho trang http không có Clipboard API). */
export function CopyButton({ text, label = "Sao chép", iconOnly }: { text: string; label?: string; iconOnly?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  const icon = done ? <Check {...ICON} color="#16a34a" /> : <Copy {...ICON} />;
  if (iconOnly) return <Tooltip title={done ? "Đã sao chép" : label}><Button size="small" type="text" icon={icon} onClick={copy} aria-label={label} /></Tooltip>;
  return <Button size="small" icon={icon} onClick={copy}>{done ? "Đã sao chép" : label}</Button>;
}
