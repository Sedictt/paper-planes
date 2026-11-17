import type { TimeOfDay } from '../types';

const TILE_W = 78;
const TILE_H = 39;

export type AmbientZoneId = 'shrine' | 'cottage' | 'campfire' | 'garden' | 'waterfall';

export interface AmbientZoneSpec {
  id: AmbientZoneId;
  gx: number;
  gy: number;
  elev: number;
  worldX: number;
  worldY: number;
  radius: number;
}

function gridToWorld(gx: number, gy: number, elev: number): { worldX: number; worldY: number } {
  return {
    worldX: (gx - gy) * (TILE_W / 2),
    worldY: (gx + gy) * (TILE_H / 2) - elev,
  };
}

export const AMBIENT_ZONES: readonly AmbientZoneSpec[] = [
  { id: 'shrine', gx: 5.5, gy: 5.0, elev: 25, radius: 180, ...gridToWorld(5.5, 5.0, 25) },
  { id: 'cottage', gx: 2.5, gy: 2.8, elev: 52, radius: 170, ...gridToWorld(2.5, 2.8, 52) },
  { id: 'campfire', gx: 2.5, gy: 6.8, elev: 34, radius: 170, ...gridToWorld(2.5, 6.8, 34) },
  { id: 'garden', gx: 7.8, gy: 6.2, elev: 25, radius: 175, ...gridToWorld(7.8, 6.2, 25) },
  { id: 'waterfall', gx: 4.8, gy: 9.2, elev: 14, radius: 205, ...gridToWorld(4.8, 9.2, 14) },
];

export interface ZoneMix {
  id: AmbientZoneId;
  weight: number;
  pan: number;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * Compute normalized spatial weights and stereo pan offsets for each island landmark
 * from the camera's current 2D world focal point and zoom level.
 */
export function computeLocationMix(
  viewX: number,
  viewY: number,
  zoom: number
): Record<AmbientZoneId, ZoneMix> {
  // When zoomed out in overview, keep local sounds subtle; when zoomed in, bring them forward.
  const zoomPresence = 0.35 + clamp01((zoom - 0.75) / 1.25) * 0.65;

  const result = {} as Record<AmbientZoneId, ZoneMix>;
  for (const zone of AMBIENT_ZONES) {
    const dist = Math.hypot(viewX - zone.worldX, viewY - zone.worldY);
    const falloff = smoothstep01(1 - dist / zone.radius);
    const weight = falloff * zoomPresence;
    const pan = Math.max(-0.75, Math.min(0.75, (zone.worldX - viewX) / 220));
    result[zone.id] = { id: zone.id, weight, pan };
  }
  return result;
}

function isNightOrDusk(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === 'dusk' || timeOfDay === 'evening' || timeOfDay === 'midnight';
}

interface ZoneAudioBus {
  gain: GainNode;
  panner: StereoPannerNode | null;
}

export class LocationAmbiencePlayer {
  private ctx: AudioContext;
  private destination: AudioNode;
  private noiseBuffer: AudioBuffer;

  private isRunning = false;
  private buses: Record<AmbientZoneId, ZoneAudioBus>;
  private waterfallSprayGain: GainNode;
  private schedulerId: ReturnType<typeof setInterval> | null = null;

  private mix: Record<AmbientZoneId, ZoneMix>;
  private timeOfDay: TimeOfDay = 'afternoon';

  private lastViewX = Number.NaN;
  private lastViewY = Number.NaN;
  private lastZoom = Number.NaN;

  private nextCrackleAt = 0;
  private nextChimeAt = 0;
  private nextBirdAt = 0;
  private nextCricketAt = 0;
  private nextDistantFrogAt = 0;

  constructor(ctx: AudioContext, destination: AudioNode, noiseBuffer: AudioBuffer) {
    this.ctx = ctx;
    this.destination = destination;
    this.noiseBuffer = noiseBuffer;
    this.mix = computeLocationMix(0, 175, 1.05);

    this.buses = {
      shrine: this.createBus(),
      cottage: this.createBus(),
      campfire: this.createBus(),
      garden: this.createBus(),
      waterfall: this.createBus(),
    };

    // 1. Waterfall: deep cascade + sparkling spray with gentle LFO surge
    const wfLowSrc = this.ctx.createBufferSource();
    wfLowSrc.buffer = this.noiseBuffer;
    wfLowSrc.loop = true;
    const wfLowFilter = this.ctx.createBiquadFilter();
    wfLowFilter.type = 'lowpass';
    wfLowFilter.frequency.value = 420;
    const wfLowGain = this.ctx.createGain();
    wfLowGain.gain.value = 0.72;
    wfLowSrc.connect(wfLowFilter);
    wfLowFilter.connect(wfLowGain);
    wfLowGain.connect(this.getBusInput(this.buses.waterfall));
    wfLowSrc.start();

    const wfSpraySrc = this.ctx.createBufferSource();
    wfSpraySrc.buffer = this.noiseBuffer;
    wfSpraySrc.loop = true;
    const wfSprayFilter = this.ctx.createBiquadFilter();
    wfSprayFilter.type = 'bandpass';
    wfSprayFilter.frequency.value = 1750;
    wfSprayFilter.Q.value = 0.75;
    this.waterfallSprayGain = this.ctx.createGain();
    this.waterfallSprayGain.gain.value = 0.34;
    wfSpraySrc.connect(wfSprayFilter);
    wfSprayFilter.connect(this.waterfallSprayGain);
    this.waterfallSprayGain.connect(this.getBusInput(this.buses.waterfall));
    wfSpraySrc.start();

    // 2. Campfire: warm low-end fire rumble
    const fireSrc = this.ctx.createBufferSource();
    fireSrc.buffer = this.noiseBuffer;
    fireSrc.loop = true;
    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 210;
    const fireGain = this.ctx.createGain();
    fireGain.gain.value = 0.42;
    fireSrc.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(this.getBusInput(this.buses.campfire));
    fireSrc.start();

    // 3. Shrine: soft airy leaf/eaves resonance
    const shrineSrc = this.ctx.createBufferSource();
    shrineSrc.buffer = this.noiseBuffer;
    shrineSrc.loop = true;
    const shrineFilter = this.ctx.createBiquadFilter();
    shrineFilter.type = 'bandpass';
    shrineFilter.frequency.value = 680;
    shrineFilter.Q.value = 1.4;
    const shrineGain = this.ctx.createGain();
    shrineGain.gain.value = 0.14;
    shrineSrc.connect(shrineFilter);
    shrineFilter.connect(shrineGain);
    shrineGain.connect(this.getBusInput(this.buses.shrine));
    shrineSrc.start();

    // 4. Cottage: warm sheltered eaves hum
    const cottageSrc = this.ctx.createBufferSource();
    cottageSrc.buffer = this.noiseBuffer;
    cottageSrc.loop = true;
    const cottageFilter = this.ctx.createBiquadFilter();
    cottageFilter.type = 'lowpass';
    cottageFilter.frequency.value = 260;
    const cottageGain = this.ctx.createGain();
    cottageGain.gain.value = 0.18;
    cottageSrc.connect(cottageFilter);
    cottageFilter.connect(cottageGain);
    cottageGain.connect(this.getBusInput(this.buses.cottage));
    cottageSrc.start();

    // 5. Garden: gentle foliage & pond-side rustle
    const gardenSrc = this.ctx.createBufferSource();
    gardenSrc.buffer = this.noiseBuffer;
    gardenSrc.loop = true;
    const gardenFilter = this.ctx.createBiquadFilter();
    gardenFilter.type = 'bandpass';
    gardenFilter.frequency.value = 1250;
    gardenFilter.Q.value = 1.1;
    const gardenGain = this.ctx.createGain();
    gardenGain.gain.value = 0.15;
    gardenSrc.connect(gardenFilter);
    gardenFilter.connect(gardenGain);
    gardenGain.connect(this.getBusInput(this.buses.garden));
    gardenSrc.start();
  }

  private createBus(): ZoneAudioBus {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const panner =
      typeof this.ctx.createStereoPanner === 'function' ? this.ctx.createStereoPanner() : null;
    if (panner) {
      panner.connect(gain);
    }
    gain.connect(this.destination);
    return { gain, panner };
  }

  private getBusInput(bus: ZoneAudioBus): AudioNode {
    return bus.panner ?? bus.gain;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    const now = this.ctx.currentTime;
    this.nextCrackleAt = now + 0.15;
    this.nextChimeAt = now + 1.1;
    this.nextBirdAt = now + 1.4;
    this.nextCricketAt = now + 0.4;
    this.nextDistantFrogAt = now + 2.5;

    this.applyMixToBuses();
    this.schedulerId = setInterval(() => this.tickEvents(), 160);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    const now = this.ctx.currentTime;
    for (const id of Object.keys(this.buses) as AmbientZoneId[]) {
      this.buses[id].gain.gain.setTargetAtTime(0, now, 0.15);
    }
  }

  public updateLocation(viewX: number, viewY: number, zoom: number, timeOfDay: TimeOfDay): void {
    const moved =
      Number.isNaN(this.lastViewX) ||
      Math.abs(viewX - this.lastViewX) > 2 ||
      Math.abs(viewY - this.lastViewY) > 2 ||
      Math.abs(zoom - this.lastZoom) > 0.02 ||
      timeOfDay !== this.timeOfDay;

    if (!moved) return;

    this.lastViewX = viewX;
    this.lastViewY = viewY;
    this.lastZoom = zoom;
    this.timeOfDay = timeOfDay;
    this.mix = computeLocationMix(viewX, viewY, zoom);

    if (this.isRunning) {
      this.applyMixToBuses();
    }
  }

  private applyMixToBuses(): void {
    const now = this.ctx.currentTime;
    const gains: Record<AmbientZoneId, number> = {
      waterfall: this.mix.waterfall.weight * 0.78,
      campfire: this.mix.campfire.weight * 0.65,
      shrine: this.mix.shrine.weight * 0.45,
      cottage: this.mix.cottage.weight * 0.4,
      garden: this.mix.garden.weight * 0.45,
    };

    for (const id of Object.keys(this.buses) as AmbientZoneId[]) {
      const bus = this.buses[id];
      bus.gain.gain.setTargetAtTime(gains[id], now, 0.18);
      if (bus.panner) {
        bus.panner.pan.setTargetAtTime(this.mix[id].pan, now, 0.18);
      }
    }
  }

  private tickEvents(): void {
    if (!this.isRunning || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Gentle waterfall spray surge
    if (this.mix.waterfall.weight > 0.1) {
      const surge = 0.28 + Math.sin(now * 0.75) * 0.06 + Math.sin(now * 1.9) * 0.03;
      this.waterfallSprayGain.gain.setTargetAtTime(surge, now, 0.25);
    }

    // Campfire wood crackles
    if (this.mix.campfire.weight > 0.15 && now >= this.nextCrackleAt) {
      this.spawnCampfireCrackle(now, this.mix.campfire.weight);
      this.nextCrackleAt = now + 0.09 + Math.random() * 0.34;
    }

    // Lantern Shrine wind chimes
    if (this.mix.shrine.weight > 0.22 && now >= this.nextChimeAt) {
      this.spawnShrineChime(now, this.mix.shrine.weight);
      this.nextChimeAt = now + 2.4 + Math.random() * 3.4;
    }

    // Cottage daytime songbirds
    if (this.mix.cottage.weight > 0.22 && !isNightOrDusk(this.timeOfDay) && now >= this.nextBirdAt) {
      this.spawnBirdChirp(now, this.mix.cottage.weight);
      this.nextBirdAt = now + 2.6 + Math.random() * 4.2;
    }

    // Garden crickets (stronger at dusk/evening/midnight, subtle during day)
    if (this.mix.garden.weight > 0.18 && now >= this.nextCricketAt) {
      const nightBoost = isNightOrDusk(this.timeOfDay) ? 1.0 : 0.32;
      this.spawnCricketPulse(now, this.mix.garden.weight * nightBoost);
      this.nextCricketAt = now + (isNightOrDusk(this.timeOfDay) ? 0.8 + Math.random() * 1.1 : 1.8 + Math.random() * 2.4);
    }

    // Distant soft pond frog near Garden
    if (this.mix.garden.weight > 0.35 && now >= this.nextDistantFrogAt) {
      this.spawnDistantFrog(now, this.mix.garden.weight);
      this.nextDistantFrogAt = now + 5.5 + Math.random() * 6.5;
    }
  }

  private spawnCampfireCrackle(t0: number, weight: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = false;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 2600;
    filter.Q.value = 2.8;

    const env = this.ctx.createGain();
    const peak = (0.09 + Math.random() * 0.16) * weight;
    const dur = 0.018 + Math.random() * 0.028;
    env.gain.setValueAtTime(0.001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.getBusInput(this.buses.campfire));

    const offset = Math.random() * Math.max(0.1, this.noiseBuffer.duration - 0.1);
    src.start(t0, offset, dur + 0.01);
  }

  private spawnShrineChime(t0: number, weight: number): void {
    const notes = [587.33, 659.25, 783.99, 880.0, 987.77, 1174.66]; // D5 pentatonic
    const freq = notes[Math.floor(Math.random() * notes.length)];

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);

    const overtone = this.ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2.01, t0);

    const env = this.ctx.createGain();
    const peak = 0.055 * weight;
    env.gain.setValueAtTime(0.0005, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0004, t0 + 1.85);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.18;

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(this.getBusInput(this.buses.shrine));

    osc.start(t0);
    overtone.start(t0);
    osc.stop(t0 + 1.9);
    overtone.stop(t0 + 1.9);
  }

  private spawnBirdChirp(t0: number, weight: number): void {
    const chirps = Math.random() < 0.55 ? 2 : 1;
    const baseFreq = 2100 + Math.random() * 900;

    for (let i = 0; i < chirps; i++) {
      const start = t0 + i * 0.13;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.25 + Math.random() * 0.25), start + 0.055);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, start + 0.095);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0005, start);
      env.gain.linearRampToValueAtTime(0.045 * weight, start + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0005, start + 0.1);

      osc.connect(env);
      env.connect(this.getBusInput(this.buses.cottage));
      osc.start(start);
      osc.stop(start + 0.11);
    }
  }

  private spawnCricketPulse(t0: number, weight: number): void {
    const pulses = 3;
    const freq = 4150 + Math.random() * 350;
    for (let i = 0; i < pulses; i++) {
      const start = t0 + i * 0.055;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0005, start);
      env.gain.linearRampToValueAtTime(0.022 * weight, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0005, start + 0.036);

      osc.connect(env);
      env.connect(this.getBusInput(this.buses.garden));
      osc.start(start);
      osc.stop(start + 0.04);
    }
  }

  private spawnDistantFrog(t0: number, weight: number): void {
    const pitch = 92 + Math.random() * 20;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.28, t0 + 0.09);

    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(420, t0);
    formant.frequency.exponentialRampToValueAtTime(760, t0 + 0.09);
    formant.Q.value = 3.5;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0005, t0);
    env.gain.linearRampToValueAtTime(0.032 * weight, t0 + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.11);

    osc.connect(formant);
    formant.connect(env);
    env.connect(this.getBusInput(this.buses.garden));
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }
}
