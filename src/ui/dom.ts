const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa todo texto que no sea nuestro: apodos, copias importadas, etc. */
export const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c] as string);

/** 2026-11-02 → 02/11 */
export const shortDate = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
