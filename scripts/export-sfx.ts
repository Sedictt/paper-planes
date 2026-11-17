// Offline procedural audio renderer for Paper Planes UI SFX.
// Renders all UI SFX kinds into 44.1 kHz 16-bit stereo WAV files in exports/sfx/.
// Usage: node --experimental-strip-types scripts/export-sfx.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { UiSfxKind } from '../src/lib/uiSfx.ts';

const SAMPLE_RATE = 44100;

function onePoleCoeff(cutoffHz: number): number {
  const clamped = Math.max(40, Math.min(SAMPLE_RATE * 0.45, cutoffHz));
  return Math.exp((-2 * Math.PI * clamped) / SAMPLE_RATE);
}

function triangleWave(phase: number): number {
  const p = phase - Math.floor(phase);
  return 1 - 4 * Math.abs(p - 0.5);
}

interface ToneSpec {
  freqStart: number;
  freqEnd: number;
  dur: number;
  peak: number;
  type?: 'sine' | 'triangle';
  delay?: number;
  cutoffHz?: number;
}

const SFX_SPECS: Record<UiSfxKind, ToneSpec[]> = {
  tap: [{ freqStart: 540, freqEnd: 260, dur: 0.045, peak: 0.14, type: 'triangle', cutoffHz: 1800 }],
  open: [
    { freqStart: 440, freqEnd: 440, dur: 0.11, peak: 0.09, type: 'sine', delay: 0, cutoffHz: 2400 },
    { freqStart: 659.25, freqEnd: 659.25, dur: 0.15, peak: 0.1, type: 'sine', delay: 0.038, cutoffHz: 2800 },
  ],
  close: [{ freqStart: 520, freqEnd: 330, dur: 0.095, peak: 0.1, type: 'sine', cutoffHz: 1900 }],
  select: [
    { freqStart: 523.25, freqEnd: 523.25, dur: 0.13, peak: 0.12, type: 'triangle', cutoffHz: 2200 },
    { freqStart: 1046.5, freqEnd: 1046.5, dur: 0.07, peak: 0.04, type: 'sine', cutoffHz: 3200 },
  ],
  camera: [
    { freqStart: 392, freqEnd: 392, dur: 0.14, peak: 0.08, type: 'sine', delay: 0, cutoffHz: 2200 },
    { freqStart: 587.33, freqEnd: 587.33, dur: 0.19, peak: 0.09, type: 'sine', delay: 0.055, cutoffHz: 2600 },
  ],
  zoomIn: [{ freqStart: 420, freqEnd: 520, dur: 0.045, peak: 0.07, type: 'sine', cutoffHz: 1800 }],
  zoomOut: [{ freqStart: 480, freqEnd: 360, dur: 0.045, peak: 0.07, type: 'sine', cutoffHz: 1600 }],
  success: [
    { freqStart: 523.25, freqEnd: 523.25, dur: 0.18, peak: 0.09, type: 'sine', delay: 0, cutoffHz: 2800 },
    { freqStart: 659.25, freqEnd: 659.25, dur: 0.18, peak: 0.09, type: 'sine', delay: 0.045, cutoffHz: 3000 },
    { freqStart: 783.99, freqEnd: 783.99, dur: 0.22, peak: 0.09, type: 'sine', delay: 0.09, cutoffHz: 3200 },
    { freqStart: 1174.66, freqEnd: 1174.66, dur: 0.28, peak: 0.07, type: 'sine', delay: 0.135, cutoffHz: 3400 },
  ],
  flag: [{ freqStart: 210, freqEnd: 115, dur: 0.11, peak: 0.14, type: 'triangle', cutoffHz: 900 }],
  fireworks: [
    { freqStart: 420, freqEnd: 1280, dur: 0.22, peak: 0.08, type: 'sine', delay: 0, cutoffHz: 3200 },
    { freqStart: 1318.5, freqEnd: 1174.6, dur: 0.16, peak: 0.06, type: 'sine', delay: 0.24, cutoffHz: 3800 },
    { freqStart: 1567.98, freqEnd: 1396.9, dur: 0.18, peak: 0.05, type: 'sine', delay: 0.29, cutoffHz: 4000 },
    { freqStart: 1975.5, freqEnd: 1760, dur: 0.2, peak: 0.04, type: 'sine', delay: 0.34, cutoffHz: 4200 },
  ],
};

function renderSfx(tones: ToneSpec[]): { left: Float32Array; right: Float32Array; durationSec: number } {
  const maxEndSec = Math.max(...tones.map((t) => (t.delay ?? 0) + t.dur)) + 0.04;
  const totalSamples = Math.ceil(maxEndSec * SAMPLE_RATE);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  for (const tone of tones) {
    const startSample = Math.floor((tone.delay ?? 0) * SAMPLE_RATE);
    const durSamples = Math.floor(tone.dur * SAMPLE_RATE);
    const attackSamples = Math.max(1, Math.floor(0.008 * SAMPLE_RATE));
    const a = onePoleCoeff(tone.cutoffHz ?? 2800);

    let phase = 0;
    let lp = 0;

    for (let i = 0; i < durSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;

      const progress = i / Math.max(1, durSamples);
      const freq =
        tone.freqEnd === tone.freqStart
          ? tone.freqStart
          : tone.freqStart * Math.pow(tone.freqEnd / tone.freqStart, progress);
      phase += freq / SAMPLE_RATE;

      const raw =
        tone.type === 'triangle' ? triangleWave(phase) : Math.sin(2 * Math.PI * phase);
      lp = (1 - a) * raw + a * lp;

      const env =
        i < attackSamples
          ? i / attackSamples
          : Math.exp(-((i - attackSamples) / Math.max(1, durSamples - attackSamples)) * 5.2);

      // Scale up slightly from in-app headroom so standalone WAVs have crisp, clear level
      const sample = lp * env * tone.peak * 2.2;
      left[idx] += sample;
      right[idx] += sample;
    }
  }

  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh(left[i]);
    right[i] = Math.tanh(right[i]);
  }

  return { left, right, durationSec: totalSamples / SAMPLE_RATE };
}

function encodeWav(left: Float32Array, right: Float32Array): Buffer {
  const numSamples = left.length;
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.allocUnsafe(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset);
    buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }
  return buffer;
}

function main() {
  const outDir = resolve(process.cwd(), 'exports', 'sfx');
  mkdirSync(outDir, { recursive: true });

  const entries = Object.entries(SFX_SPECS) as Array<[UiSfxKind, ToneSpec[]]>;
  console.log(`Exporting ${entries.length} UI SFX to ${outDir}...`);

  for (const [kind, specs] of entries) {
    const { left, right, durationSec } = renderSfx(specs);
    const outPath = join(outDir, `${kind}.wav`);
    writeFileSync(outPath, encodeWav(left, right));
    console.log(`  ✓ ${kind}.wav (${Math.round(durationSec * 1000)}ms)`);
  }

  console.log('Done!');
}

main();
