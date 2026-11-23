import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import { getTodayWibDate, PERMISSION_TYPE_LABELS } from '../../lib/time';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { PermissionRequest, PermissionType, Student } from '../../types';

export const WaliKelasPermissionsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const classId = profile?.assignedClassId || '';

  const [students, setStudents] = useState<Student[]>([]);
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    studentId: '',
    date: getTodayWibDate(),
    startTime: '09:00',
    estimatedReturnTime: '11:30',
    type: 'KEPERLUAN_KELUARGA' as PermissionType,
    reason: '',
    notes: '',
    autoApprove: true
  });

  useEffect(() => {
    if (!classId) return;
    const db = requireDb();
    const u1 = onSnapshot(query(collection(db, 'students'), where('classId', '==', classId)), (s) =>
      setStudents(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
          .filter((stu) => stu.active)
      )
    );
    const u2 = onSnapshot(
      query(collection(db, 'permission_requests'), where('classId', '==', classId)),
      (s) =>
        setPermissions(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionRequest, 'id'>) }))
            .sort((a, b) => b.date.localeCompare(a.date))
        )
    );
    return () => {
      u1();
      u2();
    };
  }, [classId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await functionsApi.createPermissionRequest({
        studentId: form.studentId,
        date: form.date,
        startTime: form.startTime,
        estimatedReturnTime: form.estimatedReturnTime,
        type: form.type,
        reason: form.reason,
        notes: form.notes,
        autoApprove: form.autoApprove
      });
      showToast(
        'success',
        form.autoApprove ? 'Izin dibuat & langsung disetujui' : 'Permohonan izin dibuat (MENUNGGU)',
        form.autoApprove ? 'Izin kini tampil di dashboard Guru Piket untuk scan keluar.' : undefined
      );
      setModalOpen(false);
      setForm({ ...form, studentId: '', reason: '', notes: '' });
    } catch (err) {
      showToast('error', 'Gagal membuat izin', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (perm: PermissionRequest, decision: 'APPROVE' | 'REJECT') => {
    let rejectedReason: string | undefined;
    if (decision === 'REJECT') {
      const r = prompt(`Masukkan alasan penolakan izin untuk ${perm.studentName}:`);
      if (r === null) return;
      rejectedReason = r;
    }
    setDecidingId(perm.id);
    try {
      await functionsApi.decidePermissionRequest({
        permissionId: perm.id,
        decision,
        rejectedReason
      });
      showToast(
        decision === 'APPROVE' ? 'success' : 'warning',
        decision === 'APPROVE' ? 'Izin Disetujui' : 'Izin Ditolak'
      );
    } catch (err) {
      showToast('error', 'Gagal memproses persetujuan', err instanceof Error ? err.message : '');
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">
            Pengajuan & Persetujuan Izin – Kelas {profile?.assignedClassName || classId}
          </h1>
          <p className="text-xs text-slate-500">
            Hanya izin berstatus DISETUJUI yang dapat dipindai oleh Guru Piket untuk keluar sekolah.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Buat Permohonan Izin
        </button>
      </div>

      <DataTable
        data={permissions}
        keyExtractor={(p) => p.id}
        searchableText={(p) => `${p.studentName} ${p.nis} ${p.reason} ${p.status}`}
        columns={[
          {
            key: 'date',
            header: 'Tanggal & Jam',
            render: (p) => (
              <div className="font-mono text-xs">
                <p className="font-bold">{p.date}</p>
                <p className="text-slate-500">{p.startTime} – {p.estimatedReturnTime} WIB</p>
              </div>
            )
          },
          {
            key: 'student',
            header: 'Siswa',
            render: (p) => (
              <div>
                <p className="font-semibold text-slate-900">{p.studentName}</p>
                <p className="font-mono text-xs text-slate-500">NIS: {p.nis}</p>
              </div>
            )
          },
          {
            key: 'reason',
            header: 'Jenis & Alasan',
            render: (p) => (
              <div className="text-xs">
                <p className="font-bold text-navy-900">{PERMISSION_TYPE_LABELS[p.type] || p.type}</p>
                <p className="text-slate-600">{p.reason}</p>
                {p.notes && <p className="text-[11px] text-slate-400">Ket: {p.notes}</p>}
              </div>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (p) => (
              <div className="space-y-1">
                <StatusBadge status={p.status} />
                {p.exitTimeWib && <p className="font-mono text-[10px] text-slate-500">Keluar: {p.exitTimeWib}</p>}
                {p.returnTimeWib && <p className="font-mono text-[10px] text-emerald-700">Kembali: {p.returnTimeWib}</p>}
              </div>
            )
          },
          {
            key: 'actions',
            header: 'Persetujuan Wali Kelas',
            render: (p) =>
              p.status === 'MENUNGGU' ? (
                <div className="flex gap-1.5">
                  <button
                    disabled={decidingId === p.id}
                    onClick={() => handleDecision(p, 'APPROVE')}
                    className="btn-success px-2.5 py-1 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Setujui
                  </button>
                  <button
                    disabled={decidingId === p.id}
                    onClick={() => handleDecision(p, 'REJECT')}
                    className="btn-danger px-2.5 py-1 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Tolak
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  {p.approvedByName ? `Oleh: ${p.approvedByName}` : '-'}
                </span>
              )
          }
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Form Pengajuan Izin Siswa"
        subtitle={`Kelas ${profile?.assignedClassName || classId}`}
      >
        <form onSubmit={handleCreate} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Pilih Siswa *</label>
            <select
              required
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              className="input-field"
            >
              <option value="">-- Pilih Siswa Kelas Anda --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} (NIS: {s.nis})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Tanggal *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Waktu Mulai *</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Est. Kembali *</label>
              <input
                type="time"
                required
                value={form.estimatedReturnTime}
                onChange={(e) => setForm({ ...form, estimatedReturnTime: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis Izin *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as PermissionType })}
              className="input-field"
            >
              <option value="KEPERLUAN_KELUARGA">Keperluan Keluarga</option>
              <option value="SAKIT">Sakit</option>
              <option value="KEPERLUAN_PRIBADI">Keperluan Pribadi</option>
              <option value="KEPERLUAN_SEKOLAH">Keperluan Sekolah</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Alasan *</label>
            <textarea
              required
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Jelaskan alasan izin keluar sekolah..."
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Keterangan Tambahan</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Diantar orang tua / surat dokter / dll"
              className="input-field"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900">
            <input
              type="checkbox"
              checked={form.autoApprove}
              onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
            />
            Langsung Setujui Izin (status langsung DISETUJUI agar dapat dipindai Guru Piket)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Izin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
