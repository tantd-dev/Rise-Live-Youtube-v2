"use client";
// Ô "Link xem buổi live": dán MÃ buổi live (vd dQw4w9WgXcQ) hoặc bất kỳ link YouTube nào
// → tự đổi thành https://www.youtube.com/watch?v=<mã>.
import { useRef, useState } from "react";
import { normalizeWatchInput } from "../types";

export function WatchUrlInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [hint, setHint] = useState("");

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return setHint("Bộ nhớ tạm đang trống.");
      onChange(normalizeWatchInput(text));
      setHint("");
    } catch {
      // Trình duyệt chặn đọc bộ nhớ tạm (trang không phải https/localhost, hoặc bị từ chối quyền).
      ref.current?.focus();
      setHint("Trình duyệt chặn đọc bộ nhớ tạm — bấm vào ô rồi nhấn Ctrl+V.");
    }
  };

  return (
    <>
      <div className="input-row">
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => { e.preventDefault(); onChange(normalizeWatchInput(e.clipboardData.getData("text"))); setHint(""); }}
          onBlur={() => { const n = normalizeWatchInput(value); if (n !== value) onChange(n); }}
          placeholder="Mã buổi live hoặc https://www.youtube.com/watch?v=..."
        />
        <button type="button" onClick={pasteFromClipboard} title="Dán mã hoặc link buổi live từ bộ nhớ tạm">📋 Dán</button>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </>
  );
}
