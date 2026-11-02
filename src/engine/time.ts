import { PAR_SECONDS_PER_QUESTION, RAYO_TIME_RATIO, TYPED_EXTRA_SECONDS, findRegion } from '../data/worlds.ts';
import type { Question } from './types.ts';

export type SpeedTier = 'rayo' | 'veloz' | null;

/** Bonos por rapidez: Rayo (≤ 60 % de la meta) y Veloz (≤ la meta). Solo si hubo a lo sumo un error. */
export const SPEED_BONUS = {
  rayo: { stars: 4, energy: 1, power: true },
  veloz: { stars: 2, energy: 1, power: false },
} as const;
export const SPEED_MAX_MISTAKES = 1;

/** Tiempo meta (segundos) de un nivel de la región: depende del mundo y de cuántas respuestas se escriben. */
export function parSeconds(regionId: string, questions: readonly Question[]): number {
  const { world } = findRegion(regionId);
  const perQuestion = PAR_SECONDS_PER_QUESTION[world.id - 1] ?? PAR_SECONDS_PER_QUESTION[PAR_SECONDS_PER_QUESTION.length - 1];
  return questions.reduce((sum, q) => sum + perQuestion + (q.input === 'number' ? TYPED_EXTRA_SECONDS : 0), 0);
}

export function speedTier(activeMs: number, parSec: number, mistakes: number, completed: boolean): SpeedTier {
  if (!completed || mistakes > SPEED_MAX_MISTAKES || parSec <= 0) return null;
  const sec = activeMs / 1000;
  if (sec <= parSec * RAYO_TIME_RATIO) return 'rayo';
  if (sec <= parSec) return 'veloz';
  return null;
}

/** 83000 → «1:23». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Estado del cronómetro mientras se juega: qué bono se alcanzaría si se terminara ahora. */
export function liveTier(activeMs: number, parSec: number): 'rayo' | 'veloz' | 'late' {
  return speedTier(activeMs, parSec, 0, true) ?? 'late';
}
