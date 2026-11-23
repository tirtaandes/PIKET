import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../config';
import { verifyCaller } from '../utils/authGuard';
import { generateOpaqueQrToken } from '../utils/crypto';
import { writeAuditLog } from '../utils/audit';

async function assignNewTokenToStudent(params: {
  studentId: string;
  actorUid: string;
  actorName: string;
  isRegenerate: boolean;
  reason?: string;
}): Promise<{ studentId: string; token: string }> {
  const studentRef = db.collection('students').doc(params.studentId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Data siswa tidak ditemukan.');
  }

  const student = studentSnap.data()!;
  const oldToken = student.activeQrToken as string | undefined;
  const newToken = generateOpaqueQrToken();

  const batch = db.batch();

  if (oldToken) {
    const oldTokenRef = db.collection('qr_tokens').doc(oldToken);
    batch.set(
      oldTokenRef,
      {
        active: false,
        status: 'REVOKED',
        deactivatedAt: FieldValue.serverTimestamp(),
        deactivatedBy: params.actorUid,
        deactivationReason: params.reason || (params.isRegenerate ? 'Regenerasi QR oleh Admin' : 'Digantikan')
      },
      { merge: true }
    );
  }

  const newTokenRef = db.collection('qr_tokens').doc(newToken);
  batch.set(newTokenRef, {
    token: newToken,
    studentId: params.studentId,
    nis: String(student.nis || ''),
    active: true,
    status: 'ACTIVE',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: params.actorUid,
    deactivatedAt: null
  });

  batch.update(studentRef, {
    activeQrToken: newToken,
    qrUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await batch.commit();

  await writeAuditLog({
    userId: params.actorUid,
    userName: params.actorName,
    role: 'ADMIN',
    action: params.isRegenerate ? 'QR_REGENERATE' : 'QR_GENERATE',
    description: `${params.isRegenerate ? 'Regenerasi' : 'Generate'} QR siswa ${student.fullName} (NIS: ${student.nis})`,
    metadata: { studentId: params.studentId, oldTokenRevoked: Boolean(oldToken) }
  });

  return { studentId: params.studentId, token: newToken };
}

export async function handleGenerateStudentQr(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const { studentId } = (request.data || {}) as { studentId: string };
  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId wajib diisi.');
  }
  return assignNewTokenToStudent({
    studentId,
    actorUid: caller.uid,
    actorName: caller.displayName,
    isRegenerate: false
  });
}

export async function handleRegenerateStudentQr(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const { studentId, reason } = (request.data || {}) as { studentId: string; reason?: string };
  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId wajib diisi.');
  }
  return assignNewTokenToStudent({
    studentId,
    actorUid: caller.uid,
    actorName: caller.displayName,
    isRegenerate: true,
    reason
  });
}

export async function handleBulkGenerateQr(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const { studentIds, onlyMissing = true } = (request.data || {}) as {
    studentIds?: string[];
    onlyMissing?: boolean;
  };

  let targets: string[] = [];
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    targets = studentIds;
  } else {
    const snap = await db.collection('students').where('active', '==', true).get();
    targets = snap.docs
      .filter((d) => (!onlyMissing ? true : !d.data().activeQrToken))
      .map((d) => d.id);
  }

  let generatedCount = 0;
  const errors: Array<{ studentId: string; error: string }> = [];

  for (const sid of targets) {
    try {
      await assignNewTokenToStudent({
        studentId: sid,
        actorUid: caller.uid,
        actorName: caller.displayName,
        isRegenerate: !onlyMissing
      });
      generatedCount += 1;
    } catch (err) {
      errors.push({
        studentId: sid,
        error: err instanceof Error ? err.message : 'Gagal generate QR'
      });
    }
  }

  return {
    success: true,
    totalRequested: targets.length,
    generatedCount,
    errors
  };
}

export async function handleDeactivateStudentQr(request: CallableRequest) {
  const caller = await verifyCaller(request, ['ADMIN']);
  const { studentId, reason } = (request.data || {}) as { studentId: string; reason?: string };
  if (!studentId) {
    throw new HttpsError('invalid-argument', 'studentId wajib diisi.');
  }

  const studentRef = db.collection('students').doc(studentId);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) {
    throw new HttpsError('not-found', 'Data siswa tidak ditemukan.');
  }

  const student = studentSnap.data()!;
  const currentToken = student.activeQrToken as string | undefined;
  if (!currentToken) {
    throw new HttpsError('failed-precondition', 'Siswa tidak memiliki QR aktif.');
  }

  const batch = db.batch();
  batch.set(
    db.collection('qr_tokens').doc(currentToken),
    {
      active: false,
      status: 'LOST',
      deactivatedAt: FieldValue.serverTimestamp(),
      deactivatedBy: caller.uid,
      deactivationReason: reason || 'QR dilaporkan hilang / dinonaktifkan Admin'
    },
    { merge: true }
  );
  batch.update(studentRef, {
    activeQrToken: null,
    qrUpdatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  await batch.commit();

  await writeAuditLog({
    userId: caller.uid,
    userName: caller.displayName,
    role: 'ADMIN',
    action: 'QR_DEACTIVATE',
    description: `Menonaktifkan QR hilang untuk ${student.fullName} (NIS: ${student.nis})`,
    metadata: { studentId, reason: reason || 'HILANG' }
  });

  return { success: true, studentId };
}
