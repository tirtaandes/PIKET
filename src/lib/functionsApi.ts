import { httpsCallable } from 'firebase/functions';
import { requireFunctions } from './firebase';
import type {
  AttendanceSessionType,
  AttendanceSettings,
  CachedOfflineStudent,
  DutyStatusResponse,
  PermissionType,
  ScanResponse,
  SignedOfflineAuthorization,
  SignedOfflinePermission,
  UserRole
} from '../types';

function call<Req, Res>(name: string) {
  return async (payload: Req): Promise<Res> => {
    const fn = httpsCallable<Req, Res>(requireFunctions(), name);
    const result = await fn(payload);
    return result.data;
  };
}

export const functionsApi = {
  createUserAccount: call<
    {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
      teacherId?: string;
      assignedClassId?: string;
      assignedClassName?: string;
      phone?: string;
    },
    { success: boolean; uid: string; email: string; role: UserRole }
  >('createUserAccount'),

  updateUserRoleAndAccess: call<
    {
      uid: string;
      displayName?: string;
      role: UserRole;
      teacherId?: string | null;
      assignedClassId?: string | null;
      assignedClassName?: string | null;
      active: boolean;
      newPassword?: string;
    },
    { success: boolean }
  >('updateUserRoleAndAccess'),

  recordAuthEvent: call<{ event: 'LOGIN' | 'LOGOUT'; deviceId?: string }, { success: boolean }>(
    'recordAuthEvent'
  ),

  generateStudentQr: call<{ studentId: string }, { studentId: string; token: string }>(
    'generateStudentQr'
  ),

  regenerateStudentQr: call<
    { studentId: string; reason?: string },
    { studentId: string; token: string }
  >('regenerateStudentQr'),

  bulkGenerateQr: call<
    { studentIds?: string[]; onlyMissing?: boolean },
    { success: boolean; totalRequested: number; generatedCount: number; errors: Array<{ studentId: string; error: string }> }
  >('bulkGenerateQr'),

  deactivateStudentQr: call<{ studentId: string; reason?: string }, { success: boolean; studentId: string }>(
    'deactivateStudentQr'
  ),

  getDutyStatus: call<Record<string, never>, DutyStatusResponse>('getDutyStatus'),

  processAttendanceScan: call<
    {
      session: AttendanceSessionType;
      qrToken: string;
      deviceId?: string;
      transactionUuid?: string;
    },
    ScanResponse
  >('processAttendanceScan'),

  createPermissionRequest: call<
    {
      studentId: string;
      date: string;
      startTime: string;
      estimatedReturnTime: string;
      type: PermissionType;
      reason: string;
      notes?: string;
      autoApprove?: boolean;
    },
    { success: boolean; permissionId: string; status: string }
  >('createPermissionRequest'),

  decidePermissionRequest: call<
    {
      permissionId: string;
      decision: 'APPROVE' | 'REJECT';
      rejectedReason?: string;
    },
    { success: boolean; permissionId: string; status: string }
  >('decidePermissionRequest'),

  processExitScan: call<
    {
      qrToken: string;
      deviceId?: string;
      exitPost?: string;
      permissionId?: string;
      transactionUuid?: string;
    },
    ScanResponse
  >('processExitScan'),

  processReturnScan: call<
    {
      qrToken: string;
      deviceId?: string;
      permissionId?: string;
      transactionUuid?: string;
    },
    ScanResponse
  >('processReturnScan'),

  issueOfflineAuthorization: call<
    { deviceId: string; deviceName?: string; userAgent?: string },
    {
      success: boolean;
      authorization: SignedOfflineAuthorization;
      attendanceSettings: AttendanceSettings;
      cachedStudents: CachedOfflineStudent[];
      signedPermissions: SignedOfflinePermission[];
      serverIsoWib: string;
    }
  >('issueOfflineAuthorization'),

  syncOfflineTransactions: call<
    {
      authorization: SignedOfflineAuthorization;
      deviceId: string;
      transactions: Array<{
        transactionUuid: string;
        type: 'SCAN_PAGI' | 'SCAN_SORE' | 'SCAN_KELUAR' | 'SCAN_KEMBALI';
        qrToken: string;
        studentId: string;
        teacherUid: string;
        deviceId: string;
        deviceLocalTimeIso: string;
        permissionId?: string;
        exitPost?: string;
      }>;
    },
    {
      success: boolean;
      serverIsoWib: string;
      summary: {
        total: number;
        syncedCount: number;
        duplicateCount: number;
        rejectedCount: number;
        flaggedCount: number;
      };
      results: Array<{
        transactionUuid: string;
        status: 'SYNCED' | 'DUPLICATE' | 'REJECTED';
        flaggedForReview: boolean;
        clockSkewSeconds: number;
        message: string;
      }>;
    }
  >('syncOfflineTransactions')
};
