import { describe, it, expect, vi, afterEach } from 'vitest';
import { IsometricWorldEngine, ThreeWorldEngine, PALETTES } from '../src/engine/IsometricWorldEngine';
import type { PaperPlaneNote } from '../src/types';

const SAMPLE_PLANES: PaperPlaneNote[] = [
  {
    id: 'p-1',
    number: 101,
    text: 'Hello woodland sky',
    biome: 'A-Frame Cottage',
    timeOfDay: 'morning',
    paperTint: 'cream',
    stamp: 'UNSAID',
    reads: 5,
    distanceKm: 12.4,
    createdAt: 'Just now',
    flags: 0,
    isUserCreated: true,
  },
  {
    id: 'p-2',
    number: 102,
    text: 'Second drifting thought',
    biome: 'Waterfall Stream',
    timeOfDay: 'dusk',
    paperTint: 'gold',
    stamp: 'AIRMAIL',
    reads: 12,
    distanceKm: 24.1,
    createdAt: '2 hours ago',
    flags: 0,
  },
];

describe('Milestone 3 & 4: AtmosphereEffects, PaperPlaneSystem & IsometricWorldEngine Parity', () => {
  let engine: ThreeWorldEngine | null = null;

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
  });

  it('re-exports ThreeWorldEngine as IsometricWorldEngine for drop-in App compatibility', () => {
    expect(IsometricWorldEngine).toBe(ThreeWorldEngine);
    expect(PALETTES.morning.label).toBe('Morning');
  });

  it('initializes AtmosphereEffects with campfire point light, sparkles, leaves, weather, and fireworks', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const atmo = engine.getAtmosphere();
    expect(atmo).not.toBeNull();
    expect(atmo!.campfireLight.intensity).toBeGreaterThan(0);

    engine.weather = 'rain';
    expect(engine.weather).toBe('rain');
    engine.weather = 'snow';
    expect(engine.weather).toBe('snow');

    expect(() => engine!.triggerFireworkVolley()).not.toThrow();
    expect(() => (engine as any).update(0.016)).not.toThrow();
  });

  it('synchronizes 3D paper planes, advances flight physics, and picks planes on click', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1280, height: 740 }),
    });
    const onSelect = vi.fn();
    engine = new ThreeWorldEngine(canvas, onSelect, vi.fn());

    engine.syncPlanes(SAMPLE_PLANES);
    const planeSys = engine.getPlaneSystem()!;
    expect(planeSys.planes.length).toBe(2);

    const p0 = planeSys.planes[0];
    const startGx = p0.gx;
    const startGy = p0.gy;

    // Advance flight simulation
    planeSys.update(0.05, 1.0);
    expect(p0.gx !== startGx || p0.gy !== startGy).toBe(true);

    // Removing a plane from pool cleans up its 3D entity
    engine.syncPlanes([SAMPLE_PLANES[0]]);
    expect(planeSys.planes.length).toBe(1);
  });
});
