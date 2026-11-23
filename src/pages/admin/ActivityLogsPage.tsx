import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Shield } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { formatTimestampWib } from '../../lib/time';
import { DataTable } from '../../components/common/DataTable';
import type { ActivityLog } from '../../types';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    const db = requireDb();
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(300));
    return onSnapshot(q, (s) =>
      setLogs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) })))
    );
  }, []);

  const filtered = logs.filter((l) => (!actionFilter ? true : l.action === actionFilter));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Activity Log & Audit Keamanan</h1>
          <p className="text-xs text-slate-500">
            Catatan audit permanen yang ditulis oleh server. Tidak dapat diubah atau dihapus dari klien.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-900">
          <Shield className="h-3.5 w-3.5 text-sky-600" />
          Immutable Audit Trail
        </span>
      </div>

      <DataTable
        data={filtered}
        keyExtractor={(l) => l.id}
        searchableText={(l) => `${l.userName || ''} ${l.role} ${l.action} ${l.description} ${l.deviceId || ''}`}
        searchPlaceholder="Cari pengguna, aktivitas, atau perangkat..."
        toolbarRight={
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-field w-52"
          >
            <option value="">Semua Jenis Aktivitas</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="SCAN_PAGI">SCAN PAGI</option>
            <option value="SCAN_SORE">SCAN SORE</option>
            <option value="SCAN_KELUAR">SCAN KELUAR</option>
            <option value="SCAN_KEMBALI">SCAN KEMBALI</option>
            <option value="PERMISSION_CREATE">PENGAJUAN IZIN</option>
            <option value="PERMISSION_APPROVE">PERSETUJUAN IZIN</option>
            <option value="PERMISSION_REJECT">PENOLAKAN IZIN</option>
            <option value="QR_GENERATE">GENERATE QR</option>
            <option value="QR_REGENERATE">REGENERASI QR</option>
            <option value="QR_DEACTIVATE">NONAKTIF QR</option>
            <option value="OFFLINE_AUTH_ISSUED">OTORISASI OFFLINE</option>
            <option value="OFFLINE_SYNC">SINKRONISASI OFFLINE</option>
            <option value="USER_CHANGE">PERUBAHAN AKUN</option>
          </select>
        }
        columns={[
          {
            key: 'time',
            header: 'Waktu Server (WIB)',
            render: (l) => <span className="whitespace-nowrap font-mono text-xs">{formatTimestampWib(l.timestamp)}</span>
          },
          {
            key: 'actor',
            header: 'Pengguna & Role',
            render: (l) => (
              <div>
                <p className="font-semibold text-slate-900">{l.userName || l.userId.slice(0, 10)}</p>
                <p className="text-[11px] font-bold text-navy-700">{l.role}</p>
              </div>
            )
          },
          {
            key: 'action',
            header: 'Aktivitas',
            render: (l) => (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                {l.action}
              </span>
            )
          },
          {
            key: 'desc',
            header: 'Keterangan',
            render: (l) => <span className="text-xs text-slate-700">{l.description}</span>
          },
          {
            key: 'device',
            header: 'Perangkat / Tx',
            render: (l) => (
              <div className="font-mono text-[11px] text-slate-500">
                <p>{l.deviceId || '-'}</p>
                {l.transactionId && <p className="truncate max-w-[120px]">{l.transactionId}</p>}
              </div>
            )
          }
        ]}
      />
    </div>
  );
};
