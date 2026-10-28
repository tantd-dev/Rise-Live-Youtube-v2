// Ảnh "đang phát" của từng live: worker đẩy JPG (base64) lên, giao diện tải về xem.
import { db, COL, nowISO } from "@/lib/server/firestore";
import { HttpError } from "@/lib/server/http";
import { verifyWorkerToken } from "@/features/machines/server/worker-token";

const MAX_B64 = 950_000;   // dưới giới hạn 1MB/bản ghi Firestore

export async function saveThumb(body: { machineId?: string; streamId?: string; jpgB64?: string }, token: string) {
  const machineId = String(body.machineId ?? ""), streamId = String(body.streamId ?? ""), b64 = String(body.jpgB64 ?? "");
  if (!verifyWorkerToken(machineId, token)) throw new HttpError(401, "unauthorized");
  if (!streamId || !b64) throw new HttpError(400, "thiếu streamId/ảnh");
  if (b64.length > MAX_B64) throw new HttpError(413, "ảnh quá lớn");
  await db.collection(COL.thumbs).doc(streamId).set({ jpgB64: b64, machineId, at: nowISO() });
}

export async function loadThumb(streamId: string): Promise<{ jpg: Buffer; at: string } | null> {
  const d = (await db.collection(COL.thumbs).doc(streamId).get()).data();
  return d?.jpgB64 ? { jpg: Buffer.from(String(d.jpgB64), "base64"), at: String(d.at ?? "") } : null;
}
