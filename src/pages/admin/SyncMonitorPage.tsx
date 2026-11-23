import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { formatTimestampWib } from '../../lib/time';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AttendanceRecord, DeviceRecord } from '../../types';

export const SyncMonitorPage: React.FC = () => {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [flagged, setFlagged] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'devices'), (s) =>
      setDevices(s.docs.map((d) => ({ deviceId: d.id, ...(d.data() as Omit<DeviceRecord, 'deviceId'>) })))
    );
    const u2 = onSnapshot(
      query(collection(db, 'attendance'), where('flaggedForReview', '==', true)),
      (s) =>
        setFlagged(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Monitor Perangkat & Sinkronisasi Offline</h1>
        <p className="text-xs text-slate-500">
          Pantau perangkat scanner yang memiliki otorisasi offline serta transaksi dengan selisih jam mencurigakan.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-navy-950">
          <Smartphone className="h-4 w-4 text-sky-600" />
          Perangkat Scanner Terdaftar ({devices.length})
        </h2>
        <DataTable
          data={devices}
          keyExtractor={(d) => d.deviceId}
          searchableText={(d) => `${d.deviceId} ${d.deviceName} ${d.lastTeacherName || ''}`}
          columns={[
            {
              key: 'device',
              header: 'Perangkat',
              render: (d) => (
                <div>
                  <p className="font-semibold text-slate-900">{d.deviceName}</p>
                  <p className="font-mono text-xs text-slate-500">{d.deviceId}</p>
                </div>
              )
            },
            {
              key: 'teacher',
              header: 'Guru Piket Terakhir',
              render: (d) => d.lastTeacherName || '-'
            },
            {
              key: 'auth',
              header: 'Batas Otorisasi Offline',
              render: (d) => (
                <span className="font-mono text-xs">
                  {d.offlineAuthExpiresAt ? formatTimestampWib(d.offlineAuthExpiresAt) : '-'}
                </span>
              )
            },
            {
              key: 'sync',
              header: 'Ringkasan Sinkronisasi Terakhir',
              render: (d) =>
                d.lastSyncSummary ? (
                  <div className="text-xs">
                    <span className="font-semibold text-emerald-700">{d.lastSyncSummary.syncedCount} ok</span> •{' '}
                    <span className="text-slate-500">{d.lastSyncSummary.duplicateCount} dup</span> •{' '}
                    <span className="text-rose-600">{d.lastSyncSummary.rejectedCount} tolak</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Belum ada sinkronisasi</span>
                )
            },
            {
              key: 'clock',
              header: 'Status Jam Perangkat',
              render: (d) =>
                d.hasSuspiciousClock ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Mencurigakan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Normal
                  </span>
                )
            }
          ]}
        />
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          Transaksi Offline Ditandai untuk Pemeriksaan Admin ({flagged.length})
        </h2>
        <DataTable
          data={flagged}
          keyExtractor={(r) => r.id}
          emptyTitle="Tidak ada transaksi mencurigakan"
          emptyDescription="Semua sinkronisasi offline berada dalam batas toleransi waktu perangkat."
          columns={[
            { key: 'date', header: 'Tanggal', render: (r) => <span className="font-mono text-xs">{r.date}</span> },
            {
              key: 'student',
              header: 'Siswa',
              render: (r) => (
                <div>
                  <p className="font-semibold">{r.studentName}</p>
                  <p className="text-xs text-slate-500">{r.nis} • {r.className}</p>
                </div>
              )
            },
            {
              key: 'skew',
              header: 'Selisih Jam Perangkat',
              render: (r) => <StatusBadge status="FAILED" label={`${r.clockSkewSeconds || 0} detik`} />
            },
            {
              key: 'local',
              header: 'Waktu Lokal Perangkat',
              render: (r) => <span className="font-mono text-xs">{r.deviceLocalTimeIso || '-'}</span>
            },
            {
              key: 'teacher',
              header: 'Petugas & Perangkat',
              render: (r) => (
                <div className="text-xs">
                  <p>{r.morningTeacherName || r.afternoonTeacherName || '-'}</p>
                  <p className="font-mono text-slate-500">{r.morningDeviceId || '-'}</p>
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};
