import React from 'react';

const STATUS_STYLE: Record<string, string> = {
  HADIR: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PULANG: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DISETUJUI: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SUDAH_KEMBALI: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SYNCED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  SUCCESS: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ONLINE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  AKTIF: 'bg-emerald-100 text-emerald-800 border-emerald-200',

  TERLAMBAT: 'bg-amber-100 text-amber-800 border-amber-200',
  MENUNGGU: 'bg-amber-100 text-amber-800 border-amber-200',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  PENDING_SYNC: 'bg-amber-100 text-amber-800 border-amber-200',
  SUDAH_KELUAR: 'bg-amber-100 text-amber-800 border-amber-200',
  IZIN: 'bg-sky-100 text-sky-800 border-sky-200',
  SAKIT: 'bg-sky-100 text-sky-800 border-sky-200',
  SYNCING: 'bg-sky-100 text-sky-800 border-sky-200',
  DUPLICATE: 'bg-slate-100 text-slate-700 border-slate-200',

  ALPA: 'bg-rose-100 text-rose-800 border-rose-200',
  DITOLAK: 'bg-rose-100 text-rose-800 border-rose-200',
  KEDALUWARSA: 'bg-rose-100 text-rose-800 border-rose-200',
  FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
  REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
  OFFLINE: 'bg-rose-100 text-rose-800 border-rose-200',
  NONAKTIF: 'bg-slate-200 text-slate-600 border-slate-300',
  BELUM_ABSEN: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const cls = STATUS_STYLE[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label || status.replace(/_/g, ' ')}
    </span>
  );
};
