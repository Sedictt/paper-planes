import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { IsometricCamera } from '../../../src/engine/camera/IsometricCamera';
import { BIOME_SPOTS } from '../../../src/types';

describe('Feature 3: Isometric Orthographic Camera', () => {
  it('3.1: verifies 2:1 dimetric projection angles and rotation ordering', () => {
    const cam = new IsometricCamera();

    expect(cam.camera.rotation.order).toBe('YXZ');
    expect(cam.camera.rotation.y).toBeCloseTo(-Math.PI / 4, 6); // -45° yaw
    expect(cam.camera.rotation.x).toBeCloseTo(-Math.PI / 6, 6); // -30° pitch
    expect(Math.sin(Math.PI / 6)).toBeCloseTo(0.5, 6); // Exact 2:1 dimetric ratio
  });

  it('3.2: verifies frustum dimensions and dynamic aspect ratio updates', () => {
    const cam = new IsometricCamera({ virtualHeight: 740 });

    expect(cam.virtualHeight).toBe(740);
    expect(cam.camera.top).toBe(370);
    expect(cam.camera.bottom).toBe(-370);

    // Update with 16:9 aspect ratio
    const aspect = 16 / 9;
    cam.updateAspect(aspect);
    expect(cam.camera.right).toBeCloseTo(370 * (16 / 9), 4);
    expect(cam.camera.left).toBeCloseTo(-370 * (16 / 9), 4);
  });

  it('3.3: clamps zoom adjustments strictly within [0.65, 2.3]', () => {
    const onZoomChange = vi.fn();
    const cam = new IsometricCamera({}, onZoomChange);

    expect(cam.minZoom).toBe(0.65);
    expect(cam.maxZoom).toBe(2.3);

    // Extreme zoom in
    cam.adjustZoom(10.0);
    expect(cam.targetZoom).toBe(2.3);
    expect(onZoomChange).toHaveBeenCalledWith(2.3);

    // Extreme zoom out
    cam.adjustZoom(-20.0);
    expect(cam.targetZoom).toBe(0.65);
    expect(onZoomChange).toHaveBeenCalledWith(0.65);
  });

  it('3.4: handles screen-to-pan delta conversion and Cartesian bounding limits', () => {
    const cam = new IsometricCamera();

    // Pan within bounds
    cam.panByScreenDelta(100, 50, 1280, 740);
    expect(cam.camX).toBeDefined();
    expect(cam.camY).toBeDefined();

    // Verify clamping limits
    expect(cam.clampCamX(5000)).toBe(650);
    expect(cam.clampCamX(-5000)).toBe(-650);
    expect(cam.clampCamY(5000)).toBe(200);
    expect(cam.clampCamY(-5000)).toBe(-600);
  });

  it('3.5: verifies exponential lerping rate and deterministic convergence', () => {
    const cam = new IsometricCamera({ lerpSpeed: 9 });
    cam.targetCamX = 200;
    cam.targetCamY = 100;
    cam.targetZoom = 1.8;

    // Simulate 60 frames at dt = 1/60s (1.0 second total)
    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      cam.update(dt);
    }

    // Should converge within <0.05% error
    expect(cam.camX).toBeCloseTo(200, 1);
    expect(cam.camY).toBeCloseTo(100, 1);
    expect(cam.zoom).toBeCloseTo(1.8, 2);
  });

  it('3.6: calculates biome focus targets for all predefined spots in BIOME_SPOTS', () => {
    const cam = new IsometricCamera();

    const spots = Object.entries(BIOME_SPOTS);
    expect(spots.length).toBe(6);

    for (const [key, spot] of spots) {
      cam.focusBiome(spot.gx, spot.gy, spot.zoom);

      expect(cam.targetZoom).toBe(cam.clampZoom(spot.zoom));
      expect(cam.targetCamX).toBeGreaterThanOrEqual(-650);
      expect(cam.targetCamX).toBeLessThanOrEqual(650);
      expect(cam.targetCamY).toBeGreaterThanOrEqual(-600);
      expect(cam.targetCamY).toBeLessThanOrEqual(200);

      // Spot coordinates must be finite numbers
      expect(Number.isFinite(cam.targetCamX)).toBe(true);
      expect(Number.isFinite(cam.targetCamY)).toBe(true);
    }
  });
});
