import type { Rng } from './rng.ts';

export type Difficulty = 1 | 2 | 3;
export type Mastery = 'none' | 'attempted' | 'familiar' | 'proficient' | 'mastered';
export type PowerKind = 'lupa' | 'pista' | 'escudo';

export type Meta = Record<string, number | string | number[]>;

export interface Question {
  skillId: string;
  prompt: string;
  /** Dibujo en emojis que acompaña a la pregunta. */
  visual?: string;
  /** Opciones de respuesta; vacío cuando la respuesta se escribe (`input`). */
  choices: string[];
  /** Respuesta correcta. Si se escribe, es siempre un número entero no negativo. */
  answer: string;
  /** `number`: el niño escribe la respuesta en vez de elegirla. */
  input?: 'number';
  /** Pista que ve el niño al fallar (o al usar la Pista mágica). */
  hint: string;
  /** Dificultad con la que se generó (1 a 3). */
  difficulty?: Difficulty;
  /** Operandos originales; las pruebas los usan para recalcular la respuesta. */
  meta: Meta;
}

export type Generator = (rng: Rng, difficulty: Difficulty) => Question;

export interface Skill {
  id: string;
  name: string;
  emoji: string;
  /** Truco corto que se muestra tras un nivel fallido. */
  tip: string;
  generate: Generator;
}
