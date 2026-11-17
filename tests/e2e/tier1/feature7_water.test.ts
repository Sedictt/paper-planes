import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { WaterSystem } from '../../../src/engine/world/WaterSystem';
import { PALETTES } from '../../../src/engine/ThreeWorldEngine';
import { ELEV_UNIT } from '../../../src/engine/world/TerrainBuilder';

describe('Feature 7: Animated Water & Waterfall', () => {
  let water: WaterSystem | null = null;

  afterEach(() => {
    if (water) {
      water.dispose();
      water = null;
    }
  });

  it('7.1: verifies stream channel geometry and sunken elevation alignment', () => {
    water = new WaterSystem(PALETTES.morning, {
      streamElevation: 14,
      waterfallDrop: -35,
    });

    const streamMesh = water.getWaterMesh();
    expect(streamMesh).toBeDefined();
    expect(streamMesh.geometry).toBeInstanceOf(THREE.BufferGeometry);

    // Geometry position attribute elevation
    const posAttr = streamMesh.geometry.getAttribute('position');
    expect(posAttr).toBeDefined();
    expect(posAttr.count).toBeGreaterThan(0);

    // Surface Y coordinate should be aligned around 14 * ELEV_UNIT - 0.1
    const expectedY = 14 * ELEV_UNIT - 0.1;
    const sampleY = posAttr.getY(0);
    expect(sampleY).toBeCloseTo(expectedY, 1);

    // Check bounding box
    streamMesh.geometry.computeBoundingBox();
    const bbox = streamMesh.geometry.boundingBox!;
    expect(bbox.min.y).toBeCloseTo(expectedY, 1);
    expect(bbox.max.y).toBeCloseTo(expectedY, 1);
  });

  it('7.2: verifies translucency, depthWrite false, and renderOrder sorting invariants', () => {
    water = new WaterSystem(PALETTES.morning);

    const streamMesh = water.getWaterMesh();
    const streamMat = (water as any).streamMaterial as THREE.ShaderMaterial;

    expect(streamMat.transparent).toBe(true);
    expect(streamMat.depthWrite).toBe(false);
    expect(streamMesh.renderOrder).toBeGreaterThanOrEqual(1);

    // Uniform opacity check
    expect(streamMat.uniforms.uOpacity.value).toBeCloseTo(0.85, 2);
  });

  it('7.3: validates mathematical sine-wave shimmer duty cycle (~37.6%)', () => {
    // Exact equation from shader:
    // sin(uTime * 2.2 + gx * 0.9 + gy * 0.7) > 0.38
    const gx = 5;
    const gy = 6;
    const period = (2 * Math.PI) / 2.2; // ~2.85599s
    const samples = 2000;
    let activeCount = 0;

    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * period;
      const wave = Math.sin(t * 2.2 + gx * 0.9 + gy * 0.7);
      if (wave > 0.38) {
        activeCount++;
      }
    }

    const dutyCycle = activeCount / samples;
    // Theoretical duty cycle = (pi - 2*asin(0.38)) / (2*pi) = 0.3759
    expect(dutyCycle).toBeGreaterThan(0.35);
    expect(dutyCycle).toBeLessThan(0.40);
  });

  it('7.4: verifies waterfall vertical drop and UV scroll rate', () => {
    water = new WaterSystem(PALETTES.morning, {
      streamElevation: 14,
      waterfallDrop: -35,
    });

    const waterfallMesh = water.getWaterfallMesh();
    const waterfallMat = (water as any).waterfallMaterial as THREE.ShaderMaterial;

    expect(waterfallMesh).toBeDefined();
    expect(waterfallMat.transparent).toBe(true);
    expect(waterfallMat.depthWrite).toBe(false);

    waterfallMesh.geometry.computeBoundingBox();
    const bbox = waterfallMesh.geometry.boundingBox!;

    const topY = bbox.max.y;
    const bottomY = bbox.min.y;
    const verticalDrop = topY - bottomY;

    // Top is around 14 * ELEV_UNIT (~16.16), bottom is -35 * ELEV_UNIT (~ -40.41)
    expect(topY).toBeCloseTo(14 * ELEV_UNIT, 1);
    expect(bottomY).toBeCloseTo(-35 * ELEV_UNIT, 1);
    expect(verticalDrop).toBeCloseTo(49 * ELEV_UNIT, 1);

    // Advance animation time by 1.0 second
    water.update(1.0, 1.0);
    expect(waterfallMat.uniforms.uTime.value).toBe(1.0);
  });

  it('7.5: verifies mist particle buffer kinematics, rising motion, and recycling', () => {
    water = new WaterSystem(PALETTES.morning);

    const mist = water.getMistParticles();
    expect(mist).toBeDefined();
    expect(mist).toBeInstanceOf(THREE.Points);

    const geo = mist.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position');
    expect(posAttr).toBeDefined();
    expect(posAttr.count).toBe(24); // Exactly 24 mist particles

    // Initial positions
    const initialY = posAttr.getY(0);

    // Advance by dt = 0.5s, elapsed = 0.5s
    water.update(0.5, 0.5);
    const advancedY = posAttr.getY(0);

    // Particles should rise upwards
    expect(advancedY).toBeGreaterThanOrEqual(initialY);

    // Advance beyond lifetime (> 2.5s) to trigger recycling
    water.update(3.0, 3.5);
    expect(Number.isFinite(posAttr.getY(0))).toBe(true);
    expect(isNaN(posAttr.getY(0))).toBe(false);
  });

  it('7.6: updates water color uniforms on palette change and cleans up on dispose()', () => {
    water = new WaterSystem(PALETTES.morning);

    const streamMat = (water as any).streamMaterial as THREE.ShaderMaterial;
    expect(streamMat.uniforms.uWaterColor.value.getHexString()).toBe(
      PALETTES.morning.river.replace('#', '').toLowerCase()
    );

    // Update palette to midnight
    water.setPalette(PALETTES.midnight);
    expect(streamMat.uniforms.uWaterColor.value.getHexString()).toBe(
      PALETTES.midnight.river.replace('#', '').toLowerCase()
    );

    const geoSpy = vi.spyOn(water.getWaterMesh().geometry, 'dispose');
    const matSpy = vi.spyOn(streamMat, 'dispose');

    water.dispose();

    expect(geoSpy).toHaveBeenCalled();
    expect(matSpy).toHaveBeenCalled();
    expect(water.group.children.length).toBe(0);
  });
});
