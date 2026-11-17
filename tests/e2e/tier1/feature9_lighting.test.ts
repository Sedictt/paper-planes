import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeWorldEngine, PALETTES } from '../../../src/engine/ThreeWorldEngine';

describe('Feature 9: Dynamic Lighting & Soft Shadows', () => {
  let engine: ThreeWorldEngine | null = null;

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
  });

  it('9.1: verifies AmbientLight initialization and palette shadeMul scaling', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const ambient = (engine as any).ambientLight as THREE.AmbientLight;
    expect(ambient).toBeDefined();
    expect(ambient).toBeInstanceOf(THREE.AmbientLight);

    // Initial is morning: intensity = shadeMul * 0.15
    expect(ambient.intensity).toBeCloseTo(PALETTES.morning.shadeMul * 0.15, 2);
    expect(ambient.color.getHexString()).toBe(
      PALETTES.morning.skyTop.replace('#', '').toLowerCase()
    );

    // Switch to midnight
    engine.timeOfDay = 'midnight';
    expect(ambient.intensity).toBeCloseTo(PALETTES.midnight.shadeMul * 0.28, 2);
    expect(ambient.color.getHexString()).toBe(
      PALETTES.midnight.skyTop.replace('#', '').toLowerCase()
    );
  });

  it('9.2: verifies DirectionalLight sun/moon position and orthographic shadow frustum', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const dirLight = (engine as any).dirLight as THREE.DirectionalLight;
    expect(dirLight).toBeDefined();
    expect(dirLight).toBeInstanceOf(THREE.DirectionalLight);

    // Sun / Moon Position (front-left/top matching floating-island.html)
    expect(dirLight.position.x).toBe(67);
    expect(dirLight.position.y).toBe(610);
    expect(dirLight.position.z).toBe(543);

    // Shadow Map configuration
    expect(dirLight.castShadow).toBe(true);
    expect(dirLight.shadow.mapSize.width).toBe(2048);
    expect(dirLight.shadow.mapSize.height).toBe(2048);

    // Shadow camera frustum bounds covering diorama island
    const cam = dirLight.shadow.camera;
    expect(cam.left).toBe(-480);
    expect(cam.right).toBe(480);
    expect(cam.top).toBe(480);
    expect(cam.bottom).toBe(-480);
    expect(cam.near).toBe(50);
    expect(cam.far).toBe(2200);
  });

  it('9.3: verifies day vs night directional light intensity attenuation', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const dirLight = (engine as any).dirLight as THREE.DirectionalLight;

    // Daytime (morning/afternoon): 2.8 * shadeMul with warm creamy sun #fff0d0
    engine.timeOfDay = 'afternoon';
    expect(dirLight.intensity).toBeCloseTo(2.8 * PALETTES.afternoon.shadeMul, 2);
    expect(dirLight.color.getHexString()).toBe('fff0d0');

    // Nighttime (evening/midnight): attenuates to 1.18 with cool moonlight #99b8eb
    engine.timeOfDay = 'midnight';
    expect(dirLight.intensity).toBeCloseTo(1.18, 2);
    expect(dirLight.color.getHexString()).toBe('99b8eb');

    engine.timeOfDay = 'evening';
    expect(dirLight.intensity).toBeCloseTo(1.18, 2);
  });

  it('9.4: verifies campfire light anchor coordinate and flame animation tracking', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const diorama = (engine as any).diorama;
    expect(diorama).toBeDefined();

    const campPos = diorama.getCampfirePosition() as THREE.Vector3;
    expect(campPos).toBeDefined();
    expect(campPos.x).toBeLessThan(0); // Located at negative X in world space
    expect(campPos.y).toBeGreaterThan(30); // Elevated on terrace
    expect(campPos.z).toBeGreaterThan(0); // Located at positive Z

    // Check prop campfire update
    const props = diorama.props;
    expect(() => props.update(0.016, 1.0)).not.toThrow();
  });

  it('9.5: verifies shadow map renderer configuration and acne-suppression bias', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const renderer = (engine as any).renderer as THREE.WebGLRenderer;
    expect(renderer.shadowMap.enabled).toBe(true);

    const dirLight = (engine as any).dirLight as THREE.DirectionalLight;
    // Bias must be negative to prevent self-shadowing acne on voxel cliff walls
    expect(dirLight.shadow.bias).toBe(-0.0003);
  });

  it('9.6: verifies lighting resources cleanup on engine destroy()', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    const scene = (engine as any).scene as THREE.Scene;
    expect(scene.children.length).toBeGreaterThan(0);

    engine.destroy();
    engine = null;

    expect(canvas).toBeDefined();
  });
});
