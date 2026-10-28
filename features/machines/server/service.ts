// Máy live (VPS): thêm / sửa / ngắt / xóa. Ghi Firestore liveMachines.
import { db, COL, nowISO, readOne } from "@/lib/server/firestore";
import { bad, notFound, str } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { streamAssetIds } from "@/features/streams/rules";
import type { Machine, MachineRole } from "../types";

const ROLES: MachineRole[] = ["stream-247", "live-pub", "shared"];

export interface MachineInput {
  name?: string; ip?: string; role?: string; provider?: string; region?: string;
  uploadMbps?: number | string; uploadHttpsUrl?: string; maintenance?: boolean; forceOffline?: boolean;
  costAmount?: number | string | null; costPeriod?: string; costRenewAt?: string;
}

/** Chỉ nhận trường hợp lệ từ form → bản vá Firestore. */
function toPatch(b: MachineInput): Partial<Machine> {
  const up: Partial<Machine> = {};
  if (b.name !== undefined) up.name = str(b.name, 80);
  if (b.ip !== undefined) up.ip = str(b.ip, 80);
  if (b.role !== undefined && ROLES.includes(b.role as MachineRole)) up.role = b.role as MachineRole;
  if (b.provider !== undefined) up.provider = str(b.provider, 60);
  if (b.region !== undefined) up.region = str(b.region, 60);
  if (b.uploadMbps !== undefined) {
    const mbps = Math.max(0, Number(b.uploadMbps) || 0);
    up.uploadMbps = mbps;
    up.uploadMbpsManual = mbps > 0;   // > 0 = đặt tay; 0 = để worker tự đo
  }
  if (b.uploadHttpsUrl !== undefined) {
    const u = str(b.uploadHttpsUrl).replace(/\/+$/, "");
    if (u && !/^https:\/\//.test(u)) throw bad("Địa chỉ nhận file phải bắt đầu bằng https://");
    up.uploadHttpsUrl = u;
  }
  if (typeof b.maintenance === "boolean") up.maintenance = b.maintenance;
  if (typeof b.forceOffline === "boolean") up.forceOffline = b.forceOffline;
  if (b.costAmount !== undefined) { const v = Number(b.costAmount); up.costAmount = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null; }
  if (b.costPeriod !== undefined) up.costPeriod = b.costPeriod === "year" ? "year" : "month";
  if (b.costRenewAt !== undefined) up.costRenewAt = /^\d{4}-\d{2}-\d{2}$/.test(String(b.costRenewAt)) ? String(b.costRenewAt) : null;
  return up;
}

export async function addMachine(b: MachineInput, by: string): Promise<string> {
  const patch = toPatch({ role: "stream-247", ...b });
  if (!patch.name || !patch.ip) throw bad("Thiếu tên hoặc IP máy.");
  const ref = await db.collection(COL.machines).add({ ...patch, status: "registered", createdAt: nowISO(), createdBy: by });
  await audit(by, "machine.add", ref.id, `${patch.name} (${patch.ip})`);
  return ref.id;
}

export async function updateMachine(id: string, b: MachineInput, by: string): Promise<void> {
  if (!(await readOne<Machine>(COL.machines, id))) throw notFound("Máy không tồn tại.");
  const patch = toPatch(b);
  if (patch.name === "") throw bad("Tên VPS không được trống.");
  await db.collection(COL.machines).doc(id).set({ ...patch, updatedAt: nowISO() }, { merge: true });
  await audit(by, "machine.update", id, JSON.stringify(patch).slice(0, 200));
}

/** Xóa máy: chỉ khi không còn live gắn vào; dọn luôn bản ghi video của máy (file mất theo máy). */
export async function deleteMachine(id: string, by: string): Promise<number> {
  const onMachine = await db.collection(COL.streams).where("machineId", "==", id).limit(1).get();
  if (!onMachine.empty) throw bad("Máy còn live gắn vào — xóa hoặc chuyển live trước.");
  const [aSnap, sSnap] = await Promise.all([
    db.collection(COL.assets).where("machineId", "==", id).limit(500).get(),
    db.collection(COL.streams).limit(5000).get(),
  ]);
  const used = new Set<string>();
  sSnap.docs.forEach((d) => streamAssetIds(d.data() as never).forEach((x) => used.add(x)));
  const inUse = aSnap.docs.filter((d) => used.has(d.id)).length;
  if (inUse) throw bad(`Máy còn ${inUse} video đang được live khác dùng — gỡ khỏi live trước.`);
  const batch = db.batch();
  aSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection(COL.machines).doc(id));
  await batch.commit();
  await audit(by, "machine.delete", id, `dọn ${aSnap.size} video`);
  return aSnap.size;
}
