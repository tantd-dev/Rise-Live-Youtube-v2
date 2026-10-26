// Nhật ký thao tác (ai làm gì, lúc nào). Lỗi ghi nhật ký KHÔNG được chặn thao tác chính.
import { db, COL, nowISO } from "./firestore";

export async function audit(by: string, action: string, entityId: string, detail = ""): Promise<void> {
  await db.collection(COL.audit).add({ by, action, entityId, detail: detail.slice(0, 300), at: nowISO() }).catch(() => undefined);
}
