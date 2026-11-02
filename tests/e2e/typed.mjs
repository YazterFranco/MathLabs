// Respuesta escrita en navegador real: el nivel 3 de las ecuaciones pide escribir el resultado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = 4796;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, 'dist'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/?e2e=1&seed=21`);
  await page.click('[data-action=start]');
  await page.fill('#nick', 'Ada');
  await page.click('button[type=submit]');
  // Progreso hasta el nivel 3 de las ecuaciones de un paso.
  await page.evaluate(() => {
    const s = window.__matemundo.state.save;
    const p = s.profiles[0];
    const done = { levels: [3, 3, 3], guardianPassed: true, guardianBest: 10, guardianTries: 1 };
    for (let w = 1; w <= 7; w++) for (let r = 1; r <= 5; r++) p.regions[`w${w}r${r}`] = { ...done, levels: [3, 3, 3] };
    p.regions.w8r1 = { ...done, levels: [3, 3, 3] };
    p.regions.w8r2 = { ...done, levels: [3, 3, 3] };
    p.regions.w8r3 = { levels: [3, 3, 0], guardianPassed: false, guardianBest: 0, guardianTries: 0 };
    localStorage.setItem('mathlabs:save', JSON.stringify(s));
  });
  await page.reload();
  await page.click('[data-action=start]');
  await page.click('[data-action=select-profile]');
  await page.click('[data-action=open-region][data-id=w8r3]');
  await page.click('[data-action=open-level][data-level="2"]');
  await page.click('[data-action=begin]');

  const info = () => page.evaluate(() => {
    const pl = window.__matemundo.state.play;
    return { index: pl.session.index, phase: pl.phase, answer: pl.session.current.answer, input: pl.session.current.input ?? null, mistakes: pl.session.mistakes, records: pl.session.records.length };
  });
  let st = await info();
  assert.equal(st.input, 'number', 'el nivel 3 pide escribir');
  assert.equal(await page.locator('button.choice').count(), 0, 'sin botones de opciones');
  assert.ok(await page.locator('#typed-input').isVisible());
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'typed-input', 'la caja recibe el foco');
  assert.ok(await page.locator('[data-action=use-power][data-id=lupa]').isDisabled(), 'la Lupa no aplica a respuestas escritas');
  await page.screenshot({ path: process.env.SHOT ?? '/dev/null' }).catch(() => {});

  // Texto que no es un número: avisa y no cuenta como intento.
  await page.fill('#typed-input', 'abc');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.toast');
  st = await info();
  assert.equal(st.records, 0, 'una respuesta inválida no gasta la pregunta');
  assert.equal(st.phase, 'asking');

  // Lo escrito sobrevive al repintado cuando se va el aviso (3,2 s).
  await page.fill('#typed-input', '5');
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 6000 });
  assert.equal(await page.inputValue('#typed-input'), '5', 'el borrador se conserva');

  // Respuesta mala: explica y espera «Seguir».
  await page.fill('#typed-input', '999');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.feedback.bad');
  assert.ok(await page.locator('#typed-input').isDisabled());
  assert.ok(await page.locator('#typed-input.is-wrong').count());
  st = await info();
  assert.equal(st.mistakes, 1);
  await page.click('[data-action=continue]');

  // Respuesta buena con espacios: se acepta y avanza sola.
  await page.waitForFunction(() => window.__matemundo.state.play.session.index === 1 && window.__matemundo.state.play.phase === 'asking');
  st = await info();
  await page.fill('#typed-input', `  ${st.answer} `);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.feedback.good');
  await page.waitForFunction(() => window.__matemundo.state.play.session.index === 2, null, { timeout: 4000 });
  assert.equal((await info()).mistakes, 1);

  // La caja se vacía en la pregunta nueva.
  assert.equal(await page.inputValue('#typed-input'), '');

  assert.deepEqual(errors, [], 'sin errores de consola');
  console.log('E2E respuesta escrita OK');
} catch (err) {
  console.error('E2E respuesta escrita FALLÓ:', err.message);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
