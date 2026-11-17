import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AMBIENT_ZONES,
  LocationAmbiencePlayer,
  computeLocationMix,
} from '../src/lib/locationAmbience';

function createMockAudioParam(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}

function createMockAudioContext() {
  const createdOscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const createdSources: Array<{ start: ReturnType<typeof vi.fn> }> = [];

  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    createGain: vi.fn(() => ({
      gain: createMockAudioParam(1),
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1),
      connect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: createMockAudioParam(0),
      connect: vi.fn(),
    })),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: createMockAudioParam(440),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdOscillators.push(osc);
      return osc;
    }),
    createBuffer: vi.fn((channels: number, length: number) => ({
      numberOfChannels: channels,
      length,
      duration: length / 44100,
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
      };
      createdSources.push(src);
      return src;
    }),
  };

  return {
    mockCtx: mockCtx as unknown as AudioContext,
    createdOscillators,
    createdSources,
  };
}

describe('Location-Based Ambient Sounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('gives each landmark the strongest weight when the camera focuses directly on it', () => {
    for (const zone of AMBIENT_ZONES) {
      const mix = computeLocationMix(zone.worldX, zone.worldY, 2.0);
      expect(mix[zone.id].weight).toBeCloseTo(1, 3);
      expect(mix[zone.id].pan).toBeCloseTo(0, 3);

      for (const other of AMBIENT_ZONES) {
        if (other.id !== zone.id) {
          expect(mix[other.id].weight).toBeLessThan(mix[zone.id].weight);
        }
      }
    }
  });

  it('scales local presence with zoom and pans left/right relative to camera', () => {
    const waterfall = AMBIENT_ZONES.find((z) => z.id === 'waterfall')!;
    const zoomedOut = computeLocationMix(waterfall.worldX, waterfall.worldY, 0.75);
    const zoomedIn = computeLocationMix(waterfall.worldX, waterfall.worldY, 2.0);
    expect(zoomedIn.waterfall.weight).toBeGreaterThan(zoomedOut.waterfall.weight);

    const lookingLeft = computeLocationMix(waterfall.worldX - 100, waterfall.worldY, 1.8);
    const lookingRight = computeLocationMix(waterfall.worldX + 100, waterfall.worldY, 1.8);
    expect(lookingLeft.waterfall.pan).toBeGreaterThan(0);
    expect(lookingRight.waterfall.pan).toBeLessThan(0);
  });

  it('starts procedural zone events when near a landmark and stops cleanly', () => {
    const { mockCtx, createdOscillators, createdSources } = createMockAudioContext();
    const dest = mockCtx.createGain();
    const noiseBuffer = mockCtx.createBuffer(1, 44100 * 3, 44100);

    const player = new LocationAmbiencePlayer(mockCtx, dest, noiseBuffer);
    const campfire = AMBIENT_ZONES.find((z) => z.id === 'campfire')!;
    player.updateLocation(campfire.worldX, campfire.worldY, 2.0, 'evening');
    player.start();

    const initialSources = createdSources.length;
    (mockCtx as unknown as { currentTime: number }).currentTime = 1.0;
    vi.advanceTimersByTime(600);
    expect(createdSources.length).toBeGreaterThan(initialSources);

    const shrine = AMBIENT_ZONES.find((z) => z.id === 'shrine')!;
    player.updateLocation(shrine.worldX, shrine.worldY, 2.0, 'afternoon');
    (mockCtx as unknown as { currentTime: number }).currentTime = 5.0;
    vi.advanceTimersByTime(400);
    expect(createdOscillators.length).toBeGreaterThan(0);

    player.stop();
  });
});
