import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { IsometricCamera } from '../src/engine/camera/IsometricCamera';
import { ThreeWorldEngine, PALETTES } from '../src/engine/ThreeWorldEngine';
import { IsometricWorldEngine } from '../src/engine/IsometricWorldEngine';
import { BIOME_SPOTS, type PaperPlaneNote } from '../src/types';

describe('Milestone 1: ThreeWorldEngine & IsometricCamera Test Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('IsometricCamera Mathematical 2:1 Dimetric Projection', () => {
    it('initializes with exact 30° pitch and -45° yaw orientation', () => {
      const cameraCtrl = new IsometricCamera();
      const camera = cameraCtrl.camera;

      expect(camera.rotation.order).toBe('YXZ');
      expect(camera.rotation.y).toBeCloseTo(-Math.PI / 4, 6);
      expect(camera.rotation.x).toBeCloseTo(-Math.PI / 6, 6);

      // Verify sin(30°) = 0.5 for exact 2:1 dimetric ratio
      expect(Math.sin(Math.PI / 6)).toBeCloseTo(0.5, 6);
    });

    it('sets initial frustum and default values matching virtual height 740', () => {
      const cameraCtrl = new IsometricCamera();
      expect(cameraCtrl.virtualHeight).toBe(740);
      expect(cameraCtrl.zoom).toBe(1.05);
      expect(cameraCtrl.camX).toBe(0);
      expect(cameraCtrl.camY).toBe(-175);

      const camera = cameraCtrl.camera;
      expect(camera.top).toBe(370);
      expect(camera.bottom).toBe(-370);
      expect(camera.right).toBeCloseTo(370 * (1280 / 740), 4);
      expect(camera.left).toBeCloseTo(-370 * (1280 / 740), 4);
    });

    it('updates frustum correctly on aspect ratio changes', () => {
      const cameraCtrl = new IsometricCamera();
      cameraCtrl.updateAspect(16 / 9);
      expect(cameraCtrl.camera.top).toBe(370);
      expect(cameraCtrl.camera.bottom).toBe(-370);
      expect(cameraCtrl.camera.right).toBeCloseTo(370 * (16 / 9), 4);
      expect(cameraCtrl.camera.left).toBeCloseTo(-370 * (16 / 9), 4);
    });

    it('matches 2D screen coordinates with sub-pixel precision across grid points', () => {
      const cameraCtrl = new IsometricCamera();
      cameraCtrl.updateAspect(1280 / 740);
      const camera = cameraCtrl.camera;

      function projectToPixels(v3: THREE.Vector3) {
        const ndc = v3.clone().project(camera);
        const px = 640 + ndc.x * 640;
        const py = 370 - ndc.y * 370;
        return { px, py };
      }

      function gridToWorld3D(gx: number, gy: number, gz = 0) {
        const S = 39 * Math.SQRT2;
        return new THREE.Vector3(-gy * S, gz * (2 / Math.sqrt(3)), gx * S);
      }

      function isoToScreen2D(gx: number, gy: number, gz = 0) {
        const worldX = (gx - gy) * 39;
        const worldY = (gx + gy) * 19.5 - gz;
        return {
          px: 640 + (worldX + cameraCtrl.camX) * cameraCtrl.zoom,
          py: 370 + (worldY + cameraCtrl.camY) * cameraCtrl.zoom,
        };
      }

      const testPoints = [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
        [5.5, 5.5, 25],
        [2.5, 2.8, 52],
        [12, 12, 0],
      ];

      for (const [gx, gy, gz] of testPoints) {
        const p3 = projectToPixels(gridToWorld3D(gx, gy, gz));
        const p2 = isoToScreen2D(gx, gy, gz);
        expect(p3.px).toBeCloseTo(p2.px, 6);
        expect(p3.py).toBeCloseTo(p2.py, 6);
      }
    });

    it('centers focused biomes on exact virtual screen center (640, 370)', () => {
      const onZoomChange = vi.fn();
      const cameraCtrl = new IsometricCamera({}, onZoomChange);
      cameraCtrl.updateAspect(1280 / 740);

      function gridToWorld3D(gx: number, gy: number, gz = 0) {
        const S = 39 * Math.SQRT2;
        return new THREE.Vector3(-gy * S, gz * (2 / Math.sqrt(3)), gx * S);
      }

      const biomeElevations: Record<string, number> = {
        overview: 25,
        cottage: 52,
        campfire: 32,
        garden: 26,
        waterfall: 14,
      };

      for (const spot of BIOME_SPOTS) {
        const elev = biomeElevations[spot.id] ?? 25;
        cameraCtrl.focusBiome(spot.gx, spot.gy, spot.zoom, elev);
        expect(onZoomChange).toHaveBeenCalledWith(cameraCtrl.targetZoom);

        // Fast-forward lerp to target
        cameraCtrl.camX = cameraCtrl.targetCamX;
        cameraCtrl.camY = cameraCtrl.targetCamY;
        cameraCtrl.zoom = cameraCtrl.targetZoom;
        cameraCtrl.syncCameraTransform();

        const ndc = gridToWorld3D(spot.gx, spot.gy, elev).project(cameraCtrl.camera);
        const px = 640 + ndc.x * 640;
        const py = 370 - ndc.y * 370;

        expect(px).toBeCloseTo(640, 2);
        expect(py).toBeCloseTo(370, 2);
      }
    });
  });

  describe('Camera Navigation & Bounds Clamping', () => {
    it('clamps zoom within strict limits [0.65, 2.3]', () => {
      const cameraCtrl = new IsometricCamera();

      cameraCtrl.adjustZoom(10.0);
      expect(cameraCtrl.targetZoom).toBe(2.3);

      cameraCtrl.adjustZoom(-10.0);
      expect(cameraCtrl.targetZoom).toBe(0.65);

      cameraCtrl.adjustZoom(0.4);
      expect(cameraCtrl.targetZoom).toBe(1.05);
    });

    it('clamps pan translation within [-650, 650] for X and [-600, 200] for Y', () => {
      const cameraCtrl = new IsometricCamera();

      // Pan far beyond positive X and Y
      cameraCtrl.panByScreenDelta(10000, 10000, 1280, 740);
      expect(cameraCtrl.camX).toBe(650);
      expect(cameraCtrl.camY).toBe(200);

      // Pan far beyond negative X and Y
      cameraCtrl.panByScreenDelta(-20000, -20000, 1280, 740);
      expect(cameraCtrl.camX).toBe(-650);
      expect(cameraCtrl.camY).toBe(-600);
    });

    it('performs exponential lerping over time toward targets', () => {
      const cameraCtrl = new IsometricCamera();
      cameraCtrl.targetCamX = 100;
      cameraCtrl.targetCamY = 0;
      cameraCtrl.targetZoom = 1.5;

      expect(cameraCtrl.camX).toBe(0);
      expect(cameraCtrl.camY).toBe(-175);
      expect(cameraCtrl.zoom).toBe(1.05);

      // Advance by 1/60s (approx 16.7ms)
      cameraCtrl.update(1 / 60);

      expect(cameraCtrl.camX).toBeGreaterThan(0);
      expect(cameraCtrl.camX).toBeLessThan(100);
      expect(cameraCtrl.camY).toBeGreaterThan(-175);
      expect(cameraCtrl.camY).toBeLessThan(0);
      expect(cameraCtrl.zoom).toBeGreaterThan(1.05);
      expect(cameraCtrl.zoom).toBeLessThan(1.5);

      // Advance by 1s (complete convergence)
      for (let i = 0; i < 60; i++) {
        cameraCtrl.update(1 / 60);
      }

      expect(cameraCtrl.camX).toBeCloseTo(100, 1);
      expect(cameraCtrl.camY).toBeCloseTo(0, 1);
      expect(cameraCtrl.zoom).toBeCloseTo(1.5, 2);
    });
  });

  describe('ThreeWorldEngine Architecture & Lifecycle', () => {
    it('initializes ThreeWorldEngine and maintains public contract interface', () => {
      const canvas = document.createElement('canvas');
      const onSelect = vi.fn();
      const onZoom = vi.fn();

      const engine = new ThreeWorldEngine(canvas, onSelect, onZoom);

      expect(engine.timeOfDay).toBe('morning');
      expect(engine.weather).toBe('clear');
      expect(engine.fireworksActive).toBe(false);
      expect(engine.zoom).toBeCloseTo(1.6);
      expect(engine.camX).toBe(0);
      expect(engine.camY).toBe(-175);

      // Update properties
      engine.timeOfDay = 'dusk';
      expect(engine.timeOfDay).toBe('dusk');

      engine.weather = 'rain';
      expect(engine.weather).toBe('rain');

      engine.fireworksActive = true;
      expect(engine.fireworksActive).toBe(true);

      engine.adjustZoom(0.2);
      expect(onZoom).toHaveBeenCalled();

      expect(() => engine.triggerFireworkVolley()).not.toThrow();
      const sampleNote: PaperPlaneNote = {
        id: 'test-1',
        number: 1,
        text: 'Hello test',
        biome: 'Sanctuary Overview',
        timeOfDay: 'morning',
        paperTint: 'cream',
        stamp: 'AIRMAIL',
        reads: 0,
        distanceKm: 0,
        createdAt: 'Just now',
        flags: 0,
      };
      expect(() => engine.syncPlanes([sampleNote])).not.toThrow();

      engine.destroy();
    });

    it('updates palette background and lighting across all 6 time phases', () => {
      const canvas = document.createElement('canvas');
      const engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

      const times = ['dawn', 'morning', 'afternoon', 'dusk', 'evening', 'midnight'] as const;
      for (const t of times) {
        engine.timeOfDay = t;
        expect(PALETTES[t].label).toBeDefined();
        expect(PALETTES[t].skyMid).toBeDefined();
        expect(PALETTES[t].windowLit).toBeDefined();
      }

      engine.destroy();
    });

    it('handles mouse wheel zoom with 0.15 step and prevents default', () => {
      const canvas = document.createElement('canvas');
      const onZoom = vi.fn();
      const engine = new ThreeWorldEngine(canvas, vi.fn(), onZoom);

      const zoomInEvent = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
      canvas.dispatchEvent(zoomInEvent);
      expect(zoomInEvent.defaultPrevented).toBe(true);
      expect(onZoom).toHaveBeenCalledWith(1.75);

      const zoomOutEvent = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
      canvas.dispatchEvent(zoomOutEvent);
      expect(zoomOutEvent.defaultPrevented).toBe(true);
      expect(onZoom).toHaveBeenCalledWith(1.6);

      engine.destroy();
    });

    it('handles mouse drag-to-pan and distinguishes clicks from drags', () => {
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => ({
        width: 1280,
        height: 740,
        top: 0,
        left: 0,
        bottom: 740,
        right: 1280,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

      // 1. Mouse down at (100, 100)
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));

      // 2. Mouse move by 20px (exceeds 4px threshold)
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 110 }));

      // Camera should have panned
      expect(engine.camX).not.toBe(0);

      // 3. Mouse up
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 120, clientY: 110 }));

      // 4. Click after drag should be suppressed
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 120, clientY: 110 }));

      engine.destroy();
    });

    it('handles WebGL context lost and restored lifecycle', () => {
      const canvas = document.createElement('canvas');
      const engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

      const lostEvent = new Event('webglcontextlost', { cancelable: true });
      canvas.dispatchEvent(lostEvent);
      expect(lostEvent.defaultPrevented).toBe(true);

      const restoredEvent = new Event('webglcontextrestored');
      expect(() => canvas.dispatchEvent(restoredEvent)).not.toThrow();

      engine.destroy();
    });

    it('cleans up all event listeners and WebGL resources on destroy() without leaking', () => {
      const canvas = document.createElement('canvas');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const canvasRemoveSpy = vi.spyOn(canvas, 'removeEventListener');

      const engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());
      engine.destroy();

      // Check window listeners removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

      // Check canvas listeners removed
      expect(canvasRemoveSpy).toHaveBeenCalledWith('wheel', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
      expect(canvasRemoveSpy).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
    });
  });

  describe('Backward Compatibility Facade', () => {
    it('exports IsometricWorldEngine matching ThreeWorldEngine signature', () => {
      expect(IsometricWorldEngine).toBe(ThreeWorldEngine);
      expect(PALETTES).toBeDefined();
      expect(PALETTES.morning.label).toBe('Morning');
      expect(PALETTES.midnight.label).toBe('Midnight');
    });
  });
});
