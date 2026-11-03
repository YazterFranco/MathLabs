import { daysBetween, weekKey, type DayKey } from './dates.ts';
import { RECENT_WINDOW } from './adaptive.ts';
import { MAX_ENERGY } from '../data/worlds.ts';
import type { Mastery, PowerKind } from './types.ts';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'mathlabs:save';
export const MAX_PROFILES = 4;
export const MAX_EVIDENCE = 60;
export const SESSION_LIMITS = [10, 15, 20, 30, 45] as const;

export type AgeBand = '5-6' | '7-8' | '9+';

export interface SkillProgress {
  mastery: Mastery;
  attempts: number;
  correct: number;
  last: DayKey | null;
  nextReview: DayKey | null;
  reviewStep: number;
  /** Últimas respuestas ('1' acierto, '0' error), las más nuevas al final. */
  recent: string;
}

export interface EvidenceMiss {
  prompt: string;
  visual?: string;
  chosen: string;
  answer: string;
}

export interface EvidenceEntry {
  date: DayKey;
  kind: 'guardian' | 'review';
  regionId: string;
  passed: boolean;
  correct: number;
  total: number;
  misses: EvidenceMiss[];
}

export interface RegionProgress {
  /** Mejor puntuación de cada nivel (0 = sin completar, 1 a 3 estrellas). */
  levels: number[];
  guardianPassed: boolean;
  guardianBest: number;
  guardianTries: number;
  /** Mejor tiempo (ms de juego activo) de cada nivel; 0 = sin marca. */
  best: number[];
}

export interface Placement {
  date: DayKey;
  /** Mundos superados en la prueba: del 1 al `placed` se dan por sabidos. */
  placed: number;
  /** Aciertos en cada mundo evaluado (de 5). */
  scores: number[];
}

/** Contadores para logros y para «Mi progreso». */
export interface Stats {
  answered: number;
  correct: number;
  levels: number;
  perfects: number;
  speedBonuses: number;
  rayoBonuses: number;
  bestStreak: number;
  sprints: number;
  sprintBest: number;
  recharges: number;
  questsDone: number;
  guardians: number;
}

export type QuestId = 'answer' | 'levels' | 'perfect' | 'speed' | 'sprint' | 'streak';

export interface QuestItem {
  id: QuestId;
  goal: number;
  progress: number;
  claimed: boolean;
}

export interface QuestDay {
  day: DayKey;
  items: QuestItem[];
  bonusClaimed: boolean;
}

export const emptyStats = (): Stats => ({
  answered: 0,
  correct: 0,
  levels: 0,
  perfects: 0,
  speedBonuses: 0,
  rayoBonuses: 0,
  bestStreak: 0,
  sprints: 0,
  sprintBest: 0,
  recharges: 0,
  questsDone: 0,
  guardians: 0,
});

export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  mascot: string;
  ageBand: AgeBand;
  sessionLimitMin: number;
  createdAt: DayKey;
  wallet: number;
  totalEarned: number;
  inventory: Record<PowerKind, number>;
  costumesOwned: string[];
  costumeEquipped: string | null;
  stickersOwned: string[];
  skills: Record<string, SkillProgress>;
  regions: Record<string, RegionProgress>;
  streak: { days: number; lastDay: DayKey | null; freezes: number; weekKey: DayKey | null };
  chestLastDay: DayKey | null;
  evidence: EvidenceEntry[];
  /** Resultado de la prueba de nivel (una sola vez por explorador). */
  placement: Placement | null;
  settings: { sound: boolean; voice: boolean; vibrate: boolean };
  /** Logros conseguidos (ids). */
  achievements: string[];
  stats: Stats;
  /** Misiones del día (se renuevan cada día). */
  quests: QuestDay | null;
  /** Energía ⚡ actual y el instante (ms) desde el que corre la recarga automática. */
  energy: number;
  energyAt: number;
  /** Mundos completados (cada uno da una medalla). */
  medals: number[];
}

export interface SaveFile {
  version: number;
  profiles: Profile[];
  activeId: string | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export const emptySave = (): SaveFile => ({ version: SAVE_VERSION, profiles: [], activeId: null });

const clean = (text: string, max: number): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

const defaultLimit = (age: AgeBand): number => (age === '5-6' ? 15 : age === '7-8' ? 20 : 25);

export interface NewProfileInput {
  nickname: string;
  avatar: string;
  mascot: string;
  ageBand: AgeBand;
}

export function newProfile(input: NewProfileInput, today: DayKey, id?: string): Profile {
  return {
    id: id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    nickname: clean(input.nickname, 12) || 'Explorador',
    avatar: input.avatar,
    mascot: input.mascot,
    ageBand: input.ageBand,
    sessionLimitMin: defaultLimit(input.ageBand),
    createdAt: today,
    wallet: 0,
    totalEarned: 0,
    inventory: { lupa: 2, pista: 1, escudo: 1 },
    costumesOwned: [],
    costumeEquipped: null,
    stickersOwned: [],
    skills: {},
    regions: {},
    streak: { days: 0, lastDay: null, freezes: 1, weekKey: null },
    chestLastDay: null,
    evidence: [],
    placement: null,
    settings: { sound: true, voice: input.ageBand === '5-6', vibrate: true },
    achievements: [],
    stats: emptyStats(),
    quests: null,
    energy: MAX_ENERGY,
    energyAt: 0,
    medals: [],
  };
}

export function skillProgress(p: Profile, skillId: string): SkillProgress {
  return (p.skills[skillId] ??= {
    mastery: 'none',
    attempts: 0,
    correct: 0,
    last: null,
    nextReview: null,
    reviewStep: 0,
    recent: '',
  });
}

export function regionProgress(p: Profile, regionId: string): RegionProgress {
  const rp = (p.regions[regionId] ??= { levels: [0, 0, 0], guardianPassed: false, guardianBest: 0, guardianTries: 0, best: [0, 0, 0] });
  if (!Array.isArray(rp.best)) rp.best = [0, 0, 0];
  return rp;
}

/** Guardado tras cada respuesta: así un cierre brusco no pierde intentos. */
export function recordAttempt(p: Profile, skillId: string, correct: boolean, today: DayKey): void {
  const s = skillProgress(p, skillId);
  s.attempts += 1;
  if (correct) s.correct += 1;
  s.recent = `${s.recent ?? ''}${correct ? '1' : '0'}`.slice(-RECENT_WINDOW);
  s.last = today;
  if (s.mastery === 'none') s.mastery = 'attempted';
}

/** Racha diaria con un congelador gratis por semana: faltar un día no la rompe. */
export function registerPlayDay(p: Profile, today: DayKey): void {
  const wk = weekKey(today);
  if (p.streak.weekKey !== wk) {
    p.streak.weekKey = wk;
    p.streak.freezes = 1;
  }
  const last = p.streak.lastDay;
  if (last === today) return;
  if (!last) {
    p.streak.days = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap === 1) p.streak.days += 1;
    else if (gap === 2 && p.streak.freezes > 0) {
      p.streak.freezes -= 1;
      p.streak.days += 1;
    } else p.streak.days = 1;
  }
  p.streak.lastDay = today;
}

/* ───────────── Persistencia ───────────── */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const QUEST_IDS: QuestId[] = ['answer', 'levels', 'perfect', 'speed', 'sprint', 'streak'];

function parseQuests(raw: unknown): QuestDay | null {
  if (!isRecord(raw) || typeof raw['day'] !== 'string' || !Array.isArray(raw['items'])) return null;
  const items: QuestItem[] = [];
  for (const it of raw['items'] as unknown[]) {
    if (!isRecord(it) || !QUEST_IDS.includes(it['id'] as QuestId)) continue;
    const goal = Math.max(1, Math.min(100, Math.floor(Number(it['goal']) || 1)));
    items.push({
      id: it['id'] as QuestId,
      goal,
      progress: Math.max(0, Math.min(goal, Math.floor(Number(it['progress']) || 0))),
      claimed: it['claimed'] === true,
    });
  }
  return items.length ? { day: raw['day'], items: items.slice(0, 3), bonusClaimed: raw['bonusClaimed'] === true } : null;
}

/** Valida lo mínimo de un archivo de guardado (por ejemplo, una copia importada). */
export function parseSave(raw: string): SaveFile | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data['version'] !== 'number' || !Array.isArray(data['profiles'])) return null;
  const profiles: Profile[] = [];
  for (const item of data['profiles'] as unknown[]) {
    if (!isRecord(item) || typeof item['id'] !== 'string' || typeof item['nickname'] !== 'string') return null;
    const base = newProfile(
      {
        nickname: item['nickname'],
        avatar: typeof item['avatar'] === 'string' ? item['avatar'] : '🦁',
        mascot: typeof item['mascot'] === 'string' ? item['mascot'] : '🦊',
        ageBand: item['ageBand'] === '7-8' || item['ageBand'] === '9+' ? item['ageBand'] : '5-6',
      },
      typeof item['createdAt'] === 'string' ? item['createdAt'] : '2026-01-01',
      item['id'],
    );
    // Completa con lo guardado y deja que los campos nuevos tomen sus valores por defecto.
    const merged = { ...base, ...(item as Partial<Profile>) } as Profile;
    merged.nickname = clean(String(merged.nickname), 12) || 'Explorador';
    merged.inventory = { ...base.inventory, ...(isRecord(item['inventory']) ? (item['inventory'] as Record<PowerKind, number>) : {}) };
    merged.settings = { ...base.settings, ...(isRecord(item['settings']) ? (item['settings'] as Profile['settings']) : {}) };
    merged.streak = { ...base.streak, ...(isRecord(item['streak']) ? (item['streak'] as Profile['streak']) : {}) };
    merged.skills = isRecord(item['skills']) ? (item['skills'] as Profile['skills']) : {};
    for (const sp of Object.values(merged.skills)) {
      // Guardados antiguos no traen `recent`; cualquier valor raro se descarta.
      sp.recent = typeof sp.recent === 'string' && /^[01]*$/.test(sp.recent) ? sp.recent.slice(-RECENT_WINDOW) : '';
    }
    merged.regions = isRecord(item['regions']) ? (item['regions'] as Profile['regions']) : {};
    for (const rp of Object.values(merged.regions)) {
      const best = Array.isArray(rp.best) ? rp.best : [];
      rp.best = [0, 1, 2].map((i) => {
        const v = best[i];
        return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 3_600_000) : 0;
      });
    }
    const st = isRecord(item['stats']) ? item['stats'] : {};
    const stats = emptyStats();
    for (const key of Object.keys(stats) as Array<keyof Stats>) {
      const v = Number(st[key]);
      stats[key] = Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 10_000_000) : 0;
    }
    merged.stats = stats;
    merged.achievements = Array.isArray(item['achievements'])
      ? [...new Set((item['achievements'] as unknown[]).filter((x): x is string => typeof x === 'string' && /^[a-z0-9-]{1,32}$/.test(x)))]
      : [];
    merged.quests = parseQuests(item['quests']);
    const en = Number(item['energy']);
    merged.energy = item['energy'] === undefined || !Number.isFinite(en) ? MAX_ENERGY : Math.max(0, Math.min(MAX_ENERGY, Math.floor(en)));
    const at = Number(item['energyAt']);
    merged.energyAt = Number.isFinite(at) && at > 0 ? at : 0;
    merged.medals = Array.isArray(item['medals'])
      ? [...new Set((item['medals'] as unknown[]).filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 50))]
      : [];
    merged.evidence = Array.isArray(item['evidence']) ? (item['evidence'] as EvidenceEntry[]).slice(-MAX_EVIDENCE) : [];
    const pl = item['placement'];
    merged.placement =
      isRecord(pl) && typeof pl['placed'] === 'number' && typeof pl['date'] === 'string' && Array.isArray(pl['scores'])
        ? {
            date: pl['date'],
            placed: Math.max(0, Math.min(50, Math.floor(pl['placed']))),
            scores: (pl['scores'] as unknown[]).filter((x): x is number => typeof x === 'number').slice(0, 50),
          }
        : null;
    profiles.push(merged);
  }
  const activeId = typeof data['activeId'] === 'string' ? data['activeId'] : null;
  return {
    version: SAVE_VERSION,
    profiles: profiles.slice(0, MAX_PROFILES),
    activeId: profiles.some((p) => p.id === activeId) ? activeId : null,
  };
}

export function loadSave(store: KeyValueStore): SaveFile {
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return emptySave();
  const parsed = parseSave(raw);
  if (parsed) return parsed;
  // Guardado dañado: se conserva una copia para recuperarlo a mano y se empieza limpio.
  try {
    store.setItem(`${SAVE_KEY}:corrupt`, raw);
  } catch {
    /* sin espacio: seguimos */
  }
  return emptySave();
}

export function persist(store: KeyValueStore, save: SaveFile): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

