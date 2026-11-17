// Procedural Web Audio Background Music Synthesizer
// Zero external audio files — synthesizes serene, nostalgic, and melancholic
// ambient soundtracks in real time using lookahead scheduling & stereo delay/reverb.

export type MusicTrackId =
  | 'paper-boats'
  | 'rain-rooftop'
  | 'midnight-lanterns'
  | 'golden-drift'
  | 'snowfall-solitude';

export interface MusicTrackInfo {
  id: MusicTrackId;
  title: string;
  mood: string;
  description: string;
  bpm: number;
}

export const MUSIC_TRACKS: readonly MusicTrackInfo[] = [
  {
    id: 'paper-boats',
    title: 'Paper Boats',
    mood: 'Serene & Nostalgic',
    description: 'Warm felt piano and gentle breeze pads in F major.',
    bpm: 64,
  },
  {
    id: 'rain-rooftop',
    title: 'Rain on the Rooftop',
    mood: 'Melancholic',
    description: 'Wistful minor-key electric piano with slow, sighing motifs.',
    bpm: 56,
  },
  {
    id: 'midnight-lanterns',
    title: 'Midnight Lanterns',
    mood: 'Dreamy & Bittersweet',
    description: 'Crystalline music-box chimes drifting over deep night chords.',
    bpm: 60,
  },
  {
    id: 'golden-drift',
    title: 'Golden Hour Drift',
    mood: 'Warm & Peaceful',
    description: 'Sunlit plucked harp arpeggios and unhurried Rhodes harmonies.',
    bpm: 68,
  },
  {
    id: 'snowfall-solitude',
    title: 'Snowfall Solitude',
    mood: 'Sparse & Contemplative',
    description: 'Minimalist, spacious piano voicings with long quiet breaths.',
    bpm: 50,
  },
] as const;

export type InstrumentVoice = 'feltPiano' | 'rhodesBell' | 'musicBox' | 'harpPluck';

export interface TrackComposition {
  info: MusicTrackInfo;
  voice: InstrumentVoice;
  padWarmthHz: number;
  padGain: number;
  melodyGain: number;
  melodyDensity: number; // 0..1 probability of playing a melody note on a subdivision
  arpeggiateChords: boolean;
  // Each chord is an array of MIDI note numbers (bass + voicing)
  chords: number[][];
  // Scale MIDI notes for generative melody phrases
  scale: number[];
  // Preferred motif intervals (scale-degree steps) for cohesive phrasing
  motifs: number[][];
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const COMPOSITIONS: Record<MusicTrackId, TrackComposition> = {
  'paper-boats': {
    info: MUSIC_TRACKS[0],
    voice: 'feltPiano',
    padWarmthHz: 520,
    padGain: 0.14,
    melodyGain: 0.22,
    melodyDensity: 0.58,
    arpeggiateChords: true,
    // Fmaj7 -> Dm9 -> Bbmaj7 -> C6/9
    chords: [
      [53, 60, 64, 69], // Fmaj7
      [50, 57, 60, 64], // Dm9
      [46, 53, 57, 62], // Bbmaj7
      [48, 55, 57, 62], // C6/9
    ],
    // F major pentatonic + 7th for nostalgic warmth
    scale: [65, 67, 69, 72, 74, 76, 77, 79, 81, 84],
    motifs: [
      [0, 2, 3, 2],
      [4, 3, 1, 0],
      [2, 4, 5, 3],
      [3, 2, 0, -1],
    ],
  },
  'rain-rooftop': {
    info: MUSIC_TRACKS[1],
    voice: 'rhodesBell',
    padWarmthHz: 410,
    padGain: 0.16,
    melodyGain: 0.2,
    melodyDensity: 0.48,
    arpeggiateChords: false,
    // Am9 -> Fmaj7 -> Dm9 -> Em7
    chords: [
      [45, 52, 59, 60, 64], // Am9
      [41, 48, 57, 60, 64], // Fmaj7
      [50, 57, 60, 64, 65], // Dm9
      [40, 47, 55, 59, 62], // Em7
    ],
    // A natural minor / Dorian-tinged wistful notes
    scale: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76],
    motifs: [
      [4, 3, 2, 0],
      [2, 1, 0, -2],
      [5, 4, 2, 1],
      [0, 2, 1, -1],
    ],
  },
  'midnight-lanterns': {
    info: MUSIC_TRACKS[2],
    voice: 'musicBox',
    padWarmthHz: 460,
    padGain: 0.15,
    melodyGain: 0.17,
    melodyDensity: 0.62,
    arpeggiateChords: true,
    // Cm9 -> Abmaj7 -> Ebadd9 -> Bb6
    chords: [
      [48, 55, 58, 62, 63], // Cm9
      [44, 51, 55, 60, 63], // Abmaj7
      [51, 58, 62, 63, 67], // Ebadd9
      [46, 53, 55, 60, 62], // Bb6
    ],
    // C minor / Eb major dreamy scale
    scale: [63, 65, 67, 70, 72, 74, 75, 79, 82, 84],
    motifs: [
      [0, 2, 4, 3],
      [3, 2, 1, 0],
      [1, 3, 4, 2],
      [4, 2, 0, 1],
    ],
  },
  'golden-drift': {
    info: MUSIC_TRACKS[3],
    voice: 'harpPluck',
    padWarmthHz: 620,
    padGain: 0.13,
    melodyGain: 0.21,
    melodyDensity: 0.65,
    arpeggiateChords: true,
    // Gmaj9 -> Em9 -> Cmaj7 -> D6sus4
    chords: [
      [43, 50, 59, 62, 66], // Gmaj9
      [40, 47, 55, 59, 62], // Em9
      [48, 55, 59, 64, 67], // Cmaj7
      [50, 57, 60, 64, 67], // D6sus4 (warm suspended)
    ],
    // G major pentatonic + maj7
    scale: [62, 64, 66, 67, 69, 71, 74, 76, 78, 79],
    motifs: [
      [0, 1, 3, 4],
      [4, 3, 2, 0],
      [1, 3, 5, 4],
      [2, 1, 0, 2],
    ],
  },
  'snowfall-solitude': {
    info: MUSIC_TRACKS[4],
    voice: 'feltPiano',
    padWarmthHz: 360,
    padGain: 0.14,
    melodyGain: 0.19,
    melodyDensity: 0.36,
    arpeggiateChords: false,
    // Dm11 -> Bbmaj7 -> Gm9 -> Asus4
    chords: [
      [50, 57, 60, 65, 67], // Dm11
      [46, 53, 57, 62, 65], // Bbmaj7
      [43, 50, 57, 58, 62], // Gm9
      [45, 52, 57, 62, 64], // Asus4
    ],
    // D Dorian sparse contemplative scale
    scale: [62, 64, 65, 67, 69, 71, 72, 74, 77],
    motifs: [
      [0, 2, 1, 0],
      [3, 2, 0, -1],
      [4, 3, 1, 2],
    ],
  },
};

const AUTO_CYCLE_INTERVAL_SEC = 150; // 2.5 minutes per track in auto-cycle mode

export class ProceduralMusicPlayer {
  private ctx: AudioContext;
  private outputBus: GainNode;
  private trackBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private reverbReturn: GainNode | null = null;
  private delayNodes: DelayNode[] = [];
  private activeNodes: Set<AudioNode> = new Set();

  private isPlaying = false;
  private currentTrackId: MusicTrackId = 'paper-boats';
  private autoCycle = true;

  private schedulerTimer: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private chordIndex = 0;
  private scaleCursor = 3;
  private activeMotif: number[] = [0, 2, 3, 2];
  private motifPos = 0;
  private trackElapsedSteps = 0;

  private onTrackChange?: (track: MusicTrackInfo) => void;

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    onTrackChange?: (track: MusicTrackInfo) => void
  ) {
    this.ctx = ctx;
    this.outputBus = ctx.createGain();
    this.outputBus.gain.value = 1.0;

    // Gentle master warmth & safety limiter so layered chords never clip
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.25;

    this.outputBus.connect(compressor);
    compressor.connect(destination);

    this.onTrackChange = onTrackChange;
    this.setupStereoSpace();
  }

  private setupStereoSpace() {
    // Warm damped stereo delay network (replaces heavy convolution buffers)
    this.reverbSend = this.ctx.createGain();
    this.reverbSend.gain.value = 0.42;

    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.55;
    this.reverbReturn.connect(this.outputBus);

    const taps = [
      { delay: 0.29, feedback: 0.36, pan: -0.55, cutoff: 1900 },
      { delay: 0.43, feedback: 0.34, pan: 0.55, cutoff: 1650 },
      { delay: 0.67, feedback: 0.28, pan: -0.25, cutoff: 1400 },
    ];

    for (const tap of taps) {
      const delay = this.ctx.createDelay(1.5);
      delay.delayTime.value = tap.delay;

      const damp = this.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = tap.cutoff;

      const fb = this.ctx.createGain();
      fb.gain.value = tap.feedback;

      const panner = this.ctx.createStereoPanner
        ? this.ctx.createStereoPanner()
        : null;
      if (panner) {
        panner.pan.value = tap.pan;
      }

      this.reverbSend.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);

      if (panner) {
        damp.connect(panner);
        panner.connect(this.reverbReturn);
      } else {
        damp.connect(this.reverbReturn);
      }

      this.delayNodes.push(delay);
    }
  }

  public getCurrentTrack(): MusicTrackInfo {
    return COMPOSITIONS[this.currentTrackId].info;
  }

  public getAutoCycle(): boolean {
    return this.autoCycle;
  }

  public setAutoCycle(enabled: boolean) {
    this.autoCycle = enabled;
  }

  public start(trackId?: MusicTrackId) {
    if (trackId) {
      this.currentTrackId = trackId;
    }
    if (this.isPlaying) {
      return;
    }
    this.isPlaying = true;
    this.beginTrackSession();
  }

  public stop() {
    this.isPlaying = false;
    this.clearScheduler();
    this.fadeOutAndDisposeTrackBus();
  }

  public setTrack(trackId: MusicTrackId) {
    if (this.currentTrackId === trackId && this.isPlaying) return;
    this.currentTrackId = trackId;
    this.onTrackChange?.(this.getCurrentTrack());

    if (this.isPlaying) {
      this.clearScheduler();
      this.fadeOutAndDisposeTrackBus();
      this.beginTrackSession();
    }
  }

  public nextTrack(): MusicTrackInfo {
    const idx = MUSIC_TRACKS.findIndex((t) => t.id === this.currentTrackId);
    const next = MUSIC_TRACKS[(idx + 1) % MUSIC_TRACKS.length];
    this.setTrack(next.id);
    return next;
  }

  private beginTrackSession() {
    const now = this.ctx.currentTime;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0.001, now);
    bus.gain.linearRampToValueAtTime(1.0, now + 0.8);
    bus.connect(this.outputBus);
    if (this.reverbSend) {
      bus.connect(this.reverbSend);
    }
    this.trackBus = bus;

    this.stepIndex = 0;
    this.chordIndex = 0;
    this.trackElapsedSteps = 0;
    this.motifPos = 0;
    const comp = COMPOSITIONS[this.currentTrackId];
    this.scaleCursor = Math.floor(comp.scale.length / 2);
    this.activeMotif = comp.motifs[0];
    this.nextStepTime = now + 0.08;

    this.scheduleLookahead();
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleLookahead();
    }, 220);
  }

  private clearScheduler() {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private fadeOutAndDisposeTrackBus() {
    const oldBus = this.trackBus;
    this.trackBus = null;
    if (!oldBus) return;
    const now = this.ctx.currentTime;
    oldBus.gain.cancelScheduledValues(now);
    oldBus.gain.setValueAtTime(oldBus.gain.value, now);
    oldBus.gain.linearRampToValueAtTime(0.0001, now + 0.65);
    window.setTimeout(() => {
      try {
        oldBus.disconnect();
      } catch {
        // Ignore already disconnected node
      }
    }, 750);
  }

  private scheduleLookahead() {
    if (!this.isPlaying || !this.trackBus) return;

    const comp = COMPOSITIONS[this.currentTrackId];
    // 8th-note subdivision duration in seconds
    const eighthSec = 60 / comp.info.bpm / 2;
    const lookaheadEnd = this.ctx.currentTime + 0.75;

    while (this.nextStepTime < lookaheadEnd) {
      this.scheduleStep(this.nextStepTime, eighthSec, comp);
      this.nextStepTime += eighthSec;
      this.stepIndex++;
      this.trackElapsedSteps++;
    }

    // Check auto-cycle after completing a full 8-bar phrase beyond the interval
    const elapsedSec = this.trackElapsedSteps * eighthSec;
    if (
      this.autoCycle &&
      elapsedSec >= AUTO_CYCLE_INTERVAL_SEC &&
      this.stepIndex % 16 === 0
    ) {
      this.nextTrack();
    }
  }

  private scheduleStep(time: number, eighthSec: number, comp: TrackComposition) {
    if (!this.trackBus) return;

    // 16 eighth-notes = 2 bars of 4/4 per chord
    const stepInChord = this.stepIndex % 16;

    if (stepInChord === 0) {
      const chord = comp.chords[this.chordIndex % comp.chords.length];
      const chordDur = eighthSec * 16;

      // Warm breathing pad on every chord change
      this.triggerPadChord(chord, time, chordDur, comp.padWarmthHz, comp.padGain);

      // Gentle chord arpeggio or soft block voicing
      if (comp.arpeggiateChords) {
        chord.forEach((midi, idx) => {
          const offset = idx * (eighthSec * 0.85);
          this.triggerVoice(
            comp.voice,
            midiToFreq(midi),
            time + offset,
            eighthSec * 5.5,
            comp.melodyGain * (idx === 0 ? 0.75 : 0.52)
          );
        });
      } else {
        // Soft bass + upper voicing
        this.triggerVoice(
          comp.voice,
          midiToFreq(chord[0]),
          time,
          eighthSec * 10,
          comp.melodyGain * 0.65
        );
        chord.slice(1, 3).forEach((midi, idx) => {
          this.triggerVoice(
            comp.voice,
            midiToFreq(midi),
            time + 0.04 * (idx + 1),
            eighthSec * 8,
            comp.melodyGain * 0.42
          );
        });
      }

      this.chordIndex++;

      // Pick a fresh motif every 2 chords
      if (this.chordIndex % 2 === 0) {
        const motifIdx = Math.floor(Math.random() * comp.motifs.length);
        this.activeMotif = comp.motifs[motifIdx];
        this.motifPos = 0;
      }
    }

    // Generative melody on expressive subdivisions (avoid cluttering beat 0)
    const isMelodicBeat =
      stepInChord === 2 ||
      stepInChord === 4 ||
      stepInChord === 6 ||
      stepInChord === 9 ||
      stepInChord === 11 ||
      stepInChord === 14;

    if (isMelodicBeat && Math.random() < comp.melodyDensity) {
      const stepDelta = this.activeMotif[this.motifPos % this.activeMotif.length];
      this.motifPos++;

      this.scaleCursor = Math.max(
        0,
        Math.min(comp.scale.length - 1, this.scaleCursor + stepDelta)
      );
      const midi = comp.scale[this.scaleCursor];
      // Slight humanize timing (+/- 14ms) and velocity
      const humanize = (Math.random() - 0.5) * 0.024;
      const vel = comp.melodyGain * (0.72 + Math.random() * 0.32);
      const noteDur = eighthSec * (2.6 + Math.random() * 2.2);

      this.triggerVoice(comp.voice, midiToFreq(midi), time + humanize, noteDur, vel);

      // Occasional delicate octave-up shimmer on serene/dreamy tracks
      if (
        (comp.voice === 'musicBox' || comp.voice === 'feltPiano') &&
        Math.random() < 0.16
      ) {
        this.triggerVoice(
          comp.voice,
          midiToFreq(midi + 12),
          time + humanize + eighthSec * 0.5,
          noteDur * 0.7,
          vel * 0.35
        );
      }
    }
  }

  private triggerPadChord(
    chord: number[],
    startTime: number,
    duration: number,
    cutoffHz: number,
    peakGain: number
  ) {
    if (!this.trackBus) return;

    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(cutoffHz * 0.75, startTime);
    padFilter.frequency.linearRampToValueAtTime(cutoffHz * 1.15, startTime + duration * 0.45);
    padFilter.frequency.linearRampToValueAtTime(cutoffHz * 0.7, startTime + duration);

    const padEnv = this.ctx.createGain();
    const perVoiceGain = peakGain / Math.max(1, chord.length);
    padEnv.gain.setValueAtTime(0.0001, startTime);
    padEnv.gain.linearRampToValueAtTime(perVoiceGain, startTime + Math.min(1.4, duration * 0.3));
    padEnv.gain.setValueAtTime(perVoiceGain, startTime + duration * 0.65);
    padEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.8);

    padFilter.connect(padEnv);
    padEnv.connect(this.trackBus);

    const stopAt = startTime + duration + 0.9;
    for (const midi of chord) {
      const freq = midiToFreq(midi);
      // Two softly detuned oscillators per pad note for warm chorus width
      for (const detuneCents of [-5, 5]) {
        const osc = this.ctx.createOscillator();
        osc.type = detuneCents < 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.detune.setValueAtTime(detuneCents, startTime);
        osc.connect(padFilter);
        osc.start(startTime);
        osc.stop(stopAt);
      }
    }
  }

  private triggerVoice(
    voice: InstrumentVoice,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number
  ) {
    if (!this.trackBus) return;
    const t0 = Math.max(this.ctx.currentTime, startTime);

    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc2Gain = this.ctx.createGain();

    if (voice === 'feltPiano') {
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, t0);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, t0);
      osc2Gain.gain.setValueAtTime(0.18, t0);

      filter.frequency.setValueAtTime(Math.min(2600, freq * 3.8), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.3), t0 + duration * 0.7);

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peakGain, t0 + 0.022);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    } else if (voice === 'rhodesBell') {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t0);
      // Bell-tine overtone
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 3, t0);
      osc2Gain.gain.setValueAtTime(0.22, t0);
      osc2Gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.25);

      filter.frequency.setValueAtTime(2200, t0);
      filter.frequency.exponentialRampToValueAtTime(550, t0 + duration * 0.8);

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peakGain, t0 + 0.014);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    } else if (voice === 'musicBox') {
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t0);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.002, t0);
      osc2Gain.gain.setValueAtTime(0.3, t0);
      osc2Gain.gain.exponentialRampToValueAtTime(0.02, t0 + duration * 0.45);

      filter.frequency.setValueAtTime(3400, t0);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peakGain * 0.85, t0 + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.85);
    } else {
      // harpPluck
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, t0);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 0.5, t0);
      osc2Gain.gain.setValueAtTime(0.2, t0);

      filter.frequency.setValueAtTime(Math.min(3200, freq * 4.5), t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(320, freq * 1.4), t0 + duration * 0.55);

      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.9);
    }

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(env);
    env.connect(this.trackBus);

    const stopTime = t0 + duration + 0.05;
    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
  }

  public dispose() {
    this.stop();
    try {
      this.outputBus.disconnect();
      this.reverbSend?.disconnect();
      this.reverbReturn?.disconnect();
      for (const d of this.delayNodes) {
        d.disconnect();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.activeNodes.clear();
  }
}
