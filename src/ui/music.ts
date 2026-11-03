/**
 * Música de fondo compuesta con Web Audio: sin archivos de audio ni peticiones de red.
 * Un secuenciador sencillo toca bajo, acordes en arpegio, melodía y percusión suave en bucle.
 */

export type TrackId = 'mapa' | 'juego' | 'contrarreloj';

/** Nota MIDI o silencio (`null`). */
type Step = number | null;

export interface Track {
  bpm: number;
  /** Acordes por compás (raíz MIDI y tipo); cada compás tiene 8 corcheas. */
  chords: Array<[root: number, kind: 'M' | 'm']>;
  /** Patrón de arpegio sobre el acorde (índices 0..2 de la tríada, una octava arriba con 3..5). */
  arp: number[];
  /** Melodía: 8 corcheas por compás, tantos compases como acordes. Vacía = sin melodía. */
  melody: Step[];
  /** Bajo: corcheas en las que suena la raíz del acorde. */
  bass: number[];
  hat: number[];
  kick: number[];
  /** Volumen relativo de la melodía (la del nivel es más suave para no distraer). */
  lead: number;
}

const _ = null;

export const TRACKS: Record<TrackId, Track> = {
  // Aventura alegre para el mapa y los menús: Do – Sol – Lam – Fa.
  mapa: {
    bpm: 108,
    chords: [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M'], [60, 'M'], [55, 'M'], [53, 'M'], [55, 'M']],
    arp: [0, 1, 2, 1, 3, 1, 2, 1],
    melody: [
      76, _, 79, _, 81, 79, 76, _,
      74, _, 71, _, 74, _, 79, _,
      72, _, 76, _, 81, _, 79, 76,
      77, _, 76, _, 74, _, _, _,
      76, _, 79, _, 84, _, 81, 79,
      79, _, 74, _, 76, 77, 79, _,
      81, _, 77, _, 76, _, 74, 72,
      74, _, 71, _, 72, _, _, _,
    ],
    bass: [0, 4],
    hat: [2, 6],
    kick: [0, 4],
    lead: 0.55,
  },
  // Tranquila para pensar: arpegios suaves, sin percusión fuerte. Lam – Fa – Do – Sol.
  juego: {
    bpm: 84,
    chords: [[57, 'm'], [53, 'M'], [60, 'M'], [55, 'M']],
    arp: [0, 2, 4, 2, 1, 2, 4, 2],
    melody: [
      _, _, 76, _, _, _, 74, _,
      _, _, 72, _, _, _, 69, _,
      _, _, 72, _, 74, _, 76, _,
      _, _, 74, _, _, _, _, _,
    ],
    bass: [0],
    hat: [],
    kick: [],
    lead: 0.3,
  },
  // Rápida y con empuje para el Contrarreloj: Lam – Fa – Do – Sol.
  contrarreloj: {
    bpm: 148,
    chords: [[57, 'm'], [53, 'M'], [60, 'M'], [55, 'M']],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
    melody: [
      81, _, 81, 79, 76, _, 79, _,
      77, _, 77, 76, 72, _, 74, _,
      76, _, 79, _, 84, _, 83, 79,
      79, _, 78, _, 79, _, 83, _,
    ],
    bass: [0, 1, 2, 3, 4, 5, 6, 7],
    hat: [0, 1, 2, 3, 4, 5, 6, 7],
    kick: [0, 4],
    lead: 0.5,
  },
};

/** Cada mundo suena en otra tonalidad (semitonos) para que el viaje se sienta distinto. */
const WORLD_SHIFT = [0, 2, -3, 5, -2, 3, -5, 1, -1, 4, -4];

export function transposeFor(worldId: number | null): number {
  if (!worldId) return 0;
  return WORLD_SHIFT[(worldId - 1) % WORLD_SHIFT.length] ?? 0;
}

/** Notas de la tríada (y su octava) para el arpegio. */
export function chordTones(root: number, kind: 'M' | 'm'): number[] {
  const third = kind === 'M' ? 4 : 3;
  const tri = [root, root + third, root + 7];
  return [...tri, ...tri.map((n) => n + 12)];
}

export const midiToHz = (n: number): number => 440 * 2 ** ((n - 69) / 12);

const LOOKAHEAD_S = 0.15;
const TICK_MS = 30;
const MUSIC_VOLUME = 0.055;

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: TrackId | null = null;
  private shift = 0;
  private step = 0;
  private nextTime = 0;
  private wanted: { id: TrackId | null; shift: number } = { id: null, shift: 0 };
  private on = true;
  private unlocked = false;

  constructor(doc?: Document) {
    doc?.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (doc.hidden) void this.ctx.suspend();
      else if (this.track) void this.ctx.resume();
    });
  }

  get enabled(): boolean {
    return this.on;
  }

  set enabled(value: boolean) {
    this.on = value;
    this.apply();
  }

  /** El navegador solo deja sonar audio después de un toque: se llama desde cada clic. */
  unlock(): void {
    this.unlocked = true;
    this.apply();
  }

  /** Elige qué tema suena (o silencio). Si es el mismo, no reinicia la canción. */
  play(id: TrackId | null, shift = 0): void {
    this.wanted = { id, shift };
    this.apply();
  }

  get current(): TrackId | null {
    return this.track;
  }

  private apply(): void {
    const id = this.on && this.unlocked ? this.wanted.id : null;
    if (id === this.track && this.wanted.shift === this.shift) return;
    if (!id) {
      this.stop();
      return;
    }
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const changed = id !== this.track;
    this.track = id;
    this.shift = this.wanted.shift;
    if (changed) {
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.08;
      this.fadeIn(ctx);
    }
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 0.25);
    }
  }

  private fadeIn(ctx: AudioContext): void {
    if (!this.master) return;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0, t);
    this.master.gain.linearRampToValueAtTime(MUSIC_VOLUME, t + 0.6);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.05);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
      return null;
    }
    return this.ctx;
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const tr = TRACKS[this.track];
    const eighth = 60 / tr.bpm / 2;
    // Si la pestaña estuvo dormida, no se intenta «recuperar» las notas perdidas.
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(tr, this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step += 1;
    }
  }

  private scheduleStep(tr: Track, step: number, t: number, eighth: number): void {
    const bars = tr.chords.length;
    const bar = Math.floor(step / 8) % bars;
    const pos = step % 8;
    const [root, kind] = tr.chords[bar] as [number, 'M' | 'm'];
    const r = root + this.shift;
    const tones = chordTones(r, kind);
    const arpNote = tones[tr.arp[pos] ?? 0] as number;
    this.note(arpNote, t, eighth * 0.9, 'triangle', 0.32);
    if (tr.bass.includes(pos)) this.note(r - 24, t, eighth * (tr.bass.length > 4 ? 0.8 : 1.8), 'sine', 0.9);
    if (tr.melody.length) {
      const m = tr.melody[(step % (tr.melody.length)) | 0];
      if (m !== null && m !== undefined) this.note(m + this.shift, t, eighth * 1.6, 'square', tr.lead * 0.35);
    }
    if (tr.hat.includes(pos)) this.hat(t, pos % 2 ? 0.12 : 0.2);
    if (tr.kick.includes(pos)) this.kick(t);
  }

  private note(midi: number, t: number, dur: number, wave: OscillatorType, vol: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = midiToHz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hat(t: number, vol: number): void {
    const ctx = this.ctx as AudioContext;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(hp).connect(g).connect(this.master as GainNode);
    src.start(t);
    src.stop(t + 0.05);
  }

  private kick(t: number): void {
    const ctx = this.ctx as AudioContext;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(this.master as GainNode);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

/** Qué tema suena en cada pantalla: el Contrarreloj tiene el suyo, las partidas uno tranquilo y el resto, el del mapa. */
export function trackFor(screen: string, refKind: string | null, worldId: number | null): { id: TrackId | null; shift: number } {
  if (screen === 'sleep') return { id: null, shift: 0 };
  if (screen === 'play' && refKind === 'sprint') return { id: 'contrarreloj', shift: 0 };
  if (screen === 'play' || screen === 'placement') return { id: 'juego', shift: transposeFor(worldId) };
  return { id: 'mapa', shift: transposeFor(worldId) };
}
