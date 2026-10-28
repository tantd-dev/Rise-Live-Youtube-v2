// Gom dữ liệu cho giao diện: máy (kèm online/số live), video, live (che khóa), tổng quan, cảnh báo.
import { COL, readAll } from "@/lib/server/firestore";
import { env } from "@/lib/server/env";
import { computeAlerts } from "@/features/alerts/compute";
import type { Asset } from "@/features/assets/types";
import { isProcessing } from "@/features/assets/types";
import type { Machine, MachineView } from "@/features/machines/types";
import { isOnline } from "@/features/machines/rules";
import { nextStartMs, isWithinSchedule } from "@/features/streams/schedule";
import { shouldBeLive } from "@/features/streams/rules";
import { maskKey, redactKeys } from "@/features/streams/stream-key";
import type { Stream, StreamView } from "@/features/streams/types";
import { can, type SessionUser } from "@/features/users/types";
import { getSwitch } from "@/features/failover/server/service";
import type { DashboardData } from "../types";

const byNewest = (a: { createdAt?: string }, b: { createdAt?: string }) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));

export function toStreamView(s: Stream, nowMs: number): StreamView {
  const { streamKey, ...rest } = s;
  const next = nextStartMs(s.schedule, nowMs);
  return {
    ...rest,
    haltReason: s.haltReason ? redactKeys(s.haltReason) : s.haltReason,
    error: s.error ? redactKeys(s.error) : s.error,
    streamKeyMasked: maskKey(streamKey),
    scheduleActive: s.control === "schedule" && isWithinSchedule(s.schedule, nowMs),
    nextStartISO: next != null ? new Date(next).toISOString() : null,
    shouldBeLive: shouldBeLive(s, nowMs),
  };
}

export async function buildDashboard(user: SessionUser): Promise<DashboardData> {
  const nowMs = Date.now();
  const [machines, assets, streams] = await Promise.all([
    readAll<Machine>(COL.machines, 500), readAll<Asset>(COL.assets, 8000), readAll<Stream>(COL.streams, 5000),
  ]);
  const machineViews: MachineView[] = machines.map((m) => ({
    ...m,
    online: isOnline(m, nowMs),
    liveCount: streams.filter((s) => s.machineId === m.id && shouldBeLive(s, nowMs)).length,
  })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const alerts = computeAlerts(machines, streams, assets, nowMs);
  const streamViews = streams.map((s) => toStreamView(s, nowMs)).sort(byNewest);

  return {
    user,
    serverTime: new Date(nowMs).toISOString(),
    overview: {
      streamsLive: streams.filter((s) => s.status === "live" && shouldBeLive(s, nowMs)).length,
      streamsWanted: streamViews.filter((s) => s.shouldBeLive).length,
      streamsError: streams.filter((s) => shouldBeLive(s, nowMs) && (s.health === "error" || s.needsHuman || !!s.ytIssue)).length,
      machinesOnline: machineViews.filter((m) => m.online).length,
      machinesTotal: machines.length,
      assetsReady: assets.filter((a) => a.status === "ready").length,
      assetsProcessing: assets.filter(isProcessing).length,
      assetsError: assets.filter((a) => a.status === "error").length,
      alertsCritical: alerts.filter((a) => a.level === "critical").length,
      alertsWarn: alerts.filter((a) => a.level === "warn").length,
    },
    alerts,
    machines: machineViews,
    assets: assets.sort(byNewest),
    streams: streamViews,
    failover: can(user, "settings.manage") ? await getSwitch() : null,
    config: {
      uploadEnabled: !!env.uploadToken(),
      ytApiKey: !!env.ytApiKey(),
      autoFailover: env.autoFailover(),
      lease: env.leaseOn(),
      rtmpBase: env.rtmpBase(),
    },
  };
}
