import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, QrCode, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getHomePathForRole } from '../components/layout/ProtectedRoute';

export const LoginPage: React.FC = () => {
  const { profile, school, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (profile) {
    return <Navigate to={getHomePathForRole(profile.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login gagal.';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Email atau kata sandi tidak sesuai.');
      } else if (msg.includes('user-disabled')) {
        setError('Akun Anda telah dinonaktifkan oleh Administrator.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Branding Panel */}
      <div className="relative flex flex-col justify-between bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-8 text-white lg:w-1/2 lg:p-14">
        <div className="flex items-center gap-3.5">
          <img
            src={school.logoUrl || '/school-logo-default.svg'}
            alt={school.schoolName}
            className="h-14 w-14 rounded-2xl bg-white/10 object-contain p-1.5 ring-1 ring-white/20"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300">
              {school.appName || 'SMART ATTENDANCE'}
            </p>
            <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">
              {school.schoolName || 'SMK NEGERI 6 MUARO JAMBI'}
            </h1>
          </div>
        </div>

        <div className="my-10 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-sky-200 ring-1 ring-white/15">
            <QrCode className="h-4 w-4 text-sky-300" />
            Sistem Kehadiran QR Code Real-Time & Offline-Ready
          </div>
          <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            Disiplin Kehadiran Siswa Terintegrasi dalam Satu Pemindaian.
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-slate-300">
            Absensi pagi, kepulangan sore, jadwal guru piket tervalidasi server, persetujuan izin
            wali kelas, serta monitoring siswa keluar-masuk sekolah berbasis Cloud Firebase.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <p className="text-xs font-bold text-sky-300">ADMIN</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Kelola siswa, QR, jadwal piket, jam absensi & laporan.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <p className="text-xs font-bold text-emerald-300">GURU PIKET</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Scan pagi, sore, izin keluar & kembali saat jadwal aktif.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <p className="text-xs font-bold text-amber-300">WALI KELAS</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Monitoring kelas, pengajuan & persetujuan izin siswa.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1 border-t border-white/10 pt-4 text-xs text-slate-300">
          <p className="font-semibold text-white">{school.schoolName}</p>
          <p>{school.address}</p>
          <p className="text-sky-300">
            Tahun Pelajaran {school.academicYear} • Zona Waktu Asia/Jakarta (WIB)
          </p>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6 sm:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-sky-300 shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-navy-950">Masuk ke SMART ATTENDANCE</h3>
            <p className="mt-1 text-xs text-slate-500">
              Gunakan akun resmi yang telah ditetapkan oleh Administrator sekolah.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email Pengguna
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@smkn6muarojambi.sch.id"
                  className="input-field pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-sm"
            >
              {submitting ? 'Memverifikasi Akun...' : 'Masuk Aplikasi'}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Hak akses diverifikasi melalui Firebase Auth Custom Claims & Cloud Functions.
          </p>
        </div>
      </div>
    </div>
  );
};
