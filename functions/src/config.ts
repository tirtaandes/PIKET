import * as admin from 'firebase-admin';
import { AttendanceSettingsDoc } from './types';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

export const FUNCTIONS_REGION = 'asia-southeast2';
export const SCHOOL_TIMEZONE = 'Asia/Jakarta';

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettingsDoc = {
  morning: {
    startTime: '06:00',
    onTimeDeadline: '07:00',
    endTime: '08:00',
    activeDays: [1, 2, 3, 4, 5, 6],
    enabled: true
  },
  afternoon: {
    startTime: '14:00',
    endTime: '16:30',
    activeDays: [1, 2, 3, 4, 5, 6],
    enabled: true
  },
  lateToleranceMinutes: 0,
  maxClockSkewSeconds: 300,
  offlineAuthDurationMinutes: 480,
  exemptedClassIds: [],
  exemptedStudentIds: []
};

export function getOfflineSigningSecret(): string {
  // In production, configure via Firebase Functions Secret Manager (`OFFLINE_SIGNING_SECRET`)
  // or environment variable. Fallback derives per-project secret only for local emulator/tests.
  const secret = process.env.OFFLINE_SIGNING_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'smart-attendance-local-dev';
  return `sa-smkn6-offline-signing-key::${projectId}`;
}
