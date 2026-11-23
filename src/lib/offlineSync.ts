import type { OfflineTxType, PendingOfflineTransaction, ScanResponse } from '../types';
import { generateTxUuid, getDeviceName, getOrCreateDeviceId } from './device';
import { functionsApi } from './functionsApi';
import {
  addPendingTransaction,
  findCachedStudentByQr,
  getAllPendingTransactions,
  getCachedPermissionsForStudent,
  getOfflineAuthBundle,
  getUnsyncedTransactions,
  saveOfflineBundle,
  updateCachedPermissionLocalStatus,
  updateTransactionStatus
} from './offlineDb';
import { getTodayWibDate } from './time';

export async function prepareOfflineCache(): Promise<{
  expiresAtIso: string;
  studentCount: number;
  permissionCount: number;
}> {
  const deviceId = getOrCreateDeviceId();
  const res = await functionsApi.issueOfflineAuthorization({
    deviceId,
    deviceName: getDeviceName(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  });

  await saveOfflineBundle({
    authorization: res.authorization,
    attendanceSettings: res.attendanceSettings,
    cachedStudents: res.cachedStudents,
    signedPermissions: res.signedPermissions
  });

  return {
    expiresAtIso: res.authorization.payload.expiresAtIso,
    studentCount: res.cachedStudents.length,
    permissionCount: res.signedPermissions.length
  };
}

export async function checkLocalOfflineAuthValidity(teacherUid: string): Promise<{
  valid: boolean;
  reason?: string;
  expiresAtIso?: string;
  scheduleTitle?: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
}> {
  const bundle = await getOfflineAuthBundle();
  if (!bundle?.authorization) {
    return {
      valid: false,
      reason: 'Belum ada otorisasi offline di perangkat ini. Hubungkan ke internet dan klik "Siapkan Mode Offline" terlebih dahulu.'
    };
  }
  const { payload } = bundle.authorization;
  const deviceId = getOrCreateDeviceId();
  if (payload.teacherUid !== teacherUid) {
    return { valid: false, reason: 'Otorisasi offline di perangkat ini bukan milik akun Anda.' };
  }
  if (payload.deviceId !== deviceId) {
    return { valid: false, reason: 'Otorisasi offline tidak cocok dengan perangkat ini.' };
  }
  const expiresMs = Date.parse(payload.expiresAtIso);
  if (Number.isNaN(expiresMs) || Date.now() > expiresMs) {
    return {
      valid: false,
      reason: 'Otorisasi offline telah kedaluwarsa. Scan offline baru tidak diizinkan sampai verifikasi online ulang.'
    };
  }
  if (payload.date !== getTodayWibDate()) {
    return { valid: false, reason: 'Otorisasi offline bukan untuk tanggal hari ini.' };
  }
  return {
    valid: true,
    expiresAtIso: payload.expiresAtIso,
    scheduleTitle: payload.scheduleTitle,
    scheduleStartTime: payload.scheduleStartTime,
    scheduleEndTime: payload.scheduleEndTime
  };
}

/**
 * Records a scan locally in IndexedDB ONLY if a valid, non-expired backend-signed
 * offline authorization exists on this device.
 */
export async function recordOfflineScan(params: {
  type: OfflineTxType;
  qrToken: string;
  teacherUid: string;
  exitPost?: string;
}): Promise<ScanResponse> {
  const authCheck = await checkLocalOfflineAuthValidity(params.teacherUid);
  if (!authCheck.valid) {
    return {
      success: false,
      code: 'OFFLINE_AUTH_EXPIRED',
      message: authCheck.reason || 'Otorisasi offline tidak valid.'
    };
  }

  const student = await findCachedStudentByQr(params.qrToken);
  if (!student) {
    return {
      success: false,
      code: 'QR_INVALID',
      message: 'QR Code tidak dikenali di cache offline perangkat.'
    };
  }

  // Prevent local duplicates in IndexedDB for PAGI / SORE today
  const allLocal = await getAllPendingTransactions();
  const todayStr = getTodayWibDate();
  if (params.type === 'SCAN_PAGI' || params.type === 'SCAN_SORE') {
    const duplicate = allLocal.find(
      (t) =>
        t.studentId === student.studentId &&
        t.type === params.type &&
        t.createdAtIso.startsWith(todayStr) &&
        t.syncStatus !== 'REJECTED'
    );
    if (duplicate) {
      return {
        success: false,
        code: 'ALREADY_SCANNED',
        message: `${student.fullName} sudah tercatat offline untuk sesi ini.`,
        student: {
          id: student.studentId,
          fullName: student.fullName,
          nis: student.nis,
          classId: student.classId,
          className: student.className,
          photoUrl: student.photoUrl
        }
      };
    }
  }

  // For EXIT / RETURN offline: ONLY backend-signed approved permissions in cache may be processed
  let permissionId: string | undefined;
  if (params.type === 'SCAN_KELUAR' || params.type === 'SCAN_KEMBALI') {
    const cachedPerms = await getCachedPermissionsForStudent(student.studentId);
    if (params.type === 'SCAN_KELUAR') {
      const approved = cachedPerms.find(
        (p) => p.payload.status === 'DISETUJUI' && p.payload.date === todayStr && Boolean(p.signature)
      );
      if (!approved) {
        return {
          success: false,
          code: 'NO_SIGNED_PERMISSION',
          message:
            'Tidak ditemukan izin DISETUJUI bertanda tangan backend di cache offline untuk siswa ini.'
        };
      }
      permissionId = approved.payload.permissionId;
      await updateCachedPermissionLocalStatus(permissionId, 'SUDAH_KELUAR');
    } else {
      const activeOut = cachedPerms.find(
        (p) => p.payload.status === 'SUDAH_KELUAR' && Boolean(p.signature)
      );
      if (!activeOut) {
        return {
          success: false,
          code: 'NOT_OUTSIDE_OFFLINE',
          message: 'Siswa tidak tercatat keluar di cache offline bertanda tangan.'
        };
      }
      permissionId = activeOut.payload.permissionId;
      await updateCachedPermissionLocalStatus(permissionId, 'SUDAH_KEMBALI');
    }
  }

  const nowIso = new Date().toISOString();
  const txRecord: PendingOfflineTransaction = {
    transactionUuid: generateTxUuid(),
    type: params.type,
    qrToken: params.qrToken.trim(),
    studentId: student.studentId,
    studentName: student.fullName,
    nis: student.nis,
    className: student.className,
    teacherUid: params.teacherUid,
    deviceId: getOrCreateDeviceId(),
    deviceLocalTimeIso: nowIso,
    permissionId,
    exitPost: params.exitPost,
    syncStatus: 'PENDING_SYNC',
    syncMessage: 'Menunggu verifikasi & sinkronisasi server',
    createdAtIso: nowIso
  };

  await addPendingTransaction(txRecord);

  return {
    success: true,
    code: 'OFFLINE_QUEUED',
    offlinePending: true,
    status: 'PENDING_SYNC',
    scannedAtIso: nowIso,
    message:
      params.type === 'SCAN_KELUAR' || params.type === 'SCAN_KEMBALI'
        ? `${student.fullName} dicatat OFFLINE (Menunggu Verifikasi Server saat online).`
        : `${student.fullName} dicatat OFFLINE (PENDING SYNC).`,
    student: {
      id: student.studentId,
      fullName: student.fullName,
      nis: student.nis,
      classId: student.classId,
      className: student.className,
      photoUrl: student.photoUrl
    }
  };
}

export async function syncPendingOfflineQueue(): Promise<{
  syncedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  flaggedCount: number;
  totalProcessed: number;
}> {
  const unsynced = await getUnsyncedTransactions();
  if (unsynced.length === 0) {
    return { syncedCount: 0, duplicateCount: 0, rejectedCount: 0, flaggedCount: 0, totalProcessed: 0 };
  }

  const bundle = await getOfflineAuthBundle();
  if (!bundle?.authorization) {
    throw new Error('Otorisasi offline tidak ditemukan untuk sinkronisasi.');
  }

  const res = await functionsApi.syncOfflineTransactions({
    authorization: bundle.authorization,
    deviceId: getOrCreateDeviceId(),
    transactions: unsynced.map((t) => ({
      transactionUuid: t.transactionUuid,
      type: t.type,
      qrToken: t.qrToken,
      studentId: t.studentId,
      teacherUid: t.teacherUid,
      deviceId: t.deviceId,
      deviceLocalTimeIso: t.deviceLocalTimeIso,
      permissionId: t.permissionId,
      exitPost: t.exitPost
    }))
  });

  for (const r of res.results) {
    await updateTransactionStatus(r.transactionUuid, {
      syncStatus: r.status,
      syncMessage: r.message,
      flaggedForReview: r.flaggedForReview
    });
  }

  return {
    syncedCount: res.summary.syncedCount,
    duplicateCount: res.summary.duplicateCount,
    rejectedCount: res.summary.rejectedCount,
    flaggedCount: res.summary.flaggedCount,
    totalProcessed: res.summary.total
  };
}
