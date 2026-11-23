import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  AttendanceSettings,
  CachedOfflineStudent,
  PendingOfflineTransaction,
  SignedOfflineAuthorization,
  SignedOfflinePermission
} from '../types';

interface SmartAttendanceDB extends DBSchema {
  offline_auth: {
    key: string;
    value: {
      key: 'current';
      authorization: SignedOfflineAuthorization;
      attendanceSettings: AttendanceSettings;
      syncedAtIso: string;
    };
  };
  cached_students: {
    key: string; // qrToken
    value: CachedOfflineStudent;
    indexes: { 'by-studentId': string };
  };
  cached_permissions: {
    key: string; // permissionId
    value: SignedOfflinePermission;
    indexes: { 'by-studentId': string };
  };
  pending_transactions: {
    key: string; // transactionUuid
    value: PendingOfflineTransaction;
    indexes: { 'by-status': string };
  };
}

const DB_NAME = 'smart_attendance_smkn6_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SmartAttendanceDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<SmartAttendanceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SmartAttendanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offline_auth')) {
          db.createObjectStore('offline_auth', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('cached_students')) {
          const store = db.createObjectStore('cached_students', { keyPath: 'qrToken' });
          store.createIndex('by-studentId', 'studentId');
        }
        if (!db.objectStoreNames.contains('cached_permissions')) {
          const store = db.createObjectStore('cached_permissions', { keyPath: 'payload.permissionId' });
          store.createIndex('by-studentId', 'payload.studentId');
        }
        if (!db.objectStoreNames.contains('pending_transactions')) {
          const store = db.createObjectStore('pending_transactions', { keyPath: 'transactionUuid' });
          store.createIndex('by-status', 'syncStatus');
        }
      }
    });
  }
  return dbPromise;
}

export async function saveOfflineBundle(params: {
  authorization: SignedOfflineAuthorization;
  attendanceSettings: AttendanceSettings;
  cachedStudents: CachedOfflineStudent[];
  signedPermissions: SignedOfflinePermission[];
}): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(['offline_auth', 'cached_students', 'cached_permissions'], 'readwrite');

  await tx.objectStore('offline_auth').put({
    key: 'current',
    authorization: params.authorization,
    attendanceSettings: params.attendanceSettings,
    syncedAtIso: new Date().toISOString()
  });

  const stuStore = tx.objectStore('cached_students');
  await stuStore.clear();
  for (const s of params.cachedStudents) {
    await stuStore.put(s);
  }

  const permStore = tx.objectStore('cached_permissions');
  await permStore.clear();
  for (const p of params.signedPermissions) {
    await permStore.put(p);
  }

  await tx.done;
}

export async function getOfflineAuthBundle() {
  const db = await getOfflineDb();
  return db.get('offline_auth', 'current');
}

export async function clearOfflineAuthBundle() {
  const db = await getOfflineDb();
  const tx = db.transaction(['offline_auth', 'cached_students', 'cached_permissions'], 'readwrite');
  await tx.objectStore('offline_auth').clear();
  await tx.objectStore('cached_students').clear();
  await tx.objectStore('cached_permissions').clear();
  await tx.done;
}

export async function findCachedStudentByQr(qrToken: string): Promise<CachedOfflineStudent | undefined> {
  const db = await getOfflineDb();
  return db.get('cached_students', qrToken.trim());
}

export async function getCachedStudentCount(): Promise<number> {
  const db = await getOfflineDb();
  return db.count('cached_students');
}

export async function getCachedPermissionsForStudent(
  studentId: string
): Promise<SignedOfflinePermission[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex('cached_permissions', 'by-studentId', studentId);
}

export async function updateCachedPermissionLocalStatus(
  permissionId: string,
  newStatus: 'SUDAH_KELUAR' | 'SUDAH_KEMBALI'
): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('cached_permissions', permissionId);
  if (existing) {
    existing.payload.status = newStatus;
    await db.put('cached_permissions', existing);
  }
}

export async function addPendingTransaction(tx: PendingOfflineTransaction): Promise<void> {
  const db = await getOfflineDb();
  await db.put('pending_transactions', tx);
}

export async function getAllPendingTransactions(): Promise<PendingOfflineTransaction[]> {
  const db = await getOfflineDb();
  const all = await db.getAll('pending_transactions');
  return all.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export async function getUnsyncedTransactions(): Promise<PendingOfflineTransaction[]> {
  const db = await getOfflineDb();
  const all = await db.getAll('pending_transactions');
  return all.filter((t) => t.syncStatus === 'PENDING_SYNC' || t.syncStatus === 'FAILED');
}

export async function updateTransactionStatus(
  transactionUuid: string,
  updates: Partial<PendingOfflineTransaction>
): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('pending_transactions', transactionUuid);
  if (existing) {
    await db.put('pending_transactions', { ...existing, ...updates });
  }
}

export async function clearSyncedTransactions(): Promise<void> {
  const db = await getOfflineDb();
  const all = await db.getAll('pending_transactions');
  const tx = db.transaction('pending_transactions', 'readwrite');
  for (const item of all) {
    if (item.syncStatus === 'SYNCED' || item.syncStatus === 'DUPLICATE') {
      await tx.store.delete(item.transactionUuid);
    }
  }
  await tx.done;
}
