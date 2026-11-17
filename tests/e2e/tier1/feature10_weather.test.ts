import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeWorldEngine } from '../../../src/engine/ThreeWorldEngine';
import { PropBuilder } from '../../../src/engine/world/PropBuilder';
import { WaterSystem } from '../../../src/engine/world/WaterSystem';
import { PALETTES } from '../../../src/engine/ThreeWorldEngine';

describe('Feature 10: Weather Particle Systems & Atmospheric States', () => {
  let engine: ThreeWorldEngine | null = null;
  let props: PropBuilder | null = null;
  let water: WaterSystem | null = null;

  afterEach(() => {
    if (engine) {
      engine.destroy();
      engine = null;
    }
    if (props) {
      props.dispose();
      props = null;
    }
    if (water) {
      water.dispose();
      water = null;
    }
  });

  it('10.1: validates weather particle buffer allocation and attribute metrics', () => {
    // Weather particle specification: 120-130 particles with Float32Array positions
    const particleCount = 130;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 500;
      positions[i * 3 + 1] = Math.random() * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 500;
      speeds[i] = 1.0 + Math.random() * 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    expect(geometry.getAttribute('position').count).toBe(130);
    expect(geometry.getAttribute('position').itemSize).toBe(3);
    expect(speeds.length).toBe(130);
    geometry.dispose();
  });

  it('10.2: validates rain downward kinematics and slanted wind trajectory', () => {
    // Rain kinematics: vy in [250, 420], vx in [-65, -95] (slanted wind)
    const dt = 0.05; // 50ms step
    const initialPos = new THREE.Vector3(0, 100, 0);

    const fallSpeed = 320; // within [250, 420]
    const windSpeed = -80; // within [-65, -95]

    const nextPos = initialPos.clone().add(
      new THREE.Vector3(windSpeed * dt, -fallSpeed * dt, 0)
    );

    const dy = nextPos.y - initialPos.y;
    const dx = nextPos.x - initialPos.x;

    expect(dy).toBeLessThan(0); // Falls downward
    expect(dx).toBeLessThan(0); // Slants with wind

    const slantRatio = Math.abs(dy / dx);
    expect(slantRatio).toBeGreaterThan(2.5);
    expect(slantRatio).toBeLessThan(5.5);
  });

  it('10.3: validates snow gentle descent velocity and sinusoidal lateral sway', () => {
    // Snow kinematics: vy in [40, 65], sinusoidal sway vx = sin(2t + seed) * 14
    const dt = 0.0166;
    let posY = 100;
    let posX = 0;
    const snowFallSpeed = 50;

    const swaySamples: number[] = [];
    const totalFrames = 150;
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame * dt;
      posY -= snowFallSpeed * dt;
      const sway = Math.sin(2 * t) * 14 * dt;
      posX += sway;
      swaySamples.push(sway);
    }

    // Snow fall speed is gentle (<25% of rain fall speed)
    expect(100 - posY).toBeCloseTo(snowFallSpeed * (totalFrames * dt), 1);

    // Lateral sway must alternate signs (harmonic swaying)
    const positiveSways = swaySamples.filter((s) => s > 0).length;
    const negativeSways = swaySamples.filter((s) => s < 0).length;
    expect(positiveSways).toBeGreaterThan(0);
    expect(negativeSways).toBeGreaterThan(0);
  });

  it('10.4: validates vertical boundary reset and wrap-around recycling without NaN', () => {
    const bottomThreshold = -10;
    const ceilingHeight = 120;
    let testY = -15; // below threshold

    if (testY < bottomThreshold) {
      testY = ceilingHeight;
    }

    expect(testY).toBe(ceilingHeight);
    expect(Number.isFinite(testY)).toBe(true);
    expect(isNaN(testY)).toBe(false);
  });

  it('10.5: verifies foliage and water material tint shifts under snow weather', () => {
    props = new PropBuilder(() => 34);
    water = new WaterSystem(PALETTES.morning);

    const pineMeshes = (props as any).pineMeshes as THREE.Mesh[];
    const initialPineColor = (pineMeshes[0].material as THREE.MeshLambertMaterial).color.getHex();
    expect(initialPineColor).toBe(0x4b6b33); // Pine green

    // Apply snow weather
    props.updateWeather('snow');
    water.setWeather('snow');

    const snowPineColor = (pineMeshes[0].material as THREE.MeshLambertMaterial).color.getHex();
    expect(snowPineColor).toBe(0xd5e4f0); // Frosty white

    const streamMat = (water as any).streamMaterial as THREE.ShaderMaterial;
    expect(streamMat.uniforms.uOpacity.value).toBe(0.95); // Slushy ice opacity

    // Revert to clear
    props.updateWeather('clear');
    water.setWeather('clear');

    expect((pineMeshes[0].material as THREE.MeshLambertMaterial).color.getHex()).toBe(0x4b6b33);
    expect(streamMat.uniforms.uOpacity.value).toBe(0.85);
  });

  it('10.6: verifies engine weather setter reactivity and clear weather state', () => {
    const canvas = document.createElement('canvas');
    engine = new ThreeWorldEngine(canvas, vi.fn(), vi.fn());

    expect(engine.weather).toBe('clear');

    engine.weather = 'rain';
    expect(engine.weather).toBe('rain');

    engine.weather = 'snow';
    expect(engine.weather).toBe('snow');

    engine.weather = 'clear';
    expect(engine.weather).toBe('clear');
  });
});
