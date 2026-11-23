import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  QrCode,
  CalendarClock,
  Sliders,
  ClipboardCheck,
  FileCheck2,
  FileBarChart2,
  UserCog,
  Building2,
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  History,
  LogOut,
  Menu,
  X,
  ScanLine,
  Clock,
  CloudUpload,
  Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { getTodayWibDate, getWibTimeString } from '../../lib/time';
import type { UserRole } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

function getNavItems(role: UserRole): NavItem[] {
  if (role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
      { to: '/admin/students', label: 'Data Siswa', icon: <GraduationCap className="h-4 w-4" /> },
      { to: '/admin/qr', label: 'QR & Kartu Siswa', icon: <QrCode className="h-4 w-4" /> },
      { to: '/admin/teachers', label: 'Data Guru', icon: <Users className="h-4 w-4" /> },
      { to: '/admin/master', label: 'Kelas, Jurusan & TP', icon: <Layers className="h-4 w-4" /> },
      { to: '/admin/duty-schedules', label: 'Jadwal Piket', icon: <CalendarClock className="h-4 w-4" /> },
      { to: '/admin/attendance-settings', label: 'Pengaturan Absensi', icon: <Sliders className="h-4 w-4" /> },
      { to: '/admin/attendance', label: 'Monitor Absensi', icon: <ClipboardCheck className="h-4 w-4" /> },
      { to: '/admin/permissions', label: 'Izin & Keluar Sekolah', icon: <FileCheck2 className="h-4 w-4" /> },
      { to: '/admin/reports', label: 'Laporan Sekolah', icon: <FileBarChart2 className="h-4 w-4" /> },
      { to: '/admin/users', label: 'Akun Pengguna', icon: <UserCog className="h-4 w-4" /> },
      { to: '/admin/sync', label: 'Sinkronisasi Offline', icon: <CloudUpload className="h-4 w-4" /> },
      { to: '/admin/logs', label: 'Activity Log', icon: <History className="h-4 w-4" /> },
      { to: '/admin/school', label: 'Identitas Sekolah', icon: <Building2 className="h-4 w-4" /> }
    ];
  }
  if (role === 'GURU_PIKET') {
    return [
      { to: '/piket', label: 'Dashboard Piket', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
      { to: '/piket/scan/pagi', label: 'Scan Pagi', icon: <ScanLine className="h-4 w-4" /> },
      { to: '/piket/scan/sore', label: 'Scan Sore', icon: <ScanLine className="h-4 w-4" /> },
      { to: '/piket/scan/keluar', label: 'Scan Izin Keluar', icon: <FileCheck2 className="h-4 w-4" /> },
      { to: '/piket/scan/kembali', label: 'Scan Kembali', icon: <ClipboardCheck className="h-4 w-4" /> },
      { to: '/piket/offline', label: 'Mode Offline & Sync', icon: <CloudUpload className="h-4 w-4" /> }
    ];
  }
  return [
    { to: '/walikelas', label: 'Dashboard Kelas', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/walikelas/permissions', label: 'Izin Siswa', icon: <FileCheck2 className="h-4 w-4" /> },
    { to: '/walikelas/reports', label: 'Laporan Kelas', icon: <FileBarChart2 className="h-4 w-4" /> }
  ];
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  GURU_PIKET: 'Guru Piket',
  WALI_KELAS: 'Wali Kelas'
};

export const AppLayout: React.FC = () => {
  const { profile, school, logout } = useAuth();
  const { syncState, pendingCount, failedCount, triggerSyncNow } = useNetwork();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [wibClock, setWibClock] = useState(() => `${getTodayWibDate()} ${getWibTimeString()} WIB`);

  useEffect(() => {
    const t = setInterval(() => {
      setWibClock(`${getTodayWibDate()} • ${getWibTimeString()} WIB`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  if (!profile) return null;

  const navItems = getNavItems(profile.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNetworkBadge = () => {
    if (syncState === 'OFFLINE') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
          <WifiOff className="h-3.5 w-3.5" />
          OFFLINE {pendingCount > 0 ? `(${pendingCount})` : ''}
        </span>
      );
    }
    if (syncState === 'SYNCING') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          SINKRONISASI...
        </span>
      );
    }
    if (syncState === 'FAILED') {
      return (
        <button
          onClick={triggerSyncNow}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          title="Klik untuk mencoba sinkronisasi ulang"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          GAGAL SINKRONISASI ({failedCount})
        </button>
      );
    }
    if (syncState === 'PENDING') {
      return (
        <button
          onClick={triggerSyncNow}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          title="Klik untuk sinkronisasi sekarang"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          MENUNGGU ({pendingCount})
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Wifi className="h-3.5 w-3.5" />
        ONLINE
      </span>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-navy-950 text-white">
      <Link
        to={navItems[0].to}
        className="flex items-center gap-3 border-b border-white/10 px-4 py-4"
        onClick={() => setMobileOpen(false)}
      >
        <img
          src={school.logoUrl || '/school-logo-default.svg'}
          alt="Logo"
          className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-wide text-white">
            {school.appName || 'SMART ATTENDANCE'}
          </p>
          <p className="truncate text-[11px] text-sky-300">{school.schoolName}</p>
        </div>
      </Link>

      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{profile.displayName}</p>
            <p className="truncate text-[11px] text-sky-300">
              {ROLE_LABELS[profile.role]}
              {profile.role === 'WALI_KELAS' && profile.assignedClassName
                ? ` • ${profile.assignedClassName}`
                : ''}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-sky-500/20 text-white ring-1 ring-sky-400/40'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div className="relative w-72 max-w-[82vw] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
          <div className="flex-1 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs font-medium text-slate-600 sm:flex">
              <Clock className="h-4 w-4 text-navy-700" />
              <span className="font-mono font-semibold text-navy-900">{wibClock}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {renderNetworkBadge()}
            <span className="hidden rounded-lg bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-900 md:inline-block">
              TP {school.academicYear}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
