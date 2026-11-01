import type { Mastery } from './types.ts';

const ORDER: Mastery[] = ['none', 'attempted', 'familiar', 'proficient', 'mastered'];
export const rank = (m: Mastery): number => ORDER.indexOf(m);
const atLeast = (current: Mastery, floor: Mastery): Mastery => (rank(current) >= rank(floor) ? current : floor);

export const MASTERY_LABEL: Record<Mastery, string> = {
  none: 'Sin empezar',
  attempted: 'Intentada',
  familiar: 'Familiar',
  proficient: 'Competente',
  mastered: 'Dominada',
};

export const MASTERY_EMOJI: Record<Mastery, string> = {
  none: '⚪',
  attempted: '🟠',
  familiar: '🟡',
  proficient: '🟢',
  mastered: '🏆',
};

/** Resultado de un nivel de práctica: 70 % → Familiar, 100 % → Competente. La práctica nunca baja el estado. */
export function afterPractice(state: Mastery, correct: number, total: number): Mastery {
  if (total <= 0) return state;
  const accuracy = correct / total;
  if (accuracy >= 1) return atLeast(state, 'proficient');
  if (accuracy >= 0.7) return atLeast(state, 'familiar');
  return atLeast(state, 'attempted');
}

/** Reto del Guardián sobre la habilidad principal de la región. */
export function afterGuardian(state: Mastery, passed: boolean): Mastery {
  return passed ? atLeast(state, 'proficient') : atLeast(state, 'attempted');
}

/**
 * Repaso espaciado de días después. Acertar sube un escalón (Competente → Dominada);
 * fallar baja a Familiar a quien estaba por encima.
 */
export function afterReview(state: Mastery, allCorrect: boolean): Mastery {
  if (allCorrect) {
    if (state === 'proficient') return 'mastered';
    if (state === 'familiar') return 'proficient';
    return state;
  }
  return rank(state) > rank('familiar') ? 'familiar' : state;
}
