import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { PropBuilder } from '../../../src/engine/world/PropBuilder';
import { TILE_SPACING, ELEV_UNIT } from '../../../src/engine/world/TerrainBuilder';

describe('Feature 6: Sculpted Woodland Props', () => {
  let builder: PropBuilder | null = null;

  const mockElev = (gx: number, gy: number): number => {
    if (gx === 2 && gy === 2) return 52;
    if (gx === 3 && gy === 1) return 54;
    if (gx === 2 && gy === 6) return 32;
    return 34;
  };

  afterEach(() => {
    if (builder) {
      builder.dispose();
      builder = null;
    }
  });

  it('6.1: verifies all 23 prop catalog kinds and 33 total instance placements', () => {
    builder = new PropBuilder(mockElev);

    expect(builder.propRecords.length).toBe(33);

    const kinds = new Set(builder.propRecords.map((r) => r.kind));
    expect(kinds.size).toBe(23);

    const expectedKinds = [
      'aframe_cottage',
      'hollow_trunk',
      'pine',
      'round_bush',
      'monolith_stone',
      'amanita_mushroom',
      'campfire',
      'watering_can',
      'cabbage',
      'garden_sprout',
      'frog_planter',
      'mushroom_stump',
      'fallen_log',
      'pond_frog',
      'cattails',
      'lilypads',
      'stream_rock',
      'pink_mushrooms',
      'tulips',
      'daisies',
      'marigolds',
      'sprout_shrub',
      'bonsai_bush',
    ];

    for (const k of expectedKinds) {
      expect(kinds.has(k)).toBe(true);
    }
  });

  it('6.2: verifies low-poly flat shading and shadow casting configuration', () => {
    builder = new PropBuilder(mockElev);

    let hasFlatShading = false;
    let hasCastShadow = false;

    builder.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.castShadow) hasCastShadow = true;
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if ((m as any).flatShading === true) {
              hasFlatShading = true;
            }
          }
        }
      }
    });

    expect(hasFlatShading).toBe(true);
    expect(hasCastShadow).toBe(true);
  });

  it('6.3: calculates campfire 3D light anchor coordinate calculation', () => {
    builder = new PropBuilder(mockElev);

    const campPos = builder.getCampfirePosition();
    expect(campPos).toBeDefined();

    // Campfire is centered on tile (2, 6) at gx = 2.5, gy = 6.5, gz = 34
    // worldX = -gy * TILE_SPACING, worldZ = gx * TILE_SPACING
    const expectedX = -6.5 * TILE_SPACING;
    const expectedY = 34 * ELEV_UNIT + 3.0;
    const expectedZ = 2.5 * TILE_SPACING;

    expect(campPos.x).toBeCloseTo(expectedX, 1);
    expect(campPos.y).toBeCloseTo(expectedY, 1);
    expect(campPos.z).toBeCloseTo(expectedZ, 1);
  });

  it('6.4: modulates campfire flame flicker oscillation animation over elapsed time', () => {
    builder = new PropBuilder(mockElev);

    const flameGroup = (builder as any).flameGroup as THREE.Group | null;
    expect(flameGroup).not.toBeNull();

    // Sample scale at elapsed = 0 vs elapsed = 0.1428 (quarter period of 11 rad/s)
    builder.update(0.016, 0.0);
    const scale0 = flameGroup!.scale.x;

    builder.update(0.016, Math.PI / 22); // sin(11 * (pi/22)) = sin(pi/2) = 1.0
    const scalePeak = flameGroup!.scale.x;

    expect(scalePeak).toBeGreaterThan(scale0);
    expect(scalePeak).toBeCloseTo(1.08, 2);
  });

  it('6.5: shifts pine tree foliage to frosty snow tint under snow weather', () => {
    builder = new PropBuilder(mockElev);

    const pineMeshes = (builder as any).pineMeshes as THREE.Mesh[];
    expect(pineMeshes.length).toBeGreaterThan(0);

    // Initial weather is clear/forest green
    const initialMat = pineMeshes[0].material as THREE.MeshLambertMaterial;
    expect(initialMat.color.getHex()).toBe(0x4b6b33);

    // Switch to snow
    builder.updateWeather('snow');
    const snowMat = pineMeshes[0].material as THREE.MeshLambertMaterial;
    expect(snowMat.color.getHex()).toBe(0xd5e4f0);

    // Revert to clear
    builder.updateWeather('clear');
    const clearMat = pineMeshes[0].material as THREE.MeshLambertMaterial;
    expect(clearMat.color.getHex()).toBe(0x4b6b33);
  });

  it('6.6: illuminates cottage window with warm gold at evening and midnight', () => {
    builder = new PropBuilder(mockElev);

    const windowMat = (builder as any).cottageWindowLit as THREE.MeshBasicMaterial;
    expect(windowMat).toBeDefined();

    // Day: softer daytime glow
    builder.updateTimeOfDay('morning');
    expect(windowMat.color.getHex()).toBe(0xffd666);

    // Night: bright luminous evening/midnight beacon
    builder.updateTimeOfDay('midnight');
    expect(windowMat.color.getHex()).toBe(0xffe680);

    builder.updateTimeOfDay('evening');
    expect(windowMat.color.getHex()).toBe(0xffe680);
  });

  it('6.7: disposes all tracked geometries and materials without memory leaks', () => {
    builder = new PropBuilder(mockElev);

    const geometries = (builder as any).geometries as Set<THREE.BufferGeometry>;
    const materials = (builder as any).materials as Set<THREE.Material>;

    expect(geometries.size).toBeGreaterThan(0);
    expect(materials.size).toBeGreaterThan(0);

    const geoSpies = Array.from(geometries).map((g) => vi.spyOn(g, 'dispose'));
    const matSpies = Array.from(materials).map((m) => vi.spyOn(m, 'dispose'));

    builder.dispose();

    for (const spy of geoSpies) {
      expect(spy).toHaveBeenCalled();
    }
    for (const spy of matSpies) {
      expect(spy).toHaveBeenCalled();
    }
    expect(builder.propRecords.length).toBe(0);
    expect(builder.group.children.length).toBe(0);
  });
});
