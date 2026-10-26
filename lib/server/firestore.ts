// Kết nối Firestore dùng chung cho mọi route/service phía máy chủ.
// Có FIRESTORE_EMULATOR_HOST → dùng emulator (không cần khoá Google). Không có → dùng
// Application Default Credentials (Cloud Run / máy đã `gcloud auth application-default login`).
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function init(): Firestore {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "demo-rise-live";
  const app = getApps()[0] ?? initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { credential: applicationDefault(), projectId },
  );
  const fs = getFirestore(app);
  try {
    fs.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Next dev nạp lại module → Firestore đã cấu hình rồi, dùng lại.
  }
  return fs;
}

export const db: Firestore = init();

/** Tên collection — giữ nguyên như bản cũ để dữ liệu cũ đọc được. */
export const COL = {
  machines: "liveMachines",
  assets: "liveAssets",
  streams: "liveStreams",
  incidents: "liveIncidentLog",
  moves: "liveMoveExecutions",
  settings: "liveSettings",
  thumbs: "liveThumbs",
  alertState: "liveAlertState",
  users: "users",
  sessions: "sessions",
  audit: "auditLog",
} as const;

export const nowISO = () => new Date().toISOString();

/** Đọc cả collection thành mảng {id, ...data}. Trần `limit` để không đọc vô hạn. */
export async function readAll<T>(col: string, limit = 2000): Promise<T[]> {
  const snap = await db.collection(col).limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function readOne<T>(col: string, id: string): Promise<T | null> {
  if (!id) return null;
  const d = await db.collection(col).doc(id).get();
  return d.exists ? ({ id: d.id, ...d.data() } as T) : null;
}
