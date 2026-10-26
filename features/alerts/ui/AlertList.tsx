"use client";
import { Empty, Pill } from "@/components/ui/primitives";
import type { Alert } from "../compute";

const TONE = { critical: "red", warn: "amber", info: "gray" } as const;
const LABEL = { critical: "Nghiêm trọng", warn: "Cảnh báo", info: "Thông tin" } as const;

export function AlertList({ alerts, onPick }: { alerts: Alert[]; onPick?: (a: Alert) => void }) {
  if (!alerts.length) return <Empty>✅ Không có cảnh báo nào.</Empty>;
  return (
    <ul className="alert-list">
      {alerts.map((a) => (
        <li key={a.fingerprint} className={`alert alert-${a.level}`} onClick={onPick ? () => onPick(a) : undefined}>
          <Pill tone={TONE[a.level]}>{LABEL[a.level]}</Pill>
          {a.priority && <Pill tone="amber">⭐ Ưu tiên</Pill>}
          <span className="alert-text">{a.text}</span>
          <code className="muted">{a.code}</code>
        </li>
      ))}
    </ul>
  );
}
