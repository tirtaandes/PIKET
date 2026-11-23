import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Save, Upload } from 'lucide-react';
import { requireDb, requireStorage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export const SchoolSettingsPage: React.FC = () => {
  const { school, profile } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    schoolName: school.schoolName,
    address: school.address,
    academicYear: school.academicYear,
    principalName: school.principalName,
    principalNip: school.principalNip || '',
    contact: school.contact,
    logoUrl: school.logoUrl
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      schoolName: school.schoolName,
      address: school.address,
      academicYear: school.academicYear,
      principalName: school.principalName,
      principalNip: school.principalNip || '',
      contact: school.contact,
      logoUrl: school.logoUrl
    });
  }, [school]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalLogoUrl = form.logoUrl;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() || 'png';
        const storageRef = ref(requireStorage(), `school/logo.${ext}`);
        await uploadBytes(storageRef, logoFile);
        finalLogoUrl = await getDownloadURL(storageRef);
      }

      // Only persist fields allowed by firestore.rules isValidSchoolProfile
      const payload: Record<string, unknown> = {
        schoolName: form.schoolName.trim(),
        address: form.address.trim(),
        academicYear: form.academicYear.trim(),
        principalName: form.principalName.trim(),
        principalNip: form.principalNip.trim(),
        contact: form.contact.trim(),
        timezone: 'Asia/Jakarta',
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || ''
      };
      if (finalLogoUrl && /^https?:\/\//.test(finalLogoUrl)) {
        payload.logoUrl = finalLogoUrl;
      }

      await setDoc(doc(requireDb(), 'system_settings', 'school_profile'), payload, { merge: true });
      setLogoFile(null);
      showToast('success', 'Identitas sekolah berhasil diperbarui');
    } catch (err) {
      showToast('error', 'Gagal menyimpan identitas sekolah', err instanceof Error ? err.message : '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950">Pengaturan Identitas Sekolah</h1>
        <p className="text-xs text-slate-500">
          Identitas ini ditampilkan pada halaman login, kartu siswa CR80, dan kop surat laporan resmi.
        </p>
      </div>

      <form onSubmit={handleSave} className="card space-y-4 p-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <img
            src={logoFile ? URL.createObjectURL(logoFile) : form.logoUrl || '/school-logo-default.svg'}
            alt="Logo Sekolah"
            className="h-20 w-20 rounded-2xl border border-slate-200 bg-navy-950 object-contain p-2"
          />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-navy-950">Logo Resmi Sekolah</p>
            <label className="btn-secondary cursor-pointer text-xs">
              <Upload className="h-4 w-4" />
              Unggah Logo (PNG/JPG/WebP)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Sekolah *</label>
            <input
              required
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Tahun Pelajaran *</label>
            <input
              required
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              placeholder="2026/2027"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Kontak Sekolah</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nama Kepala Sekolah</label>
            <input
              value={form.principalName}
              onChange={(e) => setForm({ ...form, principalName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">NIP Kepala Sekolah</label>
            <input
              value={form.principalNip}
              onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Alamat Lengkap Sekolah</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Identitas Sekolah'}
          </button>
        </div>
      </form>
    </div>
  );
};
