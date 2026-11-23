import React, { useEffect, useState } from 'react';
import { DownloadCloud, RefreshCw, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  clearSyncedTransactions,
  getCachedStudentCount,
  getOfflineAuthBundle
} from '../../lib/offlineDb';
import { checkLocalOfflineAuthValidity, prepareOfflineCache } from '../../lib/offlineSync';
import { formatTimestampWib } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';

export const PiketOfflineSyncPage: React.FC = () => {
  const { profile } = useAuth();
  const { isOnline, transactions, pendingCount, failedCount, triggerSyncNow, refreshQueue } =
    useNetwork();
  const { showToast } = useToast();

  const [authStatus, setAuthStatus] = useState<{
    valid: boolean;
    reason?: string;
    expiresAtIso?: string;
    scheduleTitle?: string;
  } | null>(null);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [preparing, setPreparing] = useState(false);

  const loadLocalStatus = async () => {
    if (!profile) return;
    const [validity, count, bundle] = await Promise.all([
      checkLocalOfflineAuthValidity(profile.uid),
      getCachedStudentCount(),
      getOfflineAuthBundle()
    ]);
    setAuthStatus(validity);
    setCachedCount(count);
    setLastSyncedAt(bundle?.syncedAtIso || '');
  };

  useEffect(() => {
    loadLocalStatus();
  }, [profile?.uid]);

  const handleDownloadOfflineBundle = async () => {
    setPreparing(true);
    try {
      const res = await prepareOfflineCache();
      await loadLocalStatus();
      showToast(
        'success',
        'Otorisasi & Cache Offline Diperbarui',
        `${res.studentCount} siswa dan ${res.permissionCount} izin bertanda tangan siap digunakan offline.`
      );
    } catch (err) {
      showToast('error', 'Gagal mengunduh otorisasi offline', err instanceof Error ? err.message : '');
    } finally {
      setPreparing(false);
    }
  };

  const handleClearCompleted = async () => {
    await clearSyncedTransactions();
    await refreshQueue();
    showToast('info', 'Riwayat transaksi tersinkron dibersihkan dari perangkat');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Mode Offline & Sinkronisasi IndexedDB</h1>
          <p className="text-xs text-slate-500">
            Otorisasi offline bertanda tangan HMAC backend memastikan keamanan scan saat koneksi terputus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!isOnline || preparing}
            onClick={handleDownloadOfflineBundle}
            className="btn-primary"
          >
            <DownloadCloud className="h-4 w-4" />
            {preparing ? 'Mengunduh...' : 'Siapkan / Perbarui Cache Offline'}
          </button>
          <button
            disabled={!isOnline || (pendingCount === 0 && failedCount === 0)}
            onClick={triggerSyncNow}
            className="btn-success"
          >
            <RefreshCw className="h-4 w-4" />
            Sinkronisasi Sekarang ({pendingCount + failedCount})
          </button>
        </div>
      </div>

      {/* Offline Auth Status Card */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          {authStatus?.valid ? (
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          ) : (
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          )}
          <div className="space-y-1 text-xs">
            <p className="text-sm font-bold text-navy-950">
              {authStatus?.valid
                ? `Otorisasi Offline Sah (${authStatus.scheduleTitle})`
                : 'Otorisasi Offline Belum Aktif / Kedaluwarsa'}
            </p>
            <p className="text-slate-600">
              {authStatus?.valid
                ? `Berlaku hingga: ${formatTimestampWib(authStatus.expiresAtIso)} • ${cachedCount} QR siswa tersimpan di IndexedDB`
                : authStatus?.reason || 'Hubungkan ke internet saat jadwal piket aktif untuk mengunduh otorisasi offline.'}
            </p>
            {lastSyncedAt && (
              <p className="text-[11px] text-slate-400">
                Terakhir diunduh: {formatTimestampWib(lastSyncedAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pending Queue Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-bold text-navy-950">
            Antrean Transaksi Offline Perangkat ({transactions.length})
          </h2>
          <button onClick={handleClearCompleted} className="btn-secondary px-2.5 py-1 text-xs">
            <Trash2 className="h-3.5 w-3.5" />
            Bersihkan yang Sudah Sync
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5 text-left">UUID / Waktu Lokal</th>
                <th className="px-4 py-2.5 text-left">Jenis</th>
                <th className="px-4 py-2.5 text-left">Siswa</th>
                <th className="px-4 py-2.5 text-left">Status Sync</th>
                <th className="px-4 py-2.5 text-left">Keterangan Server</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <tr key={t.transactionUuid}>
                  <td className="px-4 py-2.5 font-mono">
                    <p className="font-bold text-slate-800">{t.transactionUuid.slice(0, 12)}...</p>
                    <p className="text-[11px] text-slate-500">{formatTimestampWib(t.deviceLocalTimeIso)}</p>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-navy-900">{t.type}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{t.studentName}</p>
                    <p className="text-slate-500">{t.nis} • {t.className}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={t.syncStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{t.syncMessage || '-'}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada transaksi offline tersimpan di perangkat ini.
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
