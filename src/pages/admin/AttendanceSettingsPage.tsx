import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { Save, Plus, Trash2, Clock, CalendarOff } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { DAY_NAMES_ID, getTodayWibDate } from '../../lib/time';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AttendanceSettings, HolidayItem, SchoolClass } from '../../types';

const DEFAULT_SETTINGS: AttendanceSettings = {
  morning: {
    startTime: '06:00',
    onTimeDeadline: '07:00',
    endTime: '08:00',
    activeDays: [1, 2, 3, 4, 5, 6],
    enabled: true
  },
  afternoon: {
    startTime: '14:00',
    endTime: '16:30',
    activeDays: [1, 2, 3, 4, 5, 6],
    enabled: true
  },
  lateToleranceMinutes: 0,
  maxClockSkewSeconds: 300,
  offlineAuthDurationMinutes: 480,
  exemptedClassIds: [],
  exemptedStudentIds: []
};

export const AttendanceSettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [saving, setSaving] = useState(false);

  const [holidayForm, setHolidayForm] = useState({
    date: getTodayWibDate(),
    name: '',
    type: 'LIBUR' as HolidayItem['type'],
    disableAttendance: true,
    customMorningStart: '',
    customMorningDeadline: '',
    customMorningEnd: '',
    customAfternoonStart: '',
    customAfternoonEnd: '',
    notes: ''
  });

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(doc(db, 'system_settings', 'attendance'), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as Partial<AttendanceSettings>;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...d,
          morning: { ...DEFAULT_SETTINGS.morning, ...(d.morning || {}) },
          afternoon: { ...DEFAULT_SETTINGS.afternoon, ...(d.afternoon || {}) }
        });
      }
    });
    const u2 = onSnapshot(collection(db, 'holidays'), (s) =>
      setHolidays(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<HolidayItem, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date))
      )
    );
    const u3 = onSnapshot(collection(db, 'classes'), (s) =>
      setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
    );
    return () => {
      u1(); u2(); u3();
    };
  }, []);

  const toggleDay = (session: 'morning' | 'afternoon', day: number) => {
    setSettings((prev) => {
      const current = prev[session].activeDays;
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
      return { ...prev, [session]: { ...prev[session], activeDays: next } };
    });
  };

  const toggleExemptClass = (classId: string) => {
    setSettings((prev) => {
      const cur = prev.exemptedClassIds || [];
      return {
        ...prev,
        exemptedClassIds: cur.includes(classId) ? cur.filter((id) => id !== classId) : [...cur, classId]
      };
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(requireDb(), 'system_settings', 'attendance'),
        {
          morning: settings.morning,
          afternoon: settings.afternoon,
          lateToleranceMinutes: Math.max(0, Math.round(Number(settings.lateToleranceMinutes) || 0)),
          maxClockSkewSeconds: Math.max(30, Math.round(Number(settings.maxClockSkewSeconds) || 300)),
          offlineAuthDurationMinutes: Math.max(15, Math.round(Number(settings.offlineAuthDurationMinutes) || 480)),
          exemptedClassIds: settings.exemptedClassIds || [],
          exemptedStudentIds: settings.exemptedStudentIds || [],
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      showToast('success', 'Pengaturan jam absensi berhasil disimpan');
    } catch (err) {
      showToast('error', 'Gagal menyimpan pengaturan', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(requireDb(), 'holidays'), {
        date: holidayForm.date,
        name: holidayForm.name.trim(),
        type: holidayForm.type,
        disableAttendance: holidayForm.disableAttendance,
        customMorningStart: holidayForm.customMorningStart || null,
        customMorningDeadline: holidayForm.customMorningDeadline || null,
        customMorningEnd: holidayForm.customMorningEnd || null,
        customAfternoonStart: holidayForm.customAfternoonStart || null,
        customAfternoonEnd: holidayForm.customAfternoonEnd || null,
        notes: holidayForm.notes.trim(),
        createdAt: serverTimestamp()
      });
      setHolidayForm({ ...holidayForm, name: '', notes: '' });
      showToast('success', 'Agenda / hari libur ditambahkan');
    } catch (err) {
      showToast('error', 'Gagal menambah hari libur', err instanceof Error ? err.message : '');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Pengaturan Jam Absensi & Kalender Sekolah</h1>
        <p className="text-xs text-slate-500">
          Seluruh jam menggunakan waktu resmi server Asia/Jakarta (WIB) dan dapat diubah kapan saja oleh Admin.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Morning Settings */}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy-950">
              <Clock className="h-4 w-4 text-emerald-600" />
              Sesi Absensi Pagi
            </h2>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={settings.morning.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, morning: { ...settings.morning, enabled: e.target.checked } })
                }
              />
              Aktif
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jam Mulai</label>
              <input
                type="time"
                value={settings.morning.startTime}
                onChange={(e) =>
                  setSettings({ ...settings, morning: { ...settings.morning, startTime: e.target.value } })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tepat Waktu</label>
              <input
                type="time"
                value={settings.morning.onTimeDeadline}
                onChange={(e) =>
                  setSettings({ ...settings, morning: { ...settings.morning, onTimeDeadline: e.target.value } })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Batas Akhir</label>
              <input
                type="time"
                value={settings.morning.endTime}
                onChange={(e) =>
                  setSettings({ ...settings, morning: { ...settings.morning, endTime: e.target.value } })
                }
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Hari Aktif Pagi</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES_ID.map((name, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => toggleDay('morning', i)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    settings.morning.activeDays.includes(i)
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Afternoon Settings */}
        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-navy-950">
              <Clock className="h-4 w-4 text-sky-600" />
              Sesi Absensi Sore (Pulang)
            </h2>
            <label className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={settings.afternoon.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, afternoon: { ...settings.afternoon, enabled: e.target.checked } })
                }
              />
              Aktif
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jam Mulai</label>
              <input
                type="time"
                value={settings.afternoon.startTime}
                onChange={(e) =>
                  setSettings({ ...settings, afternoon: { ...settings.afternoon, startTime: e.target.value } })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Jam Selesai</label>
              <input
                type="time"
                value={settings.afternoon.endTime}
                onChange={(e) =>
                  setSettings({ ...settings, afternoon: { ...settings.afternoon, endTime: e.target.value } })
                }
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Hari Aktif Sore</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES_ID.map((name, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => toggleDay('afternoon', i)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    settings.afternoon.activeDays.includes(i)
                      ? 'border-navy-900 bg-navy-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tolerance, Offline & Class Exemptions */}
        <div className="card space-y-4 p-5 lg:col-span-2">
          <h2 className="text-base font-bold text-navy-950">
            Toleransi Keterlambatan, Keamanan Offline & Pengecualian Kelas
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Toleransi Keterlambatan (menit)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={settings.lateToleranceMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, lateToleranceMinutes: Number(e.target.value) })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Batas Selisih Jam Perangkat Offline (detik)
              </label>
              <input
                type="number"
                min={30}
                max={3600}
                value={settings.maxClockSkewSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, maxClockSkewSeconds: Number(e.target.value) })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Masa Berlaku Otorisasi Offline (menit)
              </label>
              <input
                type="number"
                min={15}
                max={1440}
                value={settings.offlineAuthDurationMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, offlineAuthDurationMinutes: Number(e.target.value) })
                }
                className="input-field"
              />
            </div>
          </div>

          {classes.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Pengecualian Absensi per Kelas (contoh: kelas sedang PKL / magang)
              </label>
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleExemptClass(c.id)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                      settings.exemptedClassIds?.includes(c.id)
                        ? 'border-amber-500 bg-amber-100 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan Jam Absensi'}
            </button>
          </div>
        </div>
      </form>

      {/* Holidays, Special Days & School Events */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <form onSubmit={handleAddHoliday} className="card space-y-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-navy-950">
            <CalendarOff className="h-4 w-4 text-rose-600" />
            Kalender Hari Libur & Hari Khusus
          </h3>
          <input
            type="date"
            required
            value={holidayForm.date}
            onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
            className="input-field"
          />
          <input
            required
            placeholder="Nama Hari Libur / Kegiatan Sekolah"
            value={holidayForm.name}
            onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
            className="input-field"
          />
          <select
            value={holidayForm.type}
            onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as HolidayItem['type'] })}
            className="input-field"
          >
            <option value="LIBUR">Hari Libur Nasional / Sekolah</option>
            <option value="HARI_KHUSUS">Hari Khusus (Jam Kustom)</option>
            <option value="KEGIATAN_SEKOLAH">Jadwal Kegiatan Sekolah</option>
            <option value="PENGECUALIAN">Pengecualian Absensi</option>
          </select>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={holidayForm.disableAttendance}
              onChange={(e) => setHolidayForm({ ...holidayForm, disableAttendance: e.target.checked })}
            />
            Nonaktifkan absensi pada tanggal ini
          </label>
          {!holidayForm.disableAttendance && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input type="time" placeholder="Mulai Pagi" value={holidayForm.customMorningStart} onChange={(e) => setHolidayForm({ ...holidayForm, customMorningStart: e.target.value })} className="input-field" />
              <input type="time" placeholder="Batas Pagi" value={holidayForm.customMorningEnd} onChange={(e) => setHolidayForm({ ...holidayForm, customMorningEnd: e.target.value })} className="input-field" />
            </div>
          )}
          <button type="submit" className="btn-primary w-full">
            <Plus className="h-4 w-4" />
            Tambah ke Kalender
          </button>
        </form>

        <div className="card overflow-hidden lg:col-span-2">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Absensi</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{h.date}</td>
                  <td className="px-4 py-3 font-medium">{h.name}</td>
                  <td className="px-4 py-3 text-xs">{h.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={h.disableAttendance ? 'NONAKTIF' : 'AKTIF'}
                      label={h.disableAttendance ? 'Diliburkan' : 'Jam Khusus'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteDoc(doc(requireDb(), 'holidays', h.id))}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                    Belum ada jadwal hari libur atau kegiatan khusus.
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
