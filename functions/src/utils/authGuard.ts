import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db } from '../config';
import { DutyScheduleDoc, UserRole } from '../types';
import { DutyValidationResult, evaluateDutySchedule } from './dutyValidator';

export interface VerifiedCaller {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teacherId?: string;
  assignedClassId?: string;
  active: boolean;
}

/**
 * Authoritative caller verification using Firebase Auth token claims AND users/{uid} document.
 * NEVER trusts any role supplied in request.data.
 */
export async function verifyCaller(
  request: CallableRequest,
  allowedRoles?: UserRole[]
): Promise<VerifiedCaller> {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Anda harus login terlebih dahulu.');
  }

  const uid = request.auth.uid;
  const tokenClaims = request.auth.token as Record<string, unknown>;
  const claimRole = tokenClaims.role as UserRole | undefined;

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'Profil pengguna tidak ditemukan di sistem.');
  }

  const userData = userSnap.data()!;
  const active = userData.active !== false && tokenClaims.active !== false;
  if (!active) {
    throw new HttpsError('permission-denied', 'Akun Anda dinonaktifkan. Hubungi Administrator.');
  }

  // Enforce match between custom claim role and Firestore user document
  const effectiveRole = (claimRole || userData.role) as UserRole | undefined;
  if (!effectiveRole || !['ADMIN', 'GURU_PIKET', 'WALI_KELAS'].includes(effectiveRole)) {
    throw new HttpsError('permission-denied', 'Role pengguna tidak valid atau belum ditetapkan oleh Admin.');
  }
  if (claimRole && userData.role && claimRole !== userData.role) {
    throw new HttpsError('permission-denied', 'Ketidaksesuaian hak akses terdeteksi. Silakan login ulang.');
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    throw new HttpsError(
      'permission-denied',
      'Anda tidak memiliki hak akses untuk melakukan tindakan ini.'
    );
  }

  return {
    uid,
    email: String(userData.email || request.auth.token.email || ''),
    displayName: String(userData.displayName || userData.name || ''),
    role: effectiveRole,
    teacherId: userData.teacherId ? String(userData.teacherId) : undefined,
    assignedClassId: userData.assignedClassId ? String(userData.assignedClassId) : undefined,
    active
  };
}

/**
 * Fetches active duty schedules for a teacher and validates against server WIB time.
 */
export async function validateActiveDutyForCaller(
  caller: VerifiedCaller,
  now: Date = new Date()
): Promise<DutyValidationResult> {
  const identifiers = Array.from(new Set([caller.uid, caller.teacherId || ''].filter(Boolean)));

  const schedulesMap = new Map<string, DutyScheduleDoc>();
  for (const id of identifiers) {
    const snap = await db
      .collection('duty_schedules')
      .where('teacherIds', 'array-contains', id)
      .where('active', '==', true)
      .get();
    for (const doc of snap.docs) {
      schedulesMap.set(doc.id, { id: doc.id, ...(doc.data() as Omit<DutyScheduleDoc, 'id'>) });
    }
  }

  return evaluateDutySchedule({
    accountActive: caller.active,
    role: caller.role,
    teacherIdentifiers: identifiers,
    schedules: Array.from(schedulesMap.values()),
    now
  });
}
