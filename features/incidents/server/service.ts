// Ghi / đọc nhật ký sự cố.
import { db, COL, nowISO } from "@/lib/server/firestore";
import { redactKeys } from "@/features/streams/stream-key";
import type { Stream } from "@/features/streams/types";
import type { IncidentLog, IncidentRow } from "../types";

export async function logIncident(x: Omit<IncidentLog, "id" | "createdAt" | "resolvedAt"> & { resolvedAt?: string }): Promise<void> {
  await db.collection(COL.incidents).add({
    ...x, reason: redactKeys(x.reason).slice(0, 300), resolvedAt: x.resolvedAt ?? nowISO(), createdAt: nowISO(),
  }).catch(() => undefined);
}

/** Gộp nhật ký cố định + các lần tự phục hồi gần đây của từng live, mới nhất lên đầu. */
export async function listIncidents(limit = 300): Promise<IncidentRow[]> {
  const [logSnap, sSnap] = await Promise.all([
    db.collection(COL.incidents).orderBy("createdAt", "desc").limit(limit).get(),
    db.collection(COL.streams).limit(5000).get(),
  ]);
  const rows: IncidentRow[] = logSnap.docs.map((d) => {
    const x = d.data() as IncidentLog;
    return { key: d.id, at: x.startedAt || x.createdAt, streamName: x.streamName, machineId: x.machineId, kind: x.cause, detail: [x.reason, x.resolution && `→ ${x.resolution}`, x.resolvedBy && `(${x.resolvedBy})`].filter(Boolean).join(" ") };
  });
  for (const d of sSnap.docs) {
    const s = d.data() as Stream;
    (s.recentIncidents ?? []).forEach((ev, i) => rows.push({
      key: `${d.id}:${i}:${ev.at}`, at: ev.at, streamName: s.name, machineId: ev.machineId ?? s.machineId,
      kind: ev.kind === "restart" ? "Tự khởi động lại" : ev.kind, detail: redactKeys(ev.reason), downSec: ev.downSec,
    }));
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
