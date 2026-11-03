// Navegador real: «Seguir jugando», misiones del día, Contrarreloj (con tiempo simulado) y logros.
// Uso: npm run build && node tests/e2e/features.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = 4803;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, 'dist'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, locale: 'es-PA', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
  const st = () => page.evaluate(() => window.__matemundo.state);
  const cur = () =>
    page.evaluate(() => {
      const s = window.__matemundo.state;
      return { screen: s.screen, answer: s.play?.session.current?.answer, typed: s.play?.session.current?.input === 'number', ref: s.play?.ref ?? null };
    });
  async function answerRight() {
    const c = await cur();
    if (c.typed) {
      await page.fill('#typed-input', c.answer);
      await page.keyboard.press('Enter');
    } else {
      await page.locator('button.choice', { hasText: new RegExp(`^${c.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
    }
  }
  const waitAsking = (n) =>
    page.waitForFunction((i) => window.__matemundo.state.play?.session.index === i && window.__matemundo.state.play.phase === 'asking', n, { timeout: 8000 });

  await page.goto(`${base}/?e2e=1&seed=21`);
  await click('start');
  await page.fill('#nick', 'Sol');
  await page.click('button[type=submit]');
  await page.waitForSelector('.continue-card');

  // Las misiones de hoy se ven en el mapa
  assert.equal(await page.locator('.quest').count(), 3, 'tres misiones');
  // Se fuerzan misiones conocidas para comprobar el progreso
  await page.evaluate(() => {
    const p = window.__matemundo.state.save.profiles[0];
    p.quests.items = [
      { id: 'levels', goal: 2, progress: 1, claimed: false },
      { id: 'sprint', goal: 1, progress: 0, claimed: false },
      { id: 'answer', goal: 15, progress: 0, claimed: false },
    ];
  });

  // «Seguir jugando» abre directamente el nivel 1 de la primera región
  await click('continue-journey');
  let c = await cur();
  assert.equal(c.screen, 'play');
  assert.deepEqual(c.ref, { kind: 'level', regionId: 'w1r1', level: 0 });
  await click('begin');
  for (let i = 0; i < 8; i++) {
    await waitAsking(i);
    await answerRight();
  }
  await page.waitForFunction(() => window.__matemundo.state.screen === 'result');
  let s = await st();
  assert.ok(s.result.unlocked.some((a) => a.id === 'primer-nivel'), 'logro Primeros pasos');
  assert.ok(s.result.questsDone.some((q) => q.id === 'levels'), 'la misión de niveles se completó');
  assert.ok((await page.locator('main').innerText()).includes('¡Logro: Primeros pasos!'));
  await click('result-map');

  // Cobrar la misión cumplida
  await click('claim-quest', '[data-id="0"]');
  s = await st();
  assert.equal(s.save.profiles[0].quests.items[0].claimed, true);
  assert.equal(s.save.profiles[0].stats.questsDone, 1);

  // «Seguir jugando» ahora lleva al nivel 2
  await click('continue-journey');
  c = await cur();
  assert.deepEqual(c.ref, { kind: 'level', regionId: 'w1r1', level: 1 });
  await click('quit-play');
  await click('back-map');

  // Contrarreloj: responde 3 y se adelanta el final del tiempo
  await click('start-sprint');
  await click('begin');
  for (let i = 0; i < 3; i++) {
    await waitAsking(i);
    await answerRight();
  }
  await waitAsking(3);
  assert.ok(await page.locator('[data-clock="sprint"]').count(), 'se ve la cuenta atrás');
  await page.evaluate(() => {
    window.__matemundo.state.play.deadline = Date.now() - 1;
  });
  await page.waitForFunction(() => window.__matemundo.state.screen === 'result', null, { timeout: 4000 });
  s = await st();
  assert.equal(s.result.outcome.correct, 3);
  assert.equal(s.save.profiles[0].stats.sprintBest, 3);
  assert.equal(s.save.profiles[0].quests.items[1].progress, 1, 'misión de Contrarreloj cumplida');
  assert.ok((await page.locator('main').innerText()).includes('aciertos en 60 segundos'));
  await click('result-map');

  // Logros: pantalla con estadísticas
  await click('open-achievements');
  assert.equal((await st()).screen, 'achievements');
  assert.ok((await page.locator('.badge.is-done').count()) >= 2);
  assert.ok((await page.locator('main').innerText()).includes('Mi progreso'));

  // Vibración: se puede apagar desde Familias (tras la puerta de adultos)
  await click('back-map');
  await click('open-parents');
  const g = await page.evaluate(() => {
    const app = window.__matemundo;
    return app['gate'];
  });
  await page.fill('#gate-input', String(g.a * g.b));
  await page.keyboard.press('Enter');
  await page.locator('[data-change="toggle-vibrate"]').uncheck();
  assert.equal((await st()).save.profiles[0].settings.vibrate, false);

  assert.deepEqual(errors, [], errors.join(' | '));
  console.log('E2E funciones nuevas OK');
} finally {
  await browser?.close();
  server.kill();
}
