import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import { generateTxUuid, getOrCreateDeviceId } from '../../lib/device';
import { checkLocalOfflineAuthValidity, recordOfflineScan } from '../../lib/offlineSync';
import { getTodayWibDate, getWibTimeString } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { useToast } from '../../contexts/ToastContext';
import { QrScannerView } from '../../components/qr/QrScannerView';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AttendanceRecord, DutyStatusResponse, OfflineTxType, ScanResponse, Student } from '../../types';

const MODE_META = {
  pagi: { title: 'SCAN ABSENSI PAGI', badge: 'SESI PAGI', color: 'bg-emerald-700', txType: 'SCAN_PAGI' as OfflineTxType },
  sore: { title: 'SCAN ABSENSI SORE', badge: 'SESI PULANG', color: 'bg-navy-900', txType: 'SCAN_SORE' as OfflineTxType },
  keluar: { title: 'SCAN IZIN KELUAR', badge: 'KELUAR SEKOLAH', color: 'bg-amber-600', txType: 'SCAN_KELUAR' as OfflineTxType },
  kembali: { title: 'SCAN SISWA KEMBALI', badge: 'KEMBALI KE SEKOLAH', color: 'bg-sky-700', txType: 'SCAN_KEMBALI' as OfflineTxType }
};

export const PiketScannerPage: React.FC = () => {
  const { mode = 'pagi' } = useParams<{ mode: 'pagi' | 'sore' | 'keluar' | 'kembali' }>();
  const meta = MODE_META[mode] || MODE_META.pagi;

  const { profile } = useAuth();
  const { isOnline, refreshQueue } = useNetwork();
  const { showToast } = useToast();
  const today = getTodayWibDate();

  const [duty, setDuty] = useState<DutyStatusResponse | null>(null);
  const [validating, setValidating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exitPost, setExitPost] = useState('POS GERBANG UTAMA');
  const [lastResult, setLastResult] = useState<ScanResponse | null>(null);
  const [liveWib, setLiveWib] = useState(getWibTimeString());

  const [totalActiveStudents, setTotalActiveStudents] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const t = setInterval(() => setLiveWib(getWibTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'students'), (s) => {
      setTotalActiveStudents(
        s.docs.filter((d) => (d.data() as Student).active).length
      );
    });
    const u2 = onSnapshot(query(collection(db, 'attendance'), where('date', '==', today)), (s) => {
      setTodayAttendance(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })));
    });
    return () => {
      u1();
      u2();
    };
  }, [today]);

  useEffect(() => {
    let active = true;
    async function verify() {
      if (!profile) return;
      setValidating(true);
      try {
        if (navigator.onLine) {
          const res = await functionsApi.getDutyStatus({});
          if (active) setDuty(res);
        } else {
          const local = await checkLocalOfflineAuthValidity(profile.uid);
          if (active) {
            setDuty({
              valid: local.valid,
              code: local.valid ? 'OFFLINE_VALID' : 'OFFLINE_EXPIRED',
              message: local.valid
                ? `Mode Offline Sah (${local.scheduleTitle})`
                : local.reason || 'Otorisasi offline tidak tersedia atau kedaluwarsa.',
              serverDate: today,
              serverTime: getWibTimeString(),
              schedule: local.valid
                ? {
                    id: 'offline',
                    title: local.scheduleTitle || 'Jadwal Offline',
                    type: 'TANGGAL',
                    teacherIds: [profile.uid],
                    startTime: local.scheduleStartTime || '',
                    endTime: local.scheduleEndTime || '',
                    active: true
                  }
                : undefined
            });
          }
        }
      } catch (err) {
        if (active) {
          setDuty({
            valid: false,
            code: 'ERROR',
            message: err instanceof Error ? err.message : 'Gagal memvalidasi jadwal piket.',
            serverDate: today,
            serverTime: getWibTimeString()
          });
        }
      } finally {
        if (active) setValidating(false);
      }
    }
    verify();
    return () => {
      active = false;
    };
  }, [profile?.uid, isOnline, mode]);

  const handleScanToken = async (qrToken: string) => {
    if (!profile || busy || !duty?.valid) return;
    setBusy(true);
    const deviceId = getOrCreateDeviceId();
    const txUuid = generateTxUuid();

    try {
      let res: ScanResponse;
      if (!navigator.onLine) {
        res = await recordOfflineScan({
          type: meta.txType,
          qrToken,
          teacherUid: profile.uid,
          exitPost: mode === 'keluar' ? exitPost : undefined
        });
        await refreshQueue();
      } else {
        if (mode === 'pagi' || mode === 'sore') {
          res = await functionsApi.processAttendanceScan({
            session: mode === 'pagi' ? 'PAGI' : 'SORE',
            qrToken,
            deviceId,
            transactionUuid: txUuid
          });
        } else if (mode === 'keluar') {
          res = await functionsApi.processExitScan({
            qrToken,
            deviceId,
            exitPost,
            transactionUuid: txUuid
          });
        } else {
          res = await functionsApi.processReturnScan({
            qrToken,
            deviceId,
            transactionUuid: txUuid
          });
        }
      }

      setLastResult(res);
      if (res.success) {
        showToast(res.warning ? 'warning' : 'success', res.message, res.warning);
      } else {
        showToast('error', res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses QR.';
      setLastResult({ success: false, code: 'ERROR', message: msg });
      showToast('error', 'Scan Gagal', msg);
    } finally {
      setBusy(false);
    }
  };

  const hadirCount = todayAttendance.filter(
    (a) => a.morningStatus === 'HADIR' || a.morningStatus === 'TERLAMBAT'
  ).length;
  const lateCount = todayAttendance.filter((a) => a.morningStatus === 'TERLAMBAT').length;
  const notPresentCount = Math.max(0, totalActiveStudents - hadirCount);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Top Mode Header */}
      <div className={`rounded-2xl ${meta.color} p-4 text-white shadow-md`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/piket" className="rounded-lg bg-white/15 p-2 hover:bg-white/25">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wider">
                {meta.badge}
              </span>
              <h1 className="mt-0.5 text-lg font-extrabold">{meta.title}</h1>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">{profile?.displayName}</p>
            <p className="font-mono text-white/80">
              {today} • {liveWib} WIB
            </p>
            {duty?.schedule && (
              <p className="text-[11px] text-white/90">
                Jadwal: {duty.schedule.startTime}–{duty.schedule.endTime} WIB
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live Counters Bar */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="card p-3">
          <p className="text-[11px] font-semibold text-slate-500">Sudah Hadir</p>
          <p className="text-xl font-extrabold text-emerald-600">{hadirCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[11px] font-semibold text-slate-500">Belum Hadir</p>
          <p className="text-xl font-extrabold text-slate-800">{notPresentCount}</p>
        </div>
        <div className="card p-3">
          <p className="text-[11px] font-semibold text-slate-500">Terlambat</p>
          <p className="text-xl font-extrabold text-amber-600">{lateCount}</p>
        </div>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0" />
          Mode OFFLINE aktif: Transaksi disimpan ke IndexedDB (PENDING SYNC) dan akan divalidasi ulang oleh server saat internet kembali.
        </div>
      )}

      {mode === 'keluar' && (
        <div className="card flex items-center gap-3 p-3.5">
          <label className="shrink-0 text-xs font-bold text-slate-700">Pos Penjagaan:</label>
          <input
            value={exitPost}
            onChange={(e) => setExitPost(e.target.value)}
            className="input-field text-xs"
            placeholder="POS GERBANG UTAMA"
          />
        </div>
      )}

      {/* Camera Scanner */}
      <div className="card p-4">
        {validating ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            <Clock className="mr-2 h-4 w-4 animate-spin" />
            Memvalidasi jadwal piket ke server...
          </div>
        ) : (
          <QrScannerView
            enabled={Boolean(duty?.valid)}
            busy={busy}
            onScan={handleScanToken}
            disabledMessage={duty?.message || 'ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF.'}
          />
        )}
      </div>

      {/* Rich Post-Scan Result Card */}
      {lastResult && (
        <div
          className={`card border-2 p-5 ${
            lastResult.success
              ? lastResult.warning
                ? 'border-amber-400 bg-amber-50/70'
                : 'border-emerald-400 bg-emerald-50/70'
              : 'border-rose-400 bg-rose-50/70'
          }`}
        >
          <div className="flex items-start gap-4">
            {lastResult.student?.photoUrl ? (
              <img
                src={lastResult.student.photoUrl}
                alt={lastResult.student.fullName}
                className="h-20 w-16 shrink-0 rounded-xl border border-slate-200 object-cover shadow"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow">
                {lastResult.success ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-rose-600" />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`text-base font-extrabold ${
                    lastResult.success ? 'text-emerald-900' : 'text-rose-900'
                  }`}
                >
                  {lastResult.message}
                </p>
                {lastResult.status && <StatusBadge status={lastResult.status} />}
              </div>

              {lastResult.student && (
                <div className="text-xs text-slate-700">
                  <p className="text-sm font-bold text-navy-950">{lastResult.student.fullName}</p>
                  <p>
                    NIS: <span className="font-mono font-bold">{lastResult.student.nis}</span> •
                    Kelas: <span className="font-bold">{lastResult.student.className}</span>
                  </p>
                  {lastResult.scannedAtIso && (
                    <p className="font-mono text-[11px] text-slate-500">
                      Waktu Scan: {lastResult.scannedAtIso}
                    </p>
                  )}
                </div>
              )}

              {lastResult.warning && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {lastResult.warning}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
