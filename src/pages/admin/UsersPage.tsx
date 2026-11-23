import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Plus, Edit3, ShieldCheck } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { SchoolClass, Teacher, UserProfile, UserRole } from '../../types';

export const UsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'GURU_PIKET' as UserRole,
    teacherId: '',
    assignedClassId: '',
    phone: '',
    active: true
  });

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'users'), (s) =>
      setUsers(s.docs.map((d) => ({ ...(d.data() as UserProfile), uid: d.id })))
    );
    const u2 = onSnapshot(collection(db, 'teachers'), (s) =>
      setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) })))
    );
    const u3 = onSnapshot(collection(db, 'classes'), (s) =>
      setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
    );
    return () => {
      u1(); u2(); u3();
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      email: '',
      password: '',
      displayName: '',
      role: 'GURU_PIKET',
      teacherId: '',
      assignedClassId: '',
      phone: '',
      active: true
    });
    setModalOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditing(u);
    setForm({
      email: u.email,
      password: '',
      displayName: u.displayName,
      role: u.role,
      teacherId: u.teacherId || '',
      assignedClassId: u.assignedClassId || '',
      phone: u.phone || '',
      active: u.active
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClass = classes.find((c) => c.id === form.assignedClassId);
    setSaving(true);
    try {
      if (editing) {
        await functionsApi.updateUserRoleAndAccess({
          uid: editing.uid,
          displayName: form.displayName,
          role: form.role,
          teacherId: form.teacherId || null,
          assignedClassId: form.role === 'WALI_KELAS' ? form.assignedClassId || null : null,
          assignedClassName: form.role === 'WALI_KELAS' ? selectedClass?.name || null : null,
          active: form.active,
          newPassword: form.password || undefined
        });
        showToast('success', 'Akun & Custom Claims diperbarui di backend');
      } else {
        await functionsApi.createUserAccount({
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          role: form.role,
          teacherId: form.teacherId || undefined,
          assignedClassId: form.role === 'WALI_KELAS' ? form.assignedClassId || undefined : undefined,
          assignedClassName: form.role === 'WALI_KELAS' ? selectedClass?.name || undefined : undefined,
          phone: form.phone
        });
        showToast('success', 'Akun pengguna baru berhasil dibuat dengan Custom Claims');
      }
      setModalOpen(false);
    } catch (err) {
      showToast('error', 'Gagal memproses akun', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Manajemen Akun & Role (Custom Claims)</h1>
          <p className="text-xs text-slate-500">
            Seluruh role ditetapkan secara aman melalui Firebase Cloud Functions Admin SDK.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Buat Akun Pengguna
        </button>
      </div>

      <DataTable
        data={users}
        keyExtractor={(u) => u.uid}
        searchableText={(u) => `${u.displayName} ${u.email} ${u.role} ${u.assignedClassName || ''}`}
        columns={[
          {
            key: 'user',
            header: 'Pengguna',
            render: (u) => (
              <div>
                <p className="font-semibold text-slate-900">{u.displayName}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            )
          },
          {
            key: 'role',
            header: 'Role & Penugasan',
            render: (u) => (
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-900">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                  {u.role.replace(/_/g, ' ')}
                </span>
                {u.role === 'WALI_KELAS' && (
                  <p className="text-xs text-slate-500">Kelas: {u.assignedClassName || u.assignedClassId}</p>
                )}
              </div>
            )
          },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge status={u.active ? 'AKTIF' : 'NONAKTIF'} /> },
          {
            key: 'action',
            header: 'Aksi',
            render: (u) => (
              <button onClick={() => openEdit(u)} className="btn-secondary px-2.5 py-1 text-xs">
                <Edit3 className="h-3.5 w-3.5" />
                Kelola
              </button>
            )
          }
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Perbarui Role & Akses Pengguna' : 'Buat Akun Pengguna Baru'}
        subtitle="Role dan kelas wali kelas disinkronkan ke Firebase Auth Custom Claims."
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          {!editing && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-field"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Lengkap *</label>
            <input
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              {editing ? 'Reset Kata Sandi (opsional, min 8 karakter)' : 'Kata Sandi Awal (min 8 karakter) *'}
            </label>
            <input
              type="password"
              required={!editing}
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Role *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="input-field"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="GURU_PIKET">GURU PIKET</option>
              <option value="WALI_KELAS">WALI KELAS</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Tautkan Data Guru (Opsional)</label>
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className="input-field"
            >
              <option value="">-- Tidak Ditautkan --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName} ({t.nip})</option>
              ))}
            </select>
          </div>
          {form.role === 'WALI_KELAS' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Kelas yang Diampu *</label>
              <select
                required
                value={form.assignedClassId}
                onChange={(e) => setForm({ ...form, assignedClassId: e.target.value })}
                className="input-field"
              >
                <option value="">-- Pilih Kelas --</option>
                {classes.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.majorName})</option>
                ))}
              </select>
            </div>
          )}
          {editing && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Akun Aktif (nonaktifkan untuk mencabut akses seketika)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Memproses...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
