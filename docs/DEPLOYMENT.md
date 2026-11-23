# Dokumentasi Deployment Produksi – SMART ATTENDANCE SMKN 6 Muaro Jambi

## 1. Checklist Sebelum Deployment
- [ ] File `.env` produksi sudah terisi benar dan tidak di-commit ke repository.
- [ ] Seluruh pengujian lulus (`npm test` dan `npm run functions:test`).
- [ ] Build frontend lulus tanpa error TypeScript (`npm run build`).
- [ ] Build Cloud Functions lulus (`npm run functions:build`).

## 2. Deploy Security Rules & Firestore Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 3. Deploy Cloud Functions (Region `asia-southeast2`)
```bash
firebase deploy --only functions
```
Pastikan 15 fungsi berikut aktif di Firebase Console:
- `createUserAccount`
- `updateUserRoleAndAccess`
- `recordAuthEvent`
- `generateStudentQr`
- `bulkGenerateQr`
- `regenerateStudentQr`
- `deactivateStudentQr`
- `getDutyStatus`
- `processAttendanceScan`
- `createPermissionRequest`
- `decidePermissionRequest`
- `processExitScan`
- `processReturnScan`
- `issueOfflineAuthorization`
- `syncOfflineTransactions`

## 4. Deploy Frontend & PWA ke Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

## 5. Deploy Sekaligus (Full Release)
```bash
npm run build && npm run functions:build && firebase deploy
```

## 6. Instalasi PWA di HP Guru Piket & Laptop
1. Buka URL Firebase Hosting (`https://<project-id>.web.app`) di Google Chrome (Android/Windows) atau Safari (iOS).
2. Pilih **Tambahkan ke Layar Utama / Install App**.
3. Berikan izin akses kamera agar ZXing QR Scanner otomatis memakai kamera belakang.
