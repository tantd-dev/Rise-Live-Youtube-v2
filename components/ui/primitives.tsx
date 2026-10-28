"use client";
// Thành phần giao diện cơ bản dùng chung (không chứa nghiệp vụ), dựng trên antd.
import type { ReactNode } from "react";
import { Tag } from "antd";

export type Tone = "green" | "amber" | "red" | "gray" | "blue";

/** Tone nội bộ → màu trạng thái của antd. */
export const TONE_COLOR: Record<Tone, string> = { green: "success", amber: "warning", red: "error", blue: "processing", gray: "default" };
/** Tone → mã màu (dùng cho viền, chữ số liệu). */
export const TONE_HEX: Record<Tone, string> = { green: "#16a34a", amber: "#d97706", red: "#dc2626", blue: "#2563eb", gray: "#94a3b8" };

export function Pill({ tone = "gray", children, title, icon }: { tone?: Tone; children: ReactNode; title?: string; icon?: ReactNode }) {
  return <Tag color={TONE_COLOR[tone]} title={title} icon={icon} bordered={false} style={{ marginInlineEnd: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>{children}</Tag>;
}

/** Icon lucide cỡ chuẩn trong nút / thẻ. */
export const ICON = { size: 14, strokeWidth: 2 } as const;
