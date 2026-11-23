import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import QRCode from 'qrcode';
import {
  QrCode,
  RefreshCw,
  Download,
  Printer,
  ShieldOff,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StudentIdCardCR80 } from '../../components/qr/StudentIdCardCR80';
import type { SchoolClass, Student } from '../../types';

export const QrCenterPage: React.FC = () => {
  const { school } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [filterClassId, setFilterClassId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [printMode, setPrintMode] = useState<'NONE' | 'CARDS' | 'QR_ONLY'>('NONE');

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'students'), (s) =>
      setStudents(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
          .filter((stu) => stu.active)
      )
    );
    const u2 = onSnapshot(collection(db, 'classes'), (s) =>
      setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  const filtered = students.filter((s) => (!filterClassId ? true : s.classId === filterClassId));

  const handleGenerateOne = async (stu: Student, regenerate = false) => {
    setBusyId(stu.id);
    try {
      if (regenerate) {
        await functionsApi.regenerateStudentQr({ studentId: stu.id, reason: 'Regenerasi oleh Admin' });
        showToast('success', 'QR Berhasil Diregenerasi', `QR lama ${stu.fullName} otomatis dinonaktifkan.`);
      } else {
        await functionsApi.generateStudentQr({ studentId: stu.id });
        showToast('success', 'QR Berhasil Dibuat', `Token QR unik untuk ${stu.fullName} aktif.`);
      }
    } catch (err) {
      showToast('error', 'Gagal memproses QR', err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeactivateLost = async (stu: Student) => {
    if (!confirm(`Nonaktifkan QR milik ${stu.fullName} (dilaporkan hilang)? QR tersebut tidak akan bisa digunakan lagi.`)) {
      return;
    }
    setBusyId(stu.id);
    try {
      await functionsApi.deactivateStudentQr({ studentId: stu.id, reason: 'QR dilaporkan hilang' });
      showToast('warning', 'QR Dinonaktifkan', `QR ${stu.fullName} telah diblokir di server.`);
    } catch (err) {
      showToast('error', 'Gagal menonaktifkan QR', err instanceof Error ? err.message : '');
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkGenerate = async () => {
    setBulkBusy(true);
    try {
      const targetIds = filtered.filter((s) => !s.activeQrToken).map((s) => s.id);
      if (targetIds.length === 0) {
        showToast('info', 'Semua siswa pada filter ini sudah memiliki QR aktif.');
        return;
      }
      const res = await functionsApi.bulkGenerateQr({ studentIds: targetIds, onlyMissing: true });
      showToast('success', 'Generate QR Massal Selesai', `${res.generatedCount} QR siswa berhasil dibuat.`);
    } catch (err) {
      showToast('error', 'Gagal generate massal', err instanceof Error ? err.message : '');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDownloadPng = async (stu: Student) => {
    if (!stu.activeQrToken) return;
    const dataUrl = await QRCode.toDataURL(stu.activeQrToken, {
      width: 600,
      margin: 2,
      color: { dark: '#0f2544', light: '#ffffff' }
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${stu.nis}_${stu.fullName.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  if (printMode !== 'NONE') {
    const printable = filtered.filter((s) => Boolean(s.activeQrToken));
    return (
      <div className="space-y-4">
        <div className="no-print flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <h2 className="font-bold text-navy-950">
              {printMode === 'CARDS' ? 'Pratinjau Cetak Kartu Siswa CR80' : 'Pratinjau Cetak QR Code'}
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan {printable.length} siswa yang memiliki QR aktif. Gunakan skala 100% saat mencetak.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPrintMode('NONE')} className="btn-secondary">Kembali</button>
            <button onClick={() => window.print()} className="btn-primary">
              <Printer className="h-4 w-4" />
              Cetak Sekarang
            </button>
          </div>
        </div>

        <div className="print-grid-cr80 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {printable.map((stu) => (
            <StudentIdCardCR80 key={stu.id} student={stu} school={school} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Generator QR & Kartu Siswa CR80</h1>
          <p className="text-xs text-slate-500">
            Token QR acak berentropi tinggi tanpa data pribadi tertanam. Satu QR berlaku untuk pagi, sore & izin keluar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={bulkBusy} onClick={handleBulkGenerate} className="btn-primary">
            <Sparkles className="h-4 w-4" />
            {bulkBusy ? 'Memproses...' : 'Generate QR Massal'}
          </button>
          <button onClick={() => setPrintMode('CARDS')} className="btn-secondary">
            <Printer className="h-4 w-4" />
            Cetak Kartu CR80
          </button>
        </div>
      </div>

      <DataTable
        data={filtered}
        keyExtractor={(s) => s.id}
        searchableText={(s) => `${s.nis} ${s.fullName} ${s.className}`}
        searchPlaceholder="Cari siswa..."
        toolbarRight={
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="input-field w-48"
          >
            <option value="">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'name',
            header: 'Siswa',
            render: (s) => (
              <div>
                <p className="font-semibold text-slate-900">{s.fullName}</p>
                <p className="font-mono text-xs text-slate-500">NIS: {s.nis} • {s.className}</p>
              </div>
            )
          },
          {
            key: 'status',
            header: 'Status QR',
            render: (s) =>
              s.activeQrToken ? (
                <div className="space-y-0.5">
                  <StatusBadge status="AKTIF" label="QR Aktif" />
                  <p className="font-mono text-[10px] text-slate-400">
                    {s.activeQrToken.slice(0, 14)}••••
                  </p>
                </div>
              ) : (
                <StatusBadge status="NONAKTIF" label="Belum / Nonaktif" />
              )
          },
          {
            key: 'actions',
            header: 'Aksi QR & Kartu',
            render: (s) => (
              <div className="flex flex-wrap items-center gap-1.5">
                {!s.activeQrToken ? (
                  <button
                    disabled={busyId === s.id}
                    onClick={() => handleGenerateOne(s, false)}
                    className="btn-primary px-2.5 py-1.5 text-xs"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Generate QR
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setPreviewStudent(s)}
                      className="btn-secondary px-2.5 py-1.5 text-xs"
                      title="Preview Kartu CR80"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Kartu
                    </button>
                    <button
                      onClick={() => handleDownloadPng(s)}
                      className="btn-secondary px-2.5 py-1.5 text-xs"
                      title="Download PNG"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PNG
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={() => handleGenerateOne(s, true)}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      title="Regenerasi QR baru"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      disabled={busyId === s.id}
                      onClick={() => handleDeactivateLost(s)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      title="Nonaktifkan QR hilang"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )
          }
        ]}
      />

      <Modal
        open={Boolean(previewStudent)}
        onClose={() => setPreviewStudent(null)}
        title="Preview Kartu Siswa (Ukuran Standar CR80)"
        subtitle="85.6 mm × 53.98 mm"
      >
        {previewStudent && (
          <div className="flex flex-col items-center gap-4">
            <StudentIdCardCR80 student={previewStudent} school={school} />
            <div className="flex gap-2">
              <button onClick={() => handleDownloadPng(previewStudent)} className="btn-secondary">
                <Download className="h-4 w-4" />
                Unduh QR PNG
              </button>
              <button onClick={() => window.print()} className="btn-primary">
                <Printer className="h-4 w-4" />
                Cetak Kartu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
