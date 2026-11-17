import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { soundscape } from '../src/lib/soundscape';

describe('Paper Planes Infrastructure Smoke Test Suite', () => {
  describe('Web Audio API & Soundscape Integration', () => {
    it('initializes global AudioContext and webkitAudioContext', () => {
      expect(window.AudioContext).toBeDefined();
      expect((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext).toBeDefined();
      const ctx = new window.AudioContext();
      expect(ctx.state).toBe('running');
      expect(ctx.sampleRate).toBe(44100);
      expect(ctx.destination).toBeDefined();
    });

    it('verifies audio node creation and parameter automation', () => {
      const ctx = new window.AudioContext();
      const gain = ctx.createGain();
      expect(gain.gain.value).toBe(1);

      gain.gain.setValueAtTime(0.5, 0);
      expect(gain.gain.value).toBe(0.5);

      gain.gain.setTargetAtTime(0.85, 0, 0.4);
      expect(gain.gain.value).toBe(0.85);

      gain.gain.exponentialRampToValueAtTime(0.01, 1);
      expect(gain.gain.value).toBe(0.01);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      expect(filter.frequency.value).toBe(340);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      expect(() => {
        osc.start();
        osc.stop();
      }).not.toThrow();
    });

    it('allocates and writes to AudioBuffer channel Float32Array', () => {
      const ctx = new window.AudioContext();
      const buffer = ctx.createBuffer(1, 44100 * 3, 44100);
      expect(buffer.numberOfChannels).toBe(1);
      expect(buffer.length).toBe(132300);
      const data = buffer.getChannelData(0);
      expect(data).toBeInstanceOf(Float32Array);
      expect(data.length).toBe(132300);
      data[100] = 0.42;
      expect(data[100]).toBeCloseTo(0.42);
    });

    it('executes AmbientSoundscape lifecycle: mute, unmute, weather mix, whoosh SFX, and re-mute', () => {
      // 1. Initial state is muted
      expect(soundscape.getMuted()).toBe(true);

      // 2. Unmute with weather creates context and noise buffer
      const unmuted = soundscape.toggleMute('rain');
      expect(unmuted).toBe(false);
      expect(soundscape.getMuted()).toBe(false);

      // 3. Switch weather conditions
      expect(() => soundscape.updateWeatherMix('snow')).not.toThrow();
      expect(() => soundscape.updateWeatherMix('clear')).not.toThrow();
      expect(() => soundscape.updateWeatherMix('rain')).not.toThrow();

      // 4. Trigger paper whoosh SFX
      expect(() => soundscape.playPaperWhoosh('unfold')).not.toThrow();
      expect(() => soundscape.playPaperWhoosh('launch')).not.toThrow();

      // 5. Mute again smoothly sets master gain to 0
      const muted = soundscape.toggleMute('clear');
      expect(muted).toBe(true);
      expect(soundscape.getMuted()).toBe(true);
    });
  });

  describe('DOM, Window & Layout Environment', () => {
    it('provides ResizeObserver implementation', () => {
      expect(window.ResizeObserver).toBeDefined();
      const ro = new ResizeObserver(() => {});
      expect(typeof ro.observe).toBe('function');
      expect(typeof ro.unobserve).toBe('function');
      expect(typeof ro.disconnect).toBe('function');
    });

    it('handles requestAnimationFrame loop and cancellation', async () => {
      let triggered = false;
      const id = window.requestAnimationFrame(() => {
        triggered = true;
      });
      expect(id).toBeDefined();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(triggered).toBe(true);
    });

    it('calculates Canvas dimensions and client bounding box correctly, preserving explicit zero dimensions', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 750;
      const rect = canvas.getBoundingClientRect();
      expect(rect.width).toBe(1200);
      expect(rect.height).toBe(750);
      expect(canvas.clientWidth).toBe(1200);
      expect(canvas.clientHeight).toBe(750);

      // Verify explicit zero dimensions are preserved and not coerced to defaults
      canvas.width = 0;
      canvas.height = 0;
      expect(canvas.clientWidth).toBe(0);
      expect(canvas.clientHeight).toBe(0);
      const zeroRect = canvas.getBoundingClientRect();
      expect(zeroRect.width).toBe(0);
      expect(zeroRect.height).toBe(0);
    });

    it('supports window.matchMedia and devicePixelRatio', () => {
      expect(window.matchMedia).toBeDefined();
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mql.matches).toBe(false);
      expect(window.devicePixelRatio).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Three.js Headless Smoke Test', () => {
    it('instantiates Scene and OrthographicCamera with 2:1 isometric angles', () => {
      const scene = new THREE.Scene();
      expect(scene).toBeDefined();

      const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
      camera.position.set(20, 20, 20);
      camera.lookAt(0, 0, 0);
      expect(camera.position.x).toBe(20);
    });

    it('instantiates WebGLRenderer and handles render loop without error', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const renderer = new THREE.WebGLRenderer({ canvas });
      expect(renderer).toBeDefined();
      renderer.setSize(800, 600);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      expect(() => renderer.render(scene, camera)).not.toThrow();

      // Verify Raycasting
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children);
      expect(Array.isArray(intersects)).toBe(true);

      renderer.dispose();
      geometry.dispose();
      material.dispose();
    });
  });

  describe('WebGL Context, Extensions & Lifecycle Verification', () => {
    it('caches mock context on repeated getContext calls for the same canvas', () => {
      const canvas = document.createElement('canvas');
      const gl1 = canvas.getContext('webgl2');
      const gl2 = canvas.getContext('webgl2');
      expect(gl1).toBe(gl2);

      const ctx2d_1 = canvas.getContext('2d');
      const ctx2d_2 = canvas.getContext('2d');
      expect(ctx2d_1).toBe(ctx2d_2);
    });

    it('handles WebGL extensions conforming to spec (valid extensions return objects, unknown return null)', () => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
      expect(gl).toBeDefined();

      // WEBGL_lose_context returns loseContext and restoreContext methods
      const loseContextExt = gl.getExtension('WEBGL_lose_context');
      expect(loseContextExt).toBeDefined();
      expect(typeof loseContextExt?.loseContext).toBe('function');
      expect(typeof loseContextExt?.restoreContext).toBe('function');

      // EXT_texture_filter_anisotropic returns anisotropy constant
      const anisoExt = gl.getExtension('EXT_texture_filter_anisotropic');
      expect(anisoExt).toBeDefined();
      expect((anisoExt as any).MAX_TEXTURE_MAX_ANISOTROPY_EXT).toBe(0x84ff);

      // KHR_parallel_shader_compile returns completion status constant
      const parallelExt = gl.getExtension('KHR_parallel_shader_compile');
      expect(parallelExt).toBeDefined();
      expect((parallelExt as any).COMPLETION_STATUS_KHR).toBe(0x91b1);

      // Unknown or unsupported extensions must return null
      expect(gl.getExtension('UNKNOWN_EXTENSION')).toBeNull();
      expect(gl.getExtension('SOME_COMPLETELY_FAKE_EXTENSION')).toBeNull();
    });

    it('executes renderer.forceContextLoss() without throwing any error', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const renderer = new THREE.WebGLRenderer({ canvas });
      expect(() => {
        renderer.forceContextLoss();
      }).not.toThrow();
      renderer.dispose();
    });
  });
});
