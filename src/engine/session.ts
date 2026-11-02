import { GUARDIAN_PASS_COUNT, MAX_HEARTS } from '../data/worlds.ts';
import { parseNumberInput } from './input.ts';
import type { Rng } from './rng.ts';
import type { Difficulty, PowerKind, Question } from './types.ts';

export type SessionKind = 'level' | 'guardian' | 'review';
export type ComboEvent = 'chispa' | 'rayo' | null;

export interface AnswerRecord {
  question: Question;
  chosen: string;
  correct: boolean;
}

export interface AnswerResult {
  correct: boolean;
  combo: ComboEvent;
  /** El juego terminó con esta respuesta (última pregunta o sin corazones). */
  finished: boolean;
  /** Esta respuesta valía el doble por una Chispa. */
  doubled: boolean;
}

export interface Outcome {
  kind: SessionKind;
  total: number;
  answered: number;
  correct: number;
  mistakes: number;
  lost: boolean;
  perfect: boolean;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  chispaBonus: number;
  bestStreak: number;
  activeMs: number;
  bySkill: Record<string, { correct: number; total: number }>;
  missed: AnswerRecord[];
}

/** Genera la pregunta `index` a partir de cómo va respondiendo el niño. */
export type AdaptFn = (index: number, records: readonly AnswerRecord[]) => Question;

/** Elegir: coincide el texto. Escribir: coincide el número, sin importar espacios ni la coma decimal. */
export function isCorrect(q: Question, given: string): boolean {
  if (q.input !== 'number') return given === q.answer;
  const value = parseNumberInput(given);
  return value !== null && Math.abs(value - Number(q.answer)) < 1e-9;
}

/** Una pregunta no suma más de 60 s: si el niño se distrae, no pierde el bono por eso. */
export const MAX_THINK_MS = 60_000;
export const CHISPA_STREAK = 3;
export const RAYO_STREAK = 5;

/**
 * Partida de un nivel, un Reto del Guardián o un repaso.
 * Solo los niveles tienen corazones y potenciadores; el Guardián y el repaso miden lo que el niño sabe sin ayudas.
 */
export class Session {
  readonly kind: SessionKind;
  readonly questions: Question[];
  index = 0;
  hearts: number;
  /** Tope de vidas: 3 por defecto; en el juego son las energías ⚡ del niño. */
  readonly maxHearts: number;
  /** Milisegundos de juego activo (el tiempo que el niño tarda en cada pregunta). */
  activeMs = 0;
  streak = 0;
  bestStreak = 0;
  readonly records: AnswerRecord[] = [];
  readonly used = new Set<PowerKind>();
  /** Opciones tachadas por la Lupa en la pregunta actual. */
  eliminated = new Set<string>();
  hintShown = false;
  shield = false;
  chispaArmed = false;
  chispaBonus = 0;
  lost = false;
  private answeredCurrent = false;
  /** Dificultad base de un nivel adaptativo (para mostrar «reto extra» cuando sube). */
  baseDifficulty: Difficulty | null = null;
  private readonly adapt: AdaptFn | null;

  constructor(kind: SessionKind, questions: Question[], adapt: AdaptFn | null = null, lives?: { start: number; max: number }) {
    this.kind = kind;
    this.questions = questions;
    this.adapt = adapt;
    this.maxHearts = lives?.max ?? MAX_HEARTS;
    this.hearts = Math.max(1, Math.min(this.maxHearts, lives?.start ?? this.maxHearts));
  }

  /** Suma tiempo de reflexión de una pregunta; una pausa larga no cuenta de más. */
  addTime(ms: number): void {
    if (Number.isFinite(ms) && ms > 0) this.activeMs += Math.min(ms, MAX_THINK_MS);
  }

  get current(): Question {
    return this.questions[this.index] as Question;
  }
  get total(): number {
    return this.questions.length;
  }
  get answered(): boolean {
    return this.answeredCurrent;
  }
  get mistakes(): number {
    return this.records.filter((r) => !r.correct).length;
  }
  get correctCount(): number {
    return this.records.filter((r) => r.correct).length;
  }
  get finished(): boolean {
    return this.lost || (this.answeredCurrent && this.index >= this.total - 1);
  }
  get usesHearts(): boolean {
    return this.kind === 'level';
  }
  get allowsPowers(): boolean {
    return this.kind === 'level';
  }

  canUse(kind: PowerKind): boolean {
    if (kind === 'lupa' && this.current.input === 'number') return false; // no hay opciones que tachar
    return this.allowsPowers && !this.answeredCurrent && !this.finished && !this.used.has(kind);
  }

  /** Quita hasta dos opciones incorrectas; siempre deja la correcta y otra más. */
  useLupa(rng: Rng): string[] {
    if (!this.canUse('lupa')) return [];
    this.used.add('lupa');
    const wrong = this.current.choices.filter((c) => c !== this.current.answer && !this.eliminated.has(c));
    const removable = Math.max(0, Math.min(2, wrong.length - 1));
    const removed = rng.shuffle(wrong).slice(0, removable);
    for (const c of removed) this.eliminated.add(c);
    return removed;
  }

  usePista(): string {
    if (!this.canUse('pista')) return '';
    this.used.add('pista');
    this.hintShown = true;
    return this.current.hint;
  }

  useEscudo(): boolean {
    if (!this.canUse('escudo')) return false;
    this.used.add('escudo');
    this.shield = true;
    return true;
  }

  answer(choice: string): AnswerResult {
    if (this.answeredCurrent || this.lost) {
      return { correct: false, combo: null, finished: this.finished, doubled: false };
    }
    const q = this.current;
    const correct = isCorrect(q, choice);
    this.records.push({ question: q, chosen: choice, correct });
    this.answeredCurrent = true;
    let combo: ComboEvent = null;
    let doubled = false;

    if (correct) {
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      if (this.chispaArmed) {
        this.chispaBonus += 1;
        this.chispaArmed = false;
        doubled = true;
      }
      if (this.usesHearts) {
        // El Rayo (cada 5 seguidas) tiene prioridad sobre la Chispa (cada 3 seguidas).
        if (this.streak % RAYO_STREAK === 0) {
          this.hearts = Math.min(this.maxHearts, this.hearts + 1);
          combo = 'rayo';
        } else if (this.streak % CHISPA_STREAK === 0) {
          this.chispaArmed = true;
          combo = 'chispa';
        }
      }
    } else {
      this.chispaArmed = false;
      if (this.shield) this.shield = false;
      else this.streak = 0;
      if (this.usesHearts) {
        this.hearts -= 1;
        if (this.hearts <= 0) this.lost = true;
      }
    }
    return { correct, combo, finished: this.finished, doubled };
  }

  /** Pasa a la siguiente pregunta. */
  next(): void {
    if (!this.answeredCurrent || this.finished) return;
    this.index += 1;
    if (this.adapt) this.questions[this.index] = this.adapt(this.index, this.records);
    this.answeredCurrent = false;
    this.eliminated = new Set();
    this.hintShown = false;
  }

  outcome(): Outcome {
    const correct = this.correctCount;
    const mistakes = this.mistakes;
    const done = this.records.length;
    const completed = !this.lost && done >= this.total;
    const bySkill: Outcome['bySkill'] = {};
    for (const r of this.records) {
      const slot = (bySkill[r.question.skillId] ??= { correct: 0, total: 0 });
      slot.total += 1;
      if (r.correct) slot.correct += 1;
    }
    let stars: Outcome['stars'] = 0;
    if (this.kind === 'level' && completed) stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    return {
      kind: this.kind,
      total: this.total,
      answered: done,
      correct,
      mistakes,
      lost: this.lost,
      perfect: completed && mistakes === 0,
      stars,
      passed: this.kind === 'guardian' && completed && correct >= GUARDIAN_PASS_COUNT,
      chispaBonus: this.chispaBonus,
      bestStreak: this.bestStreak,
      activeMs: this.activeMs,
      bySkill,
      missed: this.records.filter((r) => !r.correct),
    };
  }
}
