import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENERGY_REGEN_MS, MAX_ENERGY, WORLD_PRIZE_STARS, WORLDS, findRegion } from '../src/data/worlds.ts';
import { buildGuardianQuestions, buildLevelQuestions, buildRechargeQuestions } from '../src/engine/builders.ts';
import { adjustEnergy, msToNextEnergy, syncEnergy } from '../src/engine/energy.ts';
import { CHEST_ENERGY, applyOutcome, claimChest, rechargeSkillIds } from '../src/engine/progress.ts';
import { createRng } from '../src/engine/rng.ts';
import { MemoryStore, SAVE_KEY, emptySave, loadSave, newProfile, parseSave, persist, regionProgress } from '../src/engine/save.ts';
import { MAX_THINK_MS, Session } from '../src/engine/session.ts';
import { medalTier, worldSummary } from '../src/engine/summary.ts';
import { formatClock, liveTier, parSeconds, speedTier } from '../src/engine/time.ts';

const TODAY = '2026-11-02';
const T0 = 1_800_000_000_000;
const rng = () => createRng(7);
const profile = () => newProfile({ nickname: 'Luna', avatar: '🦁', mascot: '🦊', ageBand: '7-8' }, TODAY, 'p1');

function run(session: Session, wrongAt: number[] = []) {
  while (!session.finished) {
    const q = session.current;
    const wrong = q.choices.find((c) => c !== q.answer) ?? 'x';
    session.answer(wrongAt.includes(session.index) ? wrong : q.answer);
    if (!session.finished) session.next();
  }
  return session.outcome();
}

const levelSession = (regionId: string, level = 0, lives?: { start: number; max: number }) =>
  new Session('level', buildLevelQuestions(rng(), findRegion(regionId).region, level), null, lives);

/* ───────────── Energía ───────────── */

test('energía: un perfil nuevo empieza con la energía llena', () => {
  const p = profile();
  assert.equal(p.energy, MAX_ENERGY);
  assert.deepEqual(p.medals, []);
});

test('energía: gastar una arranca la recarga y vuelve sola cada 5 minutos', () => {
  const p = profile();
  assert.equal(adjustEnergy(p, -3, T0), -3);
  assert.equal(p.energy, 2);
  assert.equal(msToNextEnergy(p, T0), ENERGY_REGEN_MS);
  syncEnergy(p, T0 + ENERGY_REGEN_MS - 1);
  assert.equal(p.energy, 2, 'todavía no pasó el tiempo');
  syncEnergy(p, T0 + ENERGY_REGEN_MS);
  assert.equal(p.energy, 3);
  syncEnergy(p, T0 + ENERGY_REGEN_MS * 10);
  assert.equal(p.energy, MAX_ENERGY, 'nunca pasa del máximo');
  assert.equal(msToNextEnergy(p, T0 + ENERGY_REGEN_MS * 10), null);
});

test('energía: el tiempo parcial no se pierde al ganar otra energía de golpe', () => {
  const p = profile();
  adjustEnergy(p, -MAX_ENERGY, T0);
  syncEnergy(p, T0 + ENERGY_REGEN_MS * 2 + 60_000);
  assert.equal(p.energy, 2);
  assert.equal(msToNextEnergy(p, T0 + ENERGY_REGEN_MS * 2 + 60_000), ENERGY_REGEN_MS - 60_000);
});

test('energía: nunca baja de 0 ni sube de 5, y un reloj atrasado no regala energía', () => {
  const p = profile();
  adjustEnergy(p, -99, T0);
  assert.equal(p.energy, 0);
  assert.equal(adjustEnergy(p, 99, T0), MAX_ENERGY);
  adjustEnergy(p, -2, T0 + 1000);
  syncEnergy(p, T0 - ENERGY_REGEN_MS * 5);
  assert.equal(p.energy, MAX_ENERGY - 2);
});

/* ───────────── Sesión con energía ───────────── */

test('sesión: las vidas arrancan con la energía del niño y el Game Over llega al agotarla', () => {
  const s = levelSession('w1r1', 0, { start: 2, max: MAX_ENERGY });
  assert.equal(s.hearts, 2);
  assert.equal(s.maxHearts, MAX_ENERGY);
  const o = run(s, [0, 1, 2, 3]);
  assert.equal(o.lost, true);
  assert.equal(o.mistakes, 2, 'con 2 energías el nivel se pierde al segundo error');
  assert.equal(o.missed.length, 2, 'los errores quedan para mostrarlos');
});

test('sesión: el Rayo devuelve energía hasta el máximo de la partida', () => {
  const s = levelSession('w1r1', 0, { start: 4, max: MAX_ENERGY });
  for (let i = 0; i < 5; i++) {
    s.answer(s.current.answer);
    if (i < 4) s.next();
  }
  assert.equal(s.hearts, 5);
});

test('sesión: sin parámetros conserva 3 corazones', () => {
  const s = levelSession('w1r1');
  assert.equal(s.hearts, 3);
  assert.equal(s.maxHearts, 3);
});

test('sesión: el tiempo se acumula y una pausa larga cuenta como mucho 60 s', () => {
  const s = levelSession('w1r1');
  s.addTime(5000);
  s.addTime(10 * 60_000);
  s.addTime(-50);
  s.addTime(Number.NaN);
  assert.equal(s.activeMs, 5000 + MAX_THINK_MS);
  assert.equal(run(s).activeMs, 5000 + MAX_THINK_MS);
});

/* ───────────── Tiempo y bonos ───────────── */

test('tiempo: la meta crece con el mundo y con las respuestas escritas', () => {
  const q1 = buildLevelQuestions(rng(), findRegion('w1r1').region, 0);
  assert.equal(parSeconds('w1r1', q1), 8 * 15);
  const typed = { ...q1[0]!, input: 'number' as const };
  assert.equal(parSeconds('w1r1', [typed, ...q1.slice(1)]), 8 * 15 + 10);
  assert.ok(parSeconds('w11r1', q1) > parSeconds('w1r1', q1));
});

test('tiempo: Rayo hasta el 60 % de la meta, Veloz hasta la meta, y solo con 1 error o menos', () => {
  assert.equal(speedTier(60_000, 100, 0, true), 'rayo');
  assert.equal(speedTier(60_001, 100, 0, true), 'veloz');
  assert.equal(speedTier(100_000, 100, 1, true), 'veloz');
  assert.equal(speedTier(100_001, 100, 0, true), null);
  assert.equal(speedTier(10_000, 100, 2, true), null, 'con 2 errores no hay bono');
  assert.equal(speedTier(10_000, 100, 0, false), null, 'sin terminar no hay bono');
  assert.equal(speedTier(10_000, 0, 0, true), null);
  assert.equal(liveTier(10_000, 100), 'rayo');
  assert.equal(liveTier(80_000, 100), 'veloz');
  assert.equal(liveTier(180_000, 100), 'late');
});

test('tiempo: formato m:ss', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(83_000), '1:23');
  assert.equal(formatClock(600_999), '10:00');
  assert.equal(formatClock(-5), '0:00');
});

function finishLevel(p: ReturnType<typeof profile>, regionId: string, level: number, activeMs: number, wrongAt: number[] = []) {
  const s = levelSession(regionId, level);
  const o = run(s, wrongAt);
  const par = parSeconds(regionId, s.questions);
  return { reward: applyOutcome(p, { kind: 'level', regionId, level }, o, rng(), TODAY, { activeMs, parSeconds: par, nowMs: T0 }), par, outcome: o };
}

test('bonos: Rayo da +4 ⭐, +1 ⚡ y un poder (más +1 ⚡ y el cofre por nivel perfecto)', () => {
  const p = profile();
  adjustEnergy(p, -3, T0);
  const powers = p.inventory.lupa + p.inventory.pista + p.inventory.escudo;
  const { reward, par, outcome } = finishLevel(p, 'w1r1', 0, 20_000);
  assert.ok(20 < par * 0.6);
  assert.equal(reward.speed, 'rayo');
  assert.equal(reward.wallet, 3 * 2 + outcome.chispaBonus + 3 + 4, 'estrellas del nivel + Chispas + cofre + bono');
  assert.equal(reward.energyGain, 2, 'nivel perfecto +1 y Rayo +1');
  assert.equal(p.energy, 4);
  assert.equal(p.inventory.lupa + p.inventory.pista + p.inventory.escudo, powers + 1, 'un solo poder, aunque coincidan nivel perfecto y Rayo');
});

test('bonos: Veloz da +2 ⭐ y +1 ⚡; lento no da bono', () => {
  const a = profile();
  adjustEnergy(a, -2, T0);
  const { reward: veloz, par, outcome: vo } = finishLevel(a, 'w1r1', 0, 100_000, [0]);
  assert.ok(100 > par * 0.6 && 100 <= par);
  assert.equal(veloz.speed, 'veloz');
  assert.equal(veloz.energyGain, 1);
  assert.equal(veloz.wallet, 2 * 2 + vo.chispaBonus + 2);

  const b = profile();
  const { reward: slow, outcome: so } = finishLevel(b, 'w1r1', 0, 10 * 60_000);
  assert.equal(slow.speed, null);
  assert.equal(slow.wallet, 3 * 2 + so.chispaBonus + 3);
});

test('bonos: un nivel perdido no gana bonos ni guarda tiempo', () => {
  const p = profile();
  const s = levelSession('w1r1', 0, { start: 1, max: MAX_ENERGY });
  const o = run(s, [0]);
  const reward = applyOutcome(p, { kind: 'level', regionId: 'w1r1', level: 0 }, o, rng(), TODAY, { activeMs: 5000, parSeconds: 120, nowMs: T0 });
  assert.equal(reward.speed, null);
  assert.equal(reward.activeMs, 0);
  assert.equal(regionProgress(p, 'w1r1').best[0], 0);
});

test('mejores tiempos: se guarda el menor y solo es récord al mejorar una marca previa', () => {
  const p = profile();
  const first = finishLevel(p, 'w1r1', 0, 90_000).reward;
  assert.equal(first.newRecord, false, 'la primera vez no es récord, solo marca');
  assert.equal(regionProgress(p, 'w1r1').best[0], 90_000);
  const slower = finishLevel(p, 'w1r1', 0, 95_000).reward;
  assert.equal(slower.newRecord, false);
  assert.equal(regionProgress(p, 'w1r1').best[0], 90_000);
  const faster = finishLevel(p, 'w1r1', 0, 70_000).reward;
  assert.equal(faster.newRecord, true);
  assert.equal(regionProgress(p, 'w1r1').best[0], 70_000);
});

test('energía: el cofre diario regala 2 ⚡', () => {
  const p = profile();
  adjustEnergy(p, -4, T0);
  const chest = claimChest(p, TODAY, rng(), T0);
  assert.equal(chest?.energy, CHEST_ENERGY);
  assert.equal(p.energy, 3);
});

/* ───────────── Recarga practicando ───────────── */

test('recarga: preguntas fáciles de lo que el niño ya probó, sin repetirse', () => {
  const p = profile();
  assert.deepEqual(rechargeSkillIds(p), ['count10'], 'sin historial se usa la primera habilidad');
  p.skills['count10'] = { mastery: 'familiar', attempts: 5, correct: 4, last: TODAY, nextReview: null, reviewStep: 0, recent: '' };
  const qs = buildRechargeQuestions(rng(), rechargeSkillIds(p));
  assert.equal(qs.length, 5);
  assert.ok(qs.every((q) => q.difficulty === 1));
  assert.equal(new Set(qs.map((q) => `${q.prompt}|${q.visual ?? ''}`)).size, 5);
});

test('recarga: una partida de recarga no cambia estrellas ni dominio', () => {
  const p = profile();
  const s = new Session('review', buildRechargeQuestions(rng(), ['count10']));
  const o = run(s);
  const reward = applyOutcome(p, { kind: 'recharge' }, o, rng(), TODAY, { nowMs: T0 });
  assert.equal(reward.wallet, 0);
  assert.deepEqual(reward.masteryChanges, []);
  assert.equal(p.wallet, 0);
});

/* ───────────── Mundo completado ───────────── */

function passGuardianOnly(p: ReturnType<typeof profile>, regionId: string) {
  const { world, index } = findRegion(regionId);
  const s = new Session('guardian', buildGuardianQuestions(rng(), world, index));
  return applyOutcome(p, { kind: 'guardian', regionId }, run(s), rng(), TODAY, { nowMs: T0 });
}

test('mundo: la primera vez que se vence al Guardián final da medalla y premio; después no se repite', () => {
  const p = profile();
  adjustEnergy(p, -4, T0);
  const w1 = WORLDS[0]!;
  const lastId = w1.regions[4]!.id;
  const early = passGuardianOnly(p, w1.regions[0]!.id);
  assert.equal(early.worldPrize, null);
  const stars = p.wallet;
  const powers = { ...p.inventory };
  const reward = passGuardianOnly(p, lastId);
  assert.equal(reward.worldCompleted, true);
  assert.deepEqual(reward.worldPrize, { stars: WORLD_PRIZE_STARS });
  assert.equal(reward.wallet, 10 + WORLD_PRIZE_STARS);
  assert.equal(p.wallet, stars + 10 + WORLD_PRIZE_STARS);
  assert.equal(p.energy, MAX_ENERGY, 'el premio llena la energía');
  assert.deepEqual(p.medals, [1]);
  assert.equal(p.inventory.lupa, powers.lupa + 1 + 0);
  assert.equal(p.inventory.escudo, powers.escudo + 1);
  assert.equal(p.inventory.pista, powers.pista + 1 + 1, 'un poder de cada tipo y la Pista de la región');
  const again = passGuardianOnly(p, lastId);
  assert.equal(again.worldPrize, null);
  assert.deepEqual(p.medals, [1]);
});

test('resumen: totales, medalla y tiempos del mundo', () => {
  const p = profile();
  const w1 = WORLDS[0]!;
  for (const r of w1.regions) {
    const rp = regionProgress(p, r.id);
    rp.levels = [3, 3, 3];
    rp.best = [10_000, 20_000, 30_000];
    rp.guardianBest = 10;
    rp.guardianPassed = true;
  }
  const sum = worldSummary(p, 1);
  assert.equal(sum.stars, 45);
  assert.equal(sum.maxStars, 45);
  assert.equal(sum.tier, 'gold');
  assert.equal(sum.regions[0]!.bestMs, 60_000);
  assert.equal(sum.isFinal, false);
  assert.equal(worldSummary(p, WORLDS.length).isFinal, true);
  assert.equal(medalTier(41, 45), 'gold');
  assert.equal(medalTier(32, 45), 'silver');
  assert.equal(medalTier(31, 45), 'bronze');
  regionProgress(p, w1.regions[1]!.id).best = [10_000, 0, 30_000];
  assert.equal(worldSummary(p, 1).regions[1]!.bestMs, null, 'si falta un tiempo no se suma');
});

/* ───────────── Guardado ───────────── */

test('guardado: un archivo antiguo sin energía ni tiempos se completa con valores por defecto', () => {
  const old = { version: 1, activeId: 'p1', profiles: [{ id: 'p1', nickname: 'Luna', regions: { w1r1: { levels: [3, 0, 0], guardianPassed: false, guardianBest: 0, guardianTries: 0 } } }] };
  const parsed = parseSave(JSON.stringify(old));
  const p = parsed!.profiles[0]!;
  assert.equal(p.energy, MAX_ENERGY);
  assert.equal(p.energyAt, 0);
  assert.deepEqual(p.medals, []);
  assert.deepEqual(regionProgress(p, 'w1r1').best, [0, 0, 0]);
});

test('guardado: valores raros de energía, medallas y tiempos se limpian', () => {
  const dirty = {
    version: 1,
    activeId: 'p1',
    profiles: [
      {
        id: 'p1',
        nickname: 'Luna',
        energy: 99,
        energyAt: 'ayer',
        medals: [1, 1, 'x', 2.5, -3, 4, 999],
        regions: { w1r1: { levels: [3, 3, 3], guardianPassed: true, guardianBest: 9, guardianTries: 1, best: [1234.6, -5, 'no', 9e9] } },
      },
    ],
  };
  const p = parseSave(JSON.stringify(dirty))!.profiles[0]!;
  assert.equal(p.energy, MAX_ENERGY);
  assert.equal(p.energyAt, 0);
  assert.deepEqual(p.medals, [1, 4]);
  assert.deepEqual(regionProgress(p, 'w1r1').best, [1235, 0, 0]);
  const neg = parseSave(JSON.stringify({ ...dirty, profiles: [{ ...dirty.profiles[0], energy: -4 }] }))!.profiles[0]!;
  assert.equal(neg.energy, 0);
});

test('guardado: la energía y las medallas sobreviven a guardar y cargar', () => {
  const store = new MemoryStore();
  const save = emptySave();
  const p = profile();
  adjustEnergy(p, -2, T0);
  p.medals.push(3);
  save.profiles.push(p);
  save.activeId = p.id;
  assert.equal(persist(store, save), true);
  assert.ok(store.getItem(SAVE_KEY));
  const back = loadSave(store).profiles[0]!;
  assert.equal(back.energy, 3);
  assert.equal(back.energyAt, T0);
  assert.deepEqual(back.medals, [3]);
});
