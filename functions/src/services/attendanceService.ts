import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db, DEFAULT_ATTENDANCE_SETTINGS, FieldValue, Timestamp } from '../config';
import {
  AttendanceSessionType,
  AttendanceSettingsDoc,
  HolidayDoc,
  MorningStatus,
  StudentDoc
} from '../types';
import { validateActiveDutyForCaller, verifyCaller } from '../utils/authGuard';
import { getWibParts, parseTimeToMinutes } from '../utils/time';
import { writeAuditLog } from '../utils/audit';

export interface SessionEvaluationResult {
  allowed: boolean;
  reason?: string;
  morningStatus?: MorningStatus;
  lateMinutes?: number;
}

/**
 * Pure session rules evaluator (morning/afternoon windows, holidays, special days, exemptions, late tolerance).
 */
export function evaluateAttendanceSessionWindow(params: {
  session: AttendanceSessionType;
  settings: AttendanceSettingsDoc;
  holiday?: HolidayDoc | null;
  studentClassId: string;
  studentId: string;
  now?: Date;
}): SessionEvaluationResult {
  const wib = getWibParts(params.now ?? new Date());
  const { settings, holiday } = params;

  if (holiday?.disableAttendance) {
    return {
      allowed: false,
      reason: `Sesi absensi tidak aktif karena ${holiday.name} (${holiday.type}).`
    };
  }

  if (
    settings.exemptedClassIds?.includes(params.studentClassId) ||
    settings.exemptedStudentIds?.includes(params.studentId) ||
    holiday?.exemptedClassIds?.includes(params.studentClassId)
  ) {
    return {
      allowed: false,
      reason: 'Siswa/kelas ini termasuk dalam daftar pengecualian absensi.'
    };
  }

  if (params.session === 'PAGI') {
    if (!settings.morning.enabled) {
      return { allowed: false, reason: 'Sesi absensi pagi sedang dinonaktifkan oleh Admin.' };
    }
    if (!holiday && !settings.morning.activeDays.includes(wib.dayOfWeek)) {
      return { allowed: false, reason: 'Hari ini bukan hari aktif absensi pagi.' };
    }

    const startMin = parseTimeToMinutes(holiday?.customMorningStart || settings.morning.startTime);
    const deadlineMin = parseTimeToMinutes(holiday?.customMorningDeadline || settings.morning.onTimeDeadline);
    const endMin = parseTimeToMinutes(holiday?.customMorningEnd || settings.morning.endTime);
    const tolerance = Math.max(0, settings.lateToleranceMinutes || 0);

    if (wib.minutesOfDay < startMin) {
      return {
        allowed: false,
        reason: `Sesi absensi pagi belum dimulai (mulai ${holiday?.customMorningStart || settings.morning.startTime} WIB).`
      };
    }
    if (wib.minutesOfDay > endMin) {
      return {
        allowed: false,
        reason: `Sesi absensi pagi telah berakhir (batas ${holiday?.customMorningEnd || settings.morning.endTime} WIB).`
      };
    }

    const effectiveDeadline = deadlineMin + tolerance;
    if (wib.minutesOfDay <= effectiveDeadline) {
      return { allowed: true, morningStatus: 'HADIR', lateMinutes: 0 };
    }
    return {
      allowed: true,
      morningStatus: 'TERLAMBAT',
      lateMinutes: wib.minutesOfDay - deadlineMin
    };
  }

  // SORE
  if (!settings.afternoon.enabled) {
    return { allowed: false, reason: 'Sesi absensi sore sedang dinonaktifkan oleh Admin.' };
  }
  if (!holiday && !settings.afternoon.activeDays.includes(wib.dayOfWeek)) {
    return { allowed: false, reason: 'Hari ini bukan hari aktif absensi sore.' };
  }

  const startMin = parseTimeToMinutes(holiday?.customAfternoonStart || settings.afternoon.startTime);
  const endMin = parseTimeToMinutes(holiday?.customAfternoonEnd || settings.afternoon.endTime);

  if (wib.minutesOfDay < startMin) {
    return {
      allowed: false,
      reason: `Sesi absensi sore belum dimulai (mulai ${holiday?.customAfternoonStart || settings.afternoon.startTime} WIB).`
    };
  }
  if (wib.minutesOfDay > endMin) {
    return {
      allowed: false,
      reason: `Sesi absensi sore telah berakhir (batas ${holiday?.customAfternoonEnd || settings.afternoon.endTime} WIB).`
    };
  }

  return { allowed: true };
}

export async function loadAttendanceSettingsAndHoliday(dateStr: string): Promise<{
  settings: AttendanceSettingsDoc;
  holiday: HolidayDoc | null;
}> {
  const [settingsSnap, holidaySnap] = await Promise.all([
    db.collection('system_settings').doc('attendance').get(),
    db.collection('holidays').where('date', '==', dateStr).limit(1).get()
  ]);

  const settings: AttendanceSettingsDoc = settingsSnap.exists
    ? {
        ...DEFAULT_ATTENDANCE_SETTINGS,
        ...(settingsSnap.data() as Partial<AttendanceSettingsDoc>),
        morning: {
          ...DEFAULT_ATTENDANCE_SETTINGS.morning,
          ...((settingsSnap.data()?.morning as Partial<AttendanceSettingsDoc['morning']>) || {})
        },
        afternoon: {
          ...DEFAULT_ATTENDANCE_SETTINGS.afternoon,
          ...((settingsSnap.data()?.afternoon as Partial<AttendanceSettingsDoc['afternoon']>) || {})
        }
      }
    : DEFAULT_ATTENDANCE_SETTINGS;

  const holiday = holidaySnap.empty
    ? null
    : ({ id: holidaySnap.docs[0].id, ...holidaySnap.docs[0].data() } as HolidayDoc);

  return { settings, holiday };
}

export async function handleGetDutyStatus(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET', 'ADMIN']);
  const now = new Date();
  const wib = getWibParts(now);

  if (caller.role === 'ADMIN') {
    return {
      valid: false,
      code: 'INVALID_ROLE',
      message: 'Admin tidak menggunakan scanner piket.',
      serverDate: wib.date,
      serverTime: wib.timeWithSeconds,
      serverIsoWib: wib.isoWib
    };
  }

  const dutyResult = await validateActiveDutyForCaller(caller, now);
  return {
    ...dutyResult,
    serverIsoWib: wib.isoWib,
    teacherName: caller.displayName,
    teacherUid: caller.uid,
    teacherId: caller.teacherId || caller.uid
  };
}

export interface CoreAttendanceRecordResult {
  success: boolean;
  code:
    | 'SUCCESS'
    | 'ALREADY_SCANNED'
    | 'QR_INVALID'
    | 'QR_INACTIVE'
    | 'STUDENT_INACTIVE'
    | 'SESSION_INACTIVE'
    | 'DUTY_INVALID';
  message: string;
  warning?: string;
  attendanceId?: string;
  status?: string;
  scannedAtIso?: string;
  student?: {
    id: string;
    fullName: string;
    nis: string;
    classId: string;
    className: string;
    photoUrl?: string;
  };
}

export async function executeAttendanceTransaction(params: {
  session: AttendanceSessionType;
  qrToken: string;
  teacherUid: string;
  teacherName: string;
  scheduleId: string;
  deviceId: string;
  transactionUuid?: string;
  mode: 'ONLINE' | 'OFFLINE_SYNC';
  effectiveTime: Date;
  deviceLocalTimeIso?: string;
  flaggedForReview?: boolean;
  clockSkewSeconds?: number;
}): Promise<CoreAttendanceRecordResult> {
  const wib = getWibParts(params.effectiveTime);

  // 1. Validate QR Token
  const tokenSnap = await db.collection('qr_tokens').doc(params.qrToken.trim()).get();
  if (!tokenSnap.exists) {
    return { success: false, code: 'QR_INVALID', message: 'QR Code tidak dikenal.' };
  }
  const tokenData = tokenSnap.data()!;
  if (!tokenData.active || tokenData.status !== 'ACTIVE') {
    return {
      success: false,
      code: 'QR_INACTIVE',
      message: 'QR Code sudah tidak aktif atau telah dinonaktifkan.'
    };
  }

  // 2. Validate Student
  const studentSnap = await db.collection('students').doc(String(tokenData.studentId)).get();
  if (!studentSnap.exists) {
    return { success: false, code: 'QR_INVALID', message: 'Data siswa terkait QR tidak ditemukan.' };
  }
  const student = { id: studentSnap.id, ...(studentSnap.data() as Omit<StudentDoc, 'id'>) };
  if (!student.active) {
    return { success: false, code: 'STUDENT_INACTIVE', message: 'Status siswa tidak aktif.' };
  }
  if (student.activeQrToken && student.activeQrToken !== params.qrToken.trim()) {
    return { success: false, code: 'QR_INACTIVE', message: 'QR Code lama sudah digantikan.' };
  }

  // 3. Validate Session Window & Holidays
  const { settings, holiday } = await loadAttendanceSettingsAndHoliday(wib.date);
  const sessionCheck = evaluateAttendanceSessionWindow({
    session: params.session,
    settings,
    holiday,
    studentClassId: student.classId,
    studentId: student.id,
    now: params.effectiveTime
  });
  if (!sessionCheck.allowed) {
    return {
      success: false,
      code: 'SESSION_INACTIVE',
      message: sessionCheck.reason || 'Sesi absensi tidak aktif.'
    };
  }

  // 4. Atomic Firestore Transaction for Idempotency (doc ID = YYYY-MM-DD_studentId)
  const attendanceId = `${wib.date}_${student.id}`;
  const attendanceRef = db.collection('attendance').doc(attendanceId);

  let warning: string | undefined;
  let finalStatus = '';
  let alreadyScanned = false;

  await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(attendanceRef);
    const existing = existingSnap.exists ? existingSnap.data()! : null;

    if (params.session === 'PAGI') {
      if (existing && existing.morningTime) {
        alreadyScanned = true;
        finalStatus = String(existing.morningStatus || 'HADIR');
        return;
      }

      const morningStatus = sessionCheck.morningStatus || 'HADIR';
      finalStatus = morningStatus;

      const payload: Record<string, unknown> = {
        id: attendanceId,
        date: wib.date,
        studentId: student.id,
        nis: student.nis,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        majorId: student.majorId || '',
        majorName: student.majorName || '',
        academicYearId: student.academicYearId || '',
        academicYearName: student.academicYearName || '',
        morningStatus,
        morningTime: params.mode === 'ONLINE' ? FieldValue.serverTimestamp() : Timestamp.fromDate(params.effectiveTime),
        morningTimeWib: wib.timeWithSeconds,
        morningLateMinutes: sessionCheck.lateMinutes || 0,
        morningTeacherUid: params.teacherUid,
        morningTeacherName: params.teacherName,
        morningScheduleId: params.scheduleId,
        morningDeviceId: params.deviceId,
        morningTransactionUuid: params.transactionUuid || attendanceId,
        afternoonStatus: existing?.afternoonStatus || 'BELUM_ABSEN',
        syncStatus: 'SUCCESS',
        sourceMode: params.mode,
        flaggedForReview: Boolean(params.flaggedForReview || existing?.flaggedForReview),
        clockSkewSeconds: params.clockSkewSeconds ?? existing?.clockSkewSeconds ?? 0,
        deviceLocalTimeIso: params.deviceLocalTimeIso || null,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existing) {
        payload.createdAt = FieldValue.serverTimestamp();
      }
      tx.set(attendanceRef, payload, { merge: true });
    } else {
      // SORE
      if (existing && existing.afternoonTime) {
        alreadyScanned = true;
        finalStatus = 'PULANG';
        return;
      }

      if (!existing || !existing.morningTime) {
        warning = 'PERINGATAN: Siswa ini belum tercatat melakukan absensi pagi hari ini.';
      }

      finalStatus = 'PULANG';

      const payload: Record<string, unknown> = {
        id: attendanceId,
        date: wib.date,
        studentId: student.id,
        nis: student.nis,
        studentName: student.fullName,
        classId: student.classId,
        className: student.className,
        majorId: student.majorId || '',
        majorName: student.majorName || '',
        academicYearId: student.academicYearId || '',
        academicYearName: student.academicYearName || '',
        morningStatus: existing?.morningStatus || 'BELUM_ABSEN',
        afternoonStatus: 'PULANG',
        afternoonTime: params.mode === 'ONLINE' ? FieldValue.serverTimestamp() : Timestamp.fromDate(params.effectiveTime),
        afternoonTimeWib: wib.timeWithSeconds,
        afternoonTeacherUid: params.teacherUid,
        afternoonTeacherName: params.teacherName,
        afternoonScheduleId: params.scheduleId,
        afternoonDeviceId: params.deviceId,
        afternoonTransactionUuid: params.transactionUuid || `${attendanceId}_SORE`,
        missingMorningWarning: !existing || !existing.morningTime,
        syncStatus: 'SUCCESS',
        sourceMode: params.mode,
        flaggedForReview: Boolean(params.flaggedForReview || existing?.flaggedForReview),
        clockSkewSeconds: params.clockSkewSeconds ?? existing?.clockSkewSeconds ?? 0,
        deviceLocalTimeIso: params.deviceLocalTimeIso || null,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existing) {
        payload.createdAt = FieldValue.serverTimestamp();
      }
      tx.set(attendanceRef, payload, { merge: true });
    }
  });

  const studentSummary = {
    id: student.id,
    fullName: student.fullName,
    nis: student.nis,
    classId: student.classId,
    className: student.className,
    photoUrl: student.photoUrl
  };

  if (alreadyScanned) {
    return {
      success: false,
      code: 'ALREADY_SCANNED',
      message:
        params.session === 'PAGI'
          ? `${student.fullName} sudah melakukan absensi pagi hari ini.`
          : `${student.fullName} sudah melakukan absensi pulang sore hari ini.`,
      attendanceId,
      status: finalStatus,
      student: studentSummary
    };
  }

  await writeAuditLog({
    userId: params.teacherUid,
    userName: params.teacherName,
    role: 'GURU_PIKET',
    action: params.session === 'PAGI' ? 'SCAN_PAGI' : 'SCAN_SORE',
    deviceId: params.deviceId,
    transactionId: params.transactionUuid || attendanceId,
    description: `Scan ${params.session} ${student.fullName} (${student.nis}) – Status: ${finalStatus}`,
    metadata: {
      studentId: student.id,
      classId: student.classId,
      mode: params.mode,
      warning: warning || null,
      flaggedForReview: Boolean(params.flaggedForReview)
    }
  });

  return {
    success: true,
    code: 'SUCCESS',
    message:
      params.session === 'PAGI'
        ? `Absensi pagi berhasil (${finalStatus}).`
        : 'Absensi pulang sore berhasil dicatat.',
    warning,
    attendanceId,
    status: finalStatus,
    scannedAtIso: wib.isoWib,
    student: studentSummary
  };
}

export async function handleProcessAttendanceScan(request: CallableRequest) {
  const caller = await verifyCaller(request, ['GURU_PIKET']);
  const data = request.data as {
    session: AttendanceSessionType;
    qrToken: string;
    deviceId?: string;
    transactionUuid?: string;
  };

  if (!data?.qrToken || (data.session !== 'PAGI' && data.session !== 'SORE')) {
    throw new HttpsError('invalid-argument', 'Token QR dan jenis sesi (PAGI/SORE) wajib diisi.');
  }

  const now = new Date();
  const duty = await validateActiveDutyForCaller(caller, now);
  if (!duty.valid || !duty.schedule) {
    return {
      success: false,
      code: 'DUTY_INVALID',
      message: duty.message
    };
  }

  return executeAttendanceTransaction({
    session: data.session,
    qrToken: data.qrToken,
    teacherUid: caller.uid,
    teacherName: caller.displayName,
    scheduleId: duty.schedule.id,
    deviceId: data.deviceId || 'WEB',
    transactionUuid: data.transactionUuid,
    mode: 'ONLINE',
    effectiveTime: now
  });
}
