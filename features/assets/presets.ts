// Preset chất lượng video + công thức băng thông. THUẦN.
// Chính sách giữ từ bản cũ: video thêm từ Drive LUÔN "Giữ nguyên gốc" (không nén lại trên VPS) —
// nhân sự chuẩn hoá sẵn ở máy tính. Các preset nén vẫn giữ để worker hiểu dữ liệu cũ.
export interface QualityPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  fps: 30 | 60;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  keepOriginal?: boolean;
}

export const PRESETS: QualityPreset[] = [
  { id: "livepreset:1080p-6m", label: "1080p Chuẩn", width: 1920, height: 1080, fps: 30, videoBitrateKbps: 6000, audioBitrateKbps: 256 },
  { id: "livepreset:1080p-4m", label: "1080p Nhẹ", width: 1920, height: 1080, fps: 30, videoBitrateKbps: 4500, audioBitrateKbps: 256 },
  { id: "livepreset:4k-badge-6m", label: "4K (nhãn) Nhẹ", width: 3840, height: 2160, fps: 30, videoBitrateKbps: 6000, audioBitrateKbps: 256 },
  { id: "livepreset:4k-badge-10m", label: "4K (nhãn) Cao", width: 3840, height: 2160, fps: 30, videoBitrateKbps: 10000, audioBitrateKbps: 256 },
  { id: "livepreset:4k-true-20m", label: "4K Thật", width: 3840, height: 2160, fps: 30, videoBitrateKbps: 20000, audioBitrateKbps: 256 },
  { id: "livepreset:original", label: "Giữ nguyên gốc", width: 3840, height: 2160, fps: 30, videoBitrateKbps: 22000, audioBitrateKbps: 256, keepOriginal: true },
];

export const ORIGINAL_PRESET_ID = "livepreset:original";

export const findPreset = (id: string | undefined | null) => PRESETS.find((p) => p.id === id) ?? null;

/** Dùng ~70% băng thông máy, chừa 30% dự phòng. */
export const SAFETY_FACTOR = 0.7;
const RTMP_OVERHEAD = 1.05;

/** Băng thông 1 luồng cần (Mbps), gồm hao phí RTMP. */
export function streamMbps(p: QualityPreset | null): number {
  if (!p) return 0;
  return Math.round(((p.videoBitrateKbps + p.audioBitrateKbps) / 1000) * RTMP_OVERHEAD * 100) / 100;
}

/** Thông tin preset gửi xuống worker (đúng hình dạng worker cũ đọc). */
export function presetForWorker(p: QualityPreset | null) {
  return p ? { width: p.width, height: p.height, fps: p.fps, videoBitrateKbps: p.videoBitrateKbps, audioBitrateKbps: p.audioBitrateKbps, keepOriginal: !!p.keepOriginal } : null;
}
