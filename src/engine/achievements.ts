import { rank } from './mastery.ts';
import type { Profile } from './save.ts';
import { medalTier, worldSummary } from './summary.ts';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  goal: number;
  value: (p: Profile) => number;
}

const guardiansBeaten = (p: Profile): number => p.stats.guardians;
const masteredSkills = (p: Profile): number => Object.values(p.skills).filter((s) => rank(s.mastery) >= rank('mastered')).length;
const goldMedals = (p: Profile): number =>
  p.medals.filter((id) => {
    const sum = worldSummary(p, id);
    return medalTier(sum.stars, sum.maxStars) === 'gold';
  }).length;

/** Logros: metas a largo plazo que premian practicar y dominar, no solo jugar. */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primer-nivel', emoji: '🌱', name: 'Primeros pasos', desc: 'Completa tu primer nivel', goal: 1, value: (p) => p.stats.levels },
  { id: 'explorador', emoji: '🧭', name: 'Explorador', desc: 'Completa 10 niveles', goal: 10, value: (p) => p.stats.levels },
  { id: 'trotamundos', emoji: '🗺️', name: 'Trotamundos', desc: 'Completa 50 niveles', goal: 50, value: (p) => p.stats.levels },
  { id: 'perfecto', emoji: '🌟', name: 'Perfección', desc: 'Termina un nivel sin errores', goal: 1, value: (p) => p.stats.perfects },
  { id: 'diamante', emoji: '💎', name: 'Diamante', desc: '10 niveles perfectos', goal: 10, value: (p) => p.stats.perfects },
  { id: 'cien', emoji: '💯', name: 'Cien aciertos', desc: 'Responde bien 100 preguntas', goal: 100, value: (p) => p.stats.correct },
  { id: 'mil', emoji: '🧠', name: 'Cerebro brillante', desc: 'Responde bien 1000 preguntas', goal: 1000, value: (p) => p.stats.correct },
  { id: 'imparable', emoji: '🔥', name: 'Imparable', desc: 'Acierta 8 seguidas', goal: 8, value: (p) => p.stats.bestStreak },
  { id: 'veloz', emoji: '⚡', name: 'Veloz', desc: 'Gana un bono de rapidez', goal: 1, value: (p) => p.stats.speedBonuses },
  { id: 'supersonico', emoji: '🚀', name: 'Supersónico', desc: 'Gana 5 bonos Rayo', goal: 5, value: (p) => p.stats.rayoBonuses },
  { id: 'cazaguardianes', emoji: '🛡️', name: 'Cazaguardianes', desc: 'Vence a un Guardián', goal: 1, value: guardiansBeaten },
  { id: 'heroe', emoji: '⚔️', name: 'Héroe de regiones', desc: 'Vence a 10 Guardianes', goal: 10, value: guardiansBeaten },
  { id: 'medallista', emoji: '🏅', name: 'Medallista', desc: 'Completa un mundo', goal: 1, value: (p) => p.medals.length },
  { id: 'oro', emoji: '🥇', name: 'Oro puro', desc: 'Gana una medalla de oro', goal: 1, value: goldMedals },
  { id: 'leyenda', emoji: '🏆', name: 'Leyenda', desc: 'Completa 5 mundos', goal: 5, value: (p) => p.medals.length },
  { id: 'contrarreloj', emoji: '⏱️', name: 'Reloj de arena', desc: '15 aciertos en un Contrarreloj', goal: 15, value: (p) => p.stats.sprintBest },
  { id: 'cumplidor', emoji: '🎯', name: 'Cumplidor', desc: 'Cobra 10 misiones del día', goal: 10, value: (p) => p.stats.questsDone },
  { id: 'nunca-me-rindo', emoji: '🔋', name: 'Nunca me rindo', desc: 'Recarga energía practicando', goal: 1, value: (p) => p.stats.recharges },
  { id: 'constancia', emoji: '📅', name: 'Constancia', desc: 'Juega 3 días seguidos', goal: 3, value: (p) => p.streak.days },
  { id: 'maestro', emoji: '🎓', name: 'Maestro', desc: 'Domina 5 habilidades', goal: 5, value: masteredSkills },
  { id: 'a-la-moda', emoji: '🎩', name: 'A la moda', desc: 'Compra un traje para tu mascota', goal: 1, value: (p) => p.costumesOwned.length },
];

export const ACHIEVEMENT_STARS = 5;

export function achievementProgress(p: Profile, a: Achievement): { value: number; done: boolean } {
  const value = Math.min(a.goal, a.value(p));
  return { value, done: p.achievements.includes(a.id) || value >= a.goal };
}

/** Marca los logros recién conseguidos (+5 ⭐ cada uno) y los devuelve. */
export function checkAchievements(p: Profile): Achievement[] {
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id)) continue;
    if (a.value(p) >= a.goal) {
      p.achievements.push(a.id);
      p.wallet += ACHIEVEMENT_STARS;
      p.totalEarned += ACHIEVEMENT_STARS;
      fresh.push(a);
    }
  }
  return fresh;
}

/** Racha y aciertos se cuentan pregunta a pregunta, en cualquier modo de juego. */
export function noteAnswer(p: Profile, correct: boolean, streak: number): void {
  p.stats.answered += 1;
  if (correct) p.stats.correct += 1;
  p.stats.bestStreak = Math.max(p.stats.bestStreak, streak);
}
