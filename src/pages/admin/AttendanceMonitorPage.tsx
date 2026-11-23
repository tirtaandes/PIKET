import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { getTodayWibDate } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AttendanceRecord, MorningStatus, SchoolClass, Student } from '../../types';

export const AttendanceMonitorPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [date, setDate] = useState(getTodayWibDate());
  const [classId, setClassId] = useState('');
  const [viewTab, setViewTab] = useState<'RECORDED' | 'NOT_MORNING' | 'NOT_AFTERNOON' | 'FLAGGED'>('RECORDED');

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(query(collection(db, 'attendance'), where('date', '==', date)), (s) =>
      setRecords(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })))
    );
    const u2 = onSnapshot(collection(db, 'students'), (s) =>
      setStudents(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
          .filter((stu) => stu.active)
      )
    );
    const u3 = onSnapshot(collection(db, 'classes'), (s) =>
      setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
    );
    return () => {
      u1(); u2(); u3();
    };
  }, [date]);

  const filteredRecords = useMemo(
    () => records.filter((r) => (!classId ? true : r.classId === classId)),
    [records, classId]
  );

  const filteredStudents = useMemo(
    () => students.filter((s) => (!classId ? true : s.classId === classId)),
    [students, classId]
  );

  const notScannedMorning = useMemo(() => {
    const scanned = new Set(records.filter((r) => r.morningStatus !== 'BELUM_ABSEN').map((r) => r.studentId));
    return filteredStudents.filter((s) => !scanned.has(s.id));
  }, [filteredStudents, records]);

  const notScannedAfternoon = useMemo(() => {
    const scanned = new Set(records.filter((r) => r.afternoonStatus === 'PULANG').map((r) => r.studentId));
    return filteredStudents.filter((s) => !scanned.has(s.id));
  }, [filteredStudents, records]);

  const flaggedRecords = useMemo(
    () => filteredRecords.filter((r) => r.flaggedForReview),
    [filteredRecords]
  );

  const handleManualStatusUpdate = async (rec: AttendanceRecord, newMorningStatus: MorningStatus) => {
    try {
      await updateDoc(doc(requireDb(), 'attendance', rec.id), {
        morningStatus: newMorningStatus,
        manualOverride: true,
        correctedBy: profile?.uid || '',
        correctedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || '',
        updatedByName: profile?.displayName || ''
      });
      showToast('success', 'Status absensi diperbarui oleh Admin');
    } catch (err) {
      showToast('error', 'Gagal memperbarui status', err instanceof Error ? err.message : '');
    }
  };

  const handleClearFlag = async (rec: AttendanceRecord) => {
    try {
      await updateDoc(doc(requireDb(), 'attendance', rec.id), {
        flaggedForReview: false,
        reviewedBy: profile?.uid || '',
        reviewedByName: profile?.displayName || '',
        reviewedAt: serverTimestamp(),
        reviewNote: 'Diverifikasi oleh Admin',
        updatedAt: serverTimestamp()
      });
      showToast('success', 'Tanda pemeriksaan clock skew diselesaikan');
    } catch (err) {
      showToast('error', 'Gagal memverifikasi', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Monitor Absensi Pagi & Sore</h1>
          <p className="text-xs text-slate-500">
            Pantau kehadiran real-time, siswa belum absen pagi/sore, serta audit anomali jam perangkat offline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-44" />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="input-field w-44">
            <option value="">Semua Kelas</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setViewTab('RECORDED')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${viewTab === 'RECORDED' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600'}`}>
          Tercatat ({filteredRecords.length})
        </button>
        <button onClick={() => setViewTab('NOT_MORNING')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${viewTab === 'NOT_MORNING' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600'}`}>
          Belum Absen Pagi ({notScannedMorning.length})
        </button>
        <button onClick={() => setViewTab('NOT_AFTERNOON')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${viewTab === 'NOT_AFTERNOON' ? 'bg-navy-900 text-white' : 'bg-white text-slate-600'}`}>
          Belum Absen Sore ({notScannedAfternoon.length})
        </button>
        <button onClick={() => setViewTab('FLAGGED')} className={`rounded-lg px-3.5 py-2 text-xs font-bold ${viewTab === 'FLAGGED' ? 'bg-rose-600 text-white' : 'bg-white text-rose-700'}`}>
          Perlu Review ({flaggedRecords.length})
        </button>
      </div>

      {(viewTab === 'RECORDED' || viewTab === 'FLAGGED') && (
        <DataTable
          data={viewTab === 'FLAGGED' ? flaggedRecords : filteredRecords}
          keyExtractor={(r) => r.id}
          searchableText={(r) => `${r.nis} ${r.studentName} ${r.className}`}
          columns={[
            {
              key: 'student',
              header: 'Siswa',
              render: (r) => (
                <div>
                  <p className="font-semibold text-slate-900">{r.studentName}</p>
                  <p className="font-mono text-xs text-slate-500">{r.nis} • {r.className}</p>
                </div>
              )
            },
            {
              key: 'morning',
              header: 'Absensi Pagi',
              render: (r) => (
                <div className="space-y-1">
                  <StatusBadge status={r.morningStatus} />
                  <p className="font-mono text-[11px] text-slate-500">{r.morningTimeWib || '-'}</p>
                </div>
              )
            },
            {
              key: 'afternoon',
              header: 'Absensi Sore',
              render: (r) => (
                <div className="space-y-1">
                  <StatusBadge status={r.afternoonStatus} />
                  <p className="font-mono text-[11px] text-slate-500">{r.afternoonTimeWib || '-'}</p>
                  {r.missingMorningWarning && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> Tanpa scan pagi
                    </span>
                  )}
                </div>
              )
            },
            {
              key: 'meta',
              header: 'Mode & Petugas',
              render: (r) => (
                <div className="text-xs text-slate-600">
                  <p>Pagi: {r.morningTeacherName || '-'}</p>
                  <p>Sore: {r.afternoonTeacherName || '-'}</p>
                  {r.flaggedForReview && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                      Selisih jam: {r.clockSkewSeconds}s
                    </span>
                  )}
                </div>
              )
            },
            {
              key: 'action',
              header: 'Koreksi / Verifikasi',
              render: (r) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={r.morningStatus}
                    onChange={(e) => handleManualStatusUpdate(r, e.target.value as MorningStatus)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="HADIR">HADIR</option>
                    <option value="TERLAMBAT">TERLAMBAT</option>
                    <option value="IZIN">IZIN</option>
                    <option value="SAKIT">SAKIT</option>
                    <option value="ALPA">ALPA</option>
                    <option value="BELUM_ABSEN">BELUM ABSEN</option>
                  </select>
                  {r.flaggedForReview && (
                    <button
                      onClick={() => handleClearFlag(r)}
                      className="btn-success px-2 py-1 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verifikasi
                    </button>
                  )}
                </div>
              )
            }
          ]}
        />
      )}

      {(viewTab === 'NOT_MORNING' || viewTab === 'NOT_AFTERNOON') && (
        <DataTable
          data={viewTab === 'NOT_MORNING' ? notScannedMorning : notScannedAfternoon}
          keyExtractor={(s) => s.id}
          searchableText={(s) => `${s.nis} ${s.fullName} ${s.className}`}
          columns={[
            { key: 'nis', header: 'NIS', render: (s) => <span className="font-mono text-xs">{s.nis}</span> },
            { key: 'name', header: 'Nama Siswa', render: (s) => <span className="font-semibold">{s.fullName}</span> },
            { key: 'class', header: 'Kelas', render: (s) => s.className },
            {
              key: 'status',
              header: 'Status',
              render: () => (
                <StatusBadge
                  status="BELUM_ABSEN"
                  label={viewTab === 'NOT_MORNING' ? 'Belum Scan Pagi' : 'Belum Scan Sore'}
                />
              )
            }
          ]}
        />
      )}
    </div>
  );
};
