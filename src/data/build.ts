/**
 * Versión de la app de Android. `scripts/build.mjs` reemplaza los marcadores con APP_VERSION_CODE y
 * APP_VERSION_NAME (los pone el workflow del APK); en la web quedan en 0 y no se buscan actualizaciones.
 */
export const APP_VERSION_CODE: number = Number('__APP_VERSION_CODE__') || 0;
export const APP_VERSION_NAME: string = '__APP_VERSION_NAME__'.startsWith('__') ? 'web' : '__APP_VERSION_NAME__';

/** Dónde se publica la última versión del APK (lo actualiza el workflow «APK de Android»). */
export const SITE_URL = 'https://matemundo.pages.dev';
export const VERSION_URL = `${SITE_URL}/descargas/version.json`;
export const APK_URL = `${SITE_URL}/descargas/matemundo.apk`;
