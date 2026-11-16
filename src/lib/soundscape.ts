// Web Audio Procedural Soundscape (Wind, Rain, Crickets & Paper Fold SFX)
// Zero external MP3 dependencies — works reliably across desktop & mobile browsers.

class AmbientSoundscape {
  private ctx: AudioContext | null = null;
  private isMuted = true;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  public toggleMute(weather: 'clear' | 'rain' | 'snow'): boolean {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.initContext();
      this.updateWeatherMix(weather);
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private initContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.28, this.ctx.currentTime, 0.4);
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.28;
    this.masterGain.connect(this.ctx.destination);

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
    this.windGain.connect(this.masterGain);
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
    this.rainGain.connect(this.masterGain);
    rainSource.start();
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
}

export const soundscape = new AmbientSoundscape();
