import { onCall } from 'firebase-functions/v2/https';
import { FUNCTIONS_REGION } from './config';
import {
  handleCreateUserAccount,
  handleRecordAuthEvent,
  handleUpdateUserRoleAndAccess
} from './services/authService';
import {
  handleBulkGenerateQr,
  handleDeactivateStudentQr,
  handleGenerateStudentQr,
  handleRegenerateStudentQr
} from './services/qrService';
import {
  handleGetDutyStatus,
  handleProcessAttendanceScan
} from './services/attendanceService';
import {
  handleCreatePermissionRequest,
  handleDecidePermissionRequest,
  handleProcessExitScan,
  handleProcessReturnScan
} from './services/permissionService';
import {
  handleIssueOfflineAuthorization,
  handleSyncOfflineTransactions
} from './services/offlineSyncService';

const opts = { region: FUNCTIONS_REGION, cors: true };

// Authentication & Role Management (Admin-only custom claims)
export const createUserAccount = onCall(opts, handleCreateUserAccount);
export const updateUserRoleAndAccess = onCall(opts, handleUpdateUserRoleAndAccess);
export const recordAuthEvent = onCall(opts, handleRecordAuthEvent);

// QR Code Management (Admin-only)
export const generateStudentQr = onCall(opts, handleGenerateStudentQr);
export const bulkGenerateQr = onCall(opts, handleBulkGenerateQr);
export const regenerateStudentQr = onCall(opts, handleRegenerateStudentQr);
export const deactivateStudentQr = onCall(opts, handleDeactivateStudentQr);

// Duty Schedule & Attendance Scanning (Guru Piket with server-validated active duty)
export const getDutyStatus = onCall(opts, handleGetDutyStatus);
export const processAttendanceScan = onCall(opts, handleProcessAttendanceScan);

// Student Permission & Exit/Return Scanning
export const createPermissionRequest = onCall(opts, handleCreatePermissionRequest);
export const decidePermissionRequest = onCall(opts, handleDecidePermissionRequest);
export const processExitScan = onCall(opts, handleProcessExitScan);
export const processReturnScan = onCall(opts, handleProcessReturnScan);

// Secure Offline Mode & Sync
export const issueOfflineAuthorization = onCall(opts, handleIssueOfflineAuthorization);
export const syncOfflineTransactions = onCall(opts, handleSyncOfflineTransactions);
