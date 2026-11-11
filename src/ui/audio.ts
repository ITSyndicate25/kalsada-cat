type SoundName =
  | 'hop'
  | 'bump'
  | 'coin'
  | 'power'
  | 'stumble'
  | 'whistle'
  | 'sparkle'
  | 'shield-break'
  | 'payong-break'
  | 'revive'
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

// Original loop in A minor, two bars: lead + bass + hat. Composed for Kalsada-Cat;
// for drop-in CC0 alternatives see the references in README.md.
const LEAD: readonly number[] = [
  69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 71, 0, 74, 76, 0, 0,
  69, 0, 72, 0, 76, 0, 79, 0, 77, 76, 74, 0, 72, 0, 0, 0,
];

const BASS: readonly number[] = [
  45, 0, 45, 0, 52, 0, 45, 0, 50, 0, 50, 0, 45, 0, 45, 0,
  45, 0, 45, 0, 52, 0, 45, 0, 53, 0, 52, 0, 40, 0, 40, 0,
];

const HAT: readonly number[] = [92, 0, 0, 0, 92, 0, 0, 0, 92, 0, 0, 0, 92, 0, 95, 0];

export class AudioBus {
  muted: boolean;
  musicOn = false;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = this.musicOn && !this.muted ? 0.16 : 0;
      this.musicGain.connect(this.master);

      if (this.musicOn) this.startMusicClock();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    if (this.context) {
      const now = this.context.currentTime;
      this.master?.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
      // Music gain is zero while muted; unmuting must restore it or the track
      // stays silent even though the clock keeps running.
      this.musicGain?.gain.setTargetAtTime(this.musicOn && !this.muted ? 0.16 : 0, now, 0.05);
    }
    return this.muted;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) {
      this.startMusicClock();
      // Restart the lookahead so a long silent stretch does not burst stale notes.
      if (this.context) this.nextStepTime = this.context.currentTime + 0.1;
    } else if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(on && !this.muted ? 0.16 : 0, this.context.currentTime, 0.05);
    }
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
    } else if (name === 'stumble') {
      this.tone({ wave: 'square', from: 220, to: 130, duration: 0.12, volume: 0.16 });
      this.noise(0.08, 0.1, 500);
    } else if (name === 'whistle') {
      // Enforcer trill: two rising chirps with a small wobble.
      this.tone({ wave: 'square', from: 1500, to: 2300, duration: 0.09, volume: 0.14 });
      this.tone({ wave: 'square', from: 2300, to: 1600, duration: 0.09, volume: 0.14, delay: 0.09 });
      this.tone({ wave: 'square', from: 1700, to: 2600, duration: 0.12, volume: 0.12, delay: 0.2 });
    } else if (name === 'sparkle') {
      this.tone({ wave: 'triangle', from: 1046, to: 1568, duration: 0.07, volume: 0.16 });
      this.tone({ wave: 'triangle', from: 1318, to: 2093, duration: 0.08, volume: 0.13, delay: 0.06 });
      this.tone({ wave: 'triangle', from: 1568, to: 2637, duration: 0.1, volume: 0.1, delay: 0.13 });
    } else if (name === 'shield-break') {
      this.tone({ wave: 'sawtooth', from: 300, to: 110, duration: 0.22, volume: 0.18 });
      this.noise(0.12, 0.16, 900);
    } else if (name === 'payong-break') {
      this.tone({ wave: 'triangle', from: 700, to: 240, duration: 0.16, volume: 0.18 });
      this.noise(0.1, 0.14, 1400);
    } else if (name === 'revive') {
      this.tone({ wave: 'triangle', from: 392, to: 392, duration: 0.09, volume: 0.2 });
      this.tone({ wave: 'triangle', from: 523, to: 523, duration: 0.09, volume: 0.2, delay: 0.09 });
      this.tone({ wave: 'triangle', from: 659, to: 1046, duration: 0.18, volume: 0.2, delay: 0.18 });
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

  private startMusicClock(): void {
    if (this.musicTimer !== null) return;
    // 0.14 s per sixteenth ~= 107 BPM.
    const STEP = 0.14;
    const AHEAD = 0.3;
    this.nextStepTime = this.context ? this.context.currentTime + AHEAD : AHEAD;

    this.musicTimer = window.setInterval(() => {
      const context = this.context;
      const musicGain = this.musicGain;
      if (!context || !musicGain) return;

      while (this.nextStepTime < context.currentTime + AHEAD) {
        // Muted players keep the clock ticking but skip note creation, so no
        // oscillators pile up behind a zero gain.
        if (!this.muted) {
          const time = this.nextStepTime;
          const index = this.stepIndex;
          const lead = LEAD[index % LEAD.length] ?? 0;
          const bass = BASS[index % BASS.length] ?? 0;
          const hat = HAT[index % HAT.length] ?? 0;
          if (lead > 0) this.musicNote(lead, 'square', 0.3, time, STEP * 0.9);
          if (bass > 0) this.musicNote(bass - 12, 'triangle', 0.42, time, STEP * 0.95);
          if (hat > 0) this.musicHat(hat, time);
        }
        this.stepIndex = (this.stepIndex + 1) % 32;
        this.nextStepTime += STEP;
      }
    }, 90);
  }

  private musicNote(midi: number, wave: OscillatorType, volume: number, when: number, duration: number): void {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain) return;

    const freq = 440 * 2 ** ((midi - 69) / 12);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.01);
    gain.gain.setTargetAtTime(0.0001, when + duration * 0.7, 0.03);

    oscillator.connect(gain);
    gain.connect(musicGain);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.1);
  }

  private musicHat(level: number, when: number): void {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain) return;

    const frames = Math.max(1, Math.floor(context.sampleRate * 0.03));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames) ** 2;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = context.createGain();
    gain.gain.value = level / 1200;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    source.start(when);
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
