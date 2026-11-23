import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  ScanLine,
  LogOut,
  LogIn,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  DownloadCloud,
  RefreshCw,
  Users
} from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import { checkLocalOfflineAuthValidity, prepareOfflineCache } from '../../lib/offlineSync';
import { formatIndonesianDate, formatTimestampWib, getTodayWibDate, DAY_NAMES_ID } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { useToast } from '../../contexts/ToastContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import type {
  ActivityLog,
  AttendanceRecord,
  DutySchedule,
  DutyStatusResponse,
  ExitLog,
  PermissionRequest,
  Student
} from '../../types';

export const PiketDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { showToast } = useToast();
  const today = getTodayWibDate();

  const [dutyStatus, setDutyStatus] = useState<DutyStatusResponse | null>(null);
  const [loadingDuty, setLoadingDuty] = useState(true);
  const [offlineAuthInfo, setOfflineAuthInfo] = useState<{ valid: boolean; expiresAtIso?: string } | null>(null);
  const [preparingOffline, setPreparingOffline] = useState(false);

  const [mySchedules, setMySchedules] = useState<DutySchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [approvedPerms, setApprovedPerms] = useState<PermissionRequest[]>([]);
  const [outsideList, setOutsideList] = useState<ExitLog[]>([]);
  const [myLogs, setMyLogs] = useState<ActivityLog[]>([]);
  const [listTab, setListTab] = useState<'ABSENT' | 'LATE' | 'OUTSIDE' | 'APPROVED' | 'HISTORY'>('OUTSIDE');

  const checkDuty = async () => {
    if (!profile) return;
    setLoadingDuty(true);
    try {
      if (navigator.onLine) {
        const res = await functionsApi.getDutyStatus({});
        setDutyStatus(res);
      } else {
        const local = await checkLocalOfflineAuthValidity(profile.uid);
        setDutyStatus({
          valid: local.valid,
          code: local.valid ? 'OFFLINE_VALID' : 'OFFLINE_INVALID',
          message: local.valid
            ? `Mode Offline Aktif (${local.scheduleTitle})`
            : local.reason || 'ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF.',
          serverDate: today,
          serverTime: '--:--:--'
        });
      }
      const localAuth = await checkLocalOfflineAuthValidity(profile.uid);
      setOfflineAuthInfo({ valid: localAuth.valid, expiresAtIso: localAuth.expiresAtIso });
    } catch (err) {
      setDutyStatus({
        valid: false,
        code: 'ERROR',
        message: err instanceof Error ? err.message : 'Gagal memeriksa status jadwal piket.',
        serverDate: today,
        serverTime: '--:--:--'
      });
    } finally {
      setLoadingDuty(false);
    }
  };

  useEffect(() => {
    checkDuty();
  }, [profile?.uid, isOnline]);

  useEffect(() => {
    if (!profile) return;
    const db = requireDb();
    const unsubs = [
      onSnapshot(
        query(collection(db, 'duty_schedules'), where('teacherIds', 'array-contains', profile.uid)),
        (s) => setMySchedules(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DutySchedule, 'id'>) })))
      ),
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
            .filter((stu) => stu.active)
        )
      ),
      onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (s) =>
        setTodayAttendance(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
        )
      ),
      onSnapshot(
        query(collection(db, 'permission_requests'), where('status', '==', 'DISETUJUI')),
        (s) =>
          setApprovedPerms(
            s.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequest, 'id'>) }))
              .filter((p) => p.date === today)
          )
      ),
      onSnapshot(query(collection(db, 'exit_logs'), where('status', '==', 'SUDAH_KELUAR')), (s) =>
        setOutsideList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExitLog, 'id'>) })))
      ),
      onSnapshot(
        query(
          collection(db, 'activity_logs'),
          where('userId', '==', profile.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        ),
        (s) => setMyLogs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) })))
      )
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile?.uid, today]);

  const presentIds = useMemo(
    () => new Set(todayAttendance.filter((a) => a.morningStatus !== 'BELUM_ABSEN').map((a) => a.studentId)),
    [todayAttendance]
  );
  const absentStudents = useMemo(
    () => students.filter((s) => !presentIds.has(s.id)),
    [students, presentIds]
  );
  const lateRecords = useMemo(
    () => todayAttendance.filter((a) => a.morningStatus === 'TERLAMBAT'),
    [todayAttendance]
  );
  const presentCount = useMemo(
    () =>
      todayAttendance.filter(
        (a) => a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT'
      ).length,
    [todayAttendance]
  );

  const handlePrepareOffline = async () => {
    setPreparingOffline(true);
    try {
      const res = await prepareOfflineCache();
      setOfflineAuthInfo({ valid: true, expiresAtIso: res.expiresAtIso });
      showToast(
        'success',
        'Mode Offline Siap',
        `${res.studentCount} QR siswa & ${res.permissionCount} izin bertanda tangan tersimpan di perangkat.`
      );
    } catch (err) {
      showToast('error', 'Gagal menyiapkan mode offline', err instanceof Error ? err.message : '');
    } finally {
      setPreparingOffline(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Identity & Server Duty Status Banner */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-navy-950 to-navy-800 p-5 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                Dashboard Guru Piket • {formatIndonesianDate(today)}
              </p>
              <h1 className="mt-1 text-xl font-extrabold">{profile?.displayName}</h1>
              <p className="text-xs text-slate-300">{profile?.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={checkDuty} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20">
                <RefreshCw className={`mr-1.5 inline h-3.5 w-3.5 ${loadingDuty ? 'animate-spin' : ''}`} />
                Cek Jadwal Server
              </button>
              {dutyStatus?.valid && isOnline && (
                <button
                  disabled={preparingOffline}
                  onClick={handlePrepareOffline}
                  className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  <DownloadCloud className="mr-1.5 inline h-3.5 w-3.5" />
                  {preparingOffline ? 'Menyiapkan...' : 'Siapkan Mode Offline'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {loadingDuty ? (
            <p className="text-xs text-slate-500">Memvalidasi jadwal piket ke server...</p>
          ) : dutyStatus?.valid ? (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    JADWAL PIKET AKTIF: {dutyStatus.schedule?.title || 'Otorisasi Offline Sah'}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Jam Tugas: {dutyStatus.schedule?.startTime || '-'} – {dutyStatus.schedule?.endTime || '-'} WIB •
                    Jam Server: {dutyStatus.serverTime} WIB
                  </p>
                </div>
              </div>
              {offlineAuthInfo?.valid && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  Cache Offline Aktif s.d. {formatTimestampWib(offlineAuthInfo.expiresAtIso)}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-extrabold text-rose-800">
                  {dutyStatus?.message || 'ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF.'}
                </p>
                <p className="mt-0.5 text-xs text-rose-600">
                  Scanner dinonaktifkan oleh server di luar jadwal piket yang sah.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 Big Mobile-First Scan Buttons */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { to: '/piket/scan/pagi', label: 'SCAN PAGI', sub: 'Absensi Masuk', color: 'from-emerald-600 to-emerald-700', icon: <ScanLine className="h-7 w-7" /> },
          { to: '/piket/scan/sore', label: 'SCAN SORE', sub: 'Absensi Pulang', color: 'from-navy-800 to-navy-950', icon: <ScanLine className="h-7 w-7" /> },
          { to: '/piket/scan/keluar', label: 'IZIN KELUAR', sub: 'Scan Siswa Keluar', color: 'from-amber-500 to-amber-600', icon: <LogOut className="h-7 w-7" /> },
          { to: '/piket/scan/kembali', label: 'SCAN KEMBALI', sub: 'Siswa Kembali', color: 'from-sky-600 to-sky-700', icon: <LogIn className="h-7 w-7" /> }
        ].map((btn) => (
          <Link
            key={btn.to}
            to={btn.to}
            className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${btn.color} p-5 text-center text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg ${
              !dutyStatus?.valid ? 'opacity-65' : ''
            }`}
          >
            {btn.icon}
            <p className="mt-2 text-sm font-extrabold tracking-wide">{btn.label}</p>
            <p className="text-[11px] text-white/80">{btn.sub}</p>
          </Link>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Siswa Hadir" value={presentCount} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Belum Hadir" value={absentStudents.length} icon={<Users className="h-5 w-5" />} tone="slate" />
        <StatCard title="Terlambat" value={lateRecords.length} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard title="Sedang Keluar" value={outsideList.length} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
      </div>

      {/* Own Duty Schedule List */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-navy-950">Jadwal Piket Saya</h2>
        {mySchedules.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">Belum ada jadwal piket yang ditugaskan kepada Anda.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {mySchedules.map((sch) => (
              <div key={sch.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-navy-900">{sch.title}</p>
                  <StatusBadge status={sch.active ? 'AKTIF' : 'NONAKTIF'} />
                </div>
                <p className="mt-1 text-slate-600">
                  {sch.type === 'MINGGUAN'
                    ? (sch.daysOfWeek || []).map((d) => DAY_NAMES_ID[d]).join(', ')
                    : sch.date}
                </p>
                <p className="mt-0.5 font-mono font-bold text-sky-700">
                  {sch.startTime} – {sch.endTime} WIB
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Monitoring Lists */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 p-3">
          {[
            { id: 'OUTSIDE', label: `Sedang Keluar (${outsideList.length})` },
            { id: 'APPROVED', label: `Izin Disetujui (${approvedPerms.length})` },
            { id: 'LATE', label: `Terlambat (${lateRecords.length})` },
            { id: 'ABSENT', label: `Belum Hadir (${absentStudents.length})` },
            { id: 'HISTORY', label: `Riwayat Piket (${myLogs.length})` }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setListTab(t.id as typeof listTab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                listTab === t.id ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-auto p-4 text-xs">
          {listTab === 'OUTSIDE' && (
            outsideList.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Tidak ada siswa yang sedang berada di luar sekolah.</p>
            ) : (
              <div className="space-y-2">
                {outsideList.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{e.studentName} ({e.className})</p>
                      <p className="text-slate-600">{e.reason} • Keluar: {e.exitTimeWib} • Est kembali: {e.estimatedReturnTime}</p>
                    </div>
                    <StatusBadge status="SUDAH_KELUAR" />
                  </div>
                ))}
              </div>
            )
          )}

          {listTab === 'APPROVED' && (
            approvedPerms.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Tidak ada izin disetujui yang menunggu scan keluar hari ini.</p>
            ) : (
              <div className="space-y-2">
                {approvedPerms.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{p.studentName} ({p.className})</p>
                      <p className="text-slate-600">
                        {p.reason} • Jam: {p.startTime}–{p.estimatedReturnTime} • Disetujui: {p.approvedByName}
                      </p>
                    </div>
                    <StatusBadge status="DISETUJUI" />
                  </div>
                ))}
              </div>
            )
          )}

          {listTab === 'LATE' && (
            lateRecords.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Belum ada siswa terlambat hari ini.</p>
            ) : (
              <div className="space-y-2">
                {lateRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-bold text-slate-900">{r.studentName} ({r.className})</p>
                      <p className="text-slate-500">Scan: {r.morningTimeWib} WIB • Terlambat {r.morningLateMinutes || 0} menit</p>
                    </div>
                    <StatusBadge status="TERLAMBAT" />
                  </div>
                ))}
              </div>
            )
          )}

          {listTab === 'ABSENT' && (
            absentStudents.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Seluruh siswa aktif sudah tercatat hadir.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {absentStudents.slice(0, 60).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-semibold text-slate-900">{s.fullName}</p>
                      <p className="text-[11px] text-slate-500">{s.nis} • {s.className}</p>
                    </div>
                    <StatusBadge status="BELUM_ABSEN" />
                  </div>
                ))}
              </div>
            )
          )}

          {listTab === 'HISTORY' && (
            myLogs.length === 0 ? (
              <p className="py-6 text-center text-slate-400">Belum ada riwayat aktivitas piket.</p>
            ) : (
              <div className="space-y-2">
                {myLogs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="font-semibold text-slate-800">{l.description}</p>
                      <p className="font-mono text-[11px] text-slate-400">{formatTimestampWib(l.timestamp)}</p>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold">{l.action}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
