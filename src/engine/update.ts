/** Información de la última versión publicada del APK (archivo version.json del sitio). */
export interface VersionInfo {
  versionCode: number;
  versionName: string;
  notes: string;
  apk: string;
}

/** Valida version.json: cualquier dato raro se descarta para no mostrar avisos falsos ni enlaces ajenos. */
export function parseVersionInfo(raw: unknown, allowedPrefix: string): VersionInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const code = Number(r['versionCode']);
  if (!Number.isInteger(code) || code <= 0) return null;
  const name = typeof r['versionName'] === 'string' ? r['versionName'].replace(/[^0-9a-zA-Z.\-]/g, '').slice(0, 20) : '';
  const apk = typeof r['apk'] === 'string' && r['apk'].startsWith(allowedPrefix) ? r['apk'] : '';
  if (!name || !apk) return null;
  // eslint-disable-next-line no-control-regex
  const notes = typeof r['notes'] === 'string' ? r['notes'].replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 280) : '';
  return { versionCode: code, versionName: name, notes, apk };
}

/** Hay actualización si la versión publicada es más nueva que la instalada (0 = versión web, nunca avisa). */
export function hasUpdate(info: VersionInfo | null, installed: number): boolean {
  return !!info && installed > 0 && info.versionCode > installed;
}
