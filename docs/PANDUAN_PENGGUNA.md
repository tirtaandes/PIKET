# Panduan Penggunaan Setiap Role – SMART ATTENDANCE SMKN 6 Muaro Jambi

---

## 1. ADMINISTRATOR (ADMIN)
### Urutan Setup Awal Sekolah:
1. **Identitas Sekolah** (`/admin/school`): Lengkapi nama sekolah, unggah logo resmi, alamat, tahun pelajaran, nama & NIP kepala sekolah, dan kontak.
2. **Kelas, Jurusan & Tahun Pelajaran** (`/admin/master`): Tambahkan Tahun Pelajaran aktif, daftar Jurusan (misal TKJ, TSM, AKL, dll.), lalu buat daftar Kelas.
3. **Data Guru** (`/admin/teachers`): Masukkan data guru sekolah.
4. **Akun Pengguna** (`/admin/users`): Buat akun untuk `GURU_PIKET` dan `WALI_KELAS` (wajib memilih kelas yang diampu untuk Wali Kelas). Role ditetapkan secara aman melalui Firebase Auth Custom Claims.
5. **Data Siswa** (`/admin/students`): Tambah siswa satu per satu atau gunakan **Import Excel** (unduh template, unggah file, periksa validasi preview, lalu import). QR Code unik otomatis dibuat saat pendaftaran.
6. **QR & Kartu Siswa** (`/admin/qr`): Gunakan **Generate QR Massal** jika ada siswa tanpa QR, unduh PNG, cetak kartu CR80 (`85.6mm × 53.98mm`), regenerasi QR, atau nonaktifkan QR yang hilang.
7. **Pengaturan Absensi** (`/admin/attendance-settings`): Atur jam absensi pagi (mulai, tepat waktu, batas akhir), jam sore, hari aktif, toleransi keterlambatan, batas clock skew offline, pengecualian kelas (misal PKL), serta kalender hari libur & kegiatan sekolah.
8. **Jadwal Piket** (`/admin/duty-schedules`): Buat jadwal harian, mingguan, atau berdasarkan tanggal untuk satu atau beberapa Guru Piket sekaligus.

### Monitoring & Pelaporan Harian:
- **Dashboard** (`/admin`): Pantau 13 KPI real-time, grafik harian/bulanan/per-kelas/izin, dan siswa sedang di luar sekolah.
- **Monitor Absensi** (`/admin/attendance`): Lihat siswa tercatat, belum absen pagi/sore, verifikasi transaksi offline bertanda *Perlu Review*, atau koreksi status (SAKIT/IZIN/ALPA).
- **Sinkronisasi Offline** (`/admin/sync`): Pantau perangkat scanner terdaftar & anomali jam perangkat.
- **Laporan Sekolah** (`/admin/reports`): Pilih 12 jenis laporan, filter tanggal/kelas/jurusan/TP, lalu unduh **PDF berkop surat**, **Excel**, atau **Print Langsung**.
- **Activity Log** (`/admin/logs`): Audit seluruh aktivitas penting yang bersifat immutable.

---

## 2. GURU PIKET
### Alur Operasional Harian:
1. Login melalui halaman login menggunakan akun Guru Piket.
2. Di **Dashboard Piket** (`/piket`), sistem otomatis memverifikasi jadwal piket ke server:
   - Jika tidak terjadwal: muncul `"ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF."`
   - Jika terlalu awal: muncul `"JADWAL PIKET BELUM DIMULAI."`
   - Jika sudah lewat: muncul `"MASA TUGAS PIKET TELAH BERAKHIR."`
   - Jika aktif: tombol **SCAN PAGI**, **SCAN SORE**, **IZIN KELUAR**, dan **SCAN KEMBALI** siap digunakan.
3. **Persiapan Mode Offline (Direkomendasikan setiap awal piket)**: Klik **Siapkan Mode Offline** saat internet tersedia untuk mengunduh otorisasi bertanda tangan backend, cache QR siswa, dan izin disetujui hari ini ke IndexedDB.
4. **Melakukan Pemindaian**: Arahkan kamera belakang ke kartu QR siswa (atau gunakan scanner USB di opsi input token). Sistem langsung menampilkan foto, nama, NIS, kelas, jam scan, dan status.
5. **Sinkronisasi Offline** (`/piket/offline`): Jika internet sempat terputus, transaksi tersimpan dengan status `PENDING SYNC` dan otomatis disinkronkan saat online (atau klik **Sinkronisasi Sekarang**).

---

## 3. WALI KELAS
### Alur Operasional Harian:
1. Login menggunakan akun Wali Kelas. Sistem hanya menampilkan data kelas yang diampu.
2. **Dashboard Kelas** (`/walikelas`): Pantau total siswa, hadir hari ini, daftar siswa terlambat, tidak/belum hadir, dan siswa yang sedang berada di luar sekolah.
3. **Izin Siswa** (`/walikelas/permissions`):
   - Klik **Buat Permohonan Izin**, pilih siswa di kelas sendiri, jenis izin, tanggal, waktu mulai, perkiraan kembali, dan alasan.
   - Centang **Langsung Setujui Izin** atau setujui/tolak pengajuan berstatus `MENUNGGU`.
   - Izin berstatus `DISETUJUI` otomatis muncul di dashboard Guru Piket untuk dipindai saat keluar gerbang.
4. **Laporan Kelas** (`/walikelas/reports`): Cetak atau ekspor laporan PDF/Excel khusus untuk kelas yang diampu.
