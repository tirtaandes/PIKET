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

export type NetworkSyncState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'PENDING' | 'FAILED';

export interface SchoolProfile {
  schoolName: string;
  appName: string;
  logoUrl: string;
  address: string;
  academicYear: string;
  principalName: string;
  principalNip?: string;
  contact: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teacherId?: string | null;
  assignedClassId?: string | null;
  assignedClassName?: string | null;
  phone?: string;
  active: boolean;
}

export interface ClassHistoryEntry {
  fromClassId: string;
  fromClassName: string;
  toClassId: string;
  toClassName: string;
  academicYearName: string;
  movedAtIso: string;
  movedByName: string;
  reason?: string;
}

export interface Student {
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
  activeQrToken?: string | null;
  classHistory?: ClassHistoryEntry[];
}

export interface Teacher {
  id: string;
  nip: string;
  fullName: string;
  gender: 'L' | 'P';
  phone: string;
  email: string;
  subject?: string;
  active: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: 'X' | 'XI' | 'XII';
  majorId: string;
  majorName: string;
  academicYearId: string;
  academicYearName: string;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  active: boolean;
}

export interface Major {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface AcademicYear {
  id: string;
  name: string; // e.g. 2026/2027
  semester: 'GANJIL' | 'GENAP';
  active: boolean;
}

export interface DutySchedule {
  id: string;
  title: string;
  type: DutyScheduleType;
  date?: string;
  daysOfWeek?: number[];
  teacherIds: string[];
  teacherNames?: Record<string, string>;
  startTime: string;
  endTime: string;
  active: boolean;
  notes?: string;
}

export interface AttendanceSettings {
  morning: {
    startTime: string;
    onTimeDeadline: string;
    endTime: string;
    activeDays: number[];
    enabled: boolean;
  };
  afternoon: {
    startTime: string;
    endTime: string;
    activeDays: number[];
    enabled: boolean;
  };
  lateToleranceMinutes: number;
  maxClockSkewSeconds: number;
  offlineAuthDurationMinutes: number;
  exemptedClassIds?: string[];
  exemptedStudentIds?: string[];
}

export interface HolidayItem {
  id: string;
  date: string;
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

export interface AttendanceRecord {
  id: string;
  date: string;
  studentId: string;
  nis: string;
  studentName: string;
  classId: string;
  className: string;
  majorId?: string;
  majorName?: string;
  academicYearId?: string;
  academicYearName?: string;
  morningStatus: MorningStatus;
  morningTimeWib?: string;
  morningLateMinutes?: number;
  morningTeacherUid?: string;
  morningTeacherName?: string;
  morningDeviceId?: string;
  afternoonStatus: AfternoonStatus;
  afternoonTimeWib?: string;
  afternoonTeacherUid?: string;
  afternoonTeacherName?: string;
  missingMorningWarning?: boolean;
  syncStatus?: 'SUCCESS' | 'PENDING_SYNC' | 'FAILED';
  sourceMode?: 'ONLINE' | 'OFFLINE_SYNC';
  flaggedForReview?: boolean;
  clockSkewSeconds?: number;
  deviceLocalTimeIso?: string | null;
}

export interface PermissionRequest {
  id: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  estimatedReturnTime: string;
  type: PermissionType;
  reason: string;
  notes?: string;
  status: PermissionStatus;
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: unknown;
  rejectedReason?: string | null;
  exitTimeWib?: string | null;
  exitTeacherName?: string | null;
  exitPost?: string | null;
  returnTimeWib?: string | null;
  returnTeacherName?: string | null;
}

export interface ExitLog {
  id: string;
  permissionId: string;
  studentId: string;
  studentName: string;
  nis: string;
  classId: string;
  className: string;
  date: string;
  permissionType: PermissionType;
  reason: string;
  estimatedReturnTime: string;
  approvedByName: string;
  status: 'SUDAH_KELUAR' | 'SUDAH_KEMBALI';
  exitTimeWib?: string;
  exitTeacherName?: string;
  exitPost?: string;
  returnTimeWib?: string | null;
  returnTeacherName?: string | null;
  sourceMode?: 'ONLINE' | 'OFFLINE_SYNC';
  flaggedForReview?: boolean;
}

export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  lastTeacherUid?: string;
  lastTeacherName?: string;
  lastAuthId?: string;
  offlineAuthExpiresAt?: string;
  hasSuspiciousClock?: boolean;
  lastSyncSummary?: {
    total: number;
    syncedCount: number;
    duplicateCount: number;
    rejectedCount: number;
    flaggedCount: number;
  };
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName?: string;
  role: UserRole | 'SYSTEM';
  action: string;
  timestamp?: { seconds: number; nanoseconds: number } | Date;
  deviceId?: string;
  transactionId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface DutyStatusResponse {
  valid: boolean;
  code: string;
  message: string;
  schedule?: DutySchedule;
  serverDate: string;
  serverTime: string;
  serverIsoWib?: string;
  teacherName?: string;
}

export interface ScanResponse {
  success: boolean;
  code: string;
  message: string;
  warning?: string;
  status?: string;
  scannedAtIso?: string;
  offlinePending?: boolean;
  student?: {
    id: string;
    fullName: string;
    nis: string;
    classId: string;
    className: string;
    photoUrl?: string;
  };
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

export interface CachedOfflineStudent {
  studentId: string;
  qrToken: string;
  nis: string;
  fullName: string;
  classId: string;
  className: string;
  photoUrl?: string;
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

export interface PendingOfflineTransaction {
  transactionUuid: string;
  type: OfflineTxType;
  qrToken: string;
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  teacherUid: string;
  deviceId: string;
  deviceLocalTimeIso: string;
  permissionId?: string;
  exitPost?: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCED' | 'FAILED' | 'DUPLICATE' | 'REJECTED';
  syncMessage?: string;
  flaggedForReview?: boolean;
  createdAtIso: string;
}
