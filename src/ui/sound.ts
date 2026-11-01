type Cue = 'ok' | 'bad' | 'combo' | 'win' | 'lose' | 'chest';
type Tone = [frequency: number, seconds: number, wave: OscillatorType];

const CUES: Record<Cue, Tone[]> = {
  ok: [[660, 0.09, 'triangle'], [880, 0.14, 'triangle']],
  bad: [[260, 0.18, 'sine'], [200, 0.22, 'sine']],
  combo: [[523, 0.08, 'square'], [659, 0.08, 'square'], [784, 0.14, 'square']],
  win: [[523, 0.12, 'triangle'], [659, 0.12, 'triangle'], [784, 0.12, 'triangle'], [1047, 0.3, 'triangle']],
  lose: [[392, 0.16, 'sine'], [330, 0.16, 'sine'], [262, 0.3, 'sine']],
  chest: [[600, 0.08, 'triangle'], [800, 0.08, 'triangle'], [1000, 0.08, 'triangle'], [1300, 0.25, 'triangle']],
};

/** Efectos de sonido sintetizados: sin archivos de audio ni peticiones de red. */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
    } catch {
      return null;
    }
    return this.ctx;
  }

  play(cue: Cue): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    let t = ctx.currentTime + 0.01;
    for (const [freq, seconds, wave] of CUES[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + seconds + 0.02);
      t += seconds * 0.85;
    }
  }
}
