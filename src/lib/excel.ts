import * as XLSX from 'xlsx';
import type { SchoolClass, Student } from '../types';

export interface ParsedStudentRow {
  rowNumber: number;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  birthPlaceDate: string;
  address: string;
  phone: string;
  parentName: string;
  className: string;
  matchedClass?: SchoolClass;
  errors: string[];
  valid: boolean;
}

export function downloadStudentImportTemplate() {
  const sampleRows = [
    {
      NIS: '2026001',
      NISN: '0081234567',
      'Nama Lengkap': 'Ahmad Fauzi',
      'Jenis Kelamin (L/P)': 'L',
      'Tempat Tanggal Lahir': 'Jambi, 12 Mei 2009',
      Alamat: 'Jl. Lintas Timur Muaro Jambi',
      'No Telepon': '081234567890',
      'Nama Orang Tua': 'Budi Santoso',
      Kelas: 'X TKJ 1'
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
  XLSX.writeFile(wb, 'Template_Import_Siswa_SMKN6.xlsx');
}

export async function parseAndValidateStudentExcel(
  file: File,
  existingStudents: Student[],
  availableClasses: SchoolClass[]
): Promise<ParsedStudentRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const existingNis = new Set(existingStudents.map((s) => s.nis.trim().toLowerCase()));
  const existingNisn = new Set(existingStudents.map((s) => s.nisn.trim().toLowerCase()));
  const seenNisInFile = new Set<string>();
  const seenNisnInFile = new Set<string>();

  const classByName = new Map<string, SchoolClass>();
  for (const c of availableClasses) {
    if (c.active) {
      classByName.set(c.name.trim().toLowerCase(), c);
    }
  }

  return rawRows.map((row, idx) => {
    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rk of Object.keys(row)) {
          if (rk.trim().toLowerCase() === k.toLowerCase()) {
            return String(row[rk] ?? '').trim();
          }
        }
      }
      return '';
    };

    const nis = getVal('NIS');
    const nisn = getVal('NISN');
    const fullName = getVal('Nama Lengkap', 'Nama', 'fullName');
    const genderRaw = getVal('Jenis Kelamin (L/P)', 'Jenis Kelamin', 'JK', 'gender').toUpperCase();
    const gender: 'L' | 'P' = genderRaw.startsWith('P') ? 'P' : 'L';
    const birthPlaceDate = getVal('Tempat Tanggal Lahir', 'TTL', 'birthPlaceDate');
    const address = getVal('Alamat', 'address');
    const phone = getVal('No Telepon', 'Telepon', 'HP', 'phone');
    const parentName = getVal('Nama Orang Tua', 'Orang Tua', 'parentName');
    const className = getVal('Kelas', 'className');

    const errors: string[] = [];
    if (!nis) errors.push('NIS wajib diisi');
    if (!nisn) errors.push('NISN wajib diisi');
    if (!fullName) errors.push('Nama lengkap wajib diisi');
    if (!className) errors.push('Kelas wajib diisi');

    const nisKey = nis.toLowerCase();
    const nisnKey = nisn.toLowerCase();

    if (nis && existingNis.has(nisKey)) errors.push(`NIS ${nis} sudah terdaftar di database`);
    if (nis && seenNisInFile.has(nisKey)) errors.push(`NIS ${nis} duplikat di file Excel`);
    if (nis) seenNisInFile.add(nisKey);

    if (nisn && existingNisn.has(nisnKey)) errors.push(`NISN ${nisn} sudah terdaftar di database`);
    if (nisn && seenNisnInFile.has(nisnKey)) errors.push(`NISN ${nisn} duplikat di file Excel`);
    if (nisn) seenNisnInFile.add(nisnKey);

    const matchedClass = classByName.get(className.toLowerCase());
    if (className && !matchedClass) {
      errors.push(`Kelas "${className}" tidak tersedia / tidak aktif`);
    }

    return {
      rowNumber: idx + 2,
      nis,
      nisn,
      fullName,
      gender,
      birthPlaceDate,
      address,
      phone,
      parentName,
      className,
      matchedClass,
      errors,
      valid: errors.length === 0
    };
  });
}

export function exportRowsToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
