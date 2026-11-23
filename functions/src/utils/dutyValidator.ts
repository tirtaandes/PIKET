import { DutyScheduleDoc } from '../types';
import { getWibParts, parseTimeToMinutes } from './time';

export type DutyValidationCode =
  | 'VALID'
  | 'ACCOUNT_INACTIVE'
  | 'INVALID_ROLE'
  | 'NO_SCHEDULE'
  | 'NOT_STARTED'
  | 'ENDED';

export interface DutyValidationResult {
  valid: boolean;
  code: DutyValidationCode;
  message: string;
  schedule?: DutyScheduleDoc;
  serverDate: string;
  serverTime: string;
}

export const DUTY_MESSAGES = {
  NO_SCHEDULE: 'ANDA TIDAK MEMILIKI JADWAL PIKET AKTIF.',
  NOT_STARTED: 'JADWAL PIKET BELUM DIMULAI.',
  ENDED: 'MASA TUGAS PIKET TELAH BERAKHIR.',
  ACCOUNT_INACTIVE: 'AKUN ANDA TIDAK AKTIF. HUBUNGI ADMIN.',
  INVALID_ROLE: 'HANYA GURU PIKET YANG DIIZINKAN MENGGUNAKAN SCANNER.'
} as const;

/**
 * Pure, deterministic duty schedule validator (server-side authoritative).
 * Evaluates:
 * 1. Account active status
 * 2. Role === GURU_PIKET
 * 3. Active schedules assigned to teacherIds (matching uid or teacherId)
 * 4. Matching date (TANGGAL / HARIAN) or weekday (MINGGUAN)
 * 5. Server WIB time within [startTime, endTime]
 */
export function evaluateDutySchedule(params: {
  accountActive: boolean;
  role: string | undefined;
  teacherIdentifiers: string[];
  schedules: DutyScheduleDoc[];
  now?: Date;
}): DutyValidationResult {
  const wib = getWibParts(params.now ?? new Date());

  if (!params.accountActive) {
    return {
      valid: false,
      code: 'ACCOUNT_INACTIVE',
      message: DUTY_MESSAGES.ACCOUNT_INACTIVE,
      serverDate: wib.date,
      serverTime: wib.timeWithSeconds
    };
  }

  if (params.role !== 'GURU_PIKET') {
    return {
      valid: false,
      code: 'INVALID_ROLE',
      message: DUTY_MESSAGES.INVALID_ROLE,
      serverDate: wib.date,
      serverTime: wib.timeWithSeconds
    };
  }

  const idSet = new Set(params.teacherIdentifiers.filter(Boolean));

  // Filter active schedules assigned to this teacher matching today's date/day
  const todaysSchedules = params.schedules.filter((sch) => {
    if (!sch.active) return false;
    const isAssigned = (sch.teacherIds || []).some((id) => idSet.has(id));
    if (!isAssigned) return false;

    if (sch.type === 'TANGGAL' || sch.type === 'HARIAN') {
      return sch.date === wib.date;
    }
    if (sch.type === 'MINGGUAN') {
      return Array.isArray(sch.daysOfWeek) && sch.daysOfWeek.includes(wib.dayOfWeek);
    }
    return false;
  });

  if (todaysSchedules.length === 0) {
    return {
      valid: false,
      code: 'NO_SCHEDULE',
      message: DUTY_MESSAGES.NO_SCHEDULE,
      serverDate: wib.date,
      serverTime: wib.timeWithSeconds
    };
  }

  // Check if any schedule is currently active right now
  let earliestUpcoming: DutyScheduleDoc | undefined;
  let latestEnded: DutyScheduleDoc | undefined;

  for (const sch of todaysSchedules) {
    const startMin = parseTimeToMinutes(sch.startTime);
    const endMin = parseTimeToMinutes(sch.endTime);

    if (wib.minutesOfDay >= startMin && wib.minutesOfDay <= endMin) {
      return {
        valid: true,
        code: 'VALID',
        message: 'Jadwal piket aktif.',
        schedule: sch,
        serverDate: wib.date,
        serverTime: wib.timeWithSeconds
      };
    }

    if (wib.minutesOfDay < startMin) {
      if (!earliestUpcoming || parseTimeToMinutes(sch.startTime) < parseTimeToMinutes(earliestUpcoming.startTime)) {
        earliestUpcoming = sch;
      }
    } else if (wib.minutesOfDay > endMin) {
      if (!latestEnded || parseTimeToMinutes(sch.endTime) > parseTimeToMinutes(latestEnded.endTime)) {
        latestEnded = sch;
      }
    }
  }

  if (earliestUpcoming) {
    return {
      valid: false,
      code: 'NOT_STARTED',
      message: DUTY_MESSAGES.NOT_STARTED,
      schedule: earliestUpcoming,
      serverDate: wib.date,
      serverTime: wib.timeWithSeconds
    };
  }

  return {
    valid: false,
    code: 'ENDED',
    message: DUTY_MESSAGES.ENDED,
    schedule: latestEnded,
    serverDate: wib.date,
    serverTime: wib.timeWithSeconds
  };
}
