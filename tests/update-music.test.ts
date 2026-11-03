import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasUpdate, parseVersionInfo } from '../src/engine/update.ts';
import { TRACKS, chordTones, midiToHz, trackFor, transposeFor } from '../src/ui/music.ts';
import { newProfile, parseSave } from '../src/engine/save.ts';

const SITE = 'https://matemundo.pages.dev/';
const good = { versionCode: 9, versionName: '1.0.9', notes: 'Música nueva', apk: 'https://matemundo.pages.dev/descargas/matemundo.apk' };

test('actualización: version.json válido y comparación con la versión instalada', () => {
  const info = parseVersionInfo(good, SITE);
  assert.deepEqual(info, good);
  assert.equal(hasUpdate(info, 8), true);
  assert.equal(hasUpdate(info, 9), false);
  assert.equal(hasUpdate(info, 12), false);
  assert.equal(hasUpdate(info, 0), false, 'la versión web nunca muestra el aviso');
  assert.equal(hasUpdate(null, 3), false);
});

test('actualización: se descartan datos raros y enlaces de otros sitios', () => {
  assert.equal(parseVersionInfo(null, SITE), null);
  assert.equal(parseVersionInfo('hola', SITE), null);
  assert.equal(parseVersionInfo({ ...good, versionCode: 'nueve' }, SITE), null);
  assert.equal(parseVersionInfo({ ...good, versionCode: -1 }, SITE), null);
  assert.equal(parseVersionInfo({ ...good, apk: 'https://otro.sitio/virus.apk' }, SITE), null);
  assert.equal(parseVersionInfo({ ...good, versionName: '<>' }, SITE), null);
  const dirty = parseVersionInfo({ ...good, notes: '<script>alert(1)</script>' + 'x'.repeat(400) }, SITE);
  assert.ok(dirty && !dirty.notes.includes('<') && dirty.notes.length <= 280);
});

test('música: cada tema tiene una melodía que encaja en sus compases', () => {
  for (const [id, tr] of Object.entries(TRACKS)) {
    assert.ok(tr.bpm >= 60 && tr.bpm <= 180, id);
    assert.ok(tr.chords.length > 0, id);
    assert.equal(tr.arp.length, 8, `${id}: arpegio de 8 corcheas`);
    assert.ok(tr.arp.every((i) => i >= 0 && i <= 5), id);
    if (tr.melody.length) assert.equal(tr.melody.length, tr.chords.length * 8, `${id}: melodía completa`);
    assert.ok(tr.melody.every((n) => n === null || (n >= 55 && n <= 96)), `${id}: notas en un registro agradable`);
    for (const list of [tr.bass, tr.hat, tr.kick]) assert.ok(list.every((p) => p >= 0 && p < 8), id);
  }
});

test('música: acordes, afinación y tonalidad por mundo', () => {
  assert.deepEqual(chordTones(60, 'M'), [60, 64, 67, 72, 76, 79]);
  assert.deepEqual(chordTones(57, 'm'), [57, 60, 64, 69, 72, 76]);
  assert.equal(midiToHz(69), 440);
  assert.ok(Math.abs(midiToHz(60) - 261.63) < 0.01);
  assert.equal(transposeFor(null), 0);
  assert.equal(transposeFor(1), 0);
  assert.notEqual(transposeFor(2), transposeFor(1));
});

test('música: qué tema suena en cada pantalla', () => {
  assert.deepEqual(trackFor('map', null, null), { id: 'mapa', shift: 0 });
  assert.equal(trackFor('play', 'sprint', null).id, 'contrarreloj');
  assert.equal(trackFor('play', 'level', 3).id, 'juego');
  assert.equal(trackFor('play', 'level', 3).shift, transposeFor(3));
  assert.equal(trackFor('placement', null, 2).id, 'juego');
  assert.equal(trackFor('sleep', null, null).id, null, 'en la pantalla de descanso no hay música');
});

test('ajustes: la música está encendida por defecto y se conserva al cargar', () => {
  const p = newProfile({ nickname: 'Ana', avatar: '🦁', mascot: '🦊', ageBand: '5-6' }, '2026-11-02', 'p1');
  assert.equal(p.settings.music, true);
  p.settings.music = false;
  const back = parseSave(JSON.stringify({ version: 1, activeId: 'p1', profiles: [p] }))!.profiles[0]!;
  assert.equal(back.settings.music, false);
  const old = parseSave(JSON.stringify({ version: 1, activeId: null, profiles: [{ id: 'x', nickname: 'Viejo', settings: { sound: true } }] }))!.profiles[0]!;
  assert.equal(old.settings.music, true);
});
