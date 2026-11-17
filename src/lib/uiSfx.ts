// Procedural Web Audio UI Sound Effects
// Warm, tactile, non-fatiguing micro-interactions tailored to Paper Planes.

export type UiSfxKind =
  | 'tap'
  | 'open'
  | 'close'
  | 'select'
  | 'camera'
  | 'zoomIn'
  | 'zoomOut'
  | 'success'
  | 'flag'
  | 'fireworks';

export function synthesizeUiSfx(
  ctx: AudioContext,
  destination: AudioNode,
  kind: UiSfxKind
): void {
  const now = ctx.currentTime;

  const playTone = (
    freqStart: number,
    freqEnd: number,
    dur: number,
    peak: number,
    type: OscillatorType = 'sine',
    delay = 0,
    cutoffHz = 2800
  ) => {
    const t0 = now + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, t0);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(filter);
    filter.connect(env);
    env.connect(destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  switch (kind) {
    case 'tap':
      // Soft wooden/felt micro-tap
      playTone(540, 260, 0.045, 0.14, 'triangle', 0, 1800);
      break;

    case 'open':
      // Gentle rising two-note bloom
      playTone(440, 440, 0.11, 0.09, 'sine', 0, 2400);
      playTone(659.25, 659.25, 0.15, 0.1, 'sine', 0.038, 2800);
      break;

    case 'close':
      // Soft descending release
      playTone(520, 330, 0.095, 0.1, 'sine', 0, 1900);
      break;

    case 'select':
      // Warm kalimba pluck
      playTone(523.25, 523.25, 0.13, 0.12, 'triangle', 0, 2200);
      playTone(1046.5, 1046.5, 0.07, 0.04, 'sine', 0, 3200);
      break;

    case 'camera':
      // Airy compass glide (G4 -> D5)
      playTone(392, 392, 0.14, 0.08, 'sine', 0, 2200);
      playTone(587.33, 587.33, 0.19, 0.09, 'sine', 0.055, 2600);
      break;

    case 'zoomIn':
      playTone(420, 520, 0.045, 0.07, 'sine', 0, 1800);
      break;

    case 'zoomOut':
      playTone(480, 360, 0.045, 0.07, 'sine', 0, 1600);
      break;

    case 'success':
      // Warm major9 chime
      playTone(523.25, 523.25, 0.18, 0.09, 'sine', 0, 2800);
      playTone(659.25, 659.25, 0.18, 0.09, 'sine', 0.045, 3000);
      playTone(783.99, 783.99, 0.22, 0.09, 'sine', 0.09, 3200);
      playTone(1174.66, 1174.66, 0.28, 0.07, 'sine', 0.135, 3400);
      break;

    case 'flag':
      // Muted low wooden thud
      playTone(210, 115, 0.11, 0.14, 'triangle', 0, 900);
      break;

    case 'fireworks':
      // Soft whistle + sparkle glints
      playTone(420, 1280, 0.22, 0.08, 'sine', 0, 3200);
      playTone(1318.5, 1174.6, 0.16, 0.06, 'sine', 0.24, 3800);
      playTone(1567.98, 1396.9, 0.18, 0.05, 'sine', 0.29, 4000);
      playTone(1975.5, 1760, 0.2, 0.04, 'sine', 0.34, 4200);
      break;
  }
}
