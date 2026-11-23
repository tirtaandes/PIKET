import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Plus,
  Upload,
  Download,
  Edit3,
  ArrowRightLeft,
  History,
  UserX,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import { requireDb, requireStorage } from '../../lib/firebase';
import { functionsApi } from '../../lib/functionsApi';
import {
  downloadStudentImportTemplate,
  exportRowsToExcel,
  parseAndValidateStudentExcel,
  ParsedStudentRow
} from '../../lib/excel';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { DataTable } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { AcademicYear, Major, SchoolClass, Student } from '../../types';

const EMPTY_FORM = {
  nis: '',
  nisn: '',
  fullName: '',
  gender: 'L' as 'L' | 'P',
  birthPlaceDate: '',
  address: '',
  phone: '',
  parentName: '',
  classId: '',
  academicYearId: ''
};

export const StudentsPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Transfer class modal
  const [transferTarget, setTransferTarget] = useState<Student | null>(null);
  const [newClassId, setNewClassId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // History modal
  const [historyTarget, setHistoryTarget] = useState<Student | null>(null);

  // Import Excel modal
  const [importOpen, setImportOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    const db = requireDb();
    const unsubs = [
      onSnapshot(collection(db, 'students'), (s) =>
        setStudents(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) })))
      ),
      onSnapshot(collection(db, 'classes'), (s) =>
        setClasses(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolClass, 'id'>) })))
      ),
      onSnapshot(collection(db, 'majors'), (s) =>
        setMajors(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Major, 'id'>) })))
      ),
      onSnapshot(collection(db, 'academic_years'), (s) =>
        setYears(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcademicYear, 'id'>) })))
      )
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filteredStudents = students.filter((s) => {
    if (filterClassId && s.classId !== filterClassId) return false;
    if (filterStatus === 'ACTIVE' && !s.active) return false;
    if (filterStatus === 'INACTIVE' && s.active) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    const activeYear = years.find((y) => y.active);
    setForm({ ...EMPTY_FORM, academicYearId: activeYear?.id || '' });
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEdit = (stu: Student) => {
    setEditing(stu);
    setForm({
      nis: stu.nis,
      nisn: stu.nisn,
      fullName: stu.fullName,
      gender: stu.gender,
      birthPlaceDate: stu.birthPlaceDate || '',
      address: stu.address || '',
      phone: stu.phone || '',
      parentName: stu.parentName || '',
      classId: stu.classId,
      academicYearId: stu.academicYearId
    });
    setPhotoFile(null);
    setModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = requireDb();

    const nisTrim = form.nis.trim();
    const nisnTrim = form.nisn.trim();
    const dupNis = students.find((s) => s.nis.trim() === nisTrim && s.id !== editing?.id);
    if (dupNis) {
      showToast('error', 'NIS Duplikat', `NIS ${nisTrim} sudah digunakan oleh ${dupNis.fullName}.`);
      return;
    }
    const dupNisn = students.find((s) => s.nisn.trim() === nisnTrim && s.id !== editing?.id);
    if (dupNisn) {
      showToast('error', 'NISN Duplikat', `NISN ${nisnTrim} sudah digunakan oleh ${dupNisn.fullName}.`);
      return;
    }

    const selectedClass = classes.find((c) => c.id === form.classId);
    if (!selectedClass) {
      showToast('error', 'Kelas wajib dipilih');
      return;
    }
    const selectedYear = years.find((y) => y.id === form.academicYearId) || years.find((y) => y.active);
    const major = majors.find((m) => m.id === selectedClass.majorId);

    setSaving(true);
    try {
      const payload = {
        nis: nisTrim,
        nisn: nisnTrim,
        fullName: form.fullName.trim(),
        gender: form.gender,
        birthPlaceDate: form.birthPlaceDate.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        parentName: form.parentName.trim(),
        classId: selectedClass.id,
        className: selectedClass.name,
        majorId: selectedClass.majorId || major?.id || '',
        majorName: selectedClass.majorName || major?.name || '',
        academicYearId: selectedYear?.id || selectedClass.academicYearId || '',
        academicYearName: selectedYear?.name || selectedClass.academicYearName || '',
        updatedAt: serverTimestamp()
      };

      let studentId = editing?.id || '';

      if (editing) {
        await updateDoc(doc(db, 'students', editing.id), payload);
      } else {
        const refDoc = await addDoc(collection(db, 'students'), {
          ...payload,
          photoUrl: '',
          active: true,
          activeQrToken: null,
          classHistory: [],
          createdAt: serverTimestamp()
        });
        studentId = refDoc.id;
      }

      // Upload student photo if provided
      if (photoFile && studentId) {
        const storage = requireStorage();
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `students/${selectedClass.id}/${studentId}/photo.${ext}`);
        await uploadBytes(storageRef, photoFile);
        const photoUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'students', studentId), { photoUrl });
      }

      // Auto-generate opaque QR token for newly registered student via Cloud Function
      if (!editing && studentId) {
        try {
          await functionsApi.generateStudentQr({ studentId });
        } catch {
          showToast('warning', 'Siswa disimpan, QR belum dibuat', 'Anda dapat generate QR di menu QR & Kartu Siswa.');
        }
      }

      showToast('success', editing ? 'Data siswa diperbarui' : 'Siswa baru berhasil didaftarkan & QR dibuat');
      setModalOpen(false);
    } catch (err) {
      showToast('error', 'Gagal menyimpan siswa', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (stu: Student) => {
    const db = requireDb();
    try {
      await updateDoc(doc(db, 'students', stu.id), {
        active: !stu.active,
        updatedAt: serverTimestamp()
      });
      showToast('success', stu.active ? 'Siswa dinonaktifkan secara aman' : 'Siswa diaktifkan kembali');
    } catch (err) {
      showToast('error', 'Gagal mengubah status siswa', err instanceof Error ? err.message : '');
    }
  };

  const handleTransferClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget || !newClassId) return;
    const targetCls = classes.find((c) => c.id === newClassId);
    if (!targetCls) return;

    const db = requireDb();
    const historyEntry = {
      fromClassId: transferTarget.classId,
      fromClassName: transferTarget.className,
      toClassId: targetCls.id,
      toClassName: targetCls.name,
      academicYearName: targetCls.academicYearName || transferTarget.academicYearName,
      movedAtIso: new Date().toISOString(),
      movedByName: profile?.displayName || 'Admin',
      reason: transferReason.trim() || 'Pindah kelas / naik kelas'
    };

    try {
      await updateDoc(doc(db, 'students', transferTarget.id), {
        classId: targetCls.id,
        className: targetCls.name,
        majorId: targetCls.majorId,
        majorName: targetCls.majorName,
        classHistory: [...(transferTarget.classHistory || []), historyEntry],
        updatedAt: serverTimestamp()
      });
      showToast('success', `${transferTarget.fullName} dipindahkan ke ${targetCls.name}`);
      setTransferTarget(null);
      setNewClassId('');
      setTransferReason('');
    } catch (err) {
      showToast('error', 'Gagal memindahkan kelas', err instanceof Error ? err.message : '');
    }
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportReport(null);
    const rows = await parseAndValidateStudentExcel(file, students, classes);
    setParsedRows(rows);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid && r.matchedClass);
    if (validRows.length === 0) return;

    const db = requireDb();
    const activeYear = years.find((y) => y.active);
    setImporting(true);
    let success = 0;
    let failed = parsedRows.length - validRows.length;

    for (const row of validRows) {
      try {
        const cls = row.matchedClass!;
        const refDoc = await addDoc(collection(db, 'students'), {
          nis: row.nis,
          nisn: row.nisn,
          fullName: row.fullName,
          gender: row.gender,
          birthPlaceDate: row.birthPlaceDate,
          address: row.address,
          phone: row.phone,
          parentName: row.parentName,
          classId: cls.id,
          className: cls.name,
          majorId: cls.majorId,
          majorName: cls.majorName,
          academicYearId: activeYear?.id || cls.academicYearId,
          academicYearName: activeYear?.name || cls.academicYearName,
          photoUrl: '',
          active: true,
          activeQrToken: null,
          classHistory: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        try {
          await functionsApi.generateStudentQr({ studentId: refDoc.id });
        } catch {
          // QR can be bulk-generated if offline/rate-limited
        }
        success += 1;
      } catch {
        failed += 1;
      }
    }

    setImporting(false);
    setImportReport({ success, failed });
    showToast('success', 'Import Excel Selesai', `${success} berhasil diimpor, ${failed} gagal.`);
  };

  const handleExportStudents = () => {
    const rows = filteredStudents.map((s, idx) => ({
      No: idx + 1,
      NIS: s.nis,
      NISN: s.nisn,
      'Nama Lengkap': s.fullName,
      JK: s.gender,
      TTL: s.birthPlaceDate,
      Alamat: s.address,
      Telepon: s.phone,
      'Nama Orang Tua': s.parentName,
      Kelas: s.className,
      Jurusan: s.majorName,
      'Tahun Pelajaran': s.academicYearName,
      Status: s.active ? 'AKTIF' : 'NONAKTIF',
      'Status QR': s.activeQrToken ? 'TERSEDIA' : 'BELUM ADA'
    }));
    exportRowsToExcel(rows, 'Data Siswa', 'Data_Siswa_SMKN6_Muaro_Jambi.xlsx');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">Manajemen Data Siswa</h1>
          <p className="text-xs text-slate-500">
            Kelola profil siswa, foto, perpindahan kelas, dan import/export Excel tervalidasi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setParsedRows([]); setImportReport(null); setImportOpen(true); }} className="btn-secondary">
            <Upload className="h-4 w-4" />
            Import Excel
          </button>
          <button onClick={handleExportStudents} className="btn-secondary">
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-4 w-4" />
            Tambah Siswa
          </button>
        </div>
      </div>

      <DataTable
        data={filteredStudents}
        keyExtractor={(s) => s.id}
        searchableText={(s) => `${s.nis} ${s.nisn} ${s.fullName} ${s.className} ${s.majorName}`}
        searchPlaceholder="Cari nama, NIS, NISN, atau kelas..."
        toolbarRight={
          <>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="input-field w-44"
            >
              <option value="">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="input-field w-36"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
              <option value="ALL">Semua Status</option>
            </select>
          </>
        }
        columns={[
          {
            key: 'student',
            header: 'Siswa',
            render: (s) => (
              <div className="flex items-center gap-3">
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={s.fullName} className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy-900">
                    {s.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{s.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">
                    NIS: {s.nis} • NISN: {s.nisn}
                  </p>
                </div>
              </div>
            )
          },
          {
            key: 'class',
            header: 'Kelas & Jurusan',
            render: (s) => (
              <div>
                <p className="font-semibold text-navy-900">{s.className}</p>
                <p className="text-xs text-slate-500">{s.majorName}</p>
              </div>
            )
          },
          {
            key: 'parent',
            header: 'Orang Tua / Kontak',
            render: (s) => (
              <div className="text-xs">
                <p className="font-medium text-slate-800">{s.parentName || '-'}</p>
                <p className="text-slate-500">{s.phone || '-'}</p>
              </div>
            )
          },
          {
            key: 'qr',
            header: 'QR & Status',
            render: (s) => (
              <div className="flex flex-col gap-1">
                <StatusBadge status={s.active ? 'AKTIF' : 'NONAKTIF'} />
                <span className={`text-[11px] font-semibold ${s.activeQrToken ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {s.activeQrToken ? 'QR Aktif' : 'Belum Ada QR'}
                </span>
              </div>
            )
          },
          {
            key: 'actions',
            header: 'Aksi',
            render: (s) => (
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(s)} title="Edit" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-navy-900">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => { setTransferTarget(s); setNewClassId(''); }} title="Pindah Kelas" className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50">
                  <ArrowRightLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setHistoryTarget(s)} title="Riwayat Kelas" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
                  <History className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleToggleActive(s)}
                  title={s.active ? 'Nonaktifkan' : 'Aktifkan'}
                  className={`rounded-lg p-1.5 ${s.active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {s.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </button>
              </div>
            )
          }
        ]}
      />

      {/* Add / Edit Student Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="QR Code unik akan dibuat otomatis saat siswa baru didaftarkan."
        size="lg"
      >
        <form onSubmit={handleSaveStudent} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">NIS *</label>
            <input required value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">NISN *</label>
            <input required value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Lengkap *</label>
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Jenis Kelamin</label>
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })} className="input-field">
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Tempat, Tanggal Lahir</label>
            <input value={form.birthPlaceDate} onChange={(e) => setForm({ ...form, birthPlaceDate: e.target.value })} placeholder="Muaro Jambi, 10 Mei 2009" className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Kelas *</label>
            <select required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="input-field">
              <option value="">-- Pilih Kelas --</option>
              {classes.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.majorName})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Tahun Pelajaran</label>
            <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })} className="input-field">
              <option value="">-- Pilih Tahun Pelajaran --</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.name} ({y.semester})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Orang Tua / Wali</label>
            <input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nomor Telepon</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Alamat</label>
            <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Foto Siswa (JPG/PNG/WebP, maks 2MB)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="input-field text-xs" />
          </div>
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Data Siswa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Class Modal */}
      <Modal
        open={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        title="Pindahkan Siswa ke Kelas Lain"
        subtitle={transferTarget ? `${transferTarget.fullName} (Saat ini: ${transferTarget.className})` : ''}
      >
        <form onSubmit={handleTransferClass} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Kelas Tujuan *</label>
            <select required value={newClassId} onChange={(e) => setNewClassId(e.target.value)} className="input-field">
              <option value="">-- Pilih Kelas Baru --</option>
              {classes.filter((c) => c.active && c.id !== transferTarget?.classId).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.majorName})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Keterangan / Alasan</label>
            <input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Naik kelas / mutasi rombel" className="input-field" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTransferTarget(null)} className="btn-secondary">Batal</button>
            <button type="submit" className="btn-primary">Simpan Perpindahan</button>
          </div>
        </form>
      </Modal>

      {/* Class History Modal */}
      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title="Riwayat Perpindahan Kelas"
        subtitle={historyTarget ? `${historyTarget.fullName} (NIS: ${historyTarget.nis})` : ''}
      >
        {!historyTarget?.classHistory?.length ? (
          <p className="py-6 text-center text-xs text-slate-500">Belum ada riwayat perpindahan kelas.</p>
        ) : (
          <div className="space-y-2.5">
            {historyTarget.classHistory.map((h, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-bold text-navy-900">
                  {h.fromClassName} → {h.toClassName}
                </p>
                <p className="mt-0.5 text-slate-600">{h.reason}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {new Date(h.movedAtIso).toLocaleString('id-ID')} • oleh {h.movedByName}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Import Excel Modal with Preview & Validation */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Siswa dari Excel"
        subtitle="Validasi otomatis: NIS/NISN unik & kelas harus tersedia."
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-xs text-slate-600">
              Gunakan template resmi agar seluruh kolom terbaca dengan benar.
            </div>
            <button onClick={downloadStudentImportTemplate} className="btn-secondary text-xs">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Unduh Template Excel
            </button>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelFileChange}
            className="input-field text-xs"
          />

          {importReport && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
              Hasil Import: {importReport.success} data berhasil diimpor, {importReport.failed} data gagal/dilewati.
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-700">
                  Valid: {parsedRows.filter((r) => r.valid).length} baris
                </span>
                <span className="text-rose-700">
                  Tidak Valid: {parsedRows.filter((r) => !r.valid).length} baris
                </span>
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Baris</th>
                      <th className="px-3 py-2 text-left">NIS / NISN</th>
                      <th className="px-3 py-2 text-left">Nama</th>
                      <th className="px-3 py-2 text-left">Kelas</th>
                      <th className="px-3 py-2 text-left">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr key={row.rowNumber} className={row.valid ? '' : 'bg-rose-50/70'}>
                        <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-mono">{row.nis} / {row.nisn}</td>
                        <td className="px-3 py-2 font-semibold">{row.fullName}</td>
                        <td className="px-3 py-2">{row.className}</td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <StatusBadge status="SUCCESS" label="Valid" />
                          ) : (
                            <span className="text-rose-700">{row.errors.join('; ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setImportOpen(false)} className="btn-secondary">Tutup</button>
                <button
                  disabled={importing || parsedRows.filter((r) => r.valid).length === 0}
                  onClick={handleExecuteImport}
                  className="btn-primary"
                >
                  {importing
                    ? 'Mengimpor Data...'
                    : `Import ${parsedRows.filter((r) => r.valid).length} Data Valid`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
