"use client";
import { useState } from "react";

/** Nút sao chép chữ vào clipboard (có dự phòng cho trang http không có Clipboard API). */
export function CopyButton({ text, label = "Sao chép" }: { text: string; label?: string }) {
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
  return <button type="button" className="btn-small" onClick={copy}>{done ? "✓ Đã chép" : label}</button>;
}
