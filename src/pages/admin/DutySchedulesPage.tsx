import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { Plus, Edit3, Trash2, CalendarClock } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { DAY_NAMES_ID, getTodayWibDate } from '../../lib/time';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { DutySchedule, DutyScheduleType, UserProfile } from '../../types';

const INITIAL_FORM = {
  title: '',
  type: 'TANGGAL' as DutyScheduleType,
  date: getTodayWibDate(),
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  teacherIds: [] as string[],
  startTime: '06:00',
  endTime: '16:30',
  active: true,
  notes: ''
};

export const DutySchedulesPage: React.FC = () => {
  const { showToast } = useToast();
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);
  const [piketUsers, setPiketUsers] = useState<UserProfile[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DutySchedule | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'duty_schedules'), (s) =>
      setSchedules(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DutySchedule, 'id'>) })))
    );
    const u2 = onSnapshot(collection(db, 'users'), (s) =>
      setPiketUsers(
        s.docs
          .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
          .filter((u) => u.role === 'GURU_PIKET' && u.active)
      )
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  const toggleTeacher = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      teacherIds: prev.teacherIds.includes(uid)
        ? prev.teacherIds.filter((id) => id !== uid)
        : [...prev.teacherIds, uid]
    }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day].sort()
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.teacherIds.length === 0) {
      showToast('error', 'Pilih minimal satu Guru Piket');
      return;
    }
    if (form.type === 'MINGGUAN' && form.daysOfWeek.length === 0) {
      showToast('error', 'Pilih minimal satu hari untuk jadwal mingguan');
      return;
    }

    const teacherNames: Record<string, string> = {};
    for (const uid of form.teacherIds) {
      const u = piketUsers.find((p) => p.uid === uid);
      if (u) teacherNames[uid] = u.displayName;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      type: form.type,
      teacherIds: form.teacherIds,
      teacherNames,
      startTime: form.startTime,
      endTime: form.endTime,
      active: form.active,
      notes: form.notes.trim(),
      updatedAt: serverTimestamp()
    };

    if (form.type === 'MINGGUAN') {
      payload.daysOfWeek = form.daysOfWeek;
      payload.date = null;
    } else {
      payload.date = form.date;
      payload.daysOfWeek = null;
    }

    setSaving(true);
    try {
      const db = requireDb();
      if (editing) {
        await updateDoc(doc(db, 'duty_schedules', editing.id), payload);
        showToast('success', 'Jadwal piket diperbarui');
      } else {
        await addDoc(collection(db, 'duty_schedules'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        showToast('success', 'Jadwal piket berhasil dibuat');
      }
      setModalOpen(false);
    } catch (err) {
      showToast('error', 'Gagal menyimpan jadwal', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sch: DutySchedule) => {
    if (!confirm(`Hapus jadwal piket "${sch.title}"?`)) return;
    await deleteDoc(doc(requireDb(), 'duty_schedules', sch.id));
    showToast('success', 'Jadwal piket dihapus');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Jadwal Guru Piket</h1>
          <p className="text-xs text-slate-500">
            Validasi jadwal ditegakkan di Cloud Functions. Scanner hanya aktif saat jadwal guru sedang berlangsung.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ ...INITIAL_FORM, date: getTodayWibDate() });
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          Buat Jadwal Piket
        </button>
      </div>

      <DataTable
        data={schedules}
        keyExtractor={(s) => s.id}
        searchableText={(s) => `${s.title} ${s.type} ${s.date || ''} ${Object.values(s.teacherNames || {}).join(' ')}`}
        columns={[
          {
            key: 'title',
            header: 'Nama Jadwal',
            render: (s) => (
              <div>
                <p className="font-bold text-navy-900">{s.title}</p>
                <p className="text-xs text-slate-500">{s.notes || '-'}</p>
              </div>
            )
          },
          {
            key: 'when',
            header: 'Tipe & Waktu',
            render: (s) => (
              <div className="text-xs">
                <span className="font-bold text-sky-700">{s.type}</span>
                <p className="mt-0.5 text-slate-700">
                  {s.type === 'MINGGUAN'
                    ? (s.daysOfWeek || []).map((d) => DAY_NAMES_ID[d]).join(', ')
                    : s.date}
                </p>
                <p className="font-mono font-semibold text-navy-900">
                  {s.startTime} – {s.endTime} WIB
                </p>
              </div>
            )
          },
          {
            key: 'teachers',
            header: 'Guru Piket Ditugaskan',
            render: (s) => (
              <div className="flex flex-wrap gap-1">
                {s.teacherIds.map((uid) => (
                  <span
                    key={uid}
                    className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-900"
                  >
                    {s.teacherNames?.[uid] || uid.slice(0, 8)}
                  </span>
                ))}
              </div>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => <StatusBadge status={s.active ? 'AKTIF' : 'NONAKTIF'} />
          },
          {
            key: 'actions',
            header: 'Aksi',
            render: (s) => (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditing(s);
                    setForm({
                      title: s.title,
                      type: s.type,
                      date: s.date || getTodayWibDate(),
                      daysOfWeek: s.daysOfWeek || [],
                      teacherIds: s.teacherIds || [],
                      startTime: s.startTime,
                      endTime: s.endTime,
                      active: s.active,
                      notes: s.notes || ''
                    });
                    setModalOpen(true);
                  }}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          }
        ]}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Jadwal Piket' : 'Buat Jadwal Piket Baru'}
        subtitle="Pilih beberapa guru dalam satu jadwal harian, mingguan, atau berdasarkan tanggal."
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Judul Jadwal *</label>
            <input
              required
              placeholder="Cth: Piket Senin – Gerbang Utama"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Tipe Jadwal</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as DutyScheduleType })}
                className="input-field"
              >
                <option value="TANGGAL">Berdasarkan Tanggal</option>
                <option value="HARIAN">Harian (Tanggal Spesifik)</option>
                <option value="MINGGUAN">Mingguan (Berulang)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jam Mulai (WIB)</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Jam Selesai (WIB)</label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {form.type === 'MINGGUAN' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Hari Aktif</label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES_ID.map((name, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      form.daysOfWeek.includes(idx)
                        ? 'border-navy-900 bg-navy-900 text-white'
                        : 'border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Tanggal Piket *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Pilih Guru Piket ({form.teacherIds.length} dipilih) *
            </label>
            {piketUsers.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Belum ada akun pengguna dengan role GURU PIKET. Buat akun terlebih dahulu di menu Akun Pengguna.
              </p>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                {piketUsers.map((u) => (
                  <label
                    key={u.uid}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-xs ${
                      form.teacherIds.includes(u.uid)
                        ? 'border-navy-600 bg-navy-50 font-semibold text-navy-900'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.teacherIds.includes(u.uid)}
                      onChange={() => toggleTeacher(u.uid)}
                    />
                    <span className="truncate">{u.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Status Jadwal Aktif
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Catatan</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Pos gerbang utama / shift penuh"
              className="input-field"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              <CalendarClock className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
