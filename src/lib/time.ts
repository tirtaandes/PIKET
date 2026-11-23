export const SCHOOL_TIMEZONE = 'Asia/Jakarta';

export function getTodayWibDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date); // YYYY-MM-DD
}

export function getWibTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHOOL_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(date);
}

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: SCHOOL_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

export function formatTimestampWib(ts: unknown): string {
  if (!ts) return '-';
  let date: Date;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string') {
    date = new Date(ts);
  } else if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    date = new Date((ts as { seconds: number }).seconds * 1000);
  } else {
    return '-';
  }
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: SCHOOL_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const PERMISSION_TYPE_LABELS: Record<string, string> = {
  KEPERLUAN_KELUARGA: 'Keperluan Keluarga',
  SAKIT: 'Sakit',
  KEPERLUAN_PRIBADI: 'Keperluan Pribadi',
  KEPERLUAN_SEKOLAH: 'Keperluan Sekolah',
  LAINNYA: 'Lainnya'
};
