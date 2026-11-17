// Web Audio Procedural Soundscape (Wind, Rain, Background Music & Paper Fold SFX)
// Zero external MP3 dependencies — works reliably across desktop & mobile browsers.

import { LocationAmbiencePlayer } from './locationAmbience';
import {
  MUSIC_TRACKS,
  ProceduralMusicPlayer,
  type MusicTrackId,
  type MusicTrackInfo,
} from './musicSynth';
import { synthesizeUiSfx, type UiSfxKind } from './uiSfx';
import type { TimeOfDay } from '../types';

export { MUSIC_TRACKS, type MusicTrackId, type MusicTrackInfo, type UiSfxKind };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

class AmbientSoundscape {
  private ctx: AudioContext | null = null;
  private isMuted = true;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  private musicPlayer: ProceduralMusicPlayer | null = null;
  private locationAmbience: LocationAmbiencePlayer | null = null;
  private lastLocation: { viewX: number; viewY: number; zoom: number; timeOfDay: TimeOfDay } = {
    viewX: 0,
    viewY: 175,
    zoom: 1.05,
    timeOfDay: 'afternoon',
  };
  private selectedTrackId: MusicTrackId = 'paper-boats';
  private autoCycle = true;
  private musicVolume = 0.65;
  private ambienceVolume = 0.55;
  private indoorMuffled = false;
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public toggleMute(weather: 'clear' | 'rain' | 'snow'): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.initContext();
      this.updateWeatherMix(weather);
      this.locationAmbience?.updateLocation(
        this.lastLocation.viewX,
        this.lastLocation.viewY,
        this.lastLocation.zoom,
        this.lastLocation.timeOfDay
      );
      this.locationAmbience?.start();
      this.musicPlayer?.start(this.selectedTrackId);
      this.playUiSfx('tap');
    } else {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      }
      this.locationAmbience?.stop();
      this.musicPlayer?.stop();
    }
    this.notify();
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getTracks(): readonly MusicTrackInfo[] {
    return MUSIC_TRACKS;
  }

  public getCurrentTrack(): MusicTrackInfo {
    if (this.musicPlayer) {
      return this.musicPlayer.getCurrentTrack();
    }
    return MUSIC_TRACKS.find((t) => t.id === this.selectedTrackId) ?? MUSIC_TRACKS[0];
  }

  public selectTrack(trackId: MusicTrackId, weather: 'clear' | 'rain' | 'snow' = 'clear') {
    this.selectedTrackId = trackId;
    if (this.isMuted) {
      this.isMuted = false;
      this.initContext();
      this.updateWeatherMix(weather);
      this.locationAmbience?.updateLocation(
        this.lastLocation.viewX,
        this.lastLocation.viewY,
        this.lastLocation.zoom,
        this.lastLocation.timeOfDay
      );
      this.locationAmbience?.start();
      this.musicPlayer?.start(trackId);
    } else {
      this.initContext();
      this.musicPlayer?.setTrack(trackId);
    }
    this.notify();
  }

  public nextTrack(weather: 'clear' | 'rain' | 'snow' = 'clear'): MusicTrackInfo {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.selectedTrackId);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    this.selectTrack(next.id, weather);
    return next;
  }

  public getAutoCycle(): boolean {
    return this.autoCycle;
  }

  public setAutoCycle(enabled: boolean) {
    this.autoCycle = enabled;
    this.musicPlayer?.setAutoCycle(enabled);
    this.notify();
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(volume: number) {
    this.musicVolume = clamp01(volume);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.08);
    }
    this.notify();
  }

  public getAmbienceVolume(): number {
    return this.ambienceVolume;
  }

  public setAmbienceVolume(volume: number) {
    this.ambienceVolume = clamp01(volume);
    if (this.ambienceGain && this.ctx) {
      const target = this.ambienceVolume * (this.indoorMuffled ? 0.28 : 1);
      this.ambienceGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    this.notify();
  }

  public setIndoorMuffled(muffled: boolean) {
    this.indoorMuffled = muffled;
    if (this.ambienceGain && this.ctx) {
      const target = this.ambienceVolume * (muffled ? 0.28 : 1);
      this.ambienceGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.28);
    }
  }

  private initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.42, this.ctx.currentTime, 0.4);
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.42;
    this.masterGain.connect(this.ctx.destination);

    this.ambienceGain = this.ctx.createGain();
    this.ambienceGain.gain.value = this.ambienceVolume;
    this.ambienceGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.75;
    this.sfxGain.connect(this.masterGain);

    this.musicPlayer = new ProceduralMusicPlayer(this.ctx, this.musicGain, (track) => {
      this.selectedTrackId = track.id;
      this.notify();
    });
    this.musicPlayer.setAutoCycle(this.autoCycle);

    // Pink-ish noise buffer for soft rooftop breeze & gentle rain
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // Wind Loop (Lowpass filtered breeze)
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.55;

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ambienceGain);
    windSource.start();

    // Rain Loop (Bandpass filtered patter)
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1100;
    rainFilter.Q.value = 0.7;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;

    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.ambienceGain);
    rainSource.start();

    this.locationAmbience = new LocationAmbiencePlayer(this.ctx, this.ambienceGain, noiseBuffer);
    this.locationAmbience.updateLocation(
      this.lastLocation.viewX,
      this.lastLocation.viewY,
      this.lastLocation.zoom,
      this.lastLocation.timeOfDay
    );
  }

  public updateCameraLocation(
    viewX: number,
    viewY: number,
    zoom: number,
    timeOfDay: TimeOfDay
  ): void {
    this.lastLocation = { viewX, viewY, zoom, timeOfDay };
    this.locationAmbience?.updateLocation(viewX, viewY, zoom, timeOfDay);
  }

  public updateWeatherMix(weather: 'clear' | 'rain' | 'snow') {
    if (!this.ctx || this.isMuted || !this.rainGain || !this.windGain) return;
    const now = this.ctx.currentTime;
    if (weather === 'rain') {
      this.rainGain.gain.setTargetAtTime(0.65, now, 0.5);
      this.windGain.gain.setTargetAtTime(0.35, now, 0.5);
    } else if (weather === 'snow') {
      this.rainGain.gain.setTargetAtTime(0.0, now, 0.5);
      this.windGain.gain.setTargetAtTime(0.75, now, 0.5);
    } else {
      this.rainGain.gain.setTargetAtTime(0.0, now, 0.5);
      this.windGain.gain.setTargetAtTime(0.45, now, 0.5);
    }
  }

  // Tactile UI micro-interactions (buttons, popovers, modals, camera, success)
  public playUiSfx(kind: UiSfxKind) {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    synthesizeUiSfx(this.ctx, this.sfxGain, kind);
  }

  // Tactile Paper Rustle / Unfold / Launch sound
  public playPaperWhoosh(type: 'unfold' | 'launch') {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    if (type === 'unfold') {
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.14);
    } else {
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.22);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Realistic pulsed vocal-sac frog "rib-bit!" SFX (works on direct user click)
  public playFrogRibbit() {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;

    const croakBurst = (
      startOffset: number,
      dur: number,
      pitchStart: number,
      pitchEnd: number,
      formantStart: number,
      formantEnd: number,
      trillHz: number,
      peak: number
    ) => {
      if (!this.ctx) return;
      const t0 = now + startOffset;

      // Low sawtooth glottal source
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitchStart, t0);
      osc.frequency.exponentialRampToValueAtTime(pitchEnd, t0 + dur);

      // Throat-rattle AM trill LFO
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(trillHz, t0);
      const lfoDepth = this.ctx.createGain();
      lfoDepth.gain.value = 0.45;

      const trillGain = this.ctx.createGain();
      trillGain.gain.setValueAtTime(0.55, t0);
      lfo.connect(lfoDepth);
      lfoDepth.connect(trillGain.gain);

      // Resonant vocal-sac formant bandpass sweep
      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.Q.value = 4.5;
      formant.frequency.setValueAtTime(formantStart, t0);
      formant.frequency.exponentialRampToValueAtTime(formantEnd, t0 + dur);

      // Envelope
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.015);
      env.gain.setValueAtTime(peak, t0 + dur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(trillGain);
      trillGain.connect(formant);
      formant.connect(env);
      env.connect(this.ctx.destination);

      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + dur + 0.015);
      lfo.stop(t0 + dur + 0.015);
    };

    // Subtle per-click pitch & timing jitter so no two croaks sound identical
    const jitter = 0.9 + Math.random() * 0.22;
    const variant = Math.floor(Math.random() * 4);

    if (variant === 0) {
      // Classic two-syllable "rib-bit!"
      croakBurst(0.0, 0.085, 78 * jitter, 96 * jitter, 380 * jitter, 820 * jitter, 38, 0.42);
      croakBurst(0.13, 0.125, 88 * jitter, 128 * jitter, 440 * jitter, 1180 * jitter, 44, 0.48);
    } else if (variant === 1) {
      // Playful triple "rib-bit-bit!"
      croakBurst(0.0, 0.065, 82 * jitter, 102 * jitter, 400 * jitter, 860 * jitter, 40, 0.36);
      croakBurst(0.1, 0.075, 95 * jitter, 122 * jitter, 480 * jitter, 1080 * jitter, 46, 0.42);
      croakBurst(0.21, 0.095, 104 * jitter, 136 * jitter, 520 * jitter, 1240 * jitter, 48, 0.45);
    } else if (variant === 2) {
      // Deep single bullfrog "croaaak"
      croakBurst(0.0, 0.19, 64 * jitter, 76 * jitter, 300 * jitter, 640 * jitter, 30, 0.46);
    } else {
      // Peppy high tree-frog "peep-peep!"
      croakBurst(0.0, 0.07, 112 * jitter, 145 * jitter, 580 * jitter, 1260 * jitter, 52, 0.38);
      croakBurst(0.11, 0.085, 122 * jitter, 158 * jitter, 640 * jitter, 1380 * jitter, 54, 0.42);
    }
  }

  /** Subtle rising wind-chime cue when advancing the 4-step lore sequence */
  public playLoreChime(step: number) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 587.33, 659.25, 783.99]; // C5, D5, E5, G5
    const baseFreq = freqs[Math.max(0, Math.min(freqs.length - 1, step - 1))];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.005, now + 0.65);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.75);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.78);
  }

  /** Warm harmonic swell when unlocking Letter #0 & the Cathexis Lore Codex */
  public playLoreUnlock() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const chord = [392.0, 493.88, 587.33, 783.99]; // G4, B4, D5, G5

    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t0 = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.09, t0 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 1.95);
    });
  }
}

export const soundscape = new AmbientSoundscape();
