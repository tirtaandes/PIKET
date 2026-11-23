import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { SchoolProfile, Student } from '../../types';

interface StudentIdCardCR80Props {
  student: Student;
  school: SchoolProfile;
}

export const StudentIdCardCR80: React.FC<StudentIdCardCR80Props> = ({ student, school }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    if (!student.activeQrToken) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(student.activeQrToken, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f2544', light: '#ffffff' }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [student.activeQrToken]);

  return (
    <div className="cr80-card relative flex flex-col justify-between rounded-xl border border-slate-300 bg-white shadow-md">
      {/* Header Navy Bar */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 px-3 py-2 text-white">
        <img
          src={school.logoUrl || '/school-logo-default.svg'}
          alt="Logo Sekolah"
          className="h-7 w-7 shrink-0 rounded-md bg-white/10 object-contain p-0.5"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[9px] font-extrabold uppercase tracking-wide text-white">
            {school.schoolName || 'SMK NEGERI 6 MUARO JAMBI'}
          </p>
          <p className="truncate text-[7px] font-semibold tracking-widest text-sky-300">
            SMART ATTENDANCE
          </p>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 items-center gap-2.5 px-3 py-2">
        {/* Student Photo */}
        <div className="h-[24mm] w-[19mm] shrink-0 overflow-hidden rounded-lg border border-navy-200 bg-slate-100">
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={student.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-navy-50 text-lg font-bold text-navy-900">
              {student.fullName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="line-clamp-2 text-[10px] font-extrabold uppercase leading-tight text-navy-950">
            {student.fullName}
          </p>
          <div className="space-y-0.5 text-[8px] text-slate-700">
            <p>
              <span className="font-semibold text-slate-500">NIS:</span>{' '}
              <span className="font-mono font-bold text-slate-900">{student.nis}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">Kelas:</span>{' '}
              <span className="font-bold text-navy-800">{student.className}</span>
            </p>
            <p className="truncate text-[7px] text-slate-500">{student.majorName}</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex shrink-0 flex-col items-center">
          <div className="h-[22mm] w-[22mm] rounded-lg border border-slate-200 bg-white p-1">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Siswa" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-[7px] text-rose-500">
                Belum Ada QR
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Accent */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-sky-50 px-3 py-1 text-[7px] font-semibold text-navy-900">
        <span>KARTU ABSENSI RESMI SISWA</span>
        <span>TP {school.academicYear || '2026/2027'}</span>
      </div>
    </div>
  );
};
