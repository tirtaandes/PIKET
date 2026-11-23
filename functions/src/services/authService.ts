import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { authAdmin, db, FieldValue } from '../config';
import { UserRole } from '../types';
import { verifyCaller } from '../utils/authGuard';
import { writeAuditLog } from '../utils/audit';

export async function handleCreateUserAccount(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const data = request.data as {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    teacherId?: string;
    assignedClassId?: string;
    assignedClassName?: string;
    phone?: string;
  };

  if (!data?.email || !data?.password || !data?.displayName || !data?.role) {
    throw new HttpsError('invalid-argument', 'Email, password, nama, dan role wajib diisi.');
  }
  if (!['ADMIN', 'GURU_PIKET', 'WALI_KELAS'].includes(data.role)) {
    throw new HttpsError('invalid-argument', 'Role tidak valid.');
  }
  if (data.password.length < 8) {
    throw new HttpsError('invalid-argument', 'Password minimal 8 karakter.');
  }
  if (data.role === 'WALI_KELAS' && !data.assignedClassId) {
    throw new HttpsError('invalid-argument', 'Wali kelas wajib ditugaskan pada satu kelas.');
  }

  const userRecord = await authAdmin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    displayName: data.displayName.trim(),
    disabled: false
  });

  const claims: Record<string, unknown> = {
    role: data.role,
    active: true
  };
  if (data.teacherId) claims.teacherId = data.teacherId;
  if (data.role === 'WALI_KELAS' && data.assignedClassId) {
    claims.assignedClassId = data.assignedClassId;
  }

  await authAdmin.setCustomUserClaims(userRecord.uid, claims);

  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: data.displayName.trim(),
    role: data.role,
    teacherId: data.teacherId || null,
    assignedClassId: data.role === 'WALI_KELAS' ? data.assignedClassId || null : null,
    assignedClassName: data.role === 'WALI_KELAS' ? data.assignedClassName || null : null,
    phone: data.phone || '',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid
  });

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: 'USER_CHANGE',
    description: `Membuat akun ${data.role} untuk ${data.displayName} (${userRecord.email})`,
    metadata: { targetUid: userRecord.uid, role: data.role }
  });

  return {
    success: true,
    uid: userRecord.uid,
    email: userRecord.email,
    role: data.role
  };
}

export async function handleUpdateUserRoleAndAccess(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const data = request.data as {
    uid: string;
    displayName?: string;
    role: UserRole;
    teacherId?: string | null;
    assignedClassId?: string | null;
    assignedClassName?: string | null;
    active: boolean;
    newPassword?: string;
  };

  if (!data?.uid || !data?.role) {
    throw new HttpsError('invalid-argument', 'UID dan role wajib diisi.');
  }
  if (!['ADMIN', 'GURU_PIKET', 'WALI_KELAS'].includes(data.role)) {
    throw new HttpsError('invalid-argument', 'Role tidak valid.');
  }
  if (data.uid === caller.uid && (!data.active || data.role !== 'ADMIN')) {
    throw new HttpsError('failed-precondition', 'Admin tidak dapat menonaktifkan atau menurunkan role akunnya sendiri.');
  }
  if (data.role === 'WALI_KELAS' && !data.assignedClassId) {
    throw new HttpsError('invalid-argument', 'Wali kelas wajib memiliki kelas yang diampu.');
  }

  const updateAuthPayload: { displayName?: string; disabled: boolean; password?: string } = {
    disabled: !data.active
  };
  if (data.displayName) updateAuthPayload.displayName = data.displayName.trim();
  if (data.newPassword) {
    if (data.newPassword.length < 8) {
      throw new HttpsError('invalid-argument', 'Password baru minimal 8 karakter.');
    }
    updateAuthPayload.password = data.newPassword;
  }

  await authAdmin.updateUser(data.uid, updateAuthPayload);

  const claims: Record<string, unknown> = {
    role: data.role,
    active: data.active
  };
  if (data.teacherId) claims.teacherId = data.teacherId;
  if (data.role === 'WALI_KELAS' && data.assignedClassId) {
    claims.assignedClassId = data.assignedClassId;
  }

  await authAdmin.setCustomUserClaims(data.uid, claims);
  if (!data.active) {
    await authAdmin.revokeRefreshTokens(data.uid);
  }

  await db.collection('users').doc(data.uid).set(
    {
      ...(data.displayName ? { displayName: data.displayName.trim() } : {}),
      role: data.role,
      teacherId: data.teacherId || null,
      assignedClassId: data.role === 'WALI_KELAS' ? data.assignedClassId || null : null,
      assignedClassName: data.role === 'WALI_KELAS' ? data.assignedClassName || null : null,
      active: data.active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid
    },
    { merge: true }
  );

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: 'USER_CHANGE',
    description: `Memperbarui akun ${data.uid}: role=${data.role}, active=${data.active}`,
    metadata: { targetUid: data.uid, role: data.role, active: data.active }
  });

  return { success: true };
}

export async function handleRecordAuthEvent(request: CallableRequest) {
  const caller = await verifyCaller(request);
  const data = request.data as { event: 'LOGIN' | 'LOGOUT'; deviceId?: string };
  if (data?.event !== 'LOGIN' && data?.event !== 'LOGOUT') {
    throw new HttpsError('invalid-argument', 'Event autentikasi tidak valid.');
  }

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: caller.role,
    action: data.event,
    deviceId: data.deviceId || 'WEB',
    description: `${caller.displayName} (${caller.role}) melakukan ${data.event}`
  });

  return { success: true };
}
