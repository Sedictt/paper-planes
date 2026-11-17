// Offline procedural audio renderer for Paper Planes background music.
// Renders all 5 tracks from src/lib/musicSynth.ts into stereo WAV and encodes MP3 via ffmpeg.
// Usage: node --experimental-strip-types scripts/export-music.ts [--wav]

import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  COMPOSITIONS,
  MUSIC_TRACKS,
  type InstrumentVoice,
  type TrackComposition,
} from '../src/lib/musicSynth.ts';

const SAMPLE_RATE = 44100;
const CYCLES_PER_TRACK = 2; // 2 full 4-chord cycles (32 bars)
const TAIL_SEC = 4.0;

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Deterministic PRNG so exported tracks are reproducible and musical
function createRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function onePoleCoeff(cutoffHz: number): number {
  const clamped = Math.max(40, Math.min(SAMPLE_RATE * 0.45, cutoffHz));
  return Math.exp((-2 * Math.PI * clamped) / SAMPLE_RATE);
}

// Band-limited-ish soft triangle wave
function triangleWave(phase: number): number {
  const p = phase - Math.floor(phase);
  return 1 - 4 * Math.abs(p - 0.5);
}

function addPadChord(
  left: Float32Array,
  right: Float32Array,
  chord: number[],
  startSec: number,
  durSec: number,
  cutoffHz: number,
  peakGain: number
) {
  const startSample = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const totalSamples = Math.floor((durSec + 0.9) * SAMPLE_RATE);
  const attackSamples = Math.floor(Math.min(1.4, durSec * 0.3) * SAMPLE_RATE);
  const sustainEndSample = Math.floor(durSec * 0.65 * SAMPLE_RATE);
  const perVoiceGain = peakGain / Math.max(1, chord.length);

  // Render chord voices summed into a mono buffer, then apply swept 1-pole lowpass
  let lpState = 0;
  const voices = chord.flatMap((midi) => {
    const baseFreq = midiToFreq(midi);
    return [
      { freq: baseFreq * Math.pow(2, -5 / 1200), isTri: false, phase: 0 },
      { freq: baseFreq * Math.pow(2, 5 / 1200), isTri: true, phase: 0.25 },
    ];
  });

  for (let i = 0; i < totalSamples; i++) {
    const idx = startSample + i;
    if (idx >= left.length) break;

    const progress = i / totalSamples;
    const sweepCutoff =
      progress < 0.45
        ? cutoffHz * (0.75 + (0.4 * progress) / 0.45)
        : cutoffHz * (1.15 - (0.45 * (progress - 0.45)) / 0.55);
    const a = onePoleCoeff(sweepCutoff);

    let sum = 0;
    for (const v of voices) {
      v.phase += v.freq / SAMPLE_RATE;
      sum += v.isTri ? triangleWave(v.phase) : Math.sin(2 * Math.PI * v.phase);
    }
    sum *= 0.5;

    lpState = (1 - a) * sum + a * lpState;

    let env = 1;
    if (i < attackSamples) {
      env = i / Math.max(1, attackSamples);
    } else if (i > sustainEndSample) {
      const relProgress = (i - sustainEndSample) / Math.max(1, totalSamples - sustainEndSample);
      env = Math.pow(1 - relProgress, 2.2);
    }

    const sample = lpState * env * perVoiceGain;
    left[idx] += sample;
    right[idx] += sample;
  }
}

function addVoiceNote(
  left: Float32Array,
  right: Float32Array,
  voice: InstrumentVoice,
  freq: number,
  startSec: number,
  durSec: number,
  peakGain: number
) {
  const startSample = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const totalSamples = Math.floor((durSec + 0.05) * SAMPLE_RATE);

  let phase1 = 0;
  let phase2 = 0;
  let lpState = 0;

  const attackSec =
    voice === 'feltPiano'
      ? 0.022
      : voice === 'rhodesBell'
        ? 0.014
        : voice === 'musicBox'
          ? 0.008
          : 0.012;
  const attackSamples = Math.max(1, Math.floor(attackSec * SAMPLE_RATE));

  const startCutoff =
    voice === 'feltPiano'
      ? Math.min(2600, freq * 3.8)
      : voice === 'rhodesBell'
        ? 2200
        : voice === 'musicBox'
          ? 3400
          : Math.min(3200, freq * 4.5);

  const endCutoff =
    voice === 'feltPiano'
      ? Math.max(260, freq * 1.3)
      : voice === 'rhodesBell'
        ? 550
        : voice === 'musicBox'
          ? 3400
          : Math.max(320, freq * 1.4);

  const effectivePeak = voice === 'musicBox' ? peakGain * 0.85 : peakGain;

  for (let i = 0; i < totalSamples; i++) {
    const idx = startSample + i;
    if (idx >= left.length) break;

    const t = i / SAMPLE_RATE;
    const progress = i / totalSamples;

    phase1 += freq / SAMPLE_RATE;
    const freq2 =
      voice === 'feltPiano'
        ? freq * 2
        : voice === 'rhodesBell'
          ? freq * 3
          : voice === 'musicBox'
            ? freq * 2.002
            : freq * 0.5;
    phase2 += freq2 / SAMPLE_RATE;

    const osc1 =
      voice === 'feltPiano' || voice === 'harpPluck'
        ? triangleWave(phase1)
        : Math.sin(2 * Math.PI * phase1);
    const osc2 = Math.sin(2 * Math.PI * phase2);

    let osc2Amp = 0.18;
    if (voice === 'rhodesBell') {
      osc2Amp = 0.22 * Math.exp(-t / 0.08);
    } else if (voice === 'musicBox') {
      osc2Amp = 0.3 * Math.exp(-t / Math.max(0.05, durSec * 0.18));
    } else if (voice === 'harpPluck') {
      osc2Amp = 0.2;
    }

    const raw = osc1 + osc2 * osc2Amp;
    const cutoff = startCutoff * Math.pow(endCutoff / startCutoff, Math.min(1, progress / 0.75));
    const a = onePoleCoeff(cutoff);
    lpState = (1 - a) * raw + a * lpState;

    let env = 1;
    if (i < attackSamples) {
      env = i / attackSamples;
    } else {
      const decayProgress = (i - attackSamples) / Math.max(1, totalSamples - attackSamples);
      env = Math.exp(-decayProgress * 4.6);
    }

    const sample = lpState * env * effectivePeak;
    left[idx] += sample;
    right[idx] += sample;
  }
}

function applyStereoReverb(left: Float32Array, right: Float32Array) {
  const taps = [
    { delaySec: 0.29, feedback: 0.36, pan: -0.55, cutoff: 1900 },
    { delaySec: 0.43, feedback: 0.34, pan: 0.55, cutoff: 1650 },
    { delaySec: 0.67, feedback: 0.28, pan: -0.25, cutoff: 1400 },
  ];

  const wetL = new Float32Array(left.length);
  const wetR = new Float32Array(right.length);

  for (const tap of taps) {
    const delaySamples = Math.floor(tap.delaySec * SAMPLE_RATE);
    const buf = new Float32Array(delaySamples);
    const a = onePoleCoeff(tap.cutoff);
    let lp = 0;
    let writePos = 0;

    // Constant-power pan
    const panAngle = ((tap.pan + 1) * Math.PI) / 4;
    const gainL = Math.cos(panAngle);
    const gainR = Math.sin(panAngle);

    for (let i = 0; i < left.length; i++) {
      const monoIn = (left[i] + right[i]) * 0.5 * 0.42;
      const delayed = buf[writePos];
      lp = (1 - a) * delayed + a * lp;
      buf[writePos] = monoIn + lp * tap.feedback;
      writePos = (writePos + 1) % delaySamples;

      wetL[i] += lp * gainL * 0.55;
      wetR[i] += lp * gainR * 0.55;
    }
  }

  // Mix dry + wet and apply gentle soft limiting + fade-in/out
  const fadeInSamples = Math.floor(0.25 * SAMPLE_RATE);
  const fadeOutSamples = Math.floor(2.5 * SAMPLE_RATE);

  for (let i = 0; i < left.length; i++) {
    let fade = 1;
    if (i < fadeInSamples) {
      fade = i / fadeInSamples;
    } else if (i > left.length - fadeOutSamples) {
      fade = (left.length - i) / fadeOutSamples;
    }

    const l = Math.tanh((left[i] + wetL[i]) * 0.85) * fade;
    const r = Math.tanh((right[i] + wetR[i]) * 0.85) * fade;
    left[i] = l;
    right[i] = r;
  }
}

function renderComposition(comp: TrackComposition, seed: number) {
  const rng = createRng(seed);
  const eighthSec = 60 / comp.info.bpm / 2;
  const totalSteps = comp.chords.length * CYCLES_PER_TRACK * 16;
  const musicDurSec = totalSteps * eighthSec;
  const totalSamples = Math.floor((musicDurSec + TAIL_SEC) * SAMPLE_RATE);

  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  let chordIndex = 0;
  let scaleCursor = Math.floor(comp.scale.length / 2);
  let activeMotif = comp.motifs[0];
  let motifPos = 0;

  for (let step = 0; step < totalSteps; step++) {
    const time = step * eighthSec + 0.1;
    const stepInChord = step % 16;

    if (stepInChord === 0) {
      const chord = comp.chords[chordIndex % comp.chords.length];
      const chordDur = eighthSec * 16;
      addPadChord(left, right, chord, time, chordDur, comp.padWarmthHz, comp.padGain);

      if (comp.arpeggiateChords) {
        chord.forEach((midi, idx) => {
          const offset = idx * (eighthSec * 0.85);
          addVoiceNote(
            left,
            right,
            comp.voice,
            midiToFreq(midi),
            time + offset,
            eighthSec * 5.5,
            comp.melodyGain * (idx === 0 ? 0.75 : 0.52)
          );
        });
      } else {
        addVoiceNote(
          left,
          right,
          comp.voice,
          midiToFreq(chord[0]),
          time,
          eighthSec * 10,
          comp.melodyGain * 0.65
        );
        chord.slice(1, 3).forEach((midi, idx) => {
          addVoiceNote(
            left,
            right,
            comp.voice,
            midiToFreq(midi),
            time + 0.04 * (idx + 1),
            eighthSec * 8,
            comp.melodyGain * 0.42
          );
        });
      }

      chordIndex++;
      if (chordIndex % 2 === 0) {
        activeMotif = comp.motifs[Math.floor(rng() * comp.motifs.length)];
        motifPos = 0;
      }
    }

    const isMelodicBeat =
      stepInChord === 2 ||
      stepInChord === 4 ||
      stepInChord === 6 ||
      stepInChord === 9 ||
      stepInChord === 11 ||
      stepInChord === 14;

    if (isMelodicBeat && rng() < comp.melodyDensity) {
      const stepDelta = activeMotif[motifPos % activeMotif.length];
      motifPos++;

      scaleCursor = Math.max(0, Math.min(comp.scale.length - 1, scaleCursor + stepDelta));
      const midi = comp.scale[scaleCursor];
      const humanize = (rng() - 0.5) * 0.024;
      const vel = comp.melodyGain * (0.72 + rng() * 0.32);
      const noteDur = eighthSec * (2.6 + rng() * 2.2);

      addVoiceNote(left, right, comp.voice, midiToFreq(midi), time + humanize, noteDur, vel);

      if ((comp.voice === 'musicBox' || comp.voice === 'feltPiano') && rng() < 0.16) {
        addVoiceNote(
          left,
          right,
          comp.voice,
          midiToFreq(midi + 12),
          time + humanize + eighthSec * 0.5,
          noteDur * 0.7,
          vel * 0.35
        );
      }
    }
  }

  applyStereoReverb(left, right);
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
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
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
  const keepWav = process.argv.includes('--wav');
  const outDir = resolve(process.cwd(), 'exports', 'music');
  mkdirSync(outDir, { recursive: true });

  console.log(`Exporting ${MUSIC_TRACKS.length} procedural tracks to ${outDir}...`);

  MUSIC_TRACKS.forEach((track, idx) => {
    const comp = COMPOSITIONS[track.id];
    const { left, right, durationSec } = renderComposition(comp, 1337 + idx * 97);
    const wavPath = join(outDir, `${track.id}.wav`);
    const mp3Path = join(outDir, `${track.id}.mp3`);

    writeFileSync(wavPath, encodeWav(left, right));

    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        wavPath,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '192k',
        '-metadata',
        `title=${track.title}`,
        '-metadata',
        'artist=Paper Planes Procedural Synth',
        '-metadata',
        `comment=${track.mood}`,
        mp3Path,
      ],
      { stdio: 'ignore' }
    );

    if (!keepWav) {
      unlinkSync(wavPath);
    }

    console.log(
      `  ✓ ${track.title} (${track.mood}) — ${durationSec.toFixed(1)}s -> ${track.id}.mp3${keepWav ? ` + ${track.id}.wav` : ''}`
    );
  });

  console.log('Done!');
}

main();
