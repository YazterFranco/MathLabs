import { LEVELS_PER_REGION, findWorld, WORLDS, type Region, type World } from '../data/worlds.ts';
import { rank } from './mastery.ts';
import { regionProgress, skillProgress, type Profile } from './save.ts';
import type { Mastery } from './types.ts';

export type MedalTier = 'gold' | 'silver' | 'bronze';

export interface RegionSummary {
  region: Region;
  stars: number;
  maxStars: number;
  guardianBest: number;
  mastery: Mastery;
  /** Suma de los mejores tiempos de los 3 niveles; `null` si falta alguno. */
  bestMs: number | null;
}

export interface WorldSummary {
  world: World;
  regions: RegionSummary[];
  stars: number;
  maxStars: number;
  tier: MedalTier;
  /** Habilidades en Competente o Dominada. */
  strong: number;
  /** Último mundo: se muestra la celebración final. */
  isFinal: boolean;
}

export const MEDAL_EMOJI: Record<MedalTier, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
export const MEDAL_NAME: Record<MedalTier, string> = { gold: 'Oro', silver: 'Plata', bronze: 'Bronce' };

export function medalTier(stars: number, maxStars: number): MedalTier {
  const ratio = maxStars > 0 ? stars / maxStars : 0;
  return ratio >= 0.9 ? 'gold' : ratio >= 0.7 ? 'silver' : 'bronze';
}

/** Resumen de un mundo con lo que el niño lleva ganado: estrellas, Guardianes, dominio y mejores tiempos. */
export function worldSummary(p: Profile, worldId: number): WorldSummary {
  const world = findWorld(worldId);
  const regions = world.regions.map((region): RegionSummary => {
    const rp = regionProgress(p, region.id);
    const stars = rp.levels.reduce((a, b) => a + b, 0);
    const times = rp.best.slice(0, LEVELS_PER_REGION);
    return {
      region,
      stars,
      maxStars: LEVELS_PER_REGION * 3,
      guardianBest: rp.guardianBest,
      mastery: skillProgress(p, region.skillIds[0] as string).mastery,
      bestMs: times.length === LEVELS_PER_REGION && times.every((t) => t > 0) ? times.reduce((a, b) => a + b, 0) : null,
    };
  });
  const stars = regions.reduce((a, r) => a + r.stars, 0);
  const maxStars = regions.reduce((a, r) => a + r.maxStars, 0);
  return {
    world,
    regions,
    stars,
    maxStars,
    tier: medalTier(stars, maxStars),
    strong: regions.filter((r) => rank(r.mastery) >= rank('proficient')).length,
    isFinal: world.id === WORLDS.length,
  };
}
