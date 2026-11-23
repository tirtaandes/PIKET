import { db, FieldValue } from '../config';
import { AuditAction, UserRole } from '../types';

export interface AuditLogInput {
  userId: string;
  userName?: string;
  role: UserRole | 'SYSTEM';
  action: AuditAction;
  deviceId?: string;
  transactionId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<string> {
  const ref = db.collection('activity_logs').doc();
  await ref.set({
    id: ref.id,
    userId: input.userId,
    userName: input.userName || '',
    role: input.role,
    action: input.action,
    timestamp: FieldValue.serverTimestamp(),
    deviceId: input.deviceId || 'WEB',
    transactionId: input.transactionId || '',
    description: input.description,
    metadata: input.metadata || {}
  });
  return ref.id;
}
