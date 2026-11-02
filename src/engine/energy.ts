import { ENERGY_REGEN_MS, MAX_ENERGY } from '../data/worlds.ts';
import type { Profile } from './save.ts';

/** Pone al día la energía: suma las que se recuperaron solas desde `energyAt`. */
export function syncEnergy(p: Profile, nowMs: number): void {
  if (p.energy >= MAX_ENERGY) {
    p.energy = MAX_ENERGY;
    p.energyAt = nowMs;
    return;
  }
  if (nowMs < p.energyAt) {
    p.energyAt = nowMs; // el reloj se atrasó: no se regala ni se quita tiempo
    return;
  }
  const gained = Math.floor((nowMs - p.energyAt) / ENERGY_REGEN_MS);
  if (gained <= 0) return;
  p.energy = Math.min(MAX_ENERGY, p.energy + gained);
  p.energyAt = p.energy >= MAX_ENERGY ? nowMs : p.energyAt + gained * ENERGY_REGEN_MS;
}

/** Suma o resta energía (0 a MAX). Devuelve lo que cambió de verdad. */
export function adjustEnergy(p: Profile, delta: number, nowMs: number): number {
  syncEnergy(p, nowMs);
  const was = p.energy;
  p.energy = Math.max(0, Math.min(MAX_ENERGY, was + delta));
  if (was >= MAX_ENERGY && p.energy < MAX_ENERGY) p.energyAt = nowMs;
  return p.energy - was;
}

/** Milisegundos hasta la próxima energía automática; `null` si ya está llena. */
export function msToNextEnergy(p: Profile, nowMs: number): number | null {
  if (p.energy >= MAX_ENERGY) return null;
  return Math.max(0, p.energyAt + ENERGY_REGEN_MS - nowMs);
}
