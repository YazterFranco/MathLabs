import { App } from './ui/app.ts';
import { createRng } from './engine/rng.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Falta el contenedor #app');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed'));

let store: Storage | null = null;
try {
  store = window.localStorage;
  store.getItem('mathlabs:probe');
} catch {
  store = null;
}

// Sin localStorage (modo privado estricto) el juego funciona, pero no guarda: se avisa en pantalla.
const memory = new Map<string, string>();
const fallback = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
};

const e2e = params.get('e2e') === '1';
const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
const app = new App({
  root,
  store: store ?? fallback,
  ...(params.get('seed') && Number.isFinite(seed) ? { rng: createRng(seed) } : {}),
  native: capacitor?.isNativePlatform?.() === true || (e2e && params.get('native') === '1'),
  ...(e2e && params.get('appVersion') ? { appVersion: Number(params.get('appVersion')) } : {}),
});

// Gancho de pruebas: solo existe si la URL trae ?e2e=1.
if (e2e) (window as unknown as { __matemundo: App }).__matemundo = app;

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && params.get('e2e') !== '1') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* sin SW el juego sigue funcionando */
  });
}
