import { describe, it, expect } from 'vitest';
import { getHomePathForRole } from '../components/layout/ProtectedRoute';
import { getTodayWibDate, getWibTimeString, formatIndonesianDate } from '../lib/time';
import { generateTxUuid } from '../lib/device';

describe('Frontend Core Utilities & Role Routing', () => {
  it('routes each role to its dedicated layout home path', () => {
    expect(getHomePathForRole('ADMIN')).toBe('/admin');
    expect(getHomePathForRole('GURU_PIKET')).toBe('/piket');
    expect(getHomePathForRole('WALI_KELAS')).toBe('/walikelas');
  });

  it('formats Asia/Jakarta (WIB) date and time accurately', () => {
    const sample = new Date('2026-11-20T00:15:30Z'); // 07:15:30 WIB
    expect(getTodayWibDate(sample)).toBe('2026-11-20');
    expect(getWibTimeString(sample)).toBe('07:15:30');
    expect(formatIndonesianDate('2026-11-20')).toContain('2026');
  });

  it('generates unique UUIDs for offline transactions', () => {
    const a = generateTxUuid();
    const b = generateTxUuid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });
});
