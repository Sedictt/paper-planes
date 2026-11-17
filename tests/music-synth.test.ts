import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_TRACKS, ProceduralMusicPlayer } from '../src/lib/musicSynth';
import { soundscape, type UiSfxKind } from '../src/lib/soundscape';
import { synthesizeUiSfx } from '../src/lib/uiSfx';

function createMockAudioParam(initial = 0) {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function createMockAudioContext() {
  const createdOscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => ({
      gain: createMockAudioParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createDelay: vi.fn(() => ({
      delayTime: createMockAudioParam(0.3),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: createMockAudioParam(0),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: createMockAudioParam(-16),
      knee: createMockAudioParam(18),
      ratio: createMockAudioParam(3),
      attack: createMockAudioParam(0.02),
      release: createMockAudioParam(0.25),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: createMockAudioParam(440),
        detune: createMockAudioParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdOscillators.push(osc);
      return osc;
    }),
    createBuffer: vi.fn((channels: number, length: number) => ({
      numberOfChannels: channels,
      length,
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
    })),
  };

  return { mockCtx: mockCtx as unknown as AudioContext, createdOscillators };
}

describe('Procedural Background Music Synthesizer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('provides multiple distinct tracks covering serene/nostalgic and melancholic moods', () => {
    expect(MUSIC_TRACKS.length).toBeGreaterThanOrEqual(5);
    const moods = MUSIC_TRACKS.map((t) => t.mood.toLowerCase()).join(' ');
    expect(moods).toContain('serene');
    expect(moods).toContain('nostalgic');
    expect(moods).toContain('melancholic');
  });

  it('schedules oscillator voices when started and switches tracks cleanly', () => {
    const { mockCtx, createdOscillators } = createMockAudioContext();
    const dest = mockCtx.createGain();
    const onTrackChange = vi.fn();

    const player = new ProceduralMusicPlayer(mockCtx, dest, onTrackChange);
    player.start('paper-boats');

    expect(createdOscillators.length).toBeGreaterThan(0);
    expect(createdOscillators[0].start).toHaveBeenCalled();

    const next = player.nextTrack();
    expect(next.id).toBe('rain-rooftop');
    expect(onTrackChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'rain-rooftop' }));

    player.setTrack('midnight-lanterns');
    expect(player.getCurrentTrack().id).toBe('midnight-lanterns');

    player.dispose();
  });

  it('integrates with soundscape for track selection, volume clamping, and subscriptions', () => {
    const { mockCtx } = createMockAudioContext();
    vi.stubGlobal('AudioContext', function () {
      return mockCtx;
    });

    const listener = vi.fn();
    const unsub = soundscape.subscribe(listener);

    soundscape.setMusicVolume(1.5);
    expect(soundscape.getMusicVolume()).toBe(1);
    soundscape.setMusicVolume(-0.2);
    expect(soundscape.getMusicVolume()).toBe(0);

    soundscape.setAmbienceVolume(0.8);
    expect(soundscape.getAmbienceVolume()).toBe(0.8);

    soundscape.setAutoCycle(false);
    expect(soundscape.getAutoCycle()).toBe(false);
    soundscape.setAutoCycle(true);

    soundscape.selectTrack('rain-rooftop', 'rain');
    expect(soundscape.getMuted()).toBe(false);
    expect(soundscape.getCurrentTrack().id).toBe('rain-rooftop');

    const next = soundscape.nextTrack('clear');
    expect(next.id).toBe('midnight-lanterns');

    const mutedAfterToggle = soundscape.toggleMute('clear');
    expect(mutedAfterToggle).toBe(true);
    expect(listener).toHaveBeenCalled();

    unsub();
  });

  it('synthesizes all UI SFX kinds when unmuted and no-ops when muted', () => {
    const { mockCtx, createdOscillators } = createMockAudioContext();
    vi.stubGlobal('AudioContext', function () {
      return mockCtx;
    });

    const kinds: UiSfxKind[] = [
      'tap',
      'open',
      'close',
      'select',
      'camera',
      'zoomIn',
      'zoomOut',
      'success',
      'flag',
      'fireworks',
    ];

    // Ensure muted initially: playUiSfx should be a safe no-op
    if (!soundscape.getMuted()) {
      soundscape.toggleMute('clear');
    }
    expect(() => soundscape.playUiSfx('tap')).not.toThrow();

    // Synthesize every UI SFX kind against a fresh AudioContext
    const dest = mockCtx.createGain();
    for (const kind of kinds) {
      const prev = createdOscillators.length;
      synthesizeUiSfx(mockCtx, dest, kind);
      expect(createdOscillators.length).toBeGreaterThan(prev);
    }
  });
});
