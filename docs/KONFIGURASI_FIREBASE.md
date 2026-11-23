# Dokumentasi Konfigurasi Firebase & Bootstrap Admin

## 1. Membuat Proyek Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Buat proyek baru, misal: `smart-attendance-smkn6-mj`.
3. Aktifkan layanan berikut:
   - **Authentication** → Sign-in method → Aktifkan **Email/Password**.
   - **Cloud Firestore** → Buat database (direkomendasikan region `asia-southeast2` Jakarta).
   - **Firebase Storage** → Aktifkan default bucket.
   - **Cloud Functions** → Upgrade ke **Blaze Plan** (diperlukan oleh Cloud Functions v2).
   - **Firebase Hosting** → Siapkan default site.

## 2. Menghubungkan Proyek ke Workspace
```bash
firebase login
firebase use --add
```
Atau salin `.firebaserc.example` menjadi `.firebaserc` dan isi Project ID Anda.

## 3. Mengambil Konfigurasi Web SDK
1. Di Firebase Console, buka **Project Settings → General → Your apps → Add Web App**.
2. Salin `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` ke file `.env`:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_FUNCTIONS_REGION=asia-southeast2
```

## 4. Mengatur Secret Kunci Tanda Tangan Mode Offline (Direkomendasikan)
Untuk produksi, atur secret HMAC-SHA256 di Cloud Functions agar tanda tangan otorisasi offline menggunakan kunci acak kuat:
```bash
firebase functions:secrets:set OFFLINE_SIGNING_SECRET
```
Masukkan string acak minimal 32 karakter.

## 5. Bootstrap Akun Administrator Awal (Aman, Tanpa Hardcoded Password)
Aplikasi **tidak** menanam password admin tetap di source code. Buat akun ADMIN pertama melalui skrip resmi:

1. Unduh Service Account Key dari **Firebase Console → Project Settings → Service Accounts → Generate new private key**.
2. Simpan file JSON tersebut di lokasi aman **di luar** folder proyek (misal `C:\secure\serviceAccountKey.json`).
3. Jalankan skrip bootstrap:

**PowerShell:**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\serviceAccountKey.json"
npm run bootstrap:admin
```

**CMD:**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\secure\serviceAccountKey.json
npm run bootstrap:admin
```

4. Masukkan email admin, nama lengkap, dan kata sandi (minimal 10 karakter) secara interaktif.
5. Skrip akan:
   - Membuat/memperbarui user Firebase Authentication.
   - Menetapkan custom claim `{ role: "ADMIN", active: true }`.
   - Membuat profil di koleksi `users/{uid}`.
   - Menginisialisasi profil default sekolah (`system_settings/school_profile`) dan pengaturan jam absensi (`system_settings/attendance`).
