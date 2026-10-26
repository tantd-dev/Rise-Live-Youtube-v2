// Khoá luồng YouTube: kiểm trước khi lưu + che khi hiển thị. THUẦN.
// (Bài học bản cũ: dán nhầm LINK vào ô khoá → luồng chớp tắt mãi, hệ đoán nhầm là lỗi mạng.)
export type KeyCheck = { ok: true } | { ok: false; error: string };

export function checkStreamKey(raw: unknown): KeyCheck {
  const k = String(raw ?? "").trim();
  const low = k.toLowerCase();
  if (!k) return { ok: false, error: "Chưa nhập khoá luồng." };
  if (low.includes("://") || /youtube\.com|youtu\.be|drive\.google|facebook\.com/.test(low))
    return { ok: false, error: "Đây là ĐƯỜNG DẪN, không phải khoá luồng. Lấy khoá trong YouTube Studio › Phát trực tiếp › Khoá luồng (dạng xxxx-xxxx-xxxx-xxxx-xxxx)." };
  if (/\s/.test(k)) return { ok: false, error: "Khoá luồng không được chứa dấu cách." };
  if (k.length < 10) return { ok: false, error: "Khoá luồng quá ngắn — khoá thật thường dài 16–30 ký tự." };
  if (k.length > 120) return { ok: false, error: "Khoá luồng quá dài — kiểm tra lại đoạn vừa dán." };
  if (!/^[A-Za-z0-9_-]+$/.test(k)) return { ok: false, error: "Khoá luồng chỉ gồm chữ, số và dấu gạch." };
  return { ok: true };
}

export const maskKey = (k: string | undefined | null) => {
  const s = String(k ?? "");
  return s.length > 4 ? "•••• " + s.slice(-4) : s ? "••••" : "";
};

/** Che mọi khoá luồng lẫn trong câu lỗi của ffmpeg (rtmp://…/live2/<khoá>). */
export function redactKeys(text: unknown): string {
  return String(text ?? "")
    .replace(/(rtmps?:\/\/[^\s/]+\/[^\s/]+\/)([A-Za-z0-9_-]{8,})/gi, "$1••••")
    .replace(/\b[a-z0-9]{4}(-[a-z0-9]{4}){3,}\b/gi, "••••");
}
