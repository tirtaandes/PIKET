export type UserRole = 'ADMIN' | 'GURU_PIKET' | 'WALI_KELAS';

export type AttendanceSessionType = 'PAGI' | 'SORE';

export type MorningStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'SAKIT'
  | 'ALPA'
  | 'BELUM_ABSEN';

export type AfternoonStatus = 'PULANG' | 'BELUM_ABSEN';

export type PermissionType =
  | 'KEPERLUAN_KELUARGA'
  | 'SAKIT'
  | 'KEPERLUAN_PRIBADI'
  | 'KEPERLUAN_SEKOLAH'
  | 'LAINNYA';

export type PermissionStatus =
  | 'MENUNGGU'
  | 'DISETUJUI'
  | 'DITOLAK'
  | 'SUDAH_KELUAR'
  | 'SUDAH_KEMBALI'
  | 'KEDALUWARSA';

export type DutyScheduleType = 'HARIAN' | 'MINGGUAN' | 'TANGGAL';

export type OfflineTxType = 'SCAN_PAGI' | 'SCAN_SORE' | 'SCAN_KELUAR' | 'SCAN_KEMBALI';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SCAN_PAGI'
  | 'SCAN_SORE'
  | 'SCAN_KELUAR'
  | 'SCAN_KEMBALI'
  | 'PERMISSION_CREATE'
  | 'PERMISSION_APPROVE'
  | 'PERMISSION_REJECT'
  | 'DUTY_SCHEDULE_CHANGE'
  | 'STUDENT_CHANGE'
  | 'QR_GENERATE'
  | 'QR_REGENERATE'
  | 'QR_DEACTIVATE'
  | 'USER_CHANGE'
  | 'OFFLINE_AUTH_ISSUED'
  | 'OFFLINE_SYNC';

export interface AuthClaims {
  role?: UserRole;
  teacherId?: string;
  assignedClassId?: string;
  active?: boolean;
}

export interface DutyScheduleDoc {
  id: string;
  title: string;
  type: DutyScheduleType;
  date?: string; // YYYY-MM-DD for TANGGAL or HARIAN
  daysOfWeek?: number[]; // 0=Sun..6=Sat for MINGGUAN
  teacherIds: string[];
  teacherNames?: Record<string, string>;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  active: boolean;
  notes?: string;
}

export interface AttendanceSettingsDoc {
  morning: {
    startTime: string; // e.g. 06:00
    onTimeDeadline: string; // e.g. 07:00
    endTime: string; // e.g. 08:00
    activeDays: number[]; // 1..6
    enabled: boolean;
  };
  afternoon: {
    startTime: string; // e.g. 14:00
    endTime: string; // e.g. 16:30
    activeDays: number[];
    enabled: boolean;
  };
  lateToleranceMinutes: number;
  maxClockSkewSeconds: number;
  offlineAuthDurationMinutes: number;
  exemptedClassIds?: string[];
  exemptedStudentIds?: string[];
}

export interface HolidayDoc {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'LIBUR' | 'HARI_KHUSUS' | 'KEGIATAN_SEKOLAH' | 'PENGECUALIAN';
  disableAttendance: boolean;
  customMorningStart?: string;
  customMorningDeadline?: string;
  customMorningEnd?: string;
  customAfternoonStart?: string;
  customAfternoonEnd?: string;
  exemptedClassIds?: string[];
  notes?: string;
}

export interface StudentDoc {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  birthPlaceDate: string;
  address: string;
  phone: string;
  parentName: string;
  classId: string;
  className: string;
  majorId: string;
  majorName: string;
  academicYearId: string;
  academicYearName: string;
  photoUrl?: string;
  active: boolean;
  activeQrToken?: string;
}

export interface QrTokenDoc {
  token: string;
  studentId: string;
  nis: string;
  active: boolean;
  status: 'ACTIVE' | 'REVOKED' | 'LOST';
  createdAt: FirebaseFirestore.Timestamp | Date;
  deactivatedAt?: FirebaseFirestore.Timestamp | Date | null;
}

export interface PermissionRequestDoc {
  id: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  estimatedReturnTime: string; // HH:mm
  type: PermissionType;
  reason: string;
  notes?: string;
  status: PermissionStatus;
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: FirebaseFirestore.Timestamp | Date | null;
  rejectedReason?: string;
  exitTime?: FirebaseFirestore.Timestamp | Date | null;
  exitTeacherId?: string;
  exitTeacherName?: string;
  exitPost?: string;
  returnTime?: FirebaseFirestore.Timestamp | Date | null;
  returnTeacherId?: string;
  returnTeacherName?: string;
  offlinePendingVerification?: boolean;
}

export interface SignedOfflineAuthorization {
  payload: {
    authId: string;
    teacherUid: string;
    teacherId: string;
    teacherName: string;
    scheduleId: string;
    scheduleTitle: string;
    deviceId: string;
    date: string;
    scheduleStartTime: string;
    scheduleEndTime: string;
    issuedAtIso: string;
    expiresAtIso: string;
  };
  signature: string;
}

export interface SignedOfflinePermission {
  payload: {
    permissionId: string;
    studentId: string;
    studentName: string;
    nis: string;
    className: string;
    date: string;
    startTime: string;
    estimatedReturnTime: string;
    type: PermissionType;
    reason: string;
    approvedByName: string;
    status: PermissionStatus;
  };
  signature: string;
}

export interface OfflineTransactionInput {
  transactionUuid: string;
  type: OfflineTxType;
  qrToken: string;
  studentId: string;
  teacherUid: string;
  deviceId: string;
  deviceLocalTimeIso: string;
  permissionId?: string;
  exitPost?: string;
}
