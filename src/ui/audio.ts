type SoundName =
  | 'hop'
  | 'bump'
  | 'coin'
  | 'power'
  | 'shield-break'
  | 'crash'
  | 'gameover'
  | 'start'
  | 'click';

interface ToneSpec {
  wave: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume: number;
  delay?: number;
}

export class AudioBus {
  muted: boolean;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  unlock(): void {
    if (!this.context) {
      try {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = 0.2;
        master.connect(context.destination);
        this.context = context;
        this.master = master;
      } catch {
        // Audio is decorative. Browsers without WebAudio still get the full game.
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  play(name: SoundName): void {
    if (this.muted || !this.context || !this.master) return;

    if (name === 'hop') {
      this.tone({ wave: 'square', from: 330, to: 520, duration: 0.055, volume: 0.16 });
    } else if (name === 'bump') {
      this.tone({ wave: 'square', from: 140, to: 90, duration: 0.09, volume: 0.18 });
    } else if (name === 'coin') {
      this.tone({ wave: 'triangle', from: 880, to: 880, duration: 0.07, volume: 0.2 });
      this.tone({ wave: 'triangle', from: 1320, to: 1320, duration: 0.07, volume: 0.16, delay: 0.065 });
    } else if (name === 'power') {
      this.tone({ wave: 'triangle', from: 523, to: 523, duration: 0.08, volume: 0.2 });
      this.tone({ wave: 'triangle', from: 659, to: 659, duration: 0.08, volume: 0.2, delay: 0.075 });
      this.tone({ wave: 'triangle', from: 784, to: 1046, duration: 0.12, volume: 0.18, delay: 0.15 });
    } else if (name === 'shield-break') {
      this.tone({ wave: 'sawtooth', from: 300, to: 110, duration: 0.22, volume: 0.18 });
      this.noise(0.12, 0.16, 900);
    } else if (name === 'crash') {
      this.tone({ wave: 'square', from: 130, to: 42, duration: 0.3, volume: 0.2 });
      this.noise(0.22, 0.34, 700);
    } else if (name === 'gameover') {
      this.tone({ wave: 'triangle', from: 392, to: 392, duration: 0.14, volume: 0.2 });
      this.tone({ wave: 'triangle', from: 330, to: 330, duration: 0.14, volume: 0.2, delay: 0.14 });
      this.tone({ wave: 'triangle', from: 262, to: 196, duration: 0.3, volume: 0.2, delay: 0.28 });
    } else if (name === 'start') {
      this.tone({ wave: 'square', from: 392, to: 392, duration: 0.07, volume: 0.15 });
      this.tone({ wave: 'square', from: 523, to: 523, duration: 0.07, volume: 0.15, delay: 0.07 });
      this.tone({ wave: 'square', from: 659, to: 784, duration: 0.12, volume: 0.15, delay: 0.14 });
    } else {
      this.tone({ wave: 'square', from: 760, to: 920, duration: 0.035, volume: 0.12 });
    }
  }

  private tone(spec: ToneSpec): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const start = context.currentTime + (spec.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = spec.wave;
    oscillator.frequency.setValueAtTime(spec.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + spec.duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(spec.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + spec.duration + 0.02);
  }

  private noise(volume: number, duration: number, cutoff: number): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.value = volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }
}
