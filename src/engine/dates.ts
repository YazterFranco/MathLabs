/** Todas las fechas del juego son días locales con formato YYYY-MM-DD. */
export type DayKey = string;

const pad = (n: number): string => String(n).padStart(2, '0');

export function dayKey(date: Date = new Date()): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = parse(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Lunes de la semana a la que pertenece el día; sirve como clave semanal. */
export function weekKey(key: DayKey): DayKey {
  const d = parse(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}
