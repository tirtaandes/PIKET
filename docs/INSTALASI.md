# Panduan Instalasi – SMART ATTENDANCE SMKN 6 Muaro Jambi

## 1. Prasyarat Lingkungan
- **Node.js** versi `20+` atau `22+` (LTS direkomendasikan)
- **npm** versi `10+`
- **Firebase CLI**: `npm install -g firebase-tools`
- Akun Google dengan akses **Firebase Console** (Paket Blaze diperlukan untuk Cloud Functions v2)

## 2. Instalasi Dependensi
Jalankan perintah berikut dari root folder proyek:

```bash
# 1. Instal dependensi frontend
npm install

# 2. Instal dependensi Cloud Functions
npm --prefix functions install
```

## 3. Konfigurasi Variabel Lingkungan
Salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Isi seluruh nilai `VITE_FIREBASE_*` sesuai Web App pada Firebase Console proyek Anda (lihat [KONFIGURASI_FIREBASE.md](KONFIGURASI_FIREBASE.md)).

> **PENTING**: Jangan pernah menyimpan file Service Account JSON atau private key Firebase Admin SDK di dalam folder proyek frontend atau mengirimkannya ke Git.

## 4. Menjalankan Mode Pengembangan Lokal
```bash
npm run dev
```
Buka browser di `http://localhost:5173`. Jika file `.env` belum diisi, aplikasi otomatis menampilkan halaman panduan konfigurasi Firebase.

## 5. Build Produksi
```bash
# Build frontend & PWA
npm run build

# Build Cloud Functions TypeScript
npm run functions:build
```
