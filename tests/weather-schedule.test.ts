import { describe, expect, it } from 'vitest';
import {
  getDailyPrecipitationWindows,
  getScheduledWeather,
  isLocalWinter,
} from '../src/lib/weatherSchedule';

describe('weatherSchedule', () => {
  it('detects winter only in December, January, and February (local date)', () => {
    expect(isLocalWinter(new Date(2026, 11, 15))).toBe(true); // Dec
    expect(isLocalWinter(new Date(2026, 0, 10))).toBe(true); // Jan
    expect(isLocalWinter(new Date(2026, 1, 20))).toBe(true); // Feb

    expect(isLocalWinter(new Date(2026, 2, 1))).toBe(false); // Mar
    expect(isLocalWinter(new Date(2026, 6, 15))).toBe(false); // Jul
    expect(isLocalWinter(new Date(2026, 10, 17))).toBe(false); // Nov
  });

  it('schedules exactly two non-overlapping precipitation windows per day', () => {
    for (let day = 1; day <= 15; day++) {
      const date = new Date(2026, 10, day, 12, 0);
      const [w1, w2] = getDailyPrecipitationWindows(date);
      expect(w1.endMinute).toBeLessThan(w2.startMinute);
      expect(w1.endMinute - w1.startMinute).toBeGreaterThanOrEqual(45);
      expect(w2.endMinute - w2.startMinute).toBeGreaterThanOrEqual(45);
      expect(w2.endMinute).toBeLessThanOrEqual(24 * 60);
    }
  });

  it('returns rain during precipitation windows outside winter and snow during winter', () => {
    const autumnDate = new Date(2026, 10, 17);
    const [amA, pmA] = getDailyPrecipitationWindows(autumnDate);

    expect(
      getScheduledWeather(new Date(2026, 10, 17, Math.floor(amA.startMinute / 60), amA.startMinute % 60))
    ).toBe('rain');
    expect(
      getScheduledWeather(new Date(2026, 10, 17, Math.floor(pmA.startMinute / 60), pmA.startMinute % 60))
    ).toBe('rain');
    expect(getScheduledWeather(new Date(2026, 10, 17, 12, 30))).toBe('clear');

    const winterDate = new Date(2026, 11, 25);
    const [amW, pmW] = getDailyPrecipitationWindows(winterDate);

    expect(
      getScheduledWeather(new Date(2026, 11, 25, Math.floor(amW.startMinute / 60), amW.startMinute % 60))
    ).toBe('snow');
    expect(
      getScheduledWeather(new Date(2026, 11, 25, Math.floor(pmW.startMinute / 60), pmW.startMinute % 60))
    ).toBe('snow');
    expect(getScheduledWeather(new Date(2026, 11, 25, 12, 30))).toBe('clear');
  });
});
