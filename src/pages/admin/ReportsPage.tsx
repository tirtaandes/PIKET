import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { getTodayWibDate, PERMISSION_TYPE_LABELS } from '../../lib/time';
import { exportRowsToExcel } from '../../lib/excel';
import { exportReportToPdf } from '../../lib/pdfReport';
import { useAuth } from '../../contexts/AuthContext';
import type {
  AcademicYear,
  AttendanceRecord,
  DutySchedule,
  ExitLog,
  Major,
  PermissionRequest,
  SchoolClass,
  Student
} from '../../types';

export type ReportKind =
  | 'HARIAN'
  | 'PAGI'
  | 'SORE'
  | 'PER_KELAS'
  | 'PER_SISWA'
  | 'BULANAN'
  | 'TAHUNAN'
  | 'TERLAMBAT'
  | 'TIDAK_HADIR'
  | 'RIWAYAT_IZIN'
  | 'RIWAYAT_KELUAR'
  | 'REKAP_PIKET';

const REPORT_LABELS: Record<ReportKind, string> = {
  HARIAN: '1. Laporan Absensi Harian',
  PAGI: '2. Laporan Absensi Pagi',
  SORE: '3. Laporan Absensi Sore (Pulang)',
  PER_KELAS: '4. Rekap Absensi Per Kelas',
  PER_SISWA: '5. Rekap Absensi Per Siswa',
  BULANAN: '6. Rekap Kehadiran Bulanan',
  TAHUNAN: '7. Rekap Kehadiran Tahunan',
  TERLAMBAT: '8. Laporan Siswa Terlambat',
  TIDAK_HADIR: '9. Laporan Siswa Tidak Hadir',
  RIWAYAT_IZIN: '10. Laporan Riwayat Izin Siswa',
  RIWAYAT_KELUAR: '11. Laporan Riwayat Keluar Sekolah',
  REKAP_PIKET: '12. Rekap Tugas Guru Piket'
};

interface ReportsPageProps {
  scopedClassId?: string;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ scopedClassId }) => {
  const { school } = useAuth();

  const today = getTodayWibDate();
  const [reportKind, setReportKind] = useState<ReportKind>('HARIAN');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [classId, setClassId] = useState(scopedClassId || '');
  const [majorId, setMajorId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);

  useEffect(() => {
    const db = requireDb();
    const unsubs = [
      onSnapshot(collection(db, 'attendance'), (s) =>
        setAttendance(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })))
      ),
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })))
      ),
      onSnapshot(collection(db, 'classes'), (s) =>
        setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
      ),
      onSnapshot(collection(db, 'majors'), (s) =>
        setMajors(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Major, 'id'>) })))
      ),
      onSnapshot(collection(db, 'academic_years'), (s) =>
        setYears(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })))
      ),
      onSnapshot(collection(db, 'permission_requests'), (s) =>
        setPermissions(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequest, 'id'>) })))
      ),
      onSnapshot(collection(db, 'exit_logs'), (s) =>
        setExitLogs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExitLog, 'id'>) })))
      )
    ];
    if (!scopedClassId) {
      unsubs.push(
        onSnapshot(collection(db, 'duty_schedules'), (s) =>
          setSchedules(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DutySchedule, 'id'>) })))
        )
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [scopedClassId]);

  const effectiveClassId = scopedClassId || classId;

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (a.date < startDate || a.date > endDate) return false;
      if (effectiveClassId && a.classId !== effectiveClassId) return false;
      if (majorId && a.majorId !== majorId) return false;
      if (academicYearId && a.academicYearId !== academicYearId) return false;
      return true;
    });
  }, [attendance, startDate, endDate, effectiveClassId, majorId, academicYearId]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (!s.active) return false;
      if (effectiveClassId && s.classId !== effectiveClassId) return false;
      if (majorId && s.majorId !== majorId) return false;
      if (academicYearId && s.academicYearId !== academicYearId) return false;
      return true;
    });
  }, [students, effectiveClassId, majorId, academicYearId]);

  const tableModel = useMemo<{ columns: string[]; rows: (string | number)[][] }>(() => {
    switch (reportKind) {
      case 'HARIAN':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Status Pagi', 'Jam Pagi', 'Status Sore', 'Jam Sore'],
          rows: filteredAttendance.map((a) => [
            a.date,
            a.nis,
            a.studentName,
            a.className,
            a.morningStatus,
            a.morningTimeWib || '-',
            a.afternoonStatus,
            a.afternoonTimeWib || '-'
          ])
        };
      case 'PAGI':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Status Pagi', 'Waktu Scan', 'Terlambat (mnt)', 'Guru Piket'],
          rows: filteredAttendance.map((a) => [
            a.date,
            a.nis,
            a.studentName,
            a.className,
            a.morningStatus,
            a.morningTimeWib || '-',
            a.morningLateMinutes || 0,
            a.morningTeacherName || '-'
          ])
        };
      case 'SORE':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Status Sore', 'Waktu Pulang', 'Peringatan Pagi', 'Guru Piket'],
          rows: filteredAttendance.map((a) => [
            a.date,
            a.nis,
            a.studentName,
            a.className,
            a.afternoonStatus,
            a.afternoonTimeWib || '-',
            a.missingMorningWarning ? 'Belum Absen Pagi' : 'OK',
            a.afternoonTeacherName || '-'
          ])
        };
      case 'PER_KELAS': {
        const clsList = effectiveClassId ? classes.filter((c) => c.id === effectiveClassId) : classes;
        return {
          columns: ['Kelas', 'Jurusan', 'Total Siswa', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Pulang Sore'],
          rows: clsList.map((c) => {
            const recs = filteredAttendance.filter((a) => a.classId === c.id);
            const totalStu = students.filter((s) => s.active && s.classId === c.id).length;
            return [
              c.name,
              c.majorName,
              totalStu,
              recs.filter((r) => r.morningStatus === 'HADIR').length,
              recs.filter((r) => r.morningStatus === 'TERLAMBAT').length,
              recs.filter((r) => r.morningStatus === 'IZIN').length,
              recs.filter((r) => r.morningStatus === 'SAKIT').length,
              recs.filter((r) => r.morningStatus === 'ALPA').length,
              recs.filter((r) => r.afternoonStatus === 'PULANG').length
            ];
          })
        };
      }
      case 'PER_SISWA':
        return {
          columns: ['NIS', 'Nama Siswa', 'Kelas', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Total Pulang Sore'],
          rows: filteredStudents.map((s) => {
            const recs = filteredAttendance.filter((a) => a.studentId === s.id);
            return [
              s.nis,
              s.fullName,
              s.className,
              recs.filter((r) => r.morningStatus === 'HADIR').length,
              recs.filter((r) => r.morningStatus === 'TERLAMBAT').length,
              recs.filter((r) => r.morningStatus === 'IZIN').length,
              recs.filter((r) => r.morningStatus === 'SAKIT').length,
              recs.filter((r) => r.morningStatus === 'ALPA').length,
              recs.filter((r) => r.afternoonStatus === 'PULANG').length
            ];
          })
        };
      case 'BULANAN': {
        const grouped = new Map<string, AttendanceRecord[]>();
        for (const a of filteredAttendance) {
          const m = a.date.slice(0, 7);
          const arr = grouped.get(m) || [];
          arr.push(a);
          grouped.set(m, arr);
        }
        return {
          columns: ['Bulan', 'Total Catatan', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Pulang Sore'],
          rows: Array.from(grouped.entries()).map(([month, arr]) => [
            month,
            arr.length,
            arr.filter((r) => r.morningStatus === 'HADIR').length,
            arr.filter((r) => r.morningStatus === 'TERLAMBAT').length,
            arr.filter((r) => r.morningStatus === 'IZIN').length,
            arr.filter((r) => r.morningStatus === 'SAKIT').length,
            arr.filter((r) => r.morningStatus === 'ALPA').length,
            arr.filter((r) => r.afternoonStatus === 'PULANG').length
          ])
        };
      }
      case 'TAHUNAN': {
        const grouped = new Map<string, AttendanceRecord[]>();
        for (const a of filteredAttendance) {
          const y = a.academicYearName || a.date.slice(0, 4);
          const arr = grouped.get(y) || [];
          arr.push(a);
          grouped.set(y, arr);
        }
        return {
          columns: ['Tahun / TP', 'Total Catatan', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa', 'Pulang Sore'],
          rows: Array.from(grouped.entries()).map(([yr, arr]) => [
            yr,
            arr.length,
            arr.filter((r) => r.morningStatus === 'HADIR').length,
            arr.filter((r) => r.morningStatus === 'TERLAMBAT').length,
            arr.filter((r) => r.morningStatus === 'IZIN').length,
            arr.filter((r) => r.morningStatus === 'SAKIT').length,
            arr.filter((r) => r.morningStatus === 'ALPA').length,
            arr.filter((r) => r.afternoonStatus === 'PULANG').length
          ])
        };
      }
      case 'TERLAMBAT':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Jam Scan', 'Keterlambatan (mnt)', 'Guru Piket'],
          rows: filteredAttendance
            .filter((a) => a.morningStatus === 'TERLAMBAT')
            .map((a) => [
              a.date,
              a.nis,
              a.studentName,
              a.className,
              a.morningTimeWib || '-',
              a.morningLateMinutes || 0,
              a.morningTeacherName || '-'
            ])
        };
      case 'TIDAK_HADIR': {
        const presentIds = new Set(
          filteredAttendance
            .filter((a) => a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT')
            .map((a) => a.studentId)
        );
        return {
          columns: ['NIS', 'Nama Siswa', 'Kelas', 'Jurusan', 'Keterangan'],
          rows: filteredStudents
            .filter((s) => !presentIds.has(s.id))
            .map((s) => {
              const rec = filteredAttendance.find((a) => a.studentId === s.id);
              return [s.nis, s.fullName, s.className, s.majorName, rec?.morningStatus || 'BELUM ABSEN / ALPA'];
            })
        };
      }
      case 'RIWAYAT_IZIN':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Jenis Izin', 'Alasan', 'Jam', 'Status', 'Wali Kelas'],
          rows: permissions
            .filter(
              (p) =>
                p.date >= startDate &&
                p.date <= endDate &&
                (!effectiveClassId || p.classId === effectiveClassId)
            )
            .map((p) => [
              p.date,
              p.nis,
              p.studentName,
              p.className,
              PERMISSION_TYPE_LABELS[p.type] || p.type,
              p.reason,
              `${p.startTime} - ${p.estimatedReturnTime}`,
              p.status,
              p.approvedByName || '-'
            ])
        };
      case 'RIWAYAT_KELUAR':
        return {
          columns: ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Alasan', 'Keluar', 'Kembali', 'Status', 'Guru Piket'],
          rows: exitLogs
            .filter(
              (e) =>
                e.date >= startDate &&
                e.date <= endDate &&
                (!effectiveClassId || e.classId === effectiveClassId)
            )
            .map((e) => [
              e.date,
              e.nis,
              e.studentName,
              e.className,
              e.reason,
              e.exitTimeWib || '-',
              e.returnTimeWib || 'Belum Kembali',
              e.status,
              e.exitTeacherName || '-'
            ])
        };
      case 'REKAP_PIKET': {
        const map = new Map<string, { name: string; pagi: number; sore: number; keluar: number }>();
        for (const a of filteredAttendance) {
          if (a.morningTeacherName) {
            const cur = map.get(a.morningTeacherName) || { name: a.morningTeacherName, pagi: 0, sore: 0, keluar: 0 };
            cur.pagi += 1;
            map.set(a.morningTeacherName, cur);
          }
          if (a.afternoonTeacherName) {
            const cur = map.get(a.afternoonTeacherName) || { name: a.afternoonTeacherName, pagi: 0, sore: 0, keluar: 0 };
            cur.sore += 1;
            map.set(a.afternoonTeacherName, cur);
          }
        }
        for (const e of exitLogs.filter((x) => x.date >= startDate && x.date <= endDate)) {
          if (e.exitTeacherName) {
            const cur = map.get(e.exitTeacherName) || { name: e.exitTeacherName, pagi: 0, sore: 0, keluar: 0 };
            cur.keluar += 1;
            map.set(e.exitTeacherName, cur);
          }
        }
        return {
          columns: ['Nama Guru Piket', 'Total Scan Pagi', 'Total Scan Sore', 'Total Scan Keluar', 'Total Aktivitas'],
          rows: Array.from(map.values()).map((v) => [
            v.name,
            v.pagi,
            v.sore,
            v.keluar,
            v.pagi + v.sore + v.keluar
          ])
        };
      }
    }
  }, [reportKind, filteredAttendance, filteredStudents, classes, students, permissions, exitLogs, startDate, endDate, effectiveClassId, schedules]);

  const availableReportKinds = scopedClassId
    ? (Object.keys(REPORT_LABELS) as ReportKind[]).filter((k) => k !== 'REKAP_PIKET')
    : (Object.keys(REPORT_LABELS) as ReportKind[]);

  const handleExportPdf = () => {
    exportReportToPdf({
      title: REPORT_LABELS[reportKind],
      subtitle: `Periode: ${startDate} s.d. ${endDate}`,
      school,
      columns: tableModel.columns,
      rows: tableModel.rows,
      fileName: `Laporan_${reportKind}_${startDate}_${endDate}.pdf`
    });
  };

  const handleExportExcel = () => {
    const jsonRows = tableModel.rows.map((r) => {
      const obj: Record<string, unknown> = {};
      tableModel.columns.forEach((col, i) => {
        obj[col] = r[i];
      });
      return obj;
    });
    exportRowsToExcel(jsonRows, reportKind, `Laporan_${reportKind}_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">
            {scopedClassId ? 'Laporan Kehadiran Kelas' : 'Pusat Laporan Sekolah'}
          </h1>
          <p className="text-xs text-slate-500">
            Ekspor PDF berkop surat SMKN 6 Muaro Jambi, Excel, atau cetak langsung.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportPdf} className="btn-primary">
            <FileDown className="h-4 w-4" />
            Unduh PDF
          </button>
          <button onClick={handleExportExcel} className="btn-success">
            <FileSpreadsheet className="h-4 w-4" />
            Unduh Excel
          </button>
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="h-4 w-4" />
            Print Langsung
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Jenis Laporan</label>
          <select
            value={reportKind}
            onChange={(e) => setReportKind(e.target.value as ReportKind)}
            className="input-field"
          >
            {availableReportKinds.map((k) => (
              <option key={k} value={k}>{REPORT_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Dari Tanggal</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Sampai Tanggal</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
        </div>
        {!scopedClassId && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Kelas</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input-field">
              <option value="">Semua Kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {!scopedClassId && (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jurusan</label>
              <select value={majorId} onChange={(e) => setMajorId(e.target.value)} className="input-field">
                <option value="">Semua Jurusan</option>
                {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tahun Pelajaran</label>
              <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} className="input-field">
                <option value="">Semua TP</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name} ({y.semester})</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Printable Official Kop Surat + Report Table */}
      <div className="card overflow-hidden p-6">
        <div className="mb-5 border-b-2 border-navy-950 pb-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src={school.logoUrl || '/school-logo-default.svg'}
              alt="Logo"
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                PEMERINTAH PROVINSI JAMBI — DINAS PENDIDIKAN
              </p>
              <h2 className="text-lg font-extrabold uppercase text-navy-950">{school.schoolName}</h2>
              <p className="text-xs text-slate-500">
                {school.address} • {school.contact}
              </p>
            </div>
          </div>
          <h3 className="mt-4 text-sm font-extrabold uppercase text-navy-900">
            {REPORT_LABELS[reportKind]}
          </h3>
          <p className="text-xs text-slate-500">
            Periode: {startDate} s.d. {endDate} ({tableModel.rows.length} baris)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-navy-950 text-white">
              <tr>
                {tableModel.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2.5 text-left font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableModel.rows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {tableModel.rows.length === 0 && (
                <tr>
                  <td colSpan={tableModel.columns.length} className="px-3 py-8 text-center text-slate-400">
                    Tidak ada data pada filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
