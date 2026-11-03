import {
  GUARDIAN_QUESTIONS,
  QUESTIONS_PER_LEVEL,
  RECHARGE_QUESTIONS,
  SPRINT_QUESTIONS,
  REVIEW_QUESTIONS,
  type Region,
  type World,
} from '../data/worlds.ts';
import { nextDifficulty, startDifficulty } from './adaptive.ts';
import { generateQuestion } from './questions.ts';
import type { SkillProgress } from './save.ts';
import type { AdaptFn } from './session.ts';
import type { Rng } from './rng.ts';
import type { Difficulty, Question } from './types.ts';

const keyOf = (q: Question): string => `${q.skillId}|${q.prompt}|${q.visual ?? ''}`;

/** Genera `count` preguntas sin repetir; `plan` dice qué habilidad toca en cada posición. */
function buildSet(rng: Rng, plan: Array<{ skillId: string; difficulty: Difficulty }>): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const slot of plan) {
    let q = generateQuestion(slot.skillId, rng, slot.difficulty);
    for (let tries = 0; tries < 25 && seen.has(keyOf(q)); tries++) {
      q = generateQuestion(slot.skillId, rng, slot.difficulty);
    }
    seen.add(keyOf(q));
    out.push(q);
  }
  return out;
}

/** Nivel de práctica: 8 preguntas de la habilidad de la región; la dificultad sube con el nivel. */
export function buildLevelQuestions(rng: Rng, region: Region, levelIndex: number, base?: Difficulty): Question[] {
  const difficulty = base ?? (Math.min(3, levelIndex + 1) as Difficulty);
  const skillId = region.skillIds[0] as string;
  return buildSet(
    rng,
    Array.from({ length: QUESTIONS_PER_LEVEL }, () => ({ skillId, difficulty })),
  );
}

/**
 * Nivel que se ajusta al niño: arranca en la dificultad que le toca según su historial y, tras cada
 * respuesta, sube o baja un punto como máximo. Devuelve las preguntas de partida y la función de ajuste.
 */
export function buildAdaptiveLevel(
  rng: Rng,
  region: Region,
  levelIndex: number,
  skill?: SkillProgress,
): { questions: Question[]; base: Difficulty; adapt: AdaptFn } {
  const base = startDifficulty(levelIndex, skill);
  const questions = buildLevelQuestions(rng, region, levelIndex, base);
  const skillId = region.skillIds[0] as string;
  const seen = new Set(questions.map(keyOf));
  let current: Difficulty = base;
  const adapt: AdaptFn = (_index, records) => {
    current = nextDifficulty(base, current, records.map((r) => r.correct));
    let q = generateQuestion(skillId, rng, current);
    for (let tries = 0; tries < 25 && seen.has(keyOf(q)); tries++) q = generateQuestion(skillId, rng, current);
    seen.add(keyOf(q));
    return q;
  };
  return { questions, base, adapt };
}

/** Reto del Guardián: 7 preguntas de la región y 3 de repaso de regiones anteriores del mundo. */
export function buildGuardianQuestions(rng: Rng, world: World, regionIndex: number): Question[] {
  const region = world.regions[regionIndex] as Region;
  const main = region.skillIds[0] as string;
  const earlier = world.regions.slice(0, regionIndex).map((r) => r.skillIds[0] as string);
  const plan: Array<{ skillId: string; difficulty: Difficulty }> = [];
  const mainCount = earlier.length === 0 ? GUARDIAN_QUESTIONS : GUARDIAN_QUESTIONS - 3;
  for (let i = 0; i < mainCount; i++) plan.push({ skillId: main, difficulty: 3 });
  for (let i = mainCount; i < GUARDIAN_QUESTIONS; i++) {
    plan.push({ skillId: rng.pick(earlier), difficulty: 2 });
  }
  return rng.shuffle(buildSet(rng, plan));
}

/** Repaso espaciado: reparte las preguntas entre las habilidades que toca repasar. */
export function buildReviewQuestions(rng: Rng, skillIds: string[]): Question[] {
  // El orden importa: las primeras habilidades (las que más cuestan) reciben una pregunta extra.
  const order = skillIds;
  const plan = Array.from({ length: REVIEW_QUESTIONS }, (_, i) => ({
    skillId: order[i % order.length] as string,
    difficulty: 2 as Difficulty,
  }));
  return rng.shuffle(buildSet(rng, plan));
}

/** Prueba de nivel de un mundo: una pregunta de dificultad media por cada región, sin ayudas. */
export function buildPlacementQuestions(rng: Rng, world: World): Question[] {
  return world.regions.map((r) => generateQuestion(r.skillIds[0] as string, rng, 2));
}

/** «Recargar practicando»: preguntas fáciles (dificultad 1) de lo que el niño ya conoce, mezcladas. */
export function buildRechargeQuestions(rng: Rng, skillIds: string[], count: number = RECHARGE_QUESTIONS): Question[] {
  const pool = skillIds.length ? skillIds : ['count10'];
  const plan: Array<{ skillId: string; difficulty: Difficulty }> = [];
  let bag: string[] = [];
  for (let i = 0; i < count; i++) {
    if (!bag.length) bag = rng.shuffle([...pool]);
    plan.push({ skillId: bag.pop() as string, difficulty: 1 });
  }
  return buildSet(rng, plan);
}

/** Contrarreloj: mezcla de lo que el niño ya conoce; las primeras 8 fáciles y luego dificultad 2. */
export function buildSprintQuestions(rng: Rng, skillIds: string[], count: number = SPRINT_QUESTIONS): Question[] {
  const pool = skillIds.length ? skillIds : ['count10'];
  const plan: Array<{ skillId: string; difficulty: Difficulty }> = [];
  let bag: string[] = [];
  for (let i = 0; i < count; i++) {
    if (!bag.length) bag = rng.shuffle([...pool]);
    plan.push({ skillId: bag.pop() as string, difficulty: i < 8 ? 1 : 2 });
  }
  return buildSet(rng, plan);
}
