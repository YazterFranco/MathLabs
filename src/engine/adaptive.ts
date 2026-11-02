import { rank } from './mastery.ts';
import type { SkillProgress } from './save.ts';
import type { Difficulty } from './types.ts';

/** Cuántas respuestas recientes se recuerdan por habilidad. */
export const RECENT_WINDOW = 10;
/** Con menos respuestas que estas no se juzga la racha reciente. */
export const MIN_RECENT = 5;

const clamp = (n: number): Difficulty => Math.max(1, Math.min(3, n)) as Difficulty;

/** Precisión de las últimas respuestas de una habilidad; `null` si todavía hay muy pocas. */
export function recentAccuracy(sp: Pick<SkillProgress, 'recent'> | undefined): number | null {
  const recent = sp?.recent ?? '';
  if (recent.length < MIN_RECENT) return null;
  return [...recent].filter((c) => c === '1').length / recent.length;
}

/** Una habilidad necesita refuerzo si falla bastante en sus últimas respuestas. */
export const needsSupport = (sp: Pick<SkillProgress, 'recent'> | undefined): boolean => {
  const acc = recentAccuracy(sp);
  return acc !== null && acc < 0.6;
};

/**
 * Dificultad con la que arranca un nivel: la del nivel (1, 2 o 3), con un ajuste de un punto
 * si la habilidad ya es sólida (más reto) o si últimamente le cuesta mucho (más calma).
 */
export function startDifficulty(levelIndex: number, sp: SkillProgress | undefined): Difficulty {
  const base = clamp(levelIndex + 1);
  const acc = recentAccuracy(sp);
  if (acc === null || !sp) return base;
  if (acc < 0.5) return clamp(base - 1);
  if (acc >= 0.85 && rank(sp.mastery) >= rank('proficient')) return clamp(base + 1);
  return base;
}

/**
 * Dificultad de la siguiente pregunta dentro de un nivel.
 * Sube con 3 aciertos seguidos y baja si 2 de las últimas 3 fueron errores, siempre a un punto como máximo
 * de la dificultad base: el nivel conserva su carácter y el Guardián (sin adaptación) sigue siendo el examen.
 */
export function nextDifficulty(base: Difficulty, current: Difficulty, answers: boolean[]): Difficulty {
  const last = answers.slice(-3);
  let next: number = current;
  if (last.length === 3 && last.every(Boolean)) next = current + 1;
  else if (last.filter((ok) => !ok).length >= 2 && answers[answers.length - 1] === false) next = current - 1;
  return clamp(Math.max(base - 1, Math.min(base + 1, next)));
}
