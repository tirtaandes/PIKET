import React from 'react';
import { ShieldAlert, Terminal, KeyRound, CheckCircle2 } from 'lucide-react';

export const FirebaseSetupGuide: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-5">
          <img
            src="/school-logo-default.svg"
            alt="SMKN 6 Muaro Jambi"
            className="h-14 w-14 rounded-xl"
          />
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
              <ShieldAlert className="h-3.5 w-3.5" />
              Konfigurasi Firebase Diperlukan
            </span>
            <h1 className="mt-1 text-xl font-bold text-navy-900">
              SMART ATTENDANCE – SMK NEGERI 6 MUARO JAMBI
            </h1>
            <p className="text-xs text-slate-500">
              Aplikasi tidak menggunakan dummy database atau credential palsu. Hubungkan ke proyek Firebase produksi Anda.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4 text-sm text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 font-bold text-navy-900">
              <KeyRound className="h-4 w-4 text-sky-600" />
              1. Salin .env.example menjadi .env
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Ambil konfigurasi Web App dari Firebase Console → Project Settings → Your Apps, lalu isi file <code>.env</code> di root proyek:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-950 p-3 text-xs text-sky-200">
{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FUNCTIONS_REGION=asia-southeast2`}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 font-bold text-navy-900">
              <Terminal className="h-4 w-4 text-emerald-600" />
              2. Deploy Rules, Indexes & Cloud Functions
            </h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-950 p-3 text-xs text-emerald-300">
{`npm install
npm --prefix functions install
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage,functions`}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 font-bold text-navy-900">
              <CheckCircle2 className="h-4 w-4 text-navy-700" />
              3. Bootstrap Akun Administrator Awal (Aman)
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Jalankan skrip bootstrap untuk membuat akun ADMIN pertama tanpa menyimpan password di source code:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-navy-950 p-3 text-xs text-amber-200">
{`$env:GOOGLE_APPLICATION_CREDENTIALS="C:\\secure\\serviceAccountKey.json"
npm run bootstrap:admin`}
            </pre>
          </div>

          <p className="text-xs text-slate-500">
            Dokumentasi lengkap tersedia pada folder <code>docs/INSTALASI.md</code> dan{' '}
            <code>docs/KONFIGURASI_FIREBASE.md</code>. Setelah mengisi <code>.env</code>, restart server Vite.
          </p>
        </div>
      </div>
    </div>
  );
};
