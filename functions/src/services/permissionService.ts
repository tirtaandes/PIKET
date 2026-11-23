import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db, FieldValue, Timestamp } from '../config';
import { PermissionRequestDoc, PermissionStatus, PermissionType, StudentDoc } from '../types';
import { validateActiveDutyForCaller, verifyCaller } from '../utils/authGuard';
import { getWibParts, parseTimeToMinutes } from '../utils/time';
import { writeAuditLog } from '../utils/audit';

const VALID_PERMISSION_TYPES: PermissionType[] = [
  'KEPERLUAN_KELUARGA',
  'SAKIT',
  'KEPERLUAN_PRIBADI',
  'KEPERLUAN_SEKOLAH',
  'LAINNYA'
];

/**
 * Pure validator checking whether a permission can be used for an EXIT scan.
 */
export function validatePermissionForExit(
  perm: PermissionRequestDoc | null,
  now: Date = new Date()
): { valid: boolean; reason?: string; expired?: boolean } {
  if (!perm) {
    return { valid: false, reason: 'Siswa tidak memiliki izin keluar yang disetujui hari ini.' };
  }
  const wib = getWibParts(now);

  if (perm.status === 'SUDAH_KELUAR') {
    return { valid: false, reason: 'Siswa sudah tercatat keluar sekolah. Tidak dapat scan keluar dua kali.' };
  }
  if (perm.status === 'SUDAH_KEMBALI') {
    return { valid: false, reason: 'Izin ini sudah selesai digunakan (siswa sudah kembali).' };
  }
  if (perm.status === 'DITOLAK') {
    return { valid: false, reason: 'Permohonan izin ini telah ditolak oleh wali kelas.' };
  }
  if (perm.status === 'MENUNGGU') {
    return { valid: false, reason: 'Izin belum disetujui oleh wali kelas.' };
  }
  if (perm.status === 'KEDALUWARSA' || perm.date < wib.date) {
    return { valid: false, reason: 'Izin sudah kedaluwarsa.', expired: true };
  }
  if (perm.date > wib.date) {
    return { valid: false, reason: `Izin ini berlaku untuk tanggal ${perm.date}, bukan hari ini.` };
  }

  // Check if estimatedReturnTime has passed (permission expired)
  try {
    const returnMin = parseTimeToMinutes(perm.estimatedReturnTime);
    if (wib.minutesOfDay > returnMin) {
      return { valid: false, reason: 'Waktu berlaku izin sudah kedaluwarsa.', expired: true };
    }
  } catch {
    // ignore malformed time fallback
  }

  if (perm.status !== 'DISETUJUI') {
    return { valid: false, reason: 'Status izin tidak valid untuk keluar sekolah.' };
  }

  return { valid: true };
}

/**
 * Pure validator checking whether a permission can be used for a RETURN scan.
 */
export function validatePermissionForReturn(
  perm: PermissionRequestDoc | null,
  expectedStudentId: string
): { valid: boolean; reason?: string } {
  if (!perm) {
    return { valid: false, reason: 'Siswa tidak tercatat sedang berada di luar sekolah.' };
  }
  if (perm.studentId !== expectedStudentId) {
    return { valid: false, reason: 'Izin tidak sesuai dengan identitas siswa yang dipindai.' };
  }
  if (perm.status !== 'SUDAH_KELUAR') {
    return {
      valid: false,
      reason:
        perm.status === 'SUDAH_KEMBALI'
          ? 'Siswa sudah tercatat kembali sebelumnya.'
          : 'Siswa belum melakukan scan keluar sehingga tidak dapat scan kembali.'
    };
  }
  return { valid: true };
}

export async function handleCreatePermissionRequest(request: CallableRequest) {
  const caller = await verifyCaller(request, ['WALI_KELAS', 'ADMIN']);
  const data = request.data as {
    studentId: string;
    date: string;
    startTime: string;
    estimatedReturnTime: string;
    type: PermissionType;
    reason: string;
    notes?: string;
    autoApprove?: boolean;
  };

  if (
    !data?.studentId ||
    !data?.date ||
    !data?.startTime ||
    !data?.estimatedReturnTime ||
    !data?.type ||
    !data?.reason
  ) {
    throw new HttpsError('invalid-argument', 'Semua field wajib permohonan izin harus diisi.');
  }

  if (!VALID_PERMISSION_TYPES.includes(data.type)) {
    throw new HttpsError('invalid-argument', 'Jenis izin tidak valid.');
  }

  const studentSnap = await db.collection('students').doc(data.studentId).get();
  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Siswa tidak ditemukan.');
  }
  const student = { id: studentSnap.id, ...(studentSnap.data() as Omit<StudentDoc, 'id'>) };
  if (!student.active) {
    throw new HttpsError('failed-precondition', 'Siswa tidak aktif.');
  }

  // Strict class scoping for WALI_KELAS
  if (caller.role === 'WALI_KELAS' && student.classId !== caller.assignedClassId) {
    throw new HttpsError(
      'permission-denied',
      'Wali kelas hanya dapat mengajukan izin untuk siswa di kelas yang diampu.'
    );
  }

  const permRef = db.collection('permission_requests').doc();
  const status: PermissionStatus = data.autoApprove ? 'DISETUJUI' : 'MENUNGGU';

  const docData: Record<string, unknown> = {
    id: permRef.id,
    studentId: student.id,
    studentName: student.fullName,
    nis: student.nis,
    classId: student.classId,
    className: student.className,
    date: data.date,
    startTime: data.startTime,
    estimatedReturnTime: data.estimatedReturnTime,
    type: data.type,
    reason: data.reason.trim(),
    notes: (data.notes || '').trim(),
    status,
    requestedBy: caller.uid,
    requestedByName: caller.displayName,
    approvedBy: data.autoApprove ? caller.uid : null,
    approvedByName: data.autoApprove ? caller.displayName : null,
    approvedAt: data.autoApprove ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  await permRef.set(docData);

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: data.autoApprove ? 'PERMISSION_APPROVE' : 'PERMISSION_CREATE',
    transactionId: permRef.id,
    description: `${data.autoApprove ? 'Membuat & menyetujui' : 'Mengajukan'} izin ${data.type} untuk ${student.fullName} (${student.className})`,
    metadata: { studentId: student.id, classId: student.classId, date: data.date, status }
  });

  return { success: true, permissionId: permRef.id, status };
}

export async function handleDecidePermissionRequest(request: CallableRequest) {
  const caller = await verifyCaller(request, ['WALI_KELAS', 'ADMIN']);
  const data = request.data as {
    permissionId: string;
    decision: 'APPROVE' | 'REJECT';
    rejectedReason?: string;
  };

  if (!data?.permissionId || (data.decision !== 'APPROVE' && data.decision !== 'REJECT')) {
    throw new HttpsError('invalid-argument', 'permissionId dan keputusan (APPROVE/REJECT) wajib diisi.');
  }

  const permRef = db.collection('permission_requests').doc(data.permissionId);
  const permSnap = await permRef.get();
  if (!permSnap.exists) {
    throw new HttpsError('not-found', 'Data izin tidak ditemukan.');
  }
  const perm = permSnap.data() as PermissionRequestDoc;

  // Strict class scoping for WALI_KELAS
  if (caller.role === 'WALI_KELAS' && perm.classId !== caller.assignedClassId) {
    throw new HttpsError(
      'permission-denied',
      'Wali kelas hanya dapat menyetujui atau menolak izin siswa di kelasnya sendiri.'
    );
  }

  if (perm.status !== 'MENUNGGU') {
    throw new HttpsError('failed-precondition', `Izin tidak dapat diproses karena berstatus ${perm.status}.`);
  }

  const newStatus: PermissionStatus = data.decision === 'APPROVE' ? 'DISETUJUI' : 'DITOLAK';

  await permRef.update({
    status: newStatus,
    approvedBy: caller.uid,
    approvedByName: caller.displayName,
    approvedAt: FieldValue.serverTimestamp(),
    rejectedReason: data.decision === 'REJECT' ? (data.rejectedReason || '').trim() : null,
    updatedAt: FieldValue.serverTimestamp()
  });

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: data.decision === 'APPROVE' ? 'PERMISSION_APPROVE' : 'PERMISSION_REJECT',
    transactionId: permRef.id,
    description: `${data.decision === 'APPROVE' ? 'Menyetujui' : 'Menolak'} izin ${perm.studentName} (${perm.className})`,
    metadata: { permissionId: permRef.id, studentId: perm.studentId, classId: perm.classId }
  });

  return { success: true, permissionId: permRef.id, status: newStatus };
}

export async function executeExitScanTransaction(params: {
  qrToken: string;
  teacherUid: string;
  teacherName: string;
  scheduleId: string;
  deviceId: string;
  exitPost?: string;
  permissionId?: string;
  transactionUuid?: string;
  mode: 'ONLINE' | 'OFFLINE_SYNC';
  effectiveTime: Date;
  flaggedForReview?: boolean;
}) {
  const wib = getWibParts(params.effectiveTime);

  const tokenSnap = await db.collection('qr_tokens').doc(params.qrToken.trim()).get();
  if (!tokenSnap.exists || !tokenSnap.data()?.active) {
    return { success: false, code: 'QR_INVALID', message: 'QR Code tidak valid atau sudah dinonaktifkan.' };
  }

  const studentId = String(tokenSnap.data()!.studentId);
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists || !studentSnap.data()?.active) {
    return { success: false, code: 'STUDENT_INACTIVE', message: 'Siswa tidak ditemukan atau tidak aktif.' };
  }
  const student = { id: studentSnap.id, ...(studentSnap.data() as Omit<StudentDoc, 'id'>) };

  // Find candidate permissions for student today
  let targetPermRef: FirebaseFirestore.DocumentReference | null = null;
  if (params.permissionId) {
    targetPermRef = db.collection('permission_requests').doc(params.permissionId);
  } else {
    const permsSnap = await db
      .collection('permission_requests')
      .where('studentId', '==', studentId)
      .where('date', '==', wib.date)
      .get();

    const docs = permsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequestDoc, 'id'>) }));
    const alreadyOut = docs.find((d) => d.status === 'SUDAH_KELUAR');
    if (alreadyOut) {
      return {
        success: false,
        code: 'ALREADY_OUTSIDE',
        message: `${student.fullName} sudah tercatat berada di luar sekolah. Tidak dapat keluar dua kali.`
      };
    }

    const approved = docs.find((d) => d.status === 'DISETUJUI');
    if (approved) {
      targetPermRef = db.collection('permission_requests').doc(approved.id);
    } else if (docs.length > 0) {
      const check = validatePermissionForExit(docs[0], params.effectiveTime);
      return { success: false, code: 'PERMISSION_INVALID', message: check.reason || 'Izin tidak valid.' };
    }
  }

  if (!targetPermRef) {
    return {
      success: false,
      code: 'NO_PERMISSION',
      message: `${student.fullName} tidak memiliki izin keluar yang disetujui hari ini.`
    };
  }

  let outcome: { success: boolean; code: string; message: string; permissionId?: string } = {
    success: false,
    code: 'PERMISSION_INVALID',
    message: 'Gagal memproses izin keluar.'
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(targetPermRef!);
    if (!snap.exists) {
      outcome = { success: false, code: 'NO_PERMISSION', message: 'Data izin tidak ditemukan.' };
      return;
    }

    const perm = { id: snap.id, ...(snap.data() as Omit<PermissionRequestDoc, 'id'>) };
    if (perm.studentId !== studentId) {
      outcome = { success: false, code: 'PERMISSION_MISMATCH', message: 'Izin bukan milik siswa ini.' };
      return;
    }

    const check = validatePermissionForExit(perm, params.effectiveTime);
    if (!check.valid) {
      if (check.expired && perm.status === 'DISETUJUI') {
        tx.update(targetPermRef!, { status: 'KEDALUWARSA', updatedAt: FieldValue.serverTimestamp() });
      }
      outcome = {
        success: false,
        code: check.expired ? 'PERMISSION_EXPIRED' : 'PERMISSION_INVALID',
        message: check.reason || 'Izin tidak sah.'
      };
      return;
    }

    const exitTs =
      params.mode === 'ONLINE' ? FieldValue.serverTimestamp() : Timestamp.fromDate(params.effectiveTime);

    tx.update(targetPermRef!, {
      status: 'SUDAH_KELUAR',
      exitTime: exitTs,
      exitTimeWib: wib.timeWithSeconds,
      exitTeacherId: params.teacherUid,
      exitTeacherName: params.teacherName,
      exitPost: params.exitPost || 'POS GERBANG UTAMA',
      exitDeviceId: params.deviceId,
      offlinePendingVerification: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    const exitLogRef = db.collection('exit_logs').doc(perm.id);
    tx.set(exitLogRef, {
      id: perm.id,
      permissionId: perm.id,
      studentId: student.id,
      studentName: student.fullName,
      nis: student.nis,
      classId: student.classId,
      className: student.className,
      date: wib.date,
      permissionType: perm.type,
      reason: perm.reason,
      estimatedReturnTime: perm.estimatedReturnTime,
      approvedBy: perm.approvedBy || '',
      approvedByName: perm.approvedByName || '',
      status: 'SUDAH_KELUAR',
      exitTime: exitTs,
      exitTimeWib: wib.timeWithSeconds,
      exitTeacherUid: params.teacherUid,
      exitTeacherName: params.teacherName,
      exitScheduleId: params.scheduleId,
      exitPost: params.exitPost || 'POS GERBANG UTAMA',
      exitDeviceId: params.deviceId,
      returnTime: null,
      returnTimeWib: null,
      returnTeacherUid: null,
      returnTeacherName: null,
      sourceMode: params.mode,
      flaggedForReview: Boolean(params.flaggedForReview),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    outcome = {
      success: true,
      code: 'SUCCESS',
      message: `${student.fullName} tercatat KELUAR sekolah.`,
      permissionId: perm.id
    };
  });

  if (outcome.success) {
    await writeAuditLog({
      userId: params.teacherUid,
      userName: params.teacherName,
      role: 'GURU_PIKET',
      action: 'SCAN_KELUAR',
      deviceId: params.deviceId,
      transactionId: params.transactionUuid || outcome.permissionId,
      description: `Scan keluar ${student.fullName} (${student.nis}) melalui ${params.exitPost || 'POS GERBANG UTAMA'}`,
      metadata: { studentId: student.id, permissionId: outcome.permissionId, mode: params.mode }
    });
  }

  return {
    ...outcome,
    scannedAtIso: wib.isoWib,
    status: outcome.success ? 'SUDAH_KELUAR' : undefined,
    student: {
      id: student.id,
      fullName: student.fullName,
      nis: student.nis,
      classId: student.classId,
      className: student.className,
      photoUrl: student.photoUrl
    }
  };
}

export async function executeReturnScanTransaction(params: {
  qrToken: string;
  teacherUid: string;
  teacherName: string;
  scheduleId: string;
  deviceId: string;
  permissionId?: string;
  transactionUuid?: string;
  mode: 'ONLINE' | 'OFFLINE_SYNC';
  effectiveTime: Date;
  flaggedForReview?: boolean;
}) {
  const wib = getWibParts(params.effectiveTime);

  const tokenSnap = await db.collection('qr_tokens').doc(params.qrToken.trim()).get();
  if (!tokenSnap.exists || !tokenSnap.data()?.active) {
    return { success: false, code: 'QR_INVALID', message: 'QR Code tidak valid atau sudah dinonaktifkan.' };
  }

  const studentId = String(tokenSnap.data()!.studentId);
  const studentSnap = await db.collection('students').doc(studentId).get();
  if (!studentSnap.exists || !studentSnap.data()?.active) {
    return { success: false, code: 'STUDENT_INACTIVE', message: 'Siswa tidak ditemukan atau tidak aktif.' };
  }
  const student = { id: studentSnap.id, ...(studentSnap.data() as Omit<StudentDoc, 'id'>) };

  let targetPermRef: FirebaseFirestore.DocumentReference | null = null;
  if (params.permissionId) {
    targetPermRef = db.collection('permission_requests').doc(params.permissionId);
  } else {
    const activeOutsideSnap = await db
      .collection('permission_requests')
      .where('studentId', '==', studentId)
      .where('status', '==', 'SUDAH_KELUAR')
      .limit(1)
      .get();
    if (!activeOutsideSnap.empty) {
      targetPermRef = activeOutsideSnap.docs[0].ref;
    }
  }

  if (!targetPermRef) {
    return {
      success: false,
      code: 'NOT_OUTSIDE',
      message: `${student.fullName} tidak tercatat sedang berada di luar sekolah.`
    };
  }

  let outcome: { success: boolean; code: string; message: string; permissionId?: string } = {
    success: false,
    code: 'NOT_OUTSIDE',
    message: 'Gagal mencatat siswa kembali.'
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(targetPermRef!);
    if (!snap.exists) {
      outcome = { success: false, code: 'NOT_OUTSIDE', message: 'Data izin tidak ditemukan.' };
      return;
    }

    const perm = { id: snap.id, ...(snap.data() as Omit<PermissionRequestDoc, 'id'>) };
    const check = validatePermissionForReturn(perm, studentId);
    if (!check.valid) {
      outcome = { success: false, code: 'RETURN_INVALID', message: check.reason || 'Scan kembali ditolak.' };
      return;
    }

    const returnTs =
      params.mode === 'ONLINE' ? FieldValue.serverTimestamp() : Timestamp.fromDate(params.effectiveTime);

    tx.update(targetPermRef!, {
      status: 'SUDAH_KEMBALI',
      returnTime: returnTs,
      returnTimeWib: wib.timeWithSeconds,
      returnTeacherId: params.teacherUid,
      returnTeacherName: params.teacherName,
      returnDeviceId: params.deviceId,
      offlinePendingVerification: false,
      updatedAt: FieldValue.serverTimestamp()
    });

    const exitLogRef = db.collection('exit_logs').doc(perm.id);
    tx.set(
      exitLogRef,
      {
        status: 'SUDAH_KEMBALI',
        returnTime: returnTs,
        returnTimeWib: wib.timeWithSeconds,
        returnTeacherUid: params.teacherUid,
        returnTeacherName: params.teacherName,
        returnScheduleId: params.scheduleId,
        returnDeviceId: params.deviceId,
        flaggedForReview: Boolean(params.flaggedForReview),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    outcome = {
      success: true,
      code: 'SUCCESS',
      message: `${student.fullName} tercatat KEMBALI ke sekolah.`,
      permissionId: perm.id
    };
  });

  if (outcome.success) {
    await writeAuditLog({
      userId: params.teacherUid,
      userName: params.teacherName,
      role: 'GURU_PIKET',
      action: 'SCAN_KEMBALI',
      deviceId: params.deviceId,
      transactionId: params.transactionUuid || outcome.permissionId,
      description: `Scan kembali ${student.fullName} (${student.nis}) ke sekolah`,
      metadata: { studentId: student.id, permissionId: outcome.permissionId, mode: params.mode }
    });
  }

  return {
    ...outcome,
    scannedAtIso: wib.isoWib,
    status: outcome.success ? 'SUDAH_KEMBALI' : undefined,
    student: {
      id: student.id,
      fullName: student.fullName,
      nis: student.nis,
      classId: student.classId,
      className: student.className,
      photoUrl: student.photoUrl
    }
  };
}

export async function handleProcessExitScan(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET']);
  const data = request.data as {
    qrToken: string;
    deviceId?: string;
    exitPost?: string;
    permissionId?: string;
    transactionUuid?: string;
  };

  if (!data?.qrToken) {
    throw new HttpsError('invalid-argument', 'Token QR wajib diisi.');
  }

  const now = new Date();
  const duty = await validateActiveDutyForCaller(caller, now);
  if (!duty.valid || !duty.schedule) {
    return { success: false, code: 'DUTY_INVALID', message: duty.message };
  }

  return executeExitScanTransaction({
    qrToken: data.qrToken,
    teacherUid: caller.uid,
    teacherName: caller.displayName,
    scheduleId: duty.schedule.id,
    deviceId: data.deviceId || 'WEB',
    exitPost: data.exitPost,
    permissionId: data.permissionId,
    transactionUuid: data.transactionUuid,
    mode: 'ONLINE',
    effectiveTime: now
  });
}

export async function handleProcessReturnScan(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET']);
  const data = request.data as {
    qrToken: string;
    deviceId?: string;
    permissionId?: string;
    transactionUuid?: string;
  };

  if (!data?.qrToken) {
    throw new HttpsError('invalid-argument', 'Token QR wajib diisi.');
  }

  const now = new Date();
  const duty = await validateActiveDutyForCaller(caller, now);
  if (!duty.valid || !duty.schedule) {
    return { success: false, code: 'DUTY_INVALID', message: duty.message };
  }

  return executeReturnScanTransaction({
    qrToken: data.qrToken,
    teacherUid: caller.uid,
    teacherName: caller.displayName,
    scheduleId: duty.schedule.id,
    deviceId: data.deviceId || 'WEB',
    permissionId: data.permissionId,
    transactionUuid: data.transactionUuid,
    mode: 'ONLINE',
    effectiveTime: now
  });
}
