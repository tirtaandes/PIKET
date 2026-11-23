# Panduan Pengujian (22 Skenario Wajib)

## 1. Menjalankan Pengujian Otomatis (Unit & Skenario Backend + Frontend)
```bash
# Jalankan pengujian backend (seluruh 22 skenario wajib)
npm run functions:test

# Jalankan pengujian frontend
npm test
```

## 2. Daftar 22 Skenario Wajib yang Diuji
| No | Skenario | Cakupan Verifikasi |
|---|---|---|
| 1 | Admin berhasil login | Firebase Auth + Custom Claims `role: ADMIN, active: true` |
| 2 | Guru piket berhasil login | Firebase Auth + Custom Claims `role: GURU_PIKET, active: true` |
| 3 | Wali kelas berhasil login | Firebase Auth + Custom Claims `role: WALI_KELAS, assignedClassId` |
| 4 | Guru tanpa jadwal tidak bisa scan | Cloud Function menolak dengan `"ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF."` |
| 5 | Guru sebelum jadwal tidak bisa scan | Cloud Function menolak dengan `"JADWAL PIKET BELUM DIMULAI."` |
| 6 | Guru setelah jadwal tidak bisa scan | Cloud Function menolak dengan `"MASA TUGAS PIKET TELAH BERAKHIR."` |
| 7 | Guru dalam jadwal dapat scan | Validasi tanggal/hari & jam WIB lulus, mengembalikan jadwal aktif |
| 8 | QR valid berhasil diproses | Token opaque `SA-...` aktif valid & status HADIR/TERLAMBAT tercatat |
| 9 | QR tidak valid ditolak | Token tak terdaftar mengembalikan `QR_INVALID` |
| 10 | QR lama yang dinonaktifkan ditolak | Token berstatus `REVOKED`/`LOST` mengembalikan `QR_INACTIVE` |
| 11 | Scan pagi berulang ditolak | Transaksi Firestore idempoten (`YYYY-MM-DD_studentId`) menolak scan pagi ke-2 |
| 12 | Scan sore berulang ditolak | Transaksi Firestore idempoten menolak scan sore ke-2 |
| 13 | Izin belum disetujui tidak bisa diproses | Status `MENUNGGU` / `DITOLAK` ditolak pada `processExitScan` |
| 14 | Izin disetujui dapat diproses | Status `DISETUJUI` & belum kedaluwarsa berubah menjadi `SUDAH_KELUAR` |
| 15 | Siswa tidak dapat keluar dua kali | Status `SUDAH_KELUAR` ditolak jika dipindai keluar lagi |
| 16 | Siswa dapat melakukan scan kembali | Status `SUDAH_KELUAR` untuk siswa yang tepat berubah menjadi `SUDAH_KEMBALI` |
| 17 | Wali kelas tidak dapat akses kelas lain | Ditegakkan di `firestore.rules` (`isWaliKelasForClass`) & Cloud Functions |
| 18 | Guru piket tidak dapat mengubah data siswa | `firestore.rules` menolak write `students`, `duty_schedules`, `attendance`, `activity_logs` |
| 19 | Absensi offline tersimpan | Otorisasi HMAC sah + IndexedDB menyimpan transaksi dengan UUID & `PENDING_SYNC` |
| 20 | Sinkronisasi offline tidak membuat duplikat | Deduplikasi via `offline_tx_dedup/{transactionUuid}` & dokumen absensi harian |
| 21 | Perangkat dengan waktu mencurigakan ditandai | Clock skew > `maxClockSkewSeconds` ditandai `flaggedForReview: true` untuk Admin |
| 22 | Otorisasi offline kedaluwarsa ditolak | Token offline lewat `expiresAtIso` ditolak di klien dan ditolak di backend saat sync |

## 3. Pengujian End-to-End dengan Firebase Emulator Suite
```bash
firebase emulators:start
```
Atur `VITE_USE_FIREBASE_EMULATORS=true` di `.env` untuk menguji langsung seluruh alur di Auth, Firestore, Storage, dan Functions Emulator.
