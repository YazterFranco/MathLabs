import { COSTUMES, STICKERS } from '../data/shop.ts';
import {
  ALL_REGIONS,
  LEVELS_PER_REGION,
  MAX_ENERGY,
  SPRINT_MAX_STARS,
  WORLDS,
  WORLD_PRIZE_STARS,
  findRegion,
  type Region,
} from '../data/worlds.ts';
import { addDays, type DayKey } from './dates.ts';
import { recentAccuracy } from './adaptive.ts';
import { adjustEnergy } from './energy.ts';
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
import { SPEED_BONUS, speedTier, type SpeedTier } from './time.ts';
import type { Mastery, PowerKind } from './types.ts';

/** Días hasta el siguiente repaso: 1, 3, 7 y 14. */
export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;
const POWERS: PowerKind[] = ['lupa', 'pista', 'escudo'];

export type LevelRef =
  | { kind: 'level'; regionId: string; level: number }
  | { kind: 'guardian'; regionId: string }
  | { kind: 'review'; skillIds: string[] }
  /** «Recargar practicando»: preguntas fáciles que devuelven energía; no cambian el progreso. */
  | { kind: 'recharge' }
  /** Contrarreloj de 60 segundos con lo que el niño ya conoce. */
  | { kind: 'sprint' };

export interface Reward {
  wallet: number;
  powerGift: PowerKind | null;
  chest: boolean;
  regionCompleted: boolean;
  worldCompleted: boolean;
  masteryChanges: Array<{ skillId: string; from: Mastery; to: Mastery }>;
  /** Energía ⚡ que se ganó con esta partida (ya sumada al perfil). */
  energyGain: number;
  /** Bono por terminar rápido (solo niveles). */
  speed: SpeedTier;
  /** Tiempo de juego activo del nivel y si mejoró la marca anterior. */
  activeMs: number;
  newRecord: boolean;
  /** Premio por completar el mundo (primera vez que se vence al Guardián de la quinta región). */
  worldPrize: { stars: number } | null;
  /** Contrarreloj: mejoró su mejor marca. */
  sprintRecord: boolean;
}

/** Datos que el juego mide fuera del motor: tiempo y reloj. */
export interface OutcomeExtra {
  activeMs?: number;
  parSeconds?: number;
  nowMs?: number;
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

/**
 * Habilidades con repaso pendiente hoy, las que más cuestan primero (menor precisión reciente)
 * y, a igualdad, las más atrasadas.
 */
export function dueSkills(p: Profile, today: DayKey): string[] {
  return Object.entries(p.skills)
    .filter(([, s]) => s.nextReview !== null && s.nextReview <= today && rank(s.mastery) >= rank('familiar'))
    .sort(([ida, a], [idb, b]) => {
      const accA = recentAccuracy(a) ?? 0.75;
      const accB = recentAccuracy(b) ?? 0.75;
      return accA - accB || String(a.nextReview).localeCompare(String(b.nextReview)) || ida.localeCompare(idb);
    })
    .map(([id]) => id);
}

export type NextStep = { kind: 'level'; regionId: string; level: number } | { kind: 'guardian'; regionId: string };

/** Lo siguiente por jugar en el camino: el primer nivel sin estrellas o el Guardián pendiente. */
export function nextStep(p: Profile): NextStep | null {
  for (const region of ALL_REGIONS) {
    if (!isRegionUnlocked(p, region.id)) return null;
    const rp = regionProgress(p, region.id);
    if (rp.guardianPassed) continue;
    const level = rp.levels.slice(0, LEVELS_PER_REGION).findIndex((s) => s === 0);
    return level >= 0 ? { kind: 'level', regionId: region.id, level } : { kind: 'guardian', regionId: region.id };
  }
  return null;
}

/**
 * Habilidades para «Recargar practicando»: las que el niño ya probó en regiones abiertas,
 * las más recientes primero; si aún no ha probado ninguna, la primera del juego.
 */
export function rechargeSkillIds(p: Profile, limit = 5): string[] {
  const seen = ALL_REGIONS.filter((r) => isRegionUnlocked(p, r.id))
    .map((r) => r.skillIds[0] as string)
    .filter((id) => rank(skillProgress(p, id).mastery) >= rank('attempted'));
  return (seen.length ? seen.slice(-limit) : [ALL_REGIONS[0]?.skillIds[0] as string]).reverse();
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
export function applyOutcome(
  p: Profile,
  ref: LevelRef,
  outcome: Outcome,
  rng: Rng,
  today: DayKey,
  extra: OutcomeExtra = {},
): Reward {
  const reward: Reward = {
    wallet: 0,
    powerGift: null,
    chest: false,
    regionCompleted: false,
    worldCompleted: false,
    masteryChanges: [],
    energyGain: 0,
    speed: null,
    activeMs: 0,
    newRecord: false,
    worldPrize: null,
    sprintRecord: false,
  };
  const nowMs = extra.nowMs ?? Date.now();
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
      reward.energyGain += 1;
    }
    const completed = !outcome.lost && outcome.answered >= outcome.total;
    if (completed) p.stats.levels += 1;
    if (outcome.perfect) p.stats.perfects += 1;
    if (completed && extra.activeMs !== undefined && extra.activeMs > 0) {
      const ms = Math.round(extra.activeMs);
      const prev = rp.best[ref.level] ?? 0;
      reward.activeMs = ms;
      if (prev === 0 || ms < prev) {
        rp.best[ref.level] = ms;
        reward.newRecord = prev > 0;
      }
      reward.speed = speedTier(ms, extra.parSeconds ?? 0, outcome.mistakes, true);
      if (reward.speed) {
        const bonus = SPEED_BONUS[reward.speed];
        reward.wallet += bonus.stars;
        reward.energyGain += bonus.energy;
        if (bonus.power) reward.powerGift ??= randomPower(rng);
        p.stats.speedBonuses += 1;
        if (reward.speed === 'rayo') p.stats.rayoBonuses += 1;
      }
    }
  } else if (ref.kind === 'recharge') {
    // La energía se entrega acierto a acierto mientras se practica; aquí solo se cuenta la recarga.
    if (outcome.correct > 0) p.stats.recharges += 1;
  } else if (ref.kind === 'sprint') {
    p.stats.sprints += 1;
    reward.sprintRecord = outcome.correct > p.stats.sprintBest;
    p.stats.sprintBest = Math.max(p.stats.sprintBest, outcome.correct);
    reward.wallet = Math.min(SPRINT_MAX_STARS, outcome.correct);
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
      p.stats.guardians += 1;
      reward.regionCompleted = true;
      reward.wallet = 10;
      reward.powerGift = 'pista';
      reward.worldCompleted = index === world.regions.length - 1;
      if (reward.worldCompleted && !p.medals.includes(world.id)) {
        p.medals.push(world.id);
        reward.worldPrize = { stars: WORLD_PRIZE_STARS };
        reward.wallet += WORLD_PRIZE_STARS;
        for (const k of POWERS) p.inventory[k] += 1;
        reward.energyGain += MAX_ENERGY;
      }
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
  if (reward.energyGain > 0) reward.energyGain = adjustEnergy(p, reward.energyGain, nowMs);
  return reward;
}

/* ───────────── Cofre diario y tienda ───────────── */

export const CHEST_ENERGY = 2;

export interface ChestResult {
  wallet: number;
  power: PowerKind;
  energy: number;
}

export function claimChest(p: Profile, today: DayKey, rng: Rng, nowMs: number = Date.now()): ChestResult | null {
  if (p.chestLastDay === today) return null;
  p.chestLastDay = today;
  const result: ChestResult = { wallet: 3, power: randomPower(rng), energy: 0 };
  result.energy = adjustEnergy(p, CHEST_ENERGY, nowMs);
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
