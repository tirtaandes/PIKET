import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Users, CheckCircle2, Clock, UserMinus, LogOut, FileCheck2 } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { formatIndonesianDate, getTodayWibDate } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DataTable } from '../../components/common/DataTable';
import type { AttendanceRecord, ExitLog, Student } from '../../types';

export const WaliKelasDashboard: React.FC = () => {
  const { profile } = useAuth();
  const today = getTodayWibDate();
  const classId = profile?.assignedClassId || '';

  const [students, setStudents] = useState<Student[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [outsideList, setOutsideList] = useState<ExitLog[]>([]);
  const [tab, setTab] = useState<'ALL' | 'LATE' | 'ABSENT' | 'OUTSIDE'>('ALL');

  useEffect(() => {
    if (!classId) return;
    const db = requireDb();
    // Strictly scoped to assignedClassId (enforced by Firestore Security Rules)
    const unsubs = [
      onSnapshot(query(collection(db, 'students'), where('classId', '==', classId)), (s) =>
        setStudents(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
            .filter((stu) => stu.active)
        )
      ),
      onSnapshot(
        query(collection(db, 'attendance'), where('classId', '==', classId), where('date', '==', today)),
        (s) =>
          setTodayAttendance(
            s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
          )
      ),
      onSnapshot(
        query(collection(db, 'exit_logs'), where('classId', '==', classId), where('status', '==', 'SUDAH_KELUAR')),
        (s) => setOutsideList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExitLog, 'id'>) })))
      )
    ];
    return () => unsubs.forEach((u) => u());
  }, [classId, today]);

  const attByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const a of todayAttendance) map.set(a.studentId, a);
    return map;
  }, [todayAttendance]);

  const hadirCount = todayAttendance.filter(
    (a) => a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT'
  ).length;
  const lateList = todayAttendance.filter((a) => a.morningStatus === 'TERLAMBAT');
  const absentStudents = students.filter((s) => {
    const rec = attByStudent.get(s.id);
    return !rec || rec.morningStatus === 'BELUM_ABSEN' || rec.morningStatus === 'ALPA';
  });

  if (!classId) {
    return (
      <div className="card p-6 text-center text-sm text-rose-700">
        Akun Wali Kelas Anda belum ditugaskan pada kelas tertentu. Hubungi Administrator.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
            Dashboard Wali Kelas • {formatIndonesianDate(today)}
          </p>
          <h1 className="text-2xl font-extrabold text-navy-950">
            Kelas {profile?.assignedClassName || classId}
          </h1>
          <p className="text-xs text-slate-500">Wali Kelas: {profile?.displayName}</p>
        </div>
        <Link to="/walikelas/permissions" className="btn-primary self-start">
          <FileCheck2 className="h-4 w-4" />
          Kelola & Setujui Izin Siswa
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard title="Total Siswa" value={students.length} icon={<Users className="h-5 w-5" />} tone="navy" />
        <StatCard title="Hadir Hari Ini" value={hadirCount} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="Terlambat" value={lateList.length} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard title="Tidak / Belum Hadir" value={absentStudents.length} icon={<UserMinus className="h-5 w-5" />} tone="rose" />
        <StatCard title="Sedang Keluar" value={outsideList.length} icon={<LogOut className="h-5 w-5" />} tone="sky" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setTab('ALL')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${tab === 'ALL' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600'}`}>
          Semua Siswa Kelas ({students.length})
        </button>
        <button onClick={() => setTab('LATE')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${tab === 'LATE' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'}`}>
          Terlambat ({lateList.length})
        </button>
        <button onClick={() => setTab('ABSENT')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${tab === 'ABSENT' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'}`}>
          Tidak / Belum Hadir ({absentStudents.length})
        </button>
        <button onClick={() => setTab('OUTSIDE')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${tab === 'OUTSIDE' ? 'bg-sky-700 text-white' : 'bg-white text-slate-600'}`}>
          Sedang di Luar ({outsideList.length})
        </button>
      </div>

      {tab === 'ALL' && (
        <DataTable
          data={students}
          keyExtractor={(s) => s.id}
          searchableText={(s) => `${s.nis} ${s.fullName}`}
          columns={[
            {
              key: 'name',
              header: 'Siswa',
              render: (s) => (
                <div>
                  <p className="font-semibold text-slate-900">{s.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">NIS: {s.nis}</p>
                </div>
              )
            },
            {
              key: 'morning',
              header: 'Status Pagi',
              render: (s) => {
                const rec = attByStudent.get(s.id);
                return (
                  <div className="space-y-0.5">
                    <StatusBadge status={rec?.morningStatus || 'BELUM_ABSEN'} />
                    {rec?.morningTimeWib && <p className="font-mono text-[11px] text-slate-500">{rec.morningTimeWib}</p>}
                  </div>
                );
              }
            },
            {
              key: 'afternoon',
              header: 'Status Sore',
              render: (s) => {
                const rec = attByStudent.get(s.id);
                return (
                  <div className="space-y-0.5">
                    <StatusBadge status={rec?.afternoonStatus || 'BELUM_ABSEN'} />
                    {rec?.afternoonTimeWib && <p className="font-mono text-[11px] text-slate-500">{rec.afternoonTimeWib}</p>}
                  </div>
                );
              }
            },
            {
              key: 'contact',
              header: 'Orang Tua / HP',
              render: (s) => (
                <div className="text-xs">
                  <p>{s.parentName || '-'}</p>
                  <p className="text-slate-500">{s.phone || '-'}</p>
                </div>
              )
            }
          ]}
        />
      )}

      {tab === 'LATE' && (
        <DataTable
          data={lateList}
          keyExtractor={(r) => r.id}
          emptyTitle="Tidak ada siswa terlambat hari ini"
          columns={[
            { key: 'nis', header: 'NIS', render: (r) => <span className="font-mono text-xs">{r.nis}</span> },
            { key: 'name', header: 'Nama', render: (r) => <span className="font-semibold">{r.studentName}</span> },
            { key: 'time', header: 'Jam Scan', render: (r) => <span className="font-mono text-xs">{r.morningTimeWib}</span> },
            { key: 'late', header: 'Terlambat', render: (r) => <StatusBadge status="TERLAMBAT" label={`${r.morningLateMinutes || 0} menit`} /> }
          ]}
        />
      )}

      {tab === 'ABSENT' && (
        <DataTable
          data={absentStudents}
          keyExtractor={(s) => s.id}
          emptyTitle="Semua siswa di kelas Anda hadir hari ini"
          columns={[
            { key: 'nis', header: 'NIS', render: (s) => <span className="font-mono text-xs">{s.nis}</span> },
            { key: 'name', header: 'Nama', render: (s) => <span className="font-semibold">{s.fullName}</span> },
            { key: 'parent', header: 'Orang Tua', render: (s) => s.parentName || '-' },
            { key: 'phone', header: 'Telepon', render: (s) => s.phone || '-' }
          ]}
        />
      )}

      {tab === 'OUTSIDE' && (
        <DataTable
          data={outsideList}
          keyExtractor={(e) => e.id}
          emptyTitle="Tidak ada siswa kelas Anda yang sedang berada di luar sekolah"
          columns={[
            { key: 'name', header: 'Siswa', render: (e) => <span className="font-semibold">{e.studentName} ({e.nis})</span> },
            { key: 'reason', header: 'Alasan', render: (e) => e.reason },
            { key: 'exit', header: 'Keluar', render: (e) => <span className="font-mono text-xs">{e.exitTimeWib}</span> },
            { key: 'est', header: 'Est. Kembali', render: (e) => <span className="font-mono text-xs">{e.estimatedReturnTime}</span> },
            { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> }
          ]}
        />
      )}
    </div>
  );
};
