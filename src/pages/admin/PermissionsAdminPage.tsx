import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { requireDb } from '../../lib/firebase';
import { PERMISSION_TYPE_LABELS } from '../../lib/time';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { ExitLog, PermissionRequest } from '../../types';

export const PermissionsAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'OUTSIDE' | 'PERMISSIONS' | 'EXITS'>('OUTSIDE');
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [exitLogs, setExitLogs] = useState<ExitLog[]>([]);

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'permission_requests'), (s) =>
      setPermissions(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequest, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date))
      )
    );
    const u2 = onSnapshot(collection(db, 'exit_logs'), (s) =>
      setExitLogs(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ExitLog, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date))
      )
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  const currentlyOutside = exitLogs.filter((e) => e.status === 'SUDAH_KELUAR');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Monitoring Izin & Siswa Keluar Sekolah</h1>
        <p className="text-xs text-slate-500">
          Pantau seluruh pengajuan izin, persetujuan wali kelas, dan pergerakan siswa keluar-masuk gerbang.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setTab('OUTSIDE')} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'OUTSIDE' ? 'bg-amber-600 text-white' : 'bg-white text-slate-700'}`}>
          Sedang di Luar ({currentlyOutside.length})
        </button>
        <button onClick={() => setTab('PERMISSIONS')} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'PERMISSIONS' ? 'bg-navy-900 text-white' : 'bg-white text-slate-700'}`}>
          Semua Permohonan Izin ({permissions.length})
        </button>
        <button onClick={() => setTab('EXITS')} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === 'EXITS' ? 'bg-navy-900 text-white' : 'bg-white text-slate-700'}`}>
          Riwayat Keluar-Masuk ({exitLogs.length})
        </button>
      </div>

      {tab === 'PERMISSIONS' ? (
        <DataTable
          data={permissions}
          keyExtractor={(p) => p.id}
          searchableText={(p) => `${p.studentName} ${p.nis} ${p.className} ${p.reason} ${p.status}`}
          columns={[
            {
              key: 'date',
              header: 'Tanggal & Jam',
              render: (p) => (
                <div className="font-mono text-xs">
                  <p className="font-bold">{p.date}</p>
                  <p className="text-slate-500">{p.startTime} – {p.estimatedReturnTime}</p>
                </div>
              )
            },
            {
              key: 'student',
              header: 'Siswa',
              render: (p) => (
                <div>
                  <p className="font-semibold text-slate-900">{p.studentName}</p>
                  <p className="text-xs text-slate-500">{p.nis} • {p.className}</p>
                </div>
              )
            },
            {
              key: 'reason',
              header: 'Jenis & Alasan',
              render: (p) => (
                <div className="text-xs">
                  <p className="font-semibold text-navy-900">{PERMISSION_TYPE_LABELS[p.type] || p.type}</p>
                  <p className="text-slate-600">{p.reason}</p>
                </div>
              )
            },
            {
              key: 'approver',
              header: 'Wali Kelas / Persetujuan',
              render: (p) => <span className="text-xs">{p.approvedByName || p.requestedByName || '-'}</span>
            },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> }
          ]}
        />
      ) : (
        <DataTable
          data={tab === 'OUTSIDE' ? currentlyOutside : exitLogs}
          keyExtractor={(e) => e.id}
          searchableText={(e) => `${e.studentName} ${e.nis} ${e.className} ${e.reason}`}
          columns={[
            {
              key: 'student',
              header: 'Siswa',
              render: (e) => (
                <div>
                  <p className="font-semibold text-slate-900">{e.studentName}</p>
                  <p className="text-xs text-slate-500">{e.nis} • {e.className}</p>
                </div>
              )
            },
            {
              key: 'reason',
              header: 'Alasan & Penyetuju',
              render: (e) => (
                <div className="text-xs">
                  <p className="font-medium text-slate-800">{e.reason}</p>
                  <p className="text-slate-500">Disetujui: {e.approvedByName}</p>
                </div>
              )
            },
            {
              key: 'exit',
              header: 'Waktu Keluar',
              render: (e) => (
                <div className="text-xs">
                  <p className="font-mono font-bold">{e.date} {e.exitTimeWib || '-'}</p>
                  <p className="text-slate-500">Piket: {e.exitTeacherName || '-'}</p>
                </div>
              )
            },
            {
              key: 'return',
              header: 'Waktu Kembali',
              render: (e) => (
                <div className="text-xs">
                  <p className="font-mono font-bold">{e.returnTimeWib || 'Belum kembali'}</p>
                  <p className="text-slate-500">Est: {e.estimatedReturnTime}</p>
                </div>
              )
            },
            { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> }
          ]}
        />
      )}
    </div>
  );
};
