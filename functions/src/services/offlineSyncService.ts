import crypto from 'crypto';
import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../config';
import {
  OfflineTransactionInput,
  PermissionRequestDoc,
  SignedOfflineAuthorization,
  SignedOfflinePermission,
  StudentDoc
} from '../types';
import { validateActiveDutyForCaller, verifyCaller } from '../utils/authGuard';
import { signPayload, verifySignedPayload } from '../utils/crypto';
import { getWibParts, isClockSkewSuspicious, parseTimeToMinutes } from '../utils/time';
import { writeAuditLog } from '../utils/audit';
import {
  executeAttendanceTransaction,
  loadAttendanceSettingsAndHoliday
} from './attendanceService';
import {
  executeExitScanTransaction,
  executeReturnScanTransaction
} from './permissionService';

/**
 * Pure verifier for backend-signed offline authorization.
 */
export function verifyOfflineAuthorization(
  authBundle: SignedOfflineAuthorization,
  expectedTeacherUid: string,
  expectedDeviceId: string,
  now: Date = new Date(),
  secretOverride?: string
): { valid: boolean; reason?: string } {
  if (!authBundle?.payload || !authBundle?.signature) {
    return { valid: false, reason: 'Otorisasi offline tidak ditemukan.' };
  }
  const sigValid = verifySignedPayload(authBundle.payload, authBundle.signature, secretOverride);
  if (!sigValid) {
    return { valid: false, reason: 'Tanda tangan otorisasi offline tidak valid atau telah dimodifikasi.' };
  }
  if (authBundle.payload.teacherUid !== expectedTeacherUid) {
    return { valid: false, reason: 'Otorisasi offline bukan milik akun guru piket ini.' };
  }
  if (authBundle.payload.deviceId !== expectedDeviceId) {
    return { valid: false, reason: 'Otorisasi offline tidak cocok dengan perangkat ini.' };
  }
  const expiresMs = Date.parse(authBundle.payload.expiresAtIso);
  if (Number.isNaN(expiresMs) || now.getTime() > expiresMs) {
    return { valid: false, reason: 'Otorisasi offline sudah kedaluwarsa. Lakukan sinkronisasi online ulang.' };
  }
  return { valid: true };
}

/**
 * Issues a time-limited, HMAC-signed offline authorization bundle along with
 * minimal student QR lookup cache and backend-signed approved permissions for today.
 */
export async function handleIssueOfflineAuthorization(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET']);
  const data = request.data as { deviceId: string; deviceName?: string; userAgent?: string };

  if (!data?.deviceId) {
    throw new HttpsError('invalid-argument', 'deviceId wajib diisi.');
  }

  const now = new Date();
  const wib = getWibParts(now);
  const duty = await validateActiveDutyForCaller(caller, now);
  if (!duty.valid || !duty.schedule) {
    throw new HttpsError('failed-precondition', duty.message);
  }

  const { settings } = await loadAttendanceSettingsAndHoliday(wib.date);
  const maxDurationMs = Math.max(30, settings.offlineAuthDurationMinutes || 480) * 60 * 1000;

  // Cap expiry to the end of the active duty schedule today (WIB) or maxDurationMs, whichever is earlier
  const endMin = parseTimeToMinutes(duty.schedule.endTime);
  const remainingScheduleMinutes = Math.max(5, endMin - wib.minutesOfDay + 15);
  const effectiveDurationMs = Math.min(maxDurationMs, remainingScheduleMinutes * 60 * 1000);
  const expiresAt = new Date(now.getTime() + effectiveDurationMs);

  const authId = `OFF-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const payload: SignedOfflineAuthorization['payload'] = {
    authId,
    teacherUid: caller.uid,
    teacherId: caller.teacherId || caller.uid,
    teacherName: caller.displayName,
    scheduleId: duty.schedule.id,
    scheduleTitle: duty.schedule.title,
    deviceId: data.deviceId,
    date: wib.date,
    scheduleStartTime: duty.schedule.startTime,
    scheduleEndTime: duty.schedule.endTime,
    issuedAtIso: now.toISOString(),
    expiresAtIso: expiresAt.toISOString()
  };

  const authorization: SignedOfflineAuthorization = {
    payload,
    signature: signPayload(payload)
  };

  // Register/update device in Firestore `devices/`
  await db
    .collection('devices')
    .doc(data.deviceId)
    .set(
      {
        deviceId: data.deviceId,
        deviceName: data.deviceName || 'Perangkat Scanner',
        userAgent: data.userAgent || '',
        lastTeacherUid: caller.uid,
        lastTeacherName: caller.displayName,
        lastAuthId: authId,
        offlineAuthExpiresAt: expiresAt.toISOString(),
        lastOnlineAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  // Build minimal safe student QR lookup cache (active students with active QR tokens only)
  const studentsSnap = await db.collection('students').where('active', '==', true).get();
  const cachedStudents = studentsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<StudentDoc, 'id'>) }))
    .filter((s) => Boolean(s.activeQrToken))
    .map((s) => ({
      studentId: s.id,
      qrToken: s.activeQrToken!,
      nis: s.nis,
      fullName: s.fullName,
      classId: s.classId,
      className: s.className,
      photoUrl: s.photoUrl || ''
    }));

  // Build backend-signed approved/active-exit permissions cache for today
  const permsSnap = await db
    .collection('permission_requests')
    .where('date', '==', wib.date)
    .get();

  const signedPermissions: SignedOfflinePermission[] = permsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequestDoc, 'id'>) }))
    .filter((p) => p.status === 'DISETUJUI' || p.status === 'SUDAH_KELUAR')
    .map((p) => {
      const permPayload: SignedOfflinePermission['payload'] = {
        permissionId: p.id,
        studentId: p.studentId,
        studentName: p.studentName,
        nis: p.nis,
        className: p.className,
        date: p.date,
        startTime: p.startTime,
        estimatedReturnTime: p.estimatedReturnTime,
        type: p.type,
        reason: p.reason,
        approvedByName: p.approvedByName || '',
        status: p.status
      };
      return {
        payload: permPayload,
        signature: signPayload(permPayload)
      };
    });

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: 'GURU_PIKET',
    action: 'OFFLINE_AUTH_ISSUED',
    deviceId: data.deviceId,
    transactionId: authId,
    description: `Menerbitkan otorisasi offline berlaku hingga ${getWibParts(expiresAt).timeWithSeconds} WIB (${cachedStudents.length} siswa, ${signedPermissions.length} izin)`,
    metadata: { scheduleId: duty.schedule.id, expiresAtIso: expiresAt.toISOString() }
  });

  return {
    success: true,
    authorization,
    attendanceSettings: settings,
    cachedStudents,
    signedPermissions,
    serverIsoWib: wib.isoWib
  };
}

/**
 * Synchronizes queued offline transactions from IndexedDB.
 * Re-validates authorization signature & expiry, duty schedule, QR token, duplicates (by UUID & attendance doc),
 * and flags suspicious device clock skew for Admin review.
 */
export async function handleSyncOfflineTransactions(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET', 'ADMIN']);
  const data = request.data as {
    authorization: SignedOfflineAuthorization;
    deviceId: string;
    transactions: OfflineTransactionInput[];
  };

  if (!data?.authorization || !data?.deviceId || !Array.isArray(data?.transactions)) {
    throw new HttpsError('invalid-argument', 'Payload sinkronisasi offline tidak lengkap.');
  }

  const serverNow = new Date();
  const wibNow = getWibParts(serverNow);

  // Verify signature and identity (Note: allow syncing slightly after auth expiry ONLY if tx timestamp was inside valid auth window,
  // while rejecting any tx recorded after auth expiry!)
  const sigValid = verifySignedPayload(data.authorization.payload, data.authorization.signature);
  if (!sigValid) {
    throw new HttpsError('permission-denied', 'Tanda tangan otorisasi offline tidak valid.');
  }
  if (
    caller.role === 'GURU_PIKET' &&
    data.authorization.payload.teacherUid !== caller.uid
  ) {
    throw new HttpsError('permission-denied', 'Otorisasi offline tidak cocok dengan akun Anda.');
  }
  if (data.authorization.payload.deviceId !== data.deviceId) {
    throw new HttpsError('permission-denied', 'Device ID tidak sesuai dengan otorisasi offline.');
  }

  const authIssuedMs = Date.parse(data.authorization.payload.issuedAtIso);
  const authExpiresMs = Date.parse(data.authorization.payload.expiresAtIso);
  const { settings } = await loadAttendanceSettingsAndHoliday(wibNow.date);
  const maxSkew = settings.maxClockSkewSeconds || 300;

  const results: Array<{
    transactionUuid: string;
    status: 'SYNCED' | 'DUPLICATE' | 'REJECTED';
    flaggedForReview: boolean;
    clockSkewSeconds: number;
    message: string;
  }> = [];

  for (const txItem of data.transactions) {
    const txUuid = String(txItem.transactionUuid || '').trim();
    if (!txUuid) {
      results.push({
        transactionUuid: '',
        status: 'REJECTED',
        flaggedForReview: false,
        clockSkewSeconds: 0,
        message: 'UUID transaksi tidak valid.'
      });
      continue;
    }

    // 1. Idempotency check via dedicated offline_tx_dedup collection
    const dedupRef = db.collection('offline_tx_dedup').doc(txUuid);
    const dedupSnap = await dedupRef.get();
    if (dedupSnap.exists) {
      results.push({
        transactionUuid: txUuid,
        status: 'DUPLICATE',
        flaggedForReview: false,
        clockSkewSeconds: 0,
        message: 'Transaksi sudah pernah disinkronkan sebelumnya (duplikat dicegah).'
      });
      continue;
    }

    // 2. Clock skew & auth window validation (NEVER trust device clock blindly)
    const skewCheck = isClockSkewSuspicious(txItem.deviceLocalTimeIso, serverNow, maxSkew);
    const txDeviceMs = Date.parse(txItem.deviceLocalTimeIso);
    const effectiveDate = Number.isNaN(txDeviceMs) || skewCheck.suspicious ? serverNow : new Date(txDeviceMs);

    // Reject if transaction claims to have been created outside valid offline auth window
    if (Number.isNaN(txDeviceMs) || txDeviceMs < authIssuedMs - maxSkew * 1000 || txDeviceMs > authExpiresMs) {
      results.push({
        transactionUuid: txUuid,
        status: 'REJECTED',
        flaggedForReview: true,
        clockSkewSeconds: skewCheck.skewSeconds,
        message: 'Transaksi ditolak karena otorisasi offline telah kedaluwarsa saat scan dilakukan.'
      });
      continue;
    }

    // 3. Re-verify duty schedule on backend for effectiveTime
    const txWib = getWibParts(effectiveDate);
    const schStartMin = parseTimeToMinutes(data.authorization.payload.scheduleStartTime);
    const schEndMin = parseTimeToMinutes(data.authorization.payload.scheduleEndTime);
    if (
      txWib.date !== data.authorization.payload.date ||
      txWib.minutesOfDay < schStartMin ||
      txWib.minutesOfDay > schEndMin
    ) {
      results.push({
        transactionUuid: txUuid,
        status: 'REJECTED',
        flaggedForReview: true,
        clockSkewSeconds: skewCheck.skewSeconds,
        message: 'Waktu transaksi berada di luar jadwal piket yang sah.'
      });
      continue;
    }

    // 4. Execute the specific transaction type
    let outcome: { success: boolean; code: string; message: string };
    if (txItem.type === 'SCAN_PAGI' || txItem.type === 'SCAN_SORE') {
      outcome = await executeAttendanceTransaction({
        session: txItem.type === 'SCAN_PAGI' ? 'PAGI' : 'SORE',
        qrToken: txItem.qrToken,
        teacherUid: data.authorization.payload.teacherUid,
        teacherName: data.authorization.payload.teacherName,
        scheduleId: data.authorization.payload.scheduleId,
        deviceId: data.deviceId,
        transactionUuid: txUuid,
        mode: 'OFFLINE_SYNC',
        effectiveTime: effectiveDate,
        deviceLocalTimeIso: txItem.deviceLocalTimeIso,
        flaggedForReview: skewCheck.suspicious,
        clockSkewSeconds: skewCheck.skewSeconds
      });
    } else if (txItem.type === 'SCAN_KELUAR') {
      outcome = await executeExitScanTransaction({
        qrToken: txItem.qrToken,
        teacherUid: data.authorization.payload.teacherUid,
        teacherName: data.authorization.payload.teacherName,
        scheduleId: data.authorization.payload.scheduleId,
        deviceId: data.deviceId,
        exitPost: txItem.exitPost,
        permissionId: txItem.permissionId,
        transactionUuid: txUuid,
        mode: 'OFFLINE_SYNC',
        effectiveTime: effectiveDate,
        flaggedForReview: skewCheck.suspicious
      });
    } else if (txItem.type === 'SCAN_KEMBALI') {
      outcome = await executeReturnScanTransaction({
        qrToken: txItem.qrToken,
        teacherUid: data.authorization.payload.teacherUid,
        teacherName: data.authorization.payload.teacherName,
        scheduleId: data.authorization.payload.scheduleId,
        deviceId: data.deviceId,
        permissionId: txItem.permissionId,
        transactionUuid: txUuid,
        mode: 'OFFLINE_SYNC',
        effectiveTime: effectiveDate,
        flaggedForReview: skewCheck.suspicious
      });
    } else {
      outcome = { success: false, code: 'INVALID_TYPE', message: 'Tipe transaksi offline tidak dikenali.' };
    }

    if (outcome.success) {
      await dedupRef.set({
        transactionUuid: txUuid,
        type: txItem.type,
        deviceId: data.deviceId,
        teacherUid: data.authorization.payload.teacherUid,
        flaggedForReview: skewCheck.suspicious,
        clockSkewSeconds: skewCheck.skewSeconds,
        syncedAt: FieldValue.serverTimestamp()
      });
      results.push({
        transactionUuid: txUuid,
        status: 'SYNCED',
        flaggedForReview: skewCheck.suspicious,
        clockSkewSeconds: skewCheck.skewSeconds,
        message: skewCheck.suspicious
          ? `${outcome.message} (Ditandai untuk pemeriksaan Admin karena selisih jam perangkat ${skewCheck.skewSeconds} detik).`
          : outcome.message
      });
    } else if (outcome.code === 'ALREADY_SCANNED') {
      await dedupRef.set({
        transactionUuid: txUuid,
        type: txItem.type,
        deviceId: data.deviceId,
        status: 'DUPLICATE',
        syncedAt: FieldValue.serverTimestamp()
      });
      results.push({
        transactionUuid: txUuid,
        status: 'DUPLICATE',
        flaggedForReview: skewCheck.suspicious,
        clockSkewSeconds: skewCheck.skewSeconds,
        message: outcome.message
      });
    } else {
      results.push({
        transactionUuid: txUuid,
        status: 'REJECTED',
        flaggedForReview: skewCheck.suspicious,
        clockSkewSeconds: skewCheck.skewSeconds,
        message: outcome.message
      });
    }
  }

  const syncedCount = results.filter((r) => r.status === 'SYNCED').length;
  const duplicateCount = results.filter((r) => r.status === 'DUPLICATE').length;
  const rejectedCount = results.filter((r) => r.status === 'REJECTED').length;
  const flaggedCount = results.filter((r) => r.flaggedForReview).length;

  await db
    .collection('devices')
    .doc(data.deviceId)
    .set(
      {
        lastSyncAt: FieldValue.serverTimestamp(),
        lastSyncSummary: {
          total: results.length,
          syncedCount,
          duplicateCount,
          rejectedCount,
          flaggedCount
        },
        hasSuspiciousClock: flaggedCount > 0,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: 'OFFLINE_SYNC',
    deviceId: data.deviceId,
    description: `Sinkronisasi offline: ${syncedCount} berhasil, ${duplicateCount} duplikat, ${rejectedCount} ditolak, ${flaggedCount} ditandai review`,
    metadata: { syncedCount, duplicateCount, rejectedCount, flaggedCount }
  });

  return {
    success: true,
    serverIsoWib: wibNow.isoWib,
    summary: { total: results.length, syncedCount, duplicateCount, rejectedCount, flaggedCount },
    results
  };
}
