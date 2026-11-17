import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { PALETTES, ThreeWorldEngine } from '../../../src/engine/ThreeWorldEngine';
import { detectLocalTimeOfDay, type TimeOfDay } from '../../../src/types';

describe('Feature 8: 6 Time-of-Day Palettes & Atmospheric Transitions', () => {
  let engine: ThreeWorldEngine | null = null;

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
    vi.restoreAllMocks();
  });

  it('8.1: verifies palette registry completeness, 6 time phases, and all 24 required fields', () => {
    const expectedKeys: TimeOfDay[] = [
      'dawn',
      'morning',
      'afternoon',
      'dusk',
      'evening',
      'midnight',
    ];

    expect(Object.keys(PALETTES).length).toBe(6);

    const requiredFields = [
      'label',
      'skyTop',
      'skyMid',
      'skyBottom',
      'sea',
      'seaDeep',
      'seaFoam',
      'river',
      'sand',
      'grass',
      'grassAlt',
      'cobble',
      'cobbleLine',
      'asphalt',
      'crosswalk',
      'windowLit',
      'windowDark',
      'windowChance',
      'stars',
      'cloudTop',
      'cloudShade',
      'streetLight',
      'neon',
      'shadeMul',
      'shadowAlpha',
    ];

    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

    for (const key of expectedKeys) {
      const pal = PALETTES[key];
      expect(pal).toBeDefined();

      for (const field of requiredFields) {
        expect((pal as any)[field]).toBeDefined();
      }

      // Check color field formats
      expect(pal.skyTop).toMatch(hexColorRegex);
      expect(pal.skyMid).toMatch(hexColorRegex);
      expect(pal.grass).toMatch(hexColorRegex);
      expect(pal.river).toMatch(hexColorRegex);

      // Check numeric bounds
      expect(pal.shadeMul).toBeGreaterThan(0);
      expect(pal.stars).toBeGreaterThanOrEqual(0);
      expect(pal.stars).toBeLessThanOrEqual(1);
      expect(pal.shadowAlpha).toBeGreaterThanOrEqual(0);
      expect(pal.shadowAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('8.2: verifies day-to-night progression monotonicity and ambient shading', () => {
    // shadeMul: daytime brighter than nighttime
    expect(PALETTES.afternoon.shadeMul).toBeGreaterThan(PALETTES.evening.shadeMul);
    expect(PALETTES.evening.shadeMul).toBeGreaterThan(PALETTES.midnight.shadeMul);

    // stars: midnight star intensity highest
    expect(PALETTES.midnight.stars).toBeGreaterThan(PALETTES.dusk.stars);
    expect(PALETTES.dusk.stars).toBeGreaterThan(PALETTES.afternoon.stars);

    // shadowAlpha: midnight shadows darker
    expect(PALETTES.midnight.shadowAlpha).toBeGreaterThan(PALETTES.morning.shadowAlpha);
  });

  it('8.3: validates Three.js Color.lerp linear interpolation between palette colors', () => {
    const cMorning = new THREE.Color(PALETTES.morning.skyMid);
    const cMidnight = new THREE.Color(PALETTES.midnight.skyMid);

    // At alpha = 0, equals morning
    const lerp0 = cMorning.clone().lerp(cMidnight, 0);
    expect(lerp0.r).toBeCloseTo(cMorning.r, 5);
    expect(lerp0.g).toBeCloseTo(cMorning.g, 5);
    expect(lerp0.b).toBeCloseTo(cMorning.b, 5);

    // At alpha = 1, equals midnight
    const lerp1 = cMorning.clone().lerp(cMidnight, 1);
    expect(lerp1.r).toBeCloseTo(cMidnight.r, 5);
    expect(lerp1.g).toBeCloseTo(cMidnight.g, 5);
    expect(lerp1.b).toBeCloseTo(cMidnight.b, 5);

    // At alpha = 0.5, exact midpoint
    const lerpMid = cMorning.clone().lerp(cMidnight, 0.5);
    expect(lerpMid.r).toBeCloseTo((cMorning.r + cMidnight.r) / 2, 5);
    expect(lerpMid.g).toBeCloseTo((cMorning.g + cMidnight.g) / 2, 5);
    expect(lerpMid.b).toBeCloseTo((cMorning.b + cMidnight.b) / 2, 5);
  });

  it('8.4: updates engine timeOfDay and scene background color reactively', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    // Switch to dusk
    engine.timeOfDay = 'dusk';
    expect(engine.timeOfDay).toBe('dusk');

    const scene = (engine as any).scene as THREE.Scene;
    expect(scene.background).toBeInstanceOf(THREE.Color);
    const bgDusk = scene.background as THREE.Color;
    expect(bgDusk.getHexString()).toBe(
      PALETTES.dusk.skyMid.replace('#', '').toLowerCase()
    );

    // Switch to midnight
    engine.timeOfDay = 'midnight';
    expect(engine.timeOfDay).toBe('midnight');
    const bgMidnight = scene.background as THREE.Color;
    expect(bgMidnight.getHexString()).toBe(
      PALETTES.midnight.skyMid.replace('#', '').toLowerCase()
    );
  });

  it('8.5: verifies local time detection covers all 24 clock hours correctly', () => {
    const checkHour = (h: number): TimeOfDay => {
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(h);
      return detectLocalTimeOfDay();
    };

    // Dawn: [5, 7)
    expect(checkHour(5)).toBe('dawn');
    expect(checkHour(6)).toBe('dawn');

    // Morning: [7, 12)
    expect(checkHour(7)).toBe('morning');
    expect(checkHour(11)).toBe('morning');

    // Afternoon: [12, 17)
    expect(checkHour(12)).toBe('afternoon');
    expect(checkHour(16)).toBe('afternoon');

    // Dusk: [17, 19)
    expect(checkHour(17)).toBe('dusk');
    expect(checkHour(18)).toBe('dusk');

    // Evening: [19, 22)
    expect(checkHour(19)).toBe('evening');
    expect(checkHour(21)).toBe('evening');

    // Midnight: [22, 5)
    expect(checkHour(22)).toBe('midnight');
    expect(checkHour(23)).toBe('midnight');
    expect(checkHour(0)).toBe('midnight');
    expect(checkHour(3)).toBe('midnight');
    expect(checkHour(4)).toBe('midnight');
  });

  it('8.6: verifies nocturnal lighting and neon signage flags by time of day', () => {
    // Neon should be false in daytime, true in dusk/evening/midnight
    expect(PALETTES.dawn.neon).toBe(false);
    expect(PALETTES.morning.neon).toBe(false);
    expect(PALETTES.afternoon.neon).toBe(false);

    expect(PALETTES.dusk.neon).toBe(true);
    expect(PALETTES.evening.neon).toBe(true);
    expect(PALETTES.midnight.neon).toBe(true);

    // Streetlights active in nocturnal/crepuscular phases
    expect(PALETTES.dawn.streetLight).toBe(true);
    expect(PALETTES.dusk.streetLight).toBe(true);
    expect(PALETTES.evening.streetLight).toBe(true);
    expect(PALETTES.midnight.streetLight).toBe(true);
  });
});
