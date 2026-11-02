// Prueba de nivel en navegador real: aprueba 3 mundos, falla el 4.º y comprueba el desbloqueo y el panel de familias.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = 4791;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, 'dist'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  async function newKid(age, nick) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${base}/?e2e=1&seed=11`);
    await page.click('[data-action=start]');
    await page.fill('#nick', nick);
    await page.click(`label.pick-text:has-text("${age}")`);
    await page.click('button[type=submit]');
    return page;
  }
  const screen = (page) => page.evaluate(() => window.__matemundo.state.screen);

  /** Responde la prueba: `good(worldIndex, questionIndex)` decide si acierta. */
  async function runPlacement(page, good) {
    await page.click('[data-action=begin-placement]');
    for (;;) {
      await page.waitForFunction(() => {
        const s = window.__matemundo.state;
        return s.screen === 'placement-result' || (s.screen === 'placement' && s.placement.phase === 'asking');
      }, null, { timeout: 8000 });
      if ((await screen(page)) === 'placement-result') return;
      const info = await page.evaluate(() => {
        const pl = window.__matemundo.state.placement;
        return { w: pl.worldIndex, i: pl.session.index, answer: pl.session.current.answer, choices: pl.session.current.choices };
      });
      const value = good(info.w, info.i) ? info.answer : info.choices.find((c) => c !== info.answer);
      await page.locator('button.choice', { hasText: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
      // Espera a que el juego procese la respuesta antes de mirar otra vez.
      await page.waitForFunction(
        ([w, i]) => {
          const s = window.__matemundo.state;
          return s.screen !== 'placement' || s.placement.worldIndex !== w || s.placement.session.index !== i || s.placement.phase === 'asking';
        },
        [info.w, info.i],
      );
    }
  }

  // 1) Niño de 9+ que domina los mundos 1 a 3 y falla el 4 (solo 1 de 5).
  let page = await newKid('9 años', 'Sol');
  assert.equal(await screen(page), 'placement-intro', 'a partir de 7 años se ofrece la prueba');
  await runPlacement(page, (w, i) => (w < 3 ? true : i === 0));
  assert.equal(await screen(page), 'placement-result');
  const saved = await page.evaluate(() => window.__matemundo.state.save.profiles[0].placement);
  assert.equal(saved.placed, 3);
  assert.deepEqual(saved.scores, [5, 5, 5, 1]);
  await page.click('[data-action=back-map]');
  await page.waitForSelector('.trail');
  assert.ok(await page.locator('[data-action=open-region][data-id=w4r1]').count(), 'el mundo 4 debe estar abierto');
  assert.equal(await page.locator('[data-action=open-region][data-id=w4r2]').count(), 0, 'solo la primera región del mundo 4');
  assert.equal(await page.locator('[data-action=start-placement]').count(), 0, 'la prueba no se repite');
  assert.ok(await page.locator('[data-action=start-review]').count() === 0, 'hoy no hay repasos: se agendan desde mañana');
  const stars = await page.evaluate(() => window.__matemundo.state.save.profiles[0].wallet);
  assert.equal(stars, 0, 'saltar no regala estrellas');

  // 2) Niño de 7-8 que falla ya el mundo 1: empieza desde el principio.
  page = await newKid('7 a 8', 'Luz');
  await runPlacement(page, () => false);
  const none = await page.evaluate(() => window.__matemundo.state.save.profiles[0].placement);
  assert.equal(none.placed, 0);
  assert.deepEqual(none.scores, [0]);
  await page.click('[data-action=back-map]');
  assert.equal(await page.locator('[data-action=open-region][data-id=w1r2]').count(), 0);

  // 3) Niño de 5-6: no se ofrece la prueba al crear, pero sí en el mapa; se puede rechazar.
  page = await newKid('5 a 6', 'Pipo');
  assert.equal(await screen(page), 'map');
  await page.click('[data-action=start-placement]');
  await page.click('[data-action=skip-placement]');
  assert.equal(await screen(page), 'map');
  assert.ok(await page.locator('[data-action=start-placement]').count(), 'sigue disponible en el mapa');

  assert.deepEqual(errors, [], 'sin errores de consola');
  console.log('E2E prueba de nivel OK');
} catch (err) {
  console.error('E2E prueba de nivel FALLÓ:', err.message);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
