import { MAX_ENERGY } from '../data/worlds.ts';
import type { DayKey } from './dates.ts';
import { adjustEnergy } from './energy.ts';
import type { Profile, QuestDay, QuestId, QuestItem } from './save.ts';
import type { Rng } from './rng.ts';
import type { PowerKind } from './types.ts';

export interface QuestInfo {
  emoji: string;
  goal: number;
  /** Texto con `{n}` donde va la meta. */
  text: string;
}

/** Misiones que siempre se pueden cumplir en una sesión corta, se juegue el mundo que se juegue. */
export const QUESTS: Record<QuestId, QuestInfo> = {
  answer: { emoji: '✅', goal: 15, text: 'Responde bien {n} preguntas' },
  levels: { emoji: '🗺️', goal: 2, text: 'Completa {n} niveles' },
  perfect: { emoji: '🌟', goal: 1, text: 'Logra un nivel perfecto' },
  speed: { emoji: '⚡', goal: 1, text: 'Gana un bono de rapidez' },
  sprint: { emoji: '⏱️', goal: 1, text: 'Juega un Contrarreloj' },
  streak: { emoji: '🔥', goal: 5, text: 'Acierta {n} seguidas' },
};

export const QUESTS_PER_DAY = 3;
export const QUEST_REWARD = { stars: 3, energy: 1 } as const;
export const QUEST_BONUS_STARS = 5;

export const questText = (q: QuestItem): string => QUESTS[q.id].text.replace('{n}', String(q.goal));

/** Elección estable por día y explorador: el mismo día salen siempre las mismas misiones. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function questsFor(profileId: string, day: DayKey): QuestItem[] {
  const ids = Object.keys(QUESTS) as QuestId[];
  let seed = hash(`${profileId}|${day}`);
  const pool = [...ids];
  const out: QuestItem[] = [];
  while (out.length < QUESTS_PER_DAY && pool.length) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    const id = pool.splice(seed % pool.length, 1)[0] as QuestId;
    out.push({ id, goal: QUESTS[id].goal, progress: 0, claimed: false });
  }
  return out;
}

/** Devuelve las misiones de hoy, creándolas si cambió el día. */
export function ensureQuests(p: Profile, today: DayKey): QuestDay {
  if (!p.quests || p.quests.day !== today) p.quests = { day: today, items: questsFor(p.id, today), bonusClaimed: false };
  return p.quests;
}

export type QuestEvent =
  | { type: 'answer'; correct: boolean; streak: number }
  | { type: 'level'; perfect: boolean; speed: boolean }
  | { type: 'sprint' };

/** Suma progreso a las misiones de hoy. Devuelve las que se acaban de completar. */
export function trackQuests(p: Profile, today: DayKey, ev: QuestEvent): QuestItem[] {
  const day = ensureQuests(p, today);
  const done: QuestItem[] = [];
  for (const q of day.items) {
    if (q.progress >= q.goal) continue;
    let next = q.progress;
    if (ev.type === 'answer') {
      if (q.id === 'answer' && ev.correct) next += 1;
      if (q.id === 'streak') next = Math.max(next, ev.streak);
    } else if (ev.type === 'level') {
      if (q.id === 'levels') next += 1;
      if (q.id === 'perfect' && ev.perfect) next += 1;
      if (q.id === 'speed' && ev.speed) next += 1;
    } else if (q.id === 'sprint') next += 1;
    q.progress = Math.min(q.goal, next);
    if (q.progress >= q.goal) done.push(q);
  }
  return done;
}

export interface QuestClaim {
  stars: number;
  energy: number;
  /** Si con esta se completan las tres: cofre de misiones con un poder. */
  bonusPower: PowerKind | null;
}

/** Cobra una misión cumplida: +3 ⭐ y +1 ⚡; al cobrar las tres, +5 ⭐ y un poder. */
export function claimQuest(p: Profile, index: number, today: DayKey, rng: Rng, nowMs: number): QuestClaim | null {
  const day = ensureQuests(p, today);
  const q = day.items[index];
  if (!q || q.claimed || q.progress < q.goal) return null;
  q.claimed = true;
  p.stats.questsDone += 1;
  const res: QuestClaim = { stars: QUEST_REWARD.stars, energy: 0, bonusPower: null };
  res.energy = p.energy >= MAX_ENERGY ? 0 : adjustEnergy(p, QUEST_REWARD.energy, nowMs);
  if (!day.bonusClaimed && day.items.every((x) => x.claimed)) {
    day.bonusClaimed = true;
    res.stars += QUEST_BONUS_STARS;
    res.bonusPower = rng.pick(['lupa', 'pista', 'escudo'] as PowerKind[]);
    p.inventory[res.bonusPower] += 1;
  }
  p.wallet += res.stars;
  p.totalEarned += res.stars;
  return res;
}
