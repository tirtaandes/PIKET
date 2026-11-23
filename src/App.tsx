import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isFirebaseConfigured } from './lib/firebase';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { FirebaseSetupGuide } from './components/setup/FirebaseSetupGuide';
import { AppLayout } from './components/layout/AppLayout';
import { getHomePathForRole, ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentsPage } from './pages/admin/StudentsPage';
import { QrCenterPage } from './pages/admin/QrCenterPage';
import { TeachersPage } from './pages/admin/TeachersPage';
import { MasterDataPage } from './pages/admin/MasterDataPage';
import { DutySchedulesPage } from './pages/admin/DutySchedulesPage';
import { AttendanceSettingsPage } from './pages/admin/AttendanceSettingsPage';
import { AttendanceMonitorPage } from './pages/admin/AttendanceMonitorPage';
import { PermissionsAdminPage } from './pages/admin/PermissionsAdminPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SyncMonitorPage } from './pages/admin/SyncMonitorPage';
import { ActivityLogsPage } from './pages/admin/ActivityLogsPage';
import { SchoolSettingsPage } from './pages/admin/SchoolSettingsPage';

// Guru Piket pages
import { PiketDashboard } from './pages/piket/PiketDashboard';
import { PiketScannerPage } from './pages/piket/PiketScannerPage';
import { PiketOfflineSyncPage } from './pages/piket/PiketOfflineSyncPage';

// Wali Kelas pages
import { WaliKelasDashboard } from './pages/walikelas/WaliKelasDashboard';
import { WaliKelasPermissionsPage } from './pages/walikelas/WaliKelasPermissionsPage';
import { WaliKelasReportsPage } from './pages/walikelas/WaliKelasReportsPage';

const RoleIndexRedirect: React.FC = () => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePathForRole(profile.role)} replace />;
};

export const App: React.FC = () => {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupGuide />;
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <NetworkProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<RoleIndexRedirect />} />

              {/* ADMIN ROUTES */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="qr" element={<QrCenterPage />} />
                <Route path="teachers" element={<TeachersPage />} />
                <Route path="master" element={<MasterDataPage />} />
                <Route path="duty-schedules" element={<DutySchedulesPage />} />
                <Route path="attendance-settings" element={<AttendanceSettingsPage />} />
                <Route path="attendance" element={<AttendanceMonitorPage />} />
                <Route path="permissions" element={<PermissionsAdminPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="sync" element={<SyncMonitorPage />} />
                <Route path="logs" element={<ActivityLogsPage />} />
                <Route path="school" element={<SchoolSettingsPage />} />
              </Route>

              {/* GURU PIKET ROUTES */}
              <Route
                path="/piket"
                element={
                  <ProtectedRoute allowedRoles={['GURU_PIKET']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<PiketDashboard />} />
                <Route path="scan/:mode" element={<PiketScannerPage />} />
                <Route path="offline" element={<PiketOfflineSyncPage />} />
              </Route>

              {/* WALI KELAS ROUTES */}
              <Route
                path="/walikelas"
                element={
                  <ProtectedRoute allowedRoles={['WALI_KELAS']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<WaliKelasDashboard />} />
                <Route path="permissions" element={<WaliKelasPermissionsPage />} />
                <Route path="reports" element={<WaliKelasReportsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </NetworkProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
