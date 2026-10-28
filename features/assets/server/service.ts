// Kho video: thêm từ Google Drive, sao chép sang máy khác, đổi tên, xóa. Worker tự tải/chuẩn hóa.
import { db, COL, nowISO, readOne } from "@/lib/server/firestore";
import { bad, notFound, str } from "@/lib/server/http";
import { env } from "@/lib/server/env";
import { audit } from "@/lib/server/audit";
import { intakeBlock, isOnline } from "@/features/machines/rules";
import type { Machine } from "@/features/machines/types";
import { checkDriveLink } from "../drive-link";
import { ORIGINAL_PRESET_ID } from "../presets";
import type { Asset } from "../types";

/** Địa chỉ HTTP worker của 1 máy (để máy khác kéo file VPS→VPS). */
const workerHttpUrl = (m: Machine | null) => (m?.ip ? `http://${m.ip}:${env.uploadPort()}` : null);

async function machineOrFail(id: string): Promise<Machine> {
  const m = await readOne<Machine>(COL.machines, id);
  if (!m) throw bad("Máy không tồn tại.");
  return m;
}

export async function addDriveAsset(b: { name?: string; sourceUrl?: string; machineId?: string }, by: string) {
  const name = str(b.name, 120), sourceUrl = str(b.sourceUrl, 500), machineId = str(b.machineId, 80);
  if (!name) throw bad("Thiếu tên video.");
  const link = checkDriveLink(sourceUrl);
  if (!link.ok) throw bad(link.error);
  if (!machineId) throw bad("Chọn máy để tải video về.");
  const m = await machineOrFail(machineId);
  const block = intakeBlock(m, env.minFreeGb());
  if (block) throw bad(block);

  // Link này máy khác ĐÃ có bản sẵn sàng → chép thẳng VPS→VPS (nhanh, không tốn hạn mức tải Drive).
  // copyOptional: chép hỏng thì worker lui về tải Drive như thường.
  let copy: Partial<Asset> = {};
  const same = await db.collection(COL.assets).where("sourceUrl", "==", sourceUrl).limit(20).get();
  for (const d of same.docs) {
    const a = d.data() as Asset;
    if (a.status !== "ready" || !a.machineId || a.machineId === machineId) continue;
    const src = await readOne<Machine>(COL.machines, a.machineId);
    const url = workerHttpUrl(src);
    if (src && url && isOnline(src)) { copy = { copyFromUrl: url, copyFromAssetId: d.id, copyOptional: true }; break; }
  }
  const ref = await db.collection(COL.assets).add({
    name, sourceUrl, presetId: ORIGINAL_PRESET_ID, machineId, status: "pending", source: "drive",
    createdAt: nowISO(), createdBy: by, ...copy,
  });
  await audit(by, "asset.add", ref.id, name);
  return { id: ref.id, reused: !!copy.copyFromUrl };
}

/** Sao chép video sang máy khác: máy đích kéo thẳng file từ máy nguồn (hoặc tải lại từ Drive). */
export async function copyAsset(assetId: string, targetMachineId: string, by: string) {
  const a = await readOne<Asset>(COL.assets, assetId);
  if (!a) throw notFound("Không tìm thấy video.");
  if (a.machineId === targetMachineId) throw bad("Video đã ở trên máy này rồi.");
  const target = await machineOrFail(targetMachineId);
  const block = intakeBlock(target, env.minFreeGb(), { backupOnly: true });
  if (block) throw bad(block);
  const src = await readOne<Machine>(COL.machines, a.machineId);
  const copyFromUrl = workerHttpUrl(src);
  if (!copyFromUrl && !a.sourceUrl) throw bad("Không sao chép được: máy nguồn chưa có IP và video không có link Drive.");
  const dup = await db.collection(COL.assets).where("machineId", "==", targetMachineId).limit(1000).get();
  if (dup.docs.some((d) => { const x = d.data() as Asset; return x.copyFromAssetId === assetId || (!!a.sourceUrl && x.sourceUrl === a.sourceUrl); }))
    throw bad("Máy đích đã có video này rồi.");
  const ref = await db.collection(COL.assets).add({
    name: a.name, sourceUrl: a.sourceUrl ?? null, presetId: a.presetId || ORIGINAL_PRESET_ID, machineId: targetMachineId,
    status: "pending", source: "manual-copy", createdAt: nowISO(), createdBy: by,
    ...(copyFromUrl ? { copyFromUrl, copyFromAssetId: assetId } : {}),
  });
  await audit(by, "asset.copy", ref.id, `${a.name} → ${target.name}`);
  return ref.id;
}

export async function renameAsset(id: string, name: string, by: string) {
  const n = str(name, 120);
  if (!n) throw bad("Tên không được trống.");
  if (!(await readOne<Asset>(COL.assets, id))) throw notFound();
  await db.collection(COL.assets).doc(id).set({ name: n, updatedAt: nowISO() }, { merge: true });
  await audit(by, "asset.rename", id, n);
}

/** Xóa video (worker tự dọn file trên VPS ở nhịp sau). Chặn nếu còn live dùng. */
export async function deleteAsset(id: string, by: string) {
  const [single, inList] = await Promise.all([
    db.collection(COL.streams).where("assetId", "==", id).limit(1).get(),
    db.collection(COL.streams).where("assetIds", "array-contains", id).limit(1).get(),
  ]);
  if (!single.empty || !inList.empty) throw bad("Video đang được một live dùng — xóa hoặc sửa live trước.");
  await db.collection(COL.assets).doc(id).delete();
  await audit(by, "asset.delete", id);
}

/** Thông tin để trình duyệt TẢI THẲNG file lên worker của 1 máy. */
export async function uploadTarget(machineId: string, by: string) {
  const token = env.uploadToken();
  if (!token) throw bad("Chức năng tải lên trực tiếp chưa bật (thiếu RISE_LIVE_UPLOAD_TOKEN trên máy chủ).");
  const m = await machineOrFail(machineId);
  const block = intakeBlock(m, env.minFreeGb());
  if (block) throw bad(block);
  const url = m.uploadHttpsUrl || workerHttpUrl(m);
  if (!url) throw bad("Máy chưa có IP / địa chỉ nhận file.");
  await audit(by, "asset.upload_token", machineId);
  return { url, token };
}
