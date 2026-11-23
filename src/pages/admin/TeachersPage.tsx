import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Edit3, UserX, UserCheck } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { Teacher } from '../../types';

const EMPTY = { nip: '', fullName: '', gender: 'L' as 'L' | 'P', phone: '', email: '', subject: '' };

export const TeachersPage: React.FC = () => {
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    const db = requireDb();
    return onSnapshot(collection(db, 'teachers'), (s) =>
      setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) })))
    );
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = requireDb();
    try {
      if (editing) {
        await updateDoc(doc(db, 'teachers', editing.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'teachers'), {
          ...form,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      showToast('success', editing ? 'Data guru diperbarui' : 'Guru baru ditambahkan');
      setModalOpen(false);
    } catch (err) {
      showToast('error', 'Gagal menyimpan guru', err instanceof Error ? err.message : '');
    }
  };

  const toggleActive = async (t: Teacher) => {
    await updateDoc(doc(requireDb(), 'teachers', t.id), { active: !t.active, updatedAt: serverTimestamp() });
    showToast('success', t.active ? 'Guru dinonaktifkan' : 'Guru diaktifkan');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Data Guru</h1>
          <p className="text-xs text-slate-500">Daftar guru SMKN 6 Muaro Jambi untuk penugasan piket & wali kelas.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm(EMPTY); setModalOpen(true); }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Tambah Guru
        </button>
      </div>

      <DataTable
        data={teachers}
        keyExtractor={(t) => t.id}
        searchableText={(t) => `${t.nip} ${t.fullName} ${t.email} ${t.subject || ''}`}
        columns={[
          {
            key: 'name',
            header: 'Nama Guru',
            render: (t) => (
              <div>
                <p className="font-semibold text-slate-900">{t.fullName}</p>
                <p className="font-mono text-xs text-slate-500">NIP: {t.nip || '-'}</p>
              </div>
            )
          },
          { key: 'subject', header: 'Mapel / Bidang', render: (t) => t.subject || '-' },
          {
            key: 'contact',
            header: 'Kontak',
            render: (t) => (
              <div className="text-xs">
                <p>{t.email}</p>
                <p className="text-slate-500">{t.phone}</p>
              </div>
            )
          },
          { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.active ? 'AKTIF' : 'NONAKTIF'} /> },
          {
            key: 'actions',
            header: 'Aksi',
            render: (t) => (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditing(t);
                    setForm({
                      nip: t.nip,
                      fullName: t.fullName,
                      gender: t.gender,
                      phone: t.phone,
                      email: t.email,
                      subject: t.subject || ''
                    });
                    setModalOpen(true);
                  }}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleActive(t)}
                  className={`rounded-lg p-1.5 ${t.active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {t.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </button>
              </div>
            )
          }
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Guru' : 'Tambah Guru'}>
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">NIP / NUPTK</label>
            <input value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Lengkap *</label>
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis Kelamin</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })} className="input-field">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Mata Pelajaran</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Telepon</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" className="btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
