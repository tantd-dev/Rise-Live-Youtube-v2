// Kênh YouTube + khóa live: thêm / sửa / xóa. Ghi Firestore liveChannels (khóa nằm trong mảng `keys` của kênh).
// Live chọn khóa của kênh → khóa được CHÉP vào stream.streamKey (worker chỉ đọc stream), kèm channelId/channelKeyId
// để biết nguồn; sửa khóa ở kênh thì cập nhật luôn các live đang dùng (khi chúng không phát).
import { db, COL, nowISO, readOne } from "@/lib/server/firestore";
import { bad, notFound, str } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { shouldBeLive } from "@/features/streams/rules";
import { checkStreamKey, maskKey } from "@/features/streams/stream-key";
import type { Stream } from "@/features/streams/types";
import type { Channel, ChannelKey } from "../types";

export interface ChannelInput { name?: string; url?: string; description?: string }
export interface ChannelKeyInput { name?: string; key?: string; description?: string }

const ref = (id: string) => db.collection(COL.channels).doc(id);

async function getChannel(id: string): Promise<Channel> {
  const c = await readOne<Channel>(COL.channels, id);
  if (!c) throw notFound("Kênh không tồn tại.");
  return { ...c, keys: c.keys ?? [] };
}

function channelPatch(b: ChannelInput): Partial<Channel> {
  const up: Partial<Channel> = {};
  if (b.name !== undefined) up.name = str(b.name, 120);
  if (b.url !== undefined) {
    const u = str(b.url, 300);
    if (u && !/^https?:\/\//i.test(u)) throw bad("Link kênh phải bắt đầu bằng https://");
    up.url = u;
  }
  if (b.description !== undefined) up.description = str(b.description, 500);
  return up;
}

/** Khóa live không được trùng với khóa khác ở BẤT KỲ kênh nào (1 khóa chỉ thuộc 1 kênh YouTube). */
async function assertKeyUnique(key: string, exceptKeyId?: string) {
  const snap = await db.collection(COL.channels).limit(1000).get();
  for (const d of snap.docs) {
    const c = d.data() as Channel;
    const dup = (c.keys ?? []).find((k) => k.key === key && k.id !== exceptKeyId);
    if (dup) throw bad(`Khóa live này đã có ở kênh “${c.name}” (tên khóa: ${dup.name}).`);
  }
}

function keyFields(b: ChannelKeyInput, requireAll: boolean): Partial<ChannelKey> {
  const up: Partial<ChannelKey> = {};
  if (b.name !== undefined || requireAll) {
    up.name = str(b.name, 120);
    if (!up.name) throw bad("Nhập tên khóa live.");
  }
  if (b.key !== undefined || requireAll) {
    const k = str(b.key, 200);
    const c = checkStreamKey(k);
    if (!c.ok) throw bad(c.error);
    up.key = k;
  }
  if (b.description !== undefined) up.description = str(b.description, 500);
  return up;
}

export async function addChannel(b: ChannelInput, by: string): Promise<string> {
  const patch = channelPatch(b);
  if (!patch.name) throw bad("Nhập tên kênh.");
  const r = await db.collection(COL.channels).add({ ...patch, keys: [], createdAt: nowISO(), createdBy: by });
  await audit(by, "channel.add", r.id, patch.name);
  return r.id;
}

export async function updateChannel(id: string, b: ChannelInput, by: string): Promise<void> {
  await getChannel(id);
  const patch = channelPatch(b);
  if (patch.name === "") throw bad("Tên kênh không được trống.");
  await ref(id).set({ ...patch, updatedAt: nowISO() }, { merge: true });
  await audit(by, "channel.update", id, JSON.stringify(patch).slice(0, 200));
}

export async function deleteChannel(id: string, by: string): Promise<void> {
  const c = await getChannel(id);
  const used = await db.collection(COL.streams).where("channelId", "==", id).limit(1).get();
  if (!used.empty) throw bad("Kênh còn live đang gắn vào — xóa live hoặc đổi kênh của live trước.");
  await ref(id).delete();
  await audit(by, "channel.delete", id, c.name);
}

export async function addChannelKey(channelId: string, b: ChannelKeyInput, by: string): Promise<string> {
  const fields = keyFields(b, true) as Required<Pick<ChannelKey, "name" | "key">> & Partial<ChannelKey>;
  await assertKeyUnique(fields.key);
  const keyId = db.collection(COL.channels).doc().id;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref(channelId));
    if (!snap.exists) throw notFound("Kênh không tồn tại.");
    const keys = ((snap.data() as Channel).keys ?? []).slice();
    keys.push({ id: keyId, name: fields.name, key: fields.key, description: fields.description ?? "", createdAt: nowISO(), createdBy: by });
    tx.update(ref(channelId), { keys, updatedAt: nowISO() });
  });
  await audit(by, "channel.key_add", channelId, `${fields.name} → ${maskKey(fields.key)}`);
  return keyId;
}

export async function updateChannelKey(channelId: string, keyId: string, b: ChannelKeyInput, by: string): Promise<void> {
  const fields = keyFields(b, false);
  if (fields.key) await assertKeyUnique(fields.key, keyId);
  // Đổi khóa: các live đang dùng khóa này phải được cập nhật theo → không cho đổi khi có live đang phát.
  const users = fields.key ? await db.collection(COL.streams).where("channelKeyId", "==", keyId).get() : null;
  if (users?.docs.some((d) => shouldBeLive(d.data() as Stream))) throw bad("Khóa này đang được live đang phát sử dụng — dừng live trước khi đổi khóa.");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref(channelId));
    if (!snap.exists) throw notFound("Kênh không tồn tại.");
    const keys = ((snap.data() as Channel).keys ?? []).slice();
    const i = keys.findIndex((k) => k.id === keyId);
    if (i < 0) throw notFound("Khóa live không tồn tại.");
    keys[i] = { ...keys[i], ...fields, updatedAt: nowISO() };
    tx.update(ref(channelId), { keys, updatedAt: nowISO() });
  });
  if (fields.key && users && !users.empty) {
    const batch = db.batch();
    users.docs.forEach((d) => batch.set(d.ref, { streamKey: fields.key, updatedAt: nowISO() }, { merge: true }));
    await batch.commit();
  }
  await audit(by, "channel.key_update", channelId, `${keyId}${fields.key ? ` → ${maskKey(fields.key)}` : ""}`);
}

export async function deleteChannelKey(channelId: string, keyId: string, by: string): Promise<void> {
  const used = await db.collection(COL.streams).where("channelKeyId", "==", keyId).limit(1).get();
  if (!used.empty) throw bad("Khóa này còn live đang dùng — xóa live hoặc đổi khóa của live trước.");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref(channelId));
    if (!snap.exists) throw notFound("Kênh không tồn tại.");
    const keys = ((snap.data() as Channel).keys ?? []).filter((k) => k.id !== keyId);
    tx.update(ref(channelId), { keys, updatedAt: nowISO() });
  });
  await audit(by, "channel.key_delete", channelId, keyId);
}

/** Lấy khóa live của kênh (dùng khi tạo/sửa live, hoặc khi người dùng bấm "hiện khóa"). */
export async function resolveChannelKey(channelId: string, keyId: string): Promise<{ channel: Channel; key: ChannelKey }> {
  const channel = await getChannel(channelId);
  const key = channel.keys.find((k) => k.id === keyId);
  if (!key) throw bad("Khóa live đã chọn không còn tồn tại trong kênh.");
  return { channel, key };
}

export async function revealChannelKey(channelId: string, keyId: string, by: string): Promise<string> {
  const { key } = await resolveChannelKey(channelId, keyId);
  await audit(by, "channel.key_reveal", channelId, key.name);
  return key.key;
}
