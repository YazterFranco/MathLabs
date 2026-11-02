import { COSTUMES, STICKERS } from '../data/shop.ts';
import { ALL_REGIONS, LEVELS_PER_REGION, WORLDS, findRegion, type Region } from '../data/worlds.ts';
import { addDays, type DayKey } from './dates.ts';
import { afterGuardian, afterPractice, afterReview, rank } from './mastery.ts';
import {
  MAX_EVIDENCE,
  regionProgress,
  registerPlayDay,
  skillProgress,
  type EvidenceEntry,
  type Profile,
} from './save.ts';
import type { Rng } from './rng.ts';
import type { Outcome } from './session.ts';
import type { Mastery, PowerKind } from './types.ts';

/** Días hasta el siguiente repaso: 1, 3, 7 y 14. */
export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;
const POWERS: PowerKind[] = ['lupa', 'pista', 'escudo'];

export type LevelRef =
  | { kind: 'level'; regionId: string; level: number }
  | { kind: 'guardian'; regionId: string }
  | { kind: 'review'; skillIds: string[] };

export interface Reward {
  wallet: number;
  powerGift: PowerKind | null;
  chest: boolean;
  regionCompleted: boolean;
  worldCompleted: boolean;
  masteryChanges: Array<{ skillId: string; from: Mastery; to: Mastery }>;
}

/* ───────────── Desbloqueos ───────────── */

export function isWorldUnlocked(p: Profile, worldId: number): boolean {
  if (worldId <= 1) return true;
  const prev = WORLDS.find((w) => w.id === worldId - 1);
  if (!prev) return false;
  const last = prev.regions[prev.regions.length - 1] as Region;
  return regionProgress(p, last.id).guardianPassed;
}

export function isRegionUnlocked(p: Profile, regionId: string): boolean {
  const { world, index } = findRegion(regionId);
  if (!isWorldUnlocked(p, world.id)) return false;
  if (index === 0) return true;
  return regionProgress(p, (world.regions[index - 1] as Region).id).guardianPassed;
}

export function isLevelUnlocked(p: Profile, regionId: string, level: number): boolean {
  if (!isRegionUnlocked(p, regionId)) return false;
  if (level === 0) return true;
  return (regionProgress(p, regionId).levels[level - 1] ?? 0) > 0;
}

export function isGuardianUnlocked(p: Profile, regionId: string): boolean {
  if (!isRegionUnlocked(p, regionId)) return false;
  return regionProgress(p, regionId).levels.slice(0, LEVELS_PER_REGION).every((s) => s > 0);
}

export function regionStars(p: Profile, regionId: string): number {
  return regionProgress(p, regionId).levels.reduce((a, b) => a + b, 0);
}

/** Habilidades con repaso pendiente hoy. */
export function dueSkills(p: Profile, today: DayKey): string[] {
  return Object.entries(p.skills)
    .filter(([, s]) => s.nextReview !== null && s.nextReview <= today && rank(s.mastery) >= rank('familiar'))
    .map(([id]) => id);
}

/* ───────────── Aplicar resultados ───────────── */

function setMastery(p: Profile, skillId: string, to: Mastery, changes: Reward['masteryChanges']): void {
  const s = skillProgress(p, skillId);
  if (s.mastery !== to) changes.push({ skillId, from: s.mastery, to });
  s.mastery = to;
}

/** Cuando una habilidad llega por primera vez a Competente se agenda su primer repaso. */
function scheduleFirstReview(p: Profile, skillId: string, before: Mastery, today: DayKey): void {
  const s = skillProgress(p, skillId);
  if (rank(before) < rank('proficient') && rank(s.mastery) >= rank('proficient') && !s.nextReview) {
    s.reviewStep = 0;
    s.nextReview = addDays(today, REVIEW_INTERVALS[0]);
  }
}

function recordEvidence(p: Profile, entry: EvidenceEntry): void {
  p.evidence.push(entry);
  if (p.evidence.length > MAX_EVIDENCE) p.evidence.splice(0, p.evidence.length - MAX_EVIDENCE);
}

export function randomPower(rng: Rng): PowerKind {
  return rng.pick(POWERS);
}

/**
 * Aplica el resultado de una partida: estados de dominio, estrellas, recompensas y evidencia.
 * Los intentos por pregunta ya se guardaron al responder (`recordAttempt`).
 */
export function applyOutcome(p: Profile, ref: LevelRef, outcome: Outcome, rng: Rng, today: DayKey): Reward {
  const reward: Reward = {
    wallet: 0,
    powerGift: null,
    chest: false,
    regionCompleted: false,
    worldCompleted: false,
    masteryChanges: [],
  };
  registerPlayDay(p, today);

  if (ref.kind === 'level') {
    const rp = regionProgress(p, ref.regionId);
    rp.levels[ref.level] = Math.max(rp.levels[ref.level] ?? 0, outcome.stars);
    for (const [skillId, r] of Object.entries(outcome.bySkill)) {
      const before = skillProgress(p, skillId).mastery;
      if (!outcome.lost) setMastery(p, skillId, afterPractice(before, r.correct, r.total), reward.masteryChanges);
      scheduleFirstReview(p, skillId, before, today);
    }
    reward.wallet = outcome.stars * 2 + outcome.chispaBonus;
    if (outcome.perfect) {
      reward.chest = true;
      reward.wallet += 3;
      reward.powerGift = randomPower(rng);
    }
  } else if (ref.kind === 'guardian') {
    const { region, world, index } = findRegion(ref.regionId);
    const main = region.skillIds[0] as string;
    const rp = regionProgress(p, ref.regionId);
    rp.guardianTries += 1;
    rp.guardianBest = Math.max(rp.guardianBest, outcome.correct);
    for (const [skillId, r] of Object.entries(outcome.bySkill)) {
      const before = skillProgress(p, skillId).mastery;
      const next =
        skillId === main ? afterGuardian(before, outcome.passed) : afterPractice(before, r.correct, r.total);
      setMastery(p, skillId, next, reward.masteryChanges);
      scheduleFirstReview(p, skillId, before, today);
    }
    if (outcome.passed && !rp.guardianPassed) {
      rp.guardianPassed = true;
      reward.regionCompleted = true;
      reward.wallet = 10;
      reward.powerGift = 'pista';
      reward.worldCompleted = index === world.regions.length - 1;
    } else if (outcome.passed) {
      reward.wallet = 2;
    }
    recordEvidence(p, {
      date: today,
      kind: 'guardian',
      regionId: ref.regionId,
      passed: outcome.passed,
      correct: outcome.correct,
      total: outcome.total,
      misses: outcome.missed.map((m) => ({
        prompt: m.question.prompt,
        ...(m.question.visual ? { visual: m.question.visual } : {}),
        chosen: m.chosen,
        answer: m.question.answer,
      })),
    });
  } else {
    for (const [skillId, r] of Object.entries(outcome.bySkill)) {
      const s = skillProgress(p, skillId);
      const allCorrect = r.correct === r.total;
      setMastery(p, skillId, afterReview(s.mastery, allCorrect), reward.masteryChanges);
      s.reviewStep = allCorrect ? Math.min(s.reviewStep + 1, REVIEW_INTERVALS.length - 1) : 0;
      s.nextReview = addDays(today, REVIEW_INTERVALS[s.reviewStep] as number);
    }
    reward.wallet = outcome.correct;
    recordEvidence(p, {
      date: today,
      kind: 'review',
      regionId: ALL_REGIONS.find((r) => ref.skillIds.includes(r.skillIds[0] as string))?.id ?? '',
      passed: outcome.mistakes === 0,
      correct: outcome.correct,
      total: outcome.total,
      misses: outcome.missed.map((m) => ({
        prompt: m.question.prompt,
        ...(m.question.visual ? { visual: m.question.visual } : {}),
        chosen: m.chosen,
        answer: m.question.answer,
      })),
    });
  }

  p.wallet += reward.wallet;
  p.totalEarned += reward.wallet;
  if (reward.powerGift) p.inventory[reward.powerGift] += 1;
  return reward;
}

/* ───────────── Cofre diario y tienda ───────────── */

export interface ChestResult {
  wallet: number;
  power: PowerKind;
}

export function claimChest(p: Profile, today: DayKey, rng: Rng): ChestResult | null {
  if (p.chestLastDay === today) return null;
  p.chestLastDay = today;
  const result: ChestResult = { wallet: 3, power: randomPower(rng) };
  p.wallet += result.wallet;
  p.totalEarned += result.wallet;
  p.inventory[result.power] += 1;
  return result;
}

export type BuyResult = 'ok' | 'owned' | 'poor' | 'unknown';

/** Compra con estrellas; nunca con dinero real. */
export function buyItem(p: Profile, itemId: string): BuyResult {
  const costume = COSTUMES.find((c) => c.id === itemId);
  const sticker = STICKERS.find((s) => s.id === itemId);
  const item = costume ?? sticker;
  if (!item) return 'unknown';
  const owned = costume ? p.costumesOwned : p.stickersOwned;
  if (owned.includes(item.id)) return 'owned';
  if (p.wallet < item.cost) return 'poor';
  p.wallet -= item.cost;
  owned.push(item.id);
  if (costume) p.costumeEquipped = costume.id;
  return 'ok';
}

export function equipCostume(p: Profile, costumeId: string | null): boolean {
  if (costumeId === null) {
    p.costumeEquipped = null;
    return true;
  }
  if (!p.costumesOwned.includes(costumeId)) return false;
  p.costumeEquipped = costumeId;
  return true;
}

/* ───────────── Prueba de nivel ───────────── */

/**
 * Da por superados los primeros `placed` mundos. Solo sube, nunca baja el progreso.
 * No regala estrellas: cada habilidad queda en «Familiar» y se agenda su repaso (5 habilidades por día)
 * para confirmar el dominio con evidencia posterior.
 */
export function applyPlacement(p: Profile, placed: number, scores: number[], today: DayKey): void {
  let order = 0;
  for (const world of WORLDS.slice(0, placed)) {
    for (const region of world.regions) {
      const rp = regionProgress(p, region.id);
      rp.levels = rp.levels.map((l) => Math.max(l, 1));
      rp.guardianPassed = true;
      for (const skillId of region.skillIds) {
        const sp = skillProgress(p, skillId);
        if (rank(sp.mastery) < rank('familiar')) sp.mastery = 'familiar';
        if (!sp.nextReview) {
          sp.reviewStep = 0;
          sp.nextReview = addDays(today, 1 + Math.floor(order / 5));
        }
        order += 1;
      }
    }
  }
  p.placement = { date: today, placed, scores };
  registerPlayDay(p, today);
}
