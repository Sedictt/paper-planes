export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'evening' | 'midnight';
export type TimeMode = 'auto' | TimeOfDay;
export type WeatherMode = 'clear' | 'rain' | 'snow';
export type PaperTint = 'cream' | 'rose' | 'sky' | 'sage' | 'gold';

export interface PaperPlaneNote {
  id: string;
  number: number;
  text: string;
  biome: string;
  timeOfDay: TimeOfDay;
  paperTint: PaperTint;
  stamp: string;
  reads: number;
  distanceKm: number;
  createdAt: string;
  flags: number;
  isUserCreated?: boolean;
}

export interface BiomeSpot {
  id: string;
  label: string;
  gx: number;
  gy: number;
  zoom: number;
}

export const BIOME_SPOTS: BiomeSpot[] = [
  { id: 'overview', label: 'World Overview', gx: 12, gy: 12, zoom: 1.0 },
  { id: 'downtown', label: 'Downtown Crossing', gx: 10, gy: 7, zoom: 1.55 },
  { id: 'village', label: 'Cobblestone Village', gx: 8, gy: 14, zoom: 1.65 },
  { id: 'valley', label: 'Valley Waterfall', gx: 4, gy: 4, zoom: 1.55 },
  { id: 'harbor', label: 'Seaside Boardwalk', gx: 17, gy: 17, zoom: 1.5 },
];

export function detectLocalTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 19) return 'dusk';
  if (hour >= 19 && hour < 22) return 'evening';
  return 'midnight';
}
