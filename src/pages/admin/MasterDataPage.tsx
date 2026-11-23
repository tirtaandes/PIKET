import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, CheckCircle2 } from 'lucide-react';
import { requireDb } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AcademicYear, Major, SchoolClass, Teacher } from '../../types';

export const MasterDataPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'CLASSES' | 'MAJORS' | 'YEARS'>('CLASSES');

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [classForm, setClassForm] = useState({ name: '', grade: 'X' as 'X' | 'XI' | 'XII', majorId: '', academicYearId: '', homeroomTeacherId: '' });
  const [majorForm, setMajorForm] = useState({ code: '', name: '' });
  const [yearForm, setYearForm] = useState({ name: '2026/2027', semester: 'GANJIL' as 'GANJIL' | 'GENAP' });

  useEffect(() => {
    const db = requireDb();
    const u1 = onSnapshot(collection(db, 'classes'), (s) =>
      setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
    );
    const u2 = onSnapshot(collection(db, 'majors'), (s) =>
      setMajors(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Major, 'id'>) })))
    );
    const u3 = onSnapshot(collection(db, 'academic_years'), (s) =>
      setYears(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })))
    );
    const u4 = onSnapshot(collection(db, 'teachers'), (s) =>
      setTeachers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) })))
    );
    return () => {
      u1(); u2(); u3(); u4();
    };
  }, []);

  const addMajor = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(requireDb(), 'majors'), {
      code: majorForm.code.trim().toUpperCase(),
      name: majorForm.name.trim(),
      active: true,
      createdAt: serverTimestamp()
    });
    setMajorForm({ code: '', name: '' });
    showToast('success', 'Jurusan berhasil ditambahkan');
  };

  const addAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(requireDb(), 'academic_years'), {
      name: yearForm.name.trim(),
      semester: yearForm.semester,
      active: years.length === 0,
      createdAt: serverTimestamp()
    });
    showToast('success', 'Tahun pelajaran ditambahkan');
  };

  const setActiveYear = async (target: AcademicYear) => {
    const db = requireDb();
    await Promise.all(
      years.map((y) => updateDoc(doc(db, 'academic_years', y.id), { active: y.id === target.id }))
    );
    showToast('success', `Tahun pelajaran aktif diatur ke ${target.name} (${target.semester})`);
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const major = majors.find((m) => m.id === classForm.majorId);
    const year = years.find((y) => y.id === classForm.academicYearId) || years.find((y) => y.active);
    const homeroom = teachers.find((t) => t.id === classForm.homeroomTeacherId);
    if (!major) {
      showToast('error', 'Pilih jurusan terlebih dahulu');
      return;
    }
    await addDoc(collection(requireDb(), 'classes'), {
      name: classForm.name.trim(),
      grade: classForm.grade,
      majorId: major.id,
      majorName: major.name,
      academicYearId: year?.id || '',
      academicYearName: year?.name || '',
      homeroomTeacherId: homeroom?.id || '',
      homeroomTeacherName: homeroom?.fullName || '',
      active: true,
      createdAt: serverTimestamp()
    });
    setClassForm({ name: '', grade: 'X', majorId: '', academicYearId: '', homeroomTeacherId: '' });
    showToast('success', 'Kelas baru berhasil dibuat');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Data Master: Kelas, Jurusan & Tahun Pelajaran</h1>
        <p className="text-xs text-slate-500">Atur struktur rombongan belajar SMKN 6 Muaro Jambi.</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(['CLASSES', 'MAJORS', 'YEARS'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              tab === t ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t === 'CLASSES' ? `Kelas (${classes.length})` : t === 'MAJORS' ? `Jurusan (${majors.length})` : `Tahun Pelajaran (${years.length})`}
          </button>
        ))}
      </div>

      {tab === 'CLASSES' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <form onSubmit={addClass} className="card space-y-3 p-5">
            <h3 className="text-sm font-bold text-navy-950">Tambah Kelas Baru</h3>
            <input required placeholder="Nama Kelas (cth: X TKJ 1)" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} className="input-field" />
            <select value={classForm.grade} onChange={(e) => setClassForm({ ...classForm, grade: e.target.value as 'X' | 'XI' | 'XII' })} className="input-field">
              <option value="X">Tingkat X</option>
              <option value="XI">Tingkat XI</option>
              <option value="XII">Tingkat XII</option>
            </select>
            <select required value={classForm.majorId} onChange={(e) => setClassForm({ ...classForm, majorId: e.target.value })} className="input-field">
              <option value="">-- Pilih Jurusan --</option>
              {majors.map((m) => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
            </select>
            <select value={classForm.academicYearId} onChange={(e) => setClassForm({ ...classForm, academicYearId: e.target.value })} className="input-field">
              <option value="">-- Tahun Pelajaran Aktif --</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name} ({y.semester})</option>)}
            </select>
            <select value={classForm.homeroomTeacherId} onChange={(e) => setClassForm({ ...classForm, homeroomTeacherId: e.target.value })} className="input-field">
              <option value="">-- Wali Kelas (Opsional) --</option>
              {teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
            <button type="submit" className="btn-primary w-full"><Plus className="h-4 w-4" /> Simpan Kelas</button>
          </form>

          <div className="card overflow-hidden lg:col-span-2">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Kelas</th>
                  <th className="px-4 py-3 text-left">Jurusan</th>
                  <th className="px-4 py-3 text-left">Wali Kelas</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-bold text-navy-900">{c.name}</td>
                    <td className="px-4 py-3 text-xs">{c.majorName}</td>
                    <td className="px-4 py-3 text-xs">{c.homeroomTeacherName || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.active ? 'AKTIF' : 'NONAKTIF'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'MAJORS' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <form onSubmit={addMajor} className="card space-y-3 p-5">
            <h3 className="text-sm font-bold text-navy-950">Tambah Jurusan</h3>
            <input required placeholder="Kode (cth: TKJ)" value={majorForm.code} onChange={(e) => setMajorForm({ ...majorForm, code: e.target.value })} className="input-field" />
            <input required placeholder="Nama Jurusan Lengkap" value={majorForm.name} onChange={(e) => setMajorForm({ ...majorForm, name: e.target.value })} className="input-field" />
            <button type="submit" className="btn-primary w-full"><Plus className="h-4 w-4" /> Simpan Jurusan</button>
          </form>

          <div className="card overflow-hidden lg:col-span-2">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Kode</th>
                  <th className="px-4 py-3 text-left">Nama Jurusan</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {majors.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 font-mono font-bold text-navy-900">{m.code}</td>
                    <td className="px-4 py-3">{m.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.active ? 'AKTIF' : 'NONAKTIF'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'YEARS' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <form onSubmit={addAcademicYear} className="card space-y-3 p-5">
            <h3 className="text-sm font-bold text-navy-950">Tambah Tahun Pelajaran</h3>
            <input required placeholder="2026/2027" value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} className="input-field" />
            <select value={yearForm.semester} onChange={(e) => setYearForm({ ...yearForm, semester: e.target.value as 'GANJIL' | 'GENAP' })} className="input-field">
              <option value="GANJIL">Semester Ganjil</option>
              <option value="GENAP">Semester Genap</option>
            </select>
            <button type="submit" className="btn-primary w-full"><Plus className="h-4 w-4" /> Simpan Tahun Pelajaran</button>
          </form>

          <div className="card overflow-hidden lg:col-span-2">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Tahun Pelajaran</th>
                  <th className="px-4 py-3 text-left">Semester</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {years.map((y) => (
                  <tr key={y.id}>
                    <td className="px-4 py-3 font-bold text-navy-900">{y.name}</td>
                    <td className="px-4 py-3 text-xs">{y.semester}</td>
                    <td className="px-4 py-3"><StatusBadge status={y.active ? 'AKTIF' : 'NONAKTIF'} /></td>
                    <td className="px-4 py-3">
                      {!y.active && (
                        <button onClick={() => setActiveYear(y)} className="btn-secondary px-2.5 py-1 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Aktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
