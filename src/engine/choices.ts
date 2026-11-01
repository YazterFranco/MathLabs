import type { Rng } from './rng.ts';

interface ChoiceOptions {
  count?: number;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Arma las opciones de una pregunta numérica. `wrongs` son errores típicos
 * (olvidar llevar, sumar en vez de restar...) y se usan primero; si faltan,
 * se completan con vecinos de la respuesta.
 */
export function buildChoices(
  rng: Rng,
  answer: number,
  wrongs: number[],
  opts: ChoiceOptions = {},
): { choices: string[]; answer: string } {
  const count = opts.count ?? 4;
  const min = opts.min ?? 0;
  const max = opts.max ?? Number.POSITIVE_INFINITY;
  const step = opts.step ?? 1;
  const picked = new Set<number>();
  const valid = (w: number): boolean => Number.isInteger(w) && w !== answer && w >= min && w <= max;

  for (const w of rng.shuffle(wrongs)) {
    if (picked.size < count - 1 && valid(w)) picked.add(w);
  }
  for (let k = 1; picked.size < count - 1 && k <= 80; k++) {
    for (const sign of rng.shuffle([1, -1])) {
      const w = answer + sign * k * step;
      if (picked.size < count - 1 && valid(w)) picked.add(w);
    }
  }
  const all = rng.shuffle([answer, ...picked]);
  return { choices: all.map(String), answer: String(answer) };
}
