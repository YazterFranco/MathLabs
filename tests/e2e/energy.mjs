// Navegador real: botón de Inicio, Game Over con la lista de errores, recarga practicando,
// bono por rapidez y resumen del mundo con premio. Uso: npm run build && node tests/e2e/energy.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shots = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
const port = 4799;
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

  const shot = async (name) => {
    if (!shots) return;
    await mkdir(shots, { recursive: true });
    await page.screenshot({ path: join(shots, `${name}.png`) });
  };
  const st = () =>
    page.evaluate(() => {
      const s = window.__matemundo.state;
      const p = s.save.profiles[0];
      return {
        screen: s.screen,
        energy: p?.energy,
        medals: p?.medals,
        answer: s.play?.session.current?.answer ?? null,
        choices: s.play?.session.current?.choices ?? [],
        typed: s.play?.session.current?.input === 'number',
        result: s.result ? { lost: s.result.outcome.lost, mistakes: s.result.outcome.mistakes, stars: s.result.outcome.stars, speed: s.result.reward.speed, worldCompleted: s.result.reward.worldCompleted, worldPrize: s.result.reward.worldPrize, energyGain: s.result.reward.energyGain } : null,
      };
    });
  const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
  const text = () => page.locator('main').innerText();

  async function playAll(total, ok = () => true) {
    for (let i = 0; i < total; i++) {
      await page.waitForFunction((n) => window.__matemundo.state.play?.session.index === n && window.__matemundo.state.play.phase === 'asking', i, { timeout: 8000 });
      const s = await st();
      const good = ok(i);
      if (s.typed) {
        await page.fill('#typed-input', good ? s.answer : String(Number(s.answer) + 1));
        await page.keyboard.press('Enter');
      } else {
        const value = good ? s.answer : s.choices.find((c) => c !== s.answer);
        await page.locator('button.choice', { hasText: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
      }
      if (!good) await click('continue');
    }
    await page.waitForFunction(() => window.__matemundo.state.screen === 'result', null, { timeout: 8000 });
  }

  await page.goto(`${base}/?e2e=1&seed=11`);
  await page.waitForSelector('.brand');
  assert.ok((await text()).includes('¡Jugar!'), 'sin explorador se ofrece ¡Jugar!');
  await click('start');
  await page.fill('#nick', 'Luna');
  await page.click('button[type=submit]');
  await page.waitForSelector('.trail');

  // 1) Volver al inicio desde el mapa y continuar
  await shot('10-mapa-energia');
  assert.ok((await text()).includes('⚡ 5/5'), 'el mapa muestra la energía');
  await click('go-home');
  await page.waitForSelector('.brand');
  assert.equal((await st()).screen, 'welcome');
  assert.ok((await text()).includes('Continuar como'), 'el inicio ofrece continuar');
  await shot('11-inicio-continuar');
  await click('continue-as');
  await page.waitForSelector('.trail');
  assert.equal((await st()).screen, 'map');

  // 2) Game Over: cinco errores seguidos gastan las cinco energías
  await click('open-region', '[data-id="w1r1"]');
  await click('go-home');
  await page.waitForSelector('.brand');
  await click('continue-as');
  await click('open-region', '[data-id="w1r1"]');
  await click('open-level', '[data-level="0"]');
  await shot('12-intro-nivel');
  assert.ok((await text()).includes('Game Over'), 'la introducción avisa del Game Over');
  await click('begin');
  await page.waitForSelector('[data-clock="level"]');
  await shot('13-nivel-cronometro');
  await playAll(5, () => false);
  let s = await st();
  assert.equal(s.result.lost, true);
  assert.equal(s.energy, 0, 'cada error gastó una energía');
  const over = await text();
  assert.ok(over.includes('Game Over'), 'se ve Game Over');
  assert.ok(over.includes('Tus errores'), 'se muestran los errores');
  assert.equal(await page.locator('.missed li').count(), 5, 'los cinco errores aparecen en la lista');
  assert.equal(await page.locator('[data-action="result-retry"]').count(), 0, 'sin energía no hay reintento');
  assert.ok(await page.locator('[data-action="start-recharge"]').count(), 'se ofrece recargar practicando');
  await shot('14-game-over');

  // 3) Con 0 de energía no se entra a un nivel: se abre la pantalla de recarga
  await click('result-region');
  await click('open-level', '[data-level="0"]');
  assert.equal((await st()).screen, 'energy');
  await shot('15-pantalla-energia');

  // 4) Recargar practicando: cada acierto devuelve una energía
  await click('start-recharge');
  await click('begin');
  await playAll(5);
  s = await st();
  assert.equal(s.energy, 5, 'cinco aciertos llenan la energía');
  assert.ok((await text()).includes('¡Energía recargada!'));
  await shot('16-recargada');

  // 5) Nivel perfecto y rápido: bono Rayo
  await click('result-region');
  await click('open-level', '[data-level="0"]');
  await click('begin');
  await playAll(8);
  s = await st();
  assert.equal(s.result.stars, 3);
  assert.equal(s.result.speed, 'rayo', 'en el navegador el nivel se resuelve muy por debajo de la meta');
  assert.ok((await text()).includes('Bono Rayo'));
  assert.equal(s.energy, 5, 'la energía llena no pasa de 5');
  await shot('17-bono-rayo');
  await click('result-region');
  assert.ok((await text()).includes('⏱'), 'la región muestra el mejor tiempo');

  // 6) Mundo completado: premio, medalla y resumen
  await page.evaluate(() => {
    const p = window.__matemundo.state.save.profiles[0];
    for (const id of ['w1r1', 'w1r2', 'w1r3', 'w1r4', 'w1r5']) {
      p.regions[id] = { levels: [3, 3, 3], guardianPassed: id !== 'w1r5', guardianBest: 10, guardianTries: 1, best: [40000, 50000, 60000] };
    }
    p.regions['w1r5'].guardianBest = 0;
  });
  await click('back-map');
  await click('open-region', '[data-id="w1r5"]');
  await click('open-guardian');
  await click('begin');
  await playAll(10);
  s = await st();
  assert.equal(s.result.worldCompleted, true);
  assert.deepEqual(s.medals, [1]);
  assert.ok((await text()).includes('Premio del mundo'));
  await shot('18-premio-mundo');
  await click('result-summary');
  await page.waitForSelector('.medal');
  assert.equal((await st()).screen, 'world-summary');
  const sum = await text();
  assert.ok(sum.includes('Bosque de los Números') && sum.includes('Medalla de'), 'el resumen nombra el mundo y la medalla');
  await shot('19-resumen-mundo');
  await click('close-summary');
  await page.waitForSelector('.trail');
  assert.ok(await page.locator('[data-action="open-summary"]').count(), 'el mapa ofrece ver el resumen del mundo');
  await click('open-summary');
  assert.equal((await st()).screen, 'world-summary');

  // 7) El guardado conserva energía y medallas tras recargar la página
  await page.reload();
  await page.waitForSelector('.brand');
  const saved = await page.evaluate(() => window.__matemundo.state.save.profiles[0]);
  assert.equal(saved.energy, 5);
  assert.deepEqual(saved.medals, [1]);

  assert.deepEqual(errors, [], `errores de consola: ${errors.join(' | ')}`);
  console.log('E2E energía y mundos OK');
} finally {
  await browser?.close();
  server.kill();
}
