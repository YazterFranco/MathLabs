/** Convierte lo que escribe el niño en un número; `null` si no es un número válido. */
export function parseNumberInput(text: string): number | null {
  const clean = text.trim().replace(/[−–]/g, '-').replace(',', '.').replace(/\s+/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}
