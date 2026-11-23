#!/usr/bin/env node
/**
 * SMART ATTENDANCE – SMKN 6 MUARO JAMBI
 * Secure Initial Admin Account Bootstrap Script
 *
 * TIDAK ada password tetap di dalam source code!
 * Script ini membaca kredensial Service Account dari GOOGLE_APPLICATION_CREDENTIALS
 * dan meminta email/password admin secara interaktif melalui terminal (atau env).
 *
 * Cara penggunaan:
 *   set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
 *   npm run bootstrap:admin
 */

import readline from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = '';

    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(value);
        } else if (ch === '\u0003') {
          process.exit(1);
        } else if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += ch;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function main() {
  console.log('\n==============================================================');
  console.log('  SMART ATTENDANCE – SMKN 6 MUARO JAMBI');
  console.log('  Bootstrap Akun Administrator Awal (Aman via Admin SDK)');
  console.log('==============================================================\n');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[ERROR] Environment variable GOOGLE_APPLICATION_CREDENTIALS belum diatur.');
    console.error('Unduh Service Account Key dari Firebase Console -> Project Settings -> Service Accounts,');
    console.error('simpan di luar repository, lalu jalankan:');
    console.error('  PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\serviceAccountKey.json"; npm run bootstrap:admin');
    console.error('  CMD       : set GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\serviceAccountKey.json && npm run bootstrap:admin');
    process.exit(1);
  }

  let admin;
  try {
    admin = require('../functions/node_modules/firebase-admin');
  } catch {
    console.error('[ERROR] firebase-admin tidak ditemukan di functions/node_modules.');
    console.error('Jalankan terlebih dahulu: npm --prefix functions install');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || (await prompt(rl, 'Email Admin        : '));
  const displayName =
    process.env.BOOTSTRAP_ADMIN_NAME || (await prompt(rl, 'Nama Lengkap Admin : ')) || 'Administrator SMKN 6';
  rl.close();

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || (await promptHidden('Password (min 10)  : '));

  if (!email || !email.includes('@')) {
    console.error('[ERROR] Format email tidak valid.');
    process.exit(1);
  }
  if (!password || password.length < 10) {
    console.error('[ERROR] Password admin wajib minimal 10 karakter.');
    process.exit(1);
  }

  const auth = admin.auth();
  const db = admin.firestore();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email.toLowerCase());
    console.log(`[INFO] Akun ${email} sudah ada (UID: ${userRecord.uid}). Memperbarui hak akses ADMIN...`);
    await auth.updateUser(userRecord.uid, { displayName, password, disabled: false });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email: email.toLowerCase(),
        password,
        displayName,
        disabled: false
      });
      console.log(`[OK] Akun Firebase Auth dibuat (UID: ${userRecord.uid}).`);
    } else {
      throw err;
    }
  }

  // Tetapkan Custom Claims ADMIN di backend
  await auth.setCustomUserClaims(userRecord.uid, {
    role: 'ADMIN',
    active: true
  });

  // Simpan dokumen users/{uid}
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName,
      role: 'ADMIN',
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // Inisialisasi profil sekolah & pengaturan absensi default jika belum ada
  const schoolRef = db.collection('system_settings').doc('school_profile');
  const schoolSnap = await schoolRef.get();
  if (!schoolSnap.exists) {
    await schoolRef.set({
      schoolName: 'SMK NEGERI 6 MUARO JAMBI',
      appName: 'SMART ATTENDANCE',
      logoUrl: '',
      address: 'Kabupaten Muaro Jambi, Provinsi Jambi',
      academicYear: '2026/2027',
      principalName: 'Kepala SMK Negeri 6 Muaro Jambi',
      principalNip: '-',
      contact: 'info@smkn6muarojambi.sch.id',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[OK] Profil sekolah default diinisialisasi di system_settings/school_profile.');
  }

  const attendanceRef = db.collection('system_settings').doc('attendance');
  const attendanceSnap = await attendanceRef.get();
  if (!attendanceSnap.exists) {
    await attendanceRef.set({
      morning: {
        startTime: '06:00',
        onTimeDeadline: '07:00',
        endTime: '08:00',
        activeDays: [1, 2, 3, 4, 5, 6],
        enabled: true
      },
      afternoon: {
        startTime: '14:00',
        endTime: '16:30',
        activeDays: [1, 2, 3, 4, 5, 6],
        enabled: true
      },
      lateToleranceMinutes: 0,
      maxClockSkewSeconds: 300,
      offlineAuthDurationMinutes: 480,
      exemptedClassIds: [],
      exemptedStudentIds: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('[OK] Pengaturan jam absensi default diinisialisasi di system_settings/attendance.');
  }

  console.log('\n[SELESAI] Akun Administrator siap digunakan untuk login di aplikasi SMART ATTENDANCE.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
