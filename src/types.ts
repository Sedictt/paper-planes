export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'evening' | 'midnight';
export type TimeMode = 'auto' | TimeOfDay;
export type WeatherMode = 'clear' | 'rain' | 'snow';
export type PaperTint = 'cream' | 'rose' | 'sky' | 'sage' | 'gold';

export interface PaperPlaneNote {
  id: string;
  number: number;
  title?: string;
  text: string;
  biome: string;
  timeOfDay: TimeOfDay;
  paperTint: PaperTint;
  stamp?: string;
  reads: number;
  distanceKm: number;
  createdAt: string;
  flags: number;
  isUserCreated?: boolean;
}

export interface SkyStats {
  totalPlanes: number;
  totalUnfolds: number;
  totalDistanceKm: number;
  countriesCount: number;
  planesToday: number;
  mostUnfoldedReads: number;
  updatedAt: string;
}

export interface BiomeSpot {
  id: string;
  label: string;
  gx: number;
  gy: number;
  zoom: number;
}

export const BIOME_SPOTS: BiomeSpot[] = [
  { id: 'overview', label: 'Sanctuary Overview', gx: 5.5, gy: 5.5, zoom: 1.6 },
  { id: 'shrine', label: '⛩️ Lantern Shrine', gx: 5.5, gy: 5.0, zoom: 2.1 },
  { id: 'cottage', label: 'A-Frame Cottage', gx: 2.5, gy: 2.8, zoom: 1.95 },
  { id: 'campfire', label: 'Campfire Terrace', gx: 2.5, gy: 6.8, zoom: 2.0 },
  { id: 'garden', label: 'Frog Pot & Garden', gx: 7.8, gy: 6.2, zoom: 2.0 },
  { id: 'waterfall', label: 'Waterfall Stream', gx: 4.8, gy: 9.2, zoom: 1.95 },
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
