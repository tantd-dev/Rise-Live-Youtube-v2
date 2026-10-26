// Kiểm link Google Drive TRƯỚC khi nhận (chặn link thư mục / tài liệu / thiếu mã file). THUẦN.
export type DriveCheck = { ok: true; fileId: string } | { ok: false; error: string };

export function checkDriveLink(raw: unknown): DriveCheck {
  const url = String(raw ?? "").trim();
  if (!url) return { ok: false, error: "Chưa dán link Google Drive." };
  if (!/drive\.google\.com|docs\.google\.com/i.test(url))
    return { ok: false, error: "Đây không phải link Google Drive. Mở video trên Drive → Chia sẻ → Sao chép đường liên kết." };
  if (/\/drive\/(u\/\d+\/)?folders\//i.test(url))
    return { ok: false, error: "Đây là link THƯ MỤC, không phải link video. Mở đúng file video → Chia sẻ → Sao chép đường liên kết." };
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/i.test(url))
    return { ok: false, error: "Đây là link tài liệu (Docs/Sheets/Slides), không phải video." };
  const fileId = driveFileId(url);
  if (!fileId) return { ok: false, error: "Link Drive không có mã file. Dùng link dạng https://drive.google.com/file/d/…/view." };
  return { ok: true, fileId };
}

export function driveFileId(url: string | null | undefined): string {
  const s = String(url ?? "");
  return s.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/)?.[1] || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1] || "";
}
