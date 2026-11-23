import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Users,
  GraduationCap,
  Layers,
  CheckCircle2,
  Clock,
  FileCheck2,
  HeartPulse,
  UserX,
  UserMinus,
  LogOut,
  CalendarCheck2,
  AlertTriangle
} from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { formatIndonesianDate, getTodayWibDate } from '../../lib/time';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import type {
  AttendanceRecord,
  DutySchedule,
  ExitLog,
  PermissionRequest,
  SchoolClass,
  Student,
  Teacher
} from '../../types';

const PIE_COLORS = ['#10b981', '#f59e0b', '#0ea5e9', '#6366f1', '#f43f5e'];

export const AdminDashboard: React.FC = () => {
  const today = getTodayWibDate();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [attendanceAll, setAttendanceAll] = useState<AttendanceRecord[]>([]);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);

  useEffect(() => {
    const db = requireDb();
    const unsubs = [
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })))
      ),
      onSnapshot(collection(db, 'teachers'), (s) =>
        setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) })))
      ),
      onSnapshot(collection(db, 'classes'), (s) =>
        setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
      ),
      onSnapshot(collection(db, 'attendance'), (s) =>
        setAttendanceAll(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
        )
      ),
      onSnapshot(
        query(collection(db, 'exit_logs'), where('status', '==', 'SUDAH_KELUAR')),
        (s) =>
          setExitLogs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExitLog, 'id'>) })))
      ),
      onSnapshot(collection(db, 'permission_requests'), (s) =>
        setPermissions(
          s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequest, 'id'>) }))
        )
      ),
      onSnapshot(query(collection(db, 'duty_schedules'), where('active', '==', true)), (s) =>
        setSchedules(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DutySchedule, 'id'>) })))
      )
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const activeStudents = useMemo(() => students.filter((s) => s.active), [students]);
  const todayAttendance = useMemo(
    () => attendanceAll.filter((a) => a.date === today),
    [attendanceAll, today]
  );

  const stats = useMemo(() => {
    const hadir = todayAttendance.filter((a) => a.morningStatus === 'HADIR').length;
    const terlambat = todayAttendance.filter((a) => a.morningStatus === 'TERLAMBAT').length;
    const izin = todayAttendance.filter((a) => a.morningStatus === 'IZIN').length;
    const sakit = todayAttendance.filter((a) => a.morningStatus === 'SAKIT').length;
    const alpa = todayAttendance.filter((a) => a.morningStatus === 'ALPA').length;
    const recordedMorning = hadir + terlambat + izin + sakit + alpa;
    const belumHadir = Math.max(0, activeStudents.length - recordedMorning);
    const hadirSore = todayAttendance.filter((a) => a.afternoonStatus === 'PULANG').length;
    const belumSore = Math.max(0, activeStudents.length - hadirSore);

    // Count distinct teachers scheduled today
    const nowDay = new Date(`${today}T00:00:00+07:00`).getDay();
    const activeTeacherSet = new Set<string>();
    for (const sch of schedules) {
      if (
        (sch.type === 'MINGGUAN' && sch.daysOfWeek?.includes(nowDay)) ||
        ((sch.type === 'HARIAN' || sch.type === 'TANGGAL') && sch.date === today)
      ) {
        sch.teacherIds?.forEach((tid) => activeTeacherSet.add(tid));
      }
    }

    return {
      totalSiswa: activeStudents.length,
      totalGuru: teachers.filter((t) => t.active).length,
      totalKelas: classes.filter((c) => c.active).length,
      hadirPagi: hadir + terlambat,
      tepatWaktu: hadir,
      terlambat,
      izin,
      sakit,
      alpa,
      belumHadir,
      hadirSore,
      belumSore,
      sedangKeluar: exitLogs.length,
      guruPiketAktif: activeTeacherSet.size
    };
  }, [activeStudents, todayAttendance, teachers, classes, exitLogs, schedules, today]);

  // 7-day daily attendance & late chart
  const dailyChartData = useMemo(() => {
    const days: string[] = [];
    const base = new Date(`${today}T12:00:00+07:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base.getTime() - i * 86400000);
      days.push(getTodayWibDate(d));
    }
    return days.map((dateStr) => {
      const list = attendanceAll.filter((a) => a.date === dateStr);
      return {
        date: dateStr.slice(5),
        Hadir: list.filter((a) => a.morningStatus === 'HADIR').length,
        Terlambat: list.filter((a) => a.morningStatus === 'TERLAMBAT').length,
        Sore: list.filter((a) => a.afternoonStatus === 'PULANG').length
      };
    });
  }, [attendanceAll, today]);

  // Monthly attendance chart (grouped by YYYY-MM)
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { month: string; Pagi: number; Sore: number; Terlambat: number }>();
    for (const a of attendanceAll) {
      const m = a.date.slice(0, 7);
      const cur = map.get(m) || { month: m, Pagi: 0, Sore: 0, Terlambat: 0 };
      if (a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT') cur.Pagi += 1;
      if (a.morningStatus === 'TERLAMBAT') cur.Terlambat += 1;
      if (a.afternoonStatus === 'PULANG') cur.Sore += 1;
      map.set(m, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [attendanceAll]);

  // Per-class attendance today
  const perClassData = useMemo(() => {
    return classes
      .filter((c) => c.active)
      .map((c) => {
        const list = todayAttendance.filter((a) => a.classId === c.id);
        const totalInClass = activeStudents.filter((s) => s.classId === c.id).length;
        const hadir = list.filter(
          (a) => a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT'
        ).length;
        return {
          kelas: c.name,
          Hadir: hadir,
          Belum: Math.max(0, totalInClass - hadir)
        };
      })
      .slice(0, 12);
  }, [classes, todayAttendance, activeStudents]);

  // Permission statistics pie
  const permissionPieData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of permissions) {
      counts.set(p.type, (counts.get(p.type) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value
    }));
  }, [permissions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Dashboard Monitoring Sekolah</h1>
          <p className="text-xs text-slate-500">
            Data real-time kehadiran siswa • {formatIndonesianDate(today)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live Firestore Sync
        </span>
      </div>

      {/* Primary KPI Grid (All 13 stats) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard title="Total Siswa" value={stats.totalSiswa} icon={<GraduationCap className="h-5 w-5" />} tone="navy" />
        <StatCard title="Total Guru" value={stats.totalGuru} icon={<Users className="h-5 w-5" />} tone="sky" />
        <StatCard title="Total Kelas" value={stats.totalKelas} icon={<Layers className="h-5 w-5" />} tone="slate" />
        <StatCard
          title="Hadir Pagi"
          value={stats.hadirPagi}
          subtitle={`${stats.tepatWaktu} tepat waktu`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard title="Terlambat" value={stats.terlambat} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard title="Izin" value={stats.izin} icon={<FileCheck2 className="h-5 w-5" />} tone="sky" />
        <StatCard title="Sakit" value={stats.sakit} icon={<HeartPulse className="h-5 w-5" />} tone="sky" />
        <StatCard title="Alpa" value={stats.alpa} icon={<UserX className="h-5 w-5" />} tone="rose" />
        <StatCard title="Belum Hadir" value={stats.belumHadir} icon={<UserMinus className="h-5 w-5" />} tone="slate" />
        <StatCard title="Hadir Sore" value={stats.hadirSore} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Belum Absen Sore" value={stats.belumSore} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard title="Sedang Keluar" value={stats.sedangKeluar} icon={<LogOut className="h-5 w-5" />} tone="rose" />
        <StatCard
          title="Guru Piket Aktif"
          value={stats.guruPiketAktif}
          icon={<CalendarCheck2 className="h-5 w-5" />}
          tone="navy"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy-950">
            Kehadiran Harian, Keterlambatan & Perbandingan Pagi vs Sore (7 Hari)
          </h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Terlambat" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sore" fill="#0f2544" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy-950">Kehadiran Per Kelas Hari Ini</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perClassData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="kelas" fontSize={11} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Hadir" stackId="a" fill="#2552eb" />
                <Bar dataKey="Belum" stackId="a" fill="#cbd5e1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy-950">Tren Kehadiran Bulanan (Pagi, Sore & Terlambat)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Pagi" stroke="#10b981" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Sore" stroke="#0f2544" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Terlambat" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy-950">Statistik Jenis Izin Siswa</h3>
          <div className="mt-4 h-64">
            {permissionPieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Belum ada data permohonan izin.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={permissionPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label
                  >
                    {permissionPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Students Currently Outside School */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-950">
            Siswa Sedang di Luar Sekolah (Real-Time)
          </h3>
          <StatusBadge status="SUDAH_KELUAR" label={`${exitLogs.length} Siswa`} />
        </div>
        {exitLogs.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">
            Tidak ada siswa yang sedang berada di luar sekolah saat ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Siswa</th>
                  <th className="px-3 py-2 text-left">Kelas</th>
                  <th className="px-3 py-2 text-left">Alasan</th>
                  <th className="px-3 py-2 text-left">Keluar</th>
                  <th className="px-3 py-2 text-left">Perkiraan Kembali</th>
                  <th className="px-3 py-2 text-left">Disetujui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exitLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {log.studentName} <span className="text-xs text-slate-500">({log.nis})</span>
                    </td>
                    <td className="px-3 py-2">{log.className}</td>
                    <td className="px-3 py-2 text-xs">{log.reason}</td>
                    <td className="px-3 py-2 font-mono text-xs">{log.exitTimeWib || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{log.estimatedReturnTime}</td>
                    <td className="px-3 py-2 text-xs">{log.approvedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
