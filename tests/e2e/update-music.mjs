// Navegador real: música (se enciende tras el primer toque y se apaga con el botón) y aviso de versión
// nueva cuando el juego corre como app de Android. Uso: npm run build && node tests/e2e/update-music.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const port = 4805;
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, 'dist'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const errors = [];
let browser;
try {
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, locale: 'es-PA', reducedMotion: 'reduce' });
  let versionCalls = 0;
  await ctx.route('https://matemundo.pages.dev/descargas/version.json', (route) => {
    versionCalls += 1;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ versionCode: 9, versionName: '1.0.9', notes: 'Ahora con música', apk: 'https://matemundo.pages.dev/descargas/matemundo.apk' }),
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
  const music = () => page.evaluate(() => window.__matemundo['music'].current);

  // 1) En la web no se busca actualización y se ofrece descargar la app
  await page.goto(`${base}/?e2e=1&seed=4`);
  await page.waitForSelector('.brand');
  assert.equal(await page.locator('.update-card').count(), 0);
  assert.ok(await page.locator('a.android-link').count(), 'la web ofrece el APK');
  assert.equal(versionCalls, 0, 'la web no consulta version.json');
  assert.equal(await music(), null, 'sin un toque no suena nada');

  // 2) La música arranca con el primer toque y cambia de tema según la pantalla
  await click('start');
  await page.fill('#nick', 'Leo');
  await page.click('button[type=submit]');
  await page.waitForSelector('.continue-card');
  assert.equal(await music(), 'mapa');
  await click('start-sprint');
  await click('begin');
  assert.equal(await music(), 'contrarreloj');
  await click('quit-play');
  await click('continue-journey');
  assert.equal(await music(), 'juego');
  await click('quit-play');
  await click('back-map');
  await click('toggle-music');
  assert.equal(await music(), null, 'el botón 🔇 apaga la música');
  assert.equal(await page.evaluate(() => window.__matemundo.state.save.profiles[0].settings.music), false);
  await click('toggle-music');
  assert.equal(await music(), 'mapa');

  // 3) Como app de Android con versión 3: aparece el aviso de la 1.0.9
  await page.goto(`${base}/?e2e=1&seed=4&native=1&appVersion=3`);
  await page.waitForSelector('.update-card');
  assert.equal(versionCalls, 1);
  const text = await page.locator('.update-card').innerText();
  assert.ok(text.includes('1.0.9') && text.includes('Ahora con música'));
  assert.equal(await page.locator('[data-update-link]').getAttribute('href'), 'https://matemundo.pages.dev/descargas/matemundo.apk');
  assert.ok((await page.locator('main').innerText()).includes('Versión'), 'la app muestra su versión');
  await click('continue-as');
  await page.waitForSelector('.continue-card');
  assert.equal(await page.locator('.update-card').count(), 1, 'el aviso también está en el mapa');
  await click('dismiss-update');
  assert.equal(await page.locator('.update-card').count(), 0, '«Después» lo oculta');

  // 4) Si la app ya está al día, no hay aviso
  await page.goto(`${base}/?e2e=1&seed=4&native=1&appVersion=9`);
  await page.waitForSelector('.brand');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.update-card').count(), 0);

  assert.deepEqual(errors, [], errors.join(' | '));
  console.log('E2E música y actualizaciones OK');
} finally {
  await browser?.close();
  server.kill();
}
