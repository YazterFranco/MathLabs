// Mundo 9 en navegador real: cada región se juega en el nivel 3 (con respuestas escritas donde toca).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = 4797;
const base = `http://localhost:${port}`;
const shots = process.env.SHOT_DIR;
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
  await page.goto(`${base}/?e2e=1&seed=9`);
  await page.click('[data-action=start]');
  await page.fill('#nick', 'Ada');
  await page.click('button[type=submit]');
  await page.evaluate(() => {
    const s = window.__matemundo.state.save;
    const p = s.profiles[0];
    const done = { levels: [3, 3, 3], guardianPassed: true, guardianBest: 10, guardianTries: 1 };
    for (let w = 1; w <= 8; w++) for (let r = 1; r <= 5; r++) p.regions[`w${w}r${r}`] = { ...done, levels: [3, 3, 3] };
    for (let r = 1; r <= 5; r++) p.regions[`w9r${r}`] = { levels: [3, 3, 0], guardianPassed: true, guardianBest: 10, guardianTries: 1 };
    localStorage.setItem('mathlabs:save', JSON.stringify(s));
  });
  await page.reload();
  await page.click('[data-action=start]');
  await page.click('[data-action=select-profile]');
  assert.ok((await page.locator('.world[data-theme=castle]').count()) === 1, 'el mundo 9 aparece con su tema');
  await page.locator('.world[data-theme=castle]').scrollIntoViewIfNeeded();
  if (shots) await page.screenshot({ path: `${shots}/w9-map.png` });

  const typedSeen = [];
  for (let r = 1; r <= 5; r++) {
    await page.click(`[data-action=open-region][data-id=w9r${r}]`);
    await page.click('[data-action=open-level][data-level="2"]');
    await page.click('[data-action=begin]');
    for (let guard = 0; guard < 300; guard++) {
      const info = await page.evaluate(() => {
        const st = window.__matemundo.state;
        if (!st.play) return null;
        const c = st.play.session.current;
        return { answer: c.answer, input: c.input ?? null, index: st.play.session.index, phase: st.play.phase };
      });
      if (!info) break;
      if (info.phase !== 'asking') {
        await page.waitForTimeout(50);
        continue;
      }
      if (shots && info.index === 0) await page.screenshot({ path: `${shots}/w9r${r}.png` });
      if (info.input === 'number') {
        typedSeen.push(r);
        await page.fill('#typed-input', info.answer);
        await page.keyboard.press('Enter');
      } else {
        await page.click(`button.choice[data-choice="${info.answer}"]`);
      }
      await page.waitForFunction(
        (i) => {
          const st = window.__matemundo.state;
          return !st.play || st.play.session.index !== i || st.play.phase !== 'asking';
        },
        info.index,
        { timeout: 6000 },
      );
    }
    await page.waitForFunction(() => window.__matemundo.state.screen === 'result', null, { timeout: 8000 });
    if (shots) await page.screenshot({ path: `${shots}/w9r${r}-result.png` });
    const out = await page.evaluate(() => window.__matemundo.state.result.outcome);
    assert.equal(out.stars, 3, `región w9r${r}: nivel 3 con 3 estrellas`);
    await page.click('[data-action=result-map]');
  }
  assert.deepEqual([...new Set(typedSeen)].sort(), [1, 2, 5], 'escriben en ecuaciones, sistemas y cuadráticas');
  assert.deepEqual(errors, [], 'sin errores de consola');
  console.log('E2E mundo 9 OK');
} catch (err) {
  console.error('E2E mundo 9 FALLÓ:', err.message);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
