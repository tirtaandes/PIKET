import { SCHOOL_TIMEZONE } from '../config';

export interface WibDateTimeParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timeWithSeconds: string; // HH:mm:ss
  minutesOfDay: number;
  dayOfWeek: number; // 0=Sun..6=Sat
  isoWib: string;
  epochMs: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export function getWibParts(dateInput: Date = new Date()): WibDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false
  });

  const parts = formatter.formatToParts(dateInput);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const minute = get('minute');
  const second = get('second');
  const weekdayStr = get('weekday');

  const minutesOfDay = parseInt(hour, 10) * 60 + parseInt(minute, 10);
  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;
  const timeWithSeconds = `${hour}:${minute}:${second}`;

  return {
    date,
    time,
    timeWithSeconds,
    minutesOfDay,
    dayOfWeek: WEEKDAY_MAP[weekdayStr] ?? 0,
    isoWib: `${date}T${timeWithSeconds}+07:00`,
    epochMs: dateInput.getTime()
  };
}

export function parseTimeToMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) {
    throw new Error(`Format waktu tidak valid: ${hhmm}`);
  }
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Nilai waktu di luar jangkauan: ${hhmm}`);
  }
  return h * 60 + m;
}

export function computeClockSkewSeconds(deviceLocalTimeIso: string, serverTime: Date): number {
  const deviceMs = Date.parse(deviceLocalTimeIso);
  if (Number.isNaN(deviceMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.round((deviceMs - serverTime.getTime()) / 1000);
}

export function isClockSkewSuspicious(
  deviceLocalTimeIso: string,
  serverTime: Date,
  maxSkewSeconds: number
): { suspicious: boolean; skewSeconds: number } {
  const skewSeconds = computeClockSkewSeconds(deviceLocalTimeIso, serverTime);
  if (!Number.isFinite(skewSeconds)) {
    return { suspicious: true, skewSeconds: 999999 };
  }
  // Allow past device timestamps up to 12 hours when syncing offline queued scans later,
  // but flag future timestamps (> maxSkewSeconds) or wildly mismatched dates (> 16 hours in past)
  const isFutureSkew = skewSeconds > maxSkewSeconds;
  const isExcessivePastSkew = skewSeconds < -16 * 3600;
  return {
    suspicious: isFutureSkew || isExcessivePastSkew,
    skewSeconds
  };
}
