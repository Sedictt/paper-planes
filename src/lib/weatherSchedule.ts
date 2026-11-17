import type { WeatherMode } from '../types';

export interface WeatherWindow {
  startMinute: number;
  endMinute: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns true when the local calendar date falls in meteorological winter
 * (December, January, February).
 */
export function isLocalWinter(date: Date): boolean {
  const month = date.getMonth();
  return month === 11 || month === 0 || month === 1;
}

/**
 * Generates two randomized, non-overlapping precipitation windows for a given
 * local calendar date (one in the first half of the day, one in the second).
 */
export function getDailyPrecipitationWindows(date: Date): [WeatherWindow, WeatherWindow] {
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const rng = mulberry32(seed);

  // Window 1: 01:00–10:30 start, 45–85 min duration (ends by 11:55)
  const amStart = 60 + Math.floor(rng() * 570);
  const amDuration = 45 + Math.floor(rng() * 41);

  // Window 2: 13:00–22:30 start, 45–85 min duration (ends by 23:55)
  const pmStart = 780 + Math.floor(rng() * 570);
  const pmDuration = 45 + Math.floor(rng() * 41);

  return [
    { startMinute: amStart, endMinute: amStart + amDuration },
    { startMinute: pmStart, endMinute: pmStart + pmDuration },
  ];
}

/**
 * Returns the active weather for the given local date/time:
 * - Precipitation occurs during two randomized daily windows.
 * - During local winter (Dec–Feb) precipitation is 'snow'; otherwise 'rain'.
 * - Outside those two windows, weather is 'clear'.
 */
export function getScheduledWeather(date: Date = new Date()): WeatherMode {
  const [amWindow, pmWindow] = getDailyPrecipitationWindows(date);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();

  const isPrecipitating =
    (minuteOfDay >= amWindow.startMinute && minuteOfDay < amWindow.endMinute) ||
    (minuteOfDay >= pmWindow.startMinute && minuteOfDay < pmWindow.endMinute);

  if (!isPrecipitating) return 'clear';
  return isLocalWinter(date) ? 'snow' : 'rain';
}
