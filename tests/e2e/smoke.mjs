// Prueba de humo en un navegador real: crea un explorador, supera 3 niveles y al Guardián, recarga y revisa el guardado.
// Uso: npm run build && node tests/e2e/smoke.mjs   (necesita Playwright y Chrome/Chromium instalados)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOTS_DIR ? resolve(process.env.SHOTS_DIR) : null;
const port = 4789;
const base = `http://localhost:${port}`;

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, 'dist'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
const foreign = [];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-PA', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('request', (r) => {
    if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url());
  });

  const shot = async (name) => {
    if (shots) {
      await mkdir(shots, { recursive: true });
      await page.screenshot({ path: join(shots, `${name}.png`) });
    }
  };
  const state = () => page.evaluate(() => {
    const s = window.__matemundo.state;
    return { screen: s.screen, index: s.play?.session.index ?? -1, phase: s.play?.phase ?? null, answer: s.play?.session.current?.answer ?? null, choices: s.play?.session.current?.choices ?? [], result: s.result ? { stars: s.result.outcome.stars, passed: s.result.outcome.passed, correct: s.result.outcome.correct } : null };
  });
  const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
  const pickChoice = (value) => page.locator('button.choice', { hasText: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();

  /** Responde la pregunta actual. Si `ok` es falso, elige una opción incorrecta. */
  async function answerCurrent(ok = true) {
    const st = await state();
    const value = ok ? st.answer : st.choices.find((c) => c !== st.answer);
    await pickChoice(value);
  }
  async function playAll(total, ok = () => true) {
    for (let i = 0; i < total; i++) {
      await page.waitForFunction((n) => window.__matemundo.state.play?.session.index === n && window.__matemundo.state.play.phase === 'asking', i, { timeout: 8000 });
      const good = ok(i);
      await answerCurrent(good);
      if (!good) await click('continue');
    }
    await page.waitForFunction(() => window.__matemundo.state.screen === 'result', null, { timeout: 8000 });
  }

  await page.goto(`${base}/?e2e=1&seed=7`);
  await page.waitForSelector('.brand');
  await shot('01-bienvenida');

  // Crear explorador
  await click('start');
  await page.fill('#nick', 'Rayo');
  await shot('02-crear');
  await page.click('button[type=submit]');
  await page.waitForSelector('.trail');
  assert.equal((await state()).screen, 'map');
  await shot('03-mapa');

  // Nivel 1 con un error (2 estrellas) y reintento perfecto
  await click('open-region', '[data-id="w1r1"]');
  await shot('04-region');
  await click('open-level', '[data-level="0"]');
  await shot('05-intro-nivel');
  await click('begin');
  await shot('06-pregunta');
  await playAll(8, (i) => i !== 2);
  let st = await state();
  assert.equal(st.result.stars, 2, 'un error debe dar 2 estrellas');
  await shot('07-resultado');
  await click('result-region');
  await click('open-level', '[data-level="0"]');
  await click('begin');
  await playAll(8);
  st = await state();
  assert.equal(st.result.stars, 3, 'sin errores debe dar 3 estrellas');

  // Niveles 2 y 3
  for (const next of [1, 2]) {
    await click('result-next');
    await click('begin');
    await playAll(8);
    st = await state();
    assert.ok(st.result.stars >= 1);
    assert.ok(next >= 1);
  }

  // Guardián
  await click('result-next');
  await shot('08-guardian-intro');
  await click('begin');
  await playAll(10);
  st = await state();
  assert.equal(st.result.passed, true, 'el Guardián debe pasarse con 10/10');
  await shot('09-guardian-resultado');
  await click('result-map');

  // La siguiente región ya está desbloqueada
  assert.ok(await page.locator('[data-action="open-region"][data-id="w1r2"]').count(), 'w1r2 debe estar abierta');
  await shot('10-mapa-progreso');

  // Recargar: el guardado debe seguir ahí
  await page.reload();
  await page.waitForSelector('.brand');
  await click('start');
  assert.equal((await state()).screen, 'profiles');
  await click('select-profile');
  await page.waitForSelector('.trail');
  assert.ok(await page.locator('[data-action="open-region"][data-id="w1r2"]').count(), 'el progreso debe sobrevivir a la recarga');

  // Cofre diario
  await click('claim-chest');
  await page.waitForSelector('.toast');
  const wallet = await page.evaluate(() => window.__matemundo.state.save.profiles[0].wallet);
  assert.ok(wallet > 0);

  // Puerta de adultos con una respuesta mala y luego la buena
  await click('open-parents');
  const q = await page.locator('label.field[for="gate-input"]').innerText();
  const [, a, b] = q.match(/(\d)\s*×\s*(\d)/);
  await page.fill('#gate-input', '1');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.error');
  const q2 = await page.locator('label.field[for="gate-input"]').innerText();
  const [, a2, b2] = q2.match(/(\d)\s*×\s*(\d)/);
  await page.fill('#gate-input', String(Number(a2) * Number(b2)));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.parents');
  await shot('11-familias');
  assert.ok(a && b);

  // Tienda
  await click('back-map');
  await click('open-shop');
  await page.waitForSelector('.shop-list');
  await shot('12-tienda');

  assert.deepEqual(foreign, [], 'no debe haber peticiones a otros sitios');
  assert.deepEqual(errors, [], 'no debe haber errores en consola');
  console.log('E2E OK');
} catch (err) {
  console.error('E2E FALLÓ:', err.message);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
