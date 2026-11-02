import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_REGIONS, GUARDIAN_PASS_COUNT, GUARDIAN_QUESTIONS, QUESTIONS_PER_LEVEL, WORLDS, findRegion } from '../src/data/worlds.ts';
import { COSTUMES } from '../src/data/shop.ts';
import { buildGuardianQuestions, buildLevelQuestions, buildPlacementQuestions, buildReviewQuestions } from '../src/engine/builders.ts';
import { addDays, daysBetween, weekKey } from '../src/engine/dates.ts';
import { afterGuardian, afterPractice, afterReview } from '../src/engine/mastery.ts';
import {
  applyOutcome,
  applyPlacement,
  buyItem,
  claimChest,
  dueSkills,
  equipCostume,
  isGuardianUnlocked,
  isLevelUnlocked,
  isRegionUnlocked,
  isWorldUnlocked,
  type LevelRef,
} from '../src/engine/progress.ts';
import { SKILLS, getSkill } from '../src/engine/questions.ts';
import { createRng } from '../src/engine/rng.ts';
import {
  MemoryStore,
  SAVE_KEY,
  emptySave,
  loadSave,
  newProfile,
  parseSave,
  persist,
  recordAttempt,
  regionProgress,
  registerPlayDay,
  skillProgress,
} from '../src/engine/save.ts';
import { Session, isCorrect } from '../src/engine/session.ts';
import { parseNumberInput } from '../src/engine/input.ts';

const TODAY = '2026-11-02'; // lunes
const rng = () => createRng(2026);
const profile = () => newProfile({ nickname: 'Luna', avatar: '🦁', mascot: '🦊', ageBand: '5-6' }, TODAY, 'p1');

/** Juega una sesión respondiendo bien o mal según `wrongAt`. */
function play(session: Session, wrongAt: number[] = []) {
  const r = createRng(1);
  while (!session.finished) {
    const q = session.current;
    const wrong = q.choices.find((c) => c !== q.answer) as string;
    session.answer(wrongAt.includes(session.index) ? wrong : q.answer);
    if (!session.finished) session.next();
  }
  void r;
  return session.outcome();
}

/* ───────────── Datos ───────────── */

test('datos: cada región apunta a habilidades que existen y los ids son únicos', () => {
  const ids = new Set(ALL_REGIONS.map((r) => r.id));
  assert.equal(ids.size, ALL_REGIONS.length);
  for (const r of ALL_REGIONS) for (const s of r.skillIds) assert.doesNotThrow(() => getSkill(s));
  const used = new Set(ALL_REGIONS.flatMap((r) => r.skillIds));
  for (const s of SKILLS) assert.ok(used.has(s.id), `${s.id} no se usa en ningún mundo`);
  assert.equal(WORLDS.length, 11);
  assert.equal(GUARDIAN_PASS_COUNT, 9);
});

/* ───────────── Dominio ───────────── */

test('dominio: 70 % es Familiar, 100 % es Competente y la práctica no baja el estado', () => {
  assert.equal(afterPractice('none', 5, 8), 'attempted');
  assert.equal(afterPractice('none', 6, 8), 'familiar'); // 75 %
  assert.equal(afterPractice('familiar', 8, 8), 'proficient');
  assert.equal(afterPractice('mastered', 2, 8), 'mastered');
  assert.equal(afterPractice('proficient', 6, 8), 'proficient');
});

test('dominio: el Guardián certifica y el repaso espaciado sube o baja un escalón', () => {
  assert.equal(afterGuardian('familiar', true), 'proficient');
  assert.equal(afterGuardian('none', false), 'attempted');
  assert.equal(afterReview('proficient', true), 'mastered');
  assert.equal(afterReview('mastered', false), 'familiar');
  assert.equal(afterReview('proficient', false), 'familiar');
  assert.equal(afterReview('attempted', false), 'attempted');
});

/* ───────────── Fechas ───────────── */

test('fechas: sumar días, diferencias y semana en lunes', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2);
  assert.equal(weekKey('2026-11-08'), '2026-11-02'); // domingo → lunes anterior
  assert.equal(weekKey('2026-11-02'), '2026-11-02');
});

/* ───────────── Constructores de preguntas ───────────── */

test('constructores: tamaños, repetidos y mezcla del Guardián', () => {
  const region = findRegion('w2r3');
  const level = buildLevelQuestions(rng(), region.region, 1);
  assert.equal(level.length, QUESTIONS_PER_LEVEL);
  assert.ok(level.every((q) => q.skillId === 'tensOnes'));
  const keys = new Set(level.map((q) => q.prompt + (q.visual ?? '')));
  assert.ok(keys.size >= QUESTIONS_PER_LEVEL - 1, 'casi sin repeticiones');

  const guardian = buildGuardianQuestions(rng(), region.world, region.index);
  assert.equal(guardian.length, GUARDIAN_QUESTIONS);
  assert.equal(guardian.filter((q) => q.skillId === 'tensOnes').length, 7);
  assert.equal(guardian.filter((q) => q.skillId !== 'tensOnes').length, 3);
  const first = findRegion('w2r1');
  assert.ok(buildGuardianQuestions(rng(), first.world, 0).every((q) => q.skillId === 'add20'));

  const review = buildReviewQuestions(rng(), ['add10', 'sub10']);
  assert.equal(review.length, 5);
  assert.deepEqual([...new Set(review.map((q) => q.skillId))].sort(), ['add10', 'sub10']);
});

/* ───────────── Sesión ───────────── */

test('sesión: todo bien da 3 estrellas y un combo Chispa a las 3 seguidas', () => {
  const region = findRegion('w1r1').region;
  const s = new Session('level', buildLevelQuestions(rng(), region, 0));
  const events: Array<string | null> = [];
  while (!s.finished) {
    events.push(s.answer(s.current.answer).combo);
    if (!s.finished) s.next();
  }
  assert.equal(events[2], 'chispa');
  assert.equal(events[4], 'rayo');
  assert.equal(events[5], 'chispa', 'la Chispa vuelve a las 6 seguidas');
  const o = s.outcome();
  assert.equal(o.stars, 3);
  assert.equal(o.perfect, true);
  assert.equal(o.chispaBonus, 2); // respuestas 4 y 7, las que siguen a una Chispa
});

test('sesión: cada error quita un corazón, tres errores pierden el nivel', () => {
  const region = findRegion('w1r1').region;
  const s = new Session('level', buildLevelQuestions(rng(), region, 0));
  const o = play(s, [0, 1, 2]);
  assert.equal(o.lost, true);
  assert.equal(o.stars, 0);
  assert.equal(o.answered, 3);
  assert.equal(s.hearts, 0);
});

test('sesión: estrellas según errores y Rayo devuelve un corazón', () => {
  const region = findRegion('w1r2').region;
  assert.equal(play(new Session('level', buildLevelQuestions(rng(), region, 0)), [3]).stars, 2);
  assert.equal(play(new Session('level', buildLevelQuestions(rng(), region, 0)), [3, 6]).stars, 1);
  const s = new Session('level', buildLevelQuestions(rng(), region, 0));
  s.answer('x'); // error → 2 corazones
  s.next();
  for (let i = 0; i < 5; i++) {
    s.answer(s.current.answer);
    if (i < 4) s.next();
  }
  assert.equal(s.hearts, 3, 'el Rayo de la quinta seguida devuelve el corazón');
});

test('sesión: el Escudo protege el combo y la Lupa deja la correcta y otra más', () => {
  const region = findRegion('w1r4').region;
  const s = new Session('level', buildLevelQuestions(rng(), region, 2));
  s.answer(s.current.answer);
  s.next();
  assert.equal(s.useEscudo(), true);
  assert.equal(s.useEscudo(), false, 'solo una vez por nivel');
  s.answer('no');
  assert.equal(s.streak, 1, 'el combo no se rompe');
  s.next();
  s.answer('no');
  assert.equal(s.streak, 0);
  s.next();
  const removed = s.useLupa(createRng(5));
  assert.equal(removed.length, 2);
  assert.ok(!removed.includes(s.current.answer));
  assert.ok(s.current.choices.filter((c) => !s.eliminated.has(c)).length >= 2);
  assert.equal(s.usePista(), s.current.hint);
});

test('sesión: Guardián y repaso no admiten potenciadores ni corazones', () => {
  const { world, index } = findRegion('w1r3');
  const g = new Session('guardian', buildGuardianQuestions(rng(), world, index));
  assert.equal(g.useLupa(rng()).length, 0);
  assert.equal(g.usePista(), '');
  assert.equal(g.useEscudo(), false);
  const o = play(g, [0, 1, 2, 3]);
  assert.equal(o.lost, false);
  assert.equal(o.answered, GUARDIAN_QUESTIONS);
  assert.equal(o.passed, false);
  assert.equal(o.missed.length, 4);
});

test('sesión: el Guardián se aprueba con 9 de 10', () => {
  const { world, index } = findRegion('w1r3');
  assert.equal(play(new Session('guardian', buildGuardianQuestions(rng(), world, index)), [4]).passed, true);
  assert.equal(play(new Session('guardian', buildGuardianQuestions(rng(), world, index)), [4, 5]).passed, false);
});

test('sesión: no se puede responder dos veces la misma pregunta', () => {
  const region = findRegion('w1r1').region;
  const s = new Session('level', buildLevelQuestions(rng(), region, 0));
  s.answer(s.current.answer);
  const again = s.answer('lo que sea');
  assert.equal(again.correct, false);
  assert.equal(s.records.length, 1);
  assert.equal(s.mistakes, 0);
});

/* ───────────── Progreso ───────────── */

function completeLevel(p: ReturnType<typeof profile>, regionId: string, level: number, wrongAt: number[] = []) {
  const { region } = findRegion(regionId);
  const s = new Session('level', buildLevelQuestions(rng(), region, level));
  const o = play(s, wrongAt);
  for (const r of s.records) recordAttempt(p, r.question.skillId, r.correct, TODAY);
  return applyOutcome(p, { kind: 'level', regionId, level }, o, rng(), TODAY);
}

function passGuardian(p: ReturnType<typeof profile>, regionId: string, wrongAt: number[] = []) {
  const { world, index } = findRegion(regionId);
  const s = new Session('guardian', buildGuardianQuestions(rng(), world, index));
  const o = play(s, wrongAt);
  for (const r of s.records) recordAttempt(p, r.question.skillId, r.correct, TODAY);
  return { reward: applyOutcome(p, { kind: 'guardian', regionId }, o, rng(), TODAY), outcome: o };
}

test('progreso: el orden de desbloqueo exige estrellas y el Guardián', () => {
  const p = profile();
  assert.equal(isWorldUnlocked(p, 1), true);
  assert.equal(isWorldUnlocked(p, 2), false);
  assert.equal(isRegionUnlocked(p, 'w1r1'), true);
  assert.equal(isRegionUnlocked(p, 'w1r2'), false);
  assert.equal(isLevelUnlocked(p, 'w1r1', 0), true);
  assert.equal(isLevelUnlocked(p, 'w1r1', 1), false);
  assert.equal(isGuardianUnlocked(p, 'w1r1'), false);

  completeLevel(p, 'w1r1', 0);
  assert.equal(isLevelUnlocked(p, 'w1r1', 1), true);
  completeLevel(p, 'w1r1', 1);
  completeLevel(p, 'w1r1', 2);
  assert.equal(isGuardianUnlocked(p, 'w1r1'), true);
  assert.equal(isRegionUnlocked(p, 'w1r2'), false, 'sin Guardián no se abre la siguiente región');

  passGuardian(p, 'w1r1');
  assert.equal(isRegionUnlocked(p, 'w1r2'), true);
});

test('progreso: un nivel perdido no da estrellas ni desbloquea el siguiente', () => {
  const p = profile();
  const reward = completeLevel(p, 'w1r1', 0, [0, 1, 2]);
  assert.equal(reward.wallet, 0);
  assert.equal(isLevelUnlocked(p, 'w1r1', 1), false);
  assert.equal(skillProgress(p, 'count10').mastery, 'attempted');
});

test('progreso: nivel perfecto da cofre, potenciador y agenda el primer repaso', () => {
  const p = profile();
  const before = p.inventory.lupa + p.inventory.pista + p.inventory.escudo;
  const reward = completeLevel(p, 'w1r1', 0);
  assert.equal(reward.chest, true);
  assert.ok(reward.powerGift);
  assert.equal(p.inventory.lupa + p.inventory.pista + p.inventory.escudo, before + 1);
  assert.equal(p.wallet, 6 + 3 + 2); // 3 estrellas ×2, cofre, 2 bonos de Chispa
  assert.equal(skillProgress(p, 'count10').mastery, 'proficient');
  assert.equal(skillProgress(p, 'count10').nextReview, addDays(TODAY, 1));
  assert.equal(p.streak.days, 1);
});

test('progreso: el Guardián aprobado cierra la región, regala una pista y deja evidencia', () => {
  const p = profile();
  const { reward, outcome } = passGuardian(p, 'w1r1', [3]);
  assert.equal(outcome.passed, true);
  assert.equal(reward.regionCompleted, true);
  assert.equal(reward.powerGift, 'pista');
  assert.equal(p.evidence.length, 1);
  assert.equal(p.evidence[0]?.misses.length, 1);
  assert.equal(p.evidence[0]?.passed, true);
  const again = passGuardian(p, 'w1r1');
  assert.equal(again.reward.regionCompleted, false, 'la recompensa grande solo se da una vez');
});

test('progreso: el Guardián reprobado no desbloquea y guarda qué falló', () => {
  const p = profile();
  const { reward, outcome } = passGuardian(p, 'w1r1', [0, 1]);
  assert.equal(outcome.passed, false);
  assert.equal(reward.regionCompleted, false);
  assert.equal(isRegionUnlocked(p, 'w1r2'), false);
  assert.equal(p.evidence[0]?.misses.length, 2);
  assert.equal(p.regions['w1r1']?.guardianTries, 1);
});

test('progreso: completar el último Guardián abre el mundo siguiente', () => {
  const p = profile();
  for (const r of findRegion('w1r1').world.regions) {
    for (let l = 0; l < 3; l++) completeLevel(p, r.id, l);
    const { reward } = passGuardian(p, r.id);
    assert.equal(reward.worldCompleted, r.id === 'w1r5');
  }
  assert.equal(isWorldUnlocked(p, 2), true);
  assert.equal(isRegionUnlocked(p, 'w2r1'), true);
  assert.equal(isRegionUnlocked(p, 'w2r2'), false);
});

test('repaso espaciado: acertar sube a Dominada y alarga el intervalo; fallar lo baja', () => {
  const p = profile();
  completeLevel(p, 'w1r1', 0);
  assert.deepEqual(dueSkills(p, TODAY), []);
  const tomorrow = addDays(TODAY, 1);
  assert.deepEqual(dueSkills(p, tomorrow), ['count10']);

  const ref: LevelRef = { kind: 'review', skillIds: ['count10'] };
  const good = new Session('review', buildReviewQuestions(rng(), ['count10']));
  applyOutcome(p, ref, play(good), rng(), tomorrow);
  assert.equal(skillProgress(p, 'count10').mastery, 'mastered');
  assert.equal(skillProgress(p, 'count10').nextReview, addDays(tomorrow, 3));

  const later = addDays(tomorrow, 3);
  const bad = new Session('review', buildReviewQuestions(rng(), ['count10']));
  applyOutcome(p, ref, play(bad, [2]), rng(), later);
  assert.equal(skillProgress(p, 'count10').mastery, 'familiar');
  assert.equal(skillProgress(p, 'count10').reviewStep, 0);
  assert.equal(skillProgress(p, 'count10').nextReview, addDays(later, 1));
});

/* ───────────── Economía ───────────── */

test('economía: cofre diario una vez al día; tienda solo con estrellas', () => {
  const p = profile();
  const chest = claimChest(p, TODAY, rng());
  assert.ok(chest);
  assert.equal(p.wallet, 3);
  assert.equal(claimChest(p, TODAY, rng()), null);
  assert.ok(claimChest(p, addDays(TODAY, 1), rng()));

  p.wallet = 20;
  assert.equal(buyItem(p, 'gorra'), 'ok');
  assert.equal(p.wallet, 5);
  assert.equal(p.costumeEquipped, 'gorra');
  assert.equal(buyItem(p, 'gorra'), 'owned');
  assert.equal(buyItem(p, 'corona'), 'poor');
  assert.equal(buyItem(p, 'no-existe'), 'unknown');
  assert.equal(equipCostume(p, 'corona'), false);
  assert.equal(equipCostume(p, null), true);
  assert.equal(p.costumeEquipped, null);
  assert.ok(COSTUMES.every((c) => c.cost > 0));
});

test('racha: suma días seguidos y un congelador semanal cubre un día perdido', () => {
  const p = profile();
  registerPlayDay(p, '2026-11-02');
  registerPlayDay(p, '2026-11-02');
  assert.equal(p.streak.days, 1);
  registerPlayDay(p, '2026-11-03');
  assert.equal(p.streak.days, 2);
  registerPlayDay(p, '2026-11-05'); // faltó el 4: el congelador la salva
  assert.equal(p.streak.days, 3);
  assert.equal(p.streak.freezes, 0);
  registerPlayDay(p, '2026-11-07'); // faltó el 6 y ya no hay congelador
  assert.equal(p.streak.days, 1);
  registerPlayDay(p, '2026-11-10'); // semana nueva, pero faltaron varios días
  assert.equal(p.streak.days, 1);
  assert.equal(p.streak.freezes, 1);
});

/* ───────────── Guardado ───────────── */

test('guardado: ida y vuelta conserva el progreso', () => {
  const store = new MemoryStore();
  const save = emptySave();
  const p = profile();
  completeLevel(p, 'w1r1', 0);
  save.profiles.push(p);
  save.activeId = p.id;
  assert.equal(persist(store, save), true);
  const back = loadSave(store);
  assert.deepEqual(back, save);
});

test('guardado: un archivo dañado no rompe el juego y se conserva una copia', () => {
  const store = new MemoryStore();
  store.setItem(SAVE_KEY, '{"version": 1, "profiles": [');
  const loaded = loadSave(store);
  assert.deepEqual(loaded, emptySave());
  assert.equal(store.getItem(`${SAVE_KEY}:corrupt`), '{"version": 1, "profiles": [');
});

test('guardado: importar valida la forma, limpia el apodo y completa campos nuevos', () => {
  assert.equal(parseSave('no es json'), null);
  assert.equal(parseSave('{"version":1,"profiles":[{"nickname":3}]}'), null);
  const parsed = parseSave(
    JSON.stringify({ version: 1, activeId: 'a', profiles: [{ id: 'a', nickname: '<b>Ana</b>\u0000', wallet: 7 }] }),
  );
  assert.ok(parsed);
  const p = parsed.profiles[0];
  assert.equal(p?.nickname, 'bAna/b');
  assert.equal(p?.wallet, 7);
  assert.deepEqual(p?.inventory, { lupa: 2, pista: 1, escudo: 1 });
  assert.equal(parsed.activeId, 'a');
});

test('guardado: máximo 4 perfiles y apodo con límite de 12 caracteres', () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, nickname: 'x'.repeat(30) }));
  const parsed = parseSave(JSON.stringify({ version: 1, profiles: many }));
  assert.equal(parsed?.profiles.length, 4);
  assert.equal(parsed?.profiles[0]?.nickname.length, 12);
});

test('recordAttempt guarda el intento al instante y marca la habilidad como intentada', () => {
  const p = profile();
  recordAttempt(p, 'add10', false, TODAY);
  recordAttempt(p, 'add10', true, TODAY);
  const s = skillProgress(p, 'add10');
  assert.deepEqual([s.attempts, s.correct, s.mastery, s.last], [2, 1, 'attempted', TODAY]);
});

/* ───────────── Prueba de nivel ───────────── */

test('prueba de nivel: una pregunta por región de cada mundo, de su propia habilidad', () => {
  for (const world of WORLDS) {
    const qs = buildPlacementQuestions(rng(), world);
    assert.deepEqual(qs.map((q) => q.skillId), world.regions.map((r) => r.skillIds[0]));
  }
});

test('prueba de nivel: abre los mundos superados sin regalar estrellas y agenda repasos escalonados', () => {
  const p = profile();
  applyPlacement(p, 2, [5, 4, 2], TODAY);
  assert.equal(isWorldUnlocked(p, 3), true);
  assert.equal(isWorldUnlocked(p, 4), false);
  assert.equal(isRegionUnlocked(p, 'w3r1'), true);
  assert.equal(p.wallet, 0);
  assert.deepEqual(p.placement, { date: TODAY, placed: 2, scores: [5, 4, 2] });
  assert.equal(skillProgress(p, 'count10').mastery, 'familiar');
  assert.equal(skillProgress(p, 'count10').nextReview, addDays(TODAY, 1));
  assert.equal(skillProgress(p, 'sub10').nextReview, addDays(TODAY, 1)); // 5.ª habilidad
  assert.equal(skillProgress(p, 'add20').nextReview, addDays(TODAY, 2)); // 6.ª habilidad
  assert.equal(skillProgress(p, 'add100').mastery, 'none', 'lo no superado no se toca');
  // El repaso del día siguiente solo trae 5 habilidades, no las 10.
  assert.equal(dueSkills(p, addDays(TODAY, 1)).length, 5);
  assert.equal(dueSkills(p, TODAY).length, 0);
});

test('prueba de nivel: nunca baja el progreso que ya había', () => {
  const p = profile();
  completeLevel(p, 'w1r1', 0);
  completeLevel(p, 'w1r1', 1);
  const stars = [...regionProgress(p, 'w1r1').levels];
  passGuardian(p, 'w1r1');
  const before = skillProgress(p, 'count10');
  const review = before.nextReview;
  const mastery = before.mastery;
  applyPlacement(p, 1, [5], TODAY);
  assert.equal(skillProgress(p, 'count10').mastery, mastery);
  assert.equal(skillProgress(p, 'count10').nextReview, review);
  assert.ok(regionProgress(p, 'w1r1').levels.every((l, i) => l >= (stars[i] ?? 0)));
});

test('prueba de nivel: se conserva al guardar y se sanea al cargar', () => {
  const p = profile();
  applyPlacement(p, 1, [5, 3], TODAY);
  const save = { ...emptySave(), profiles: [p], activeId: p.id };
  assert.deepEqual(parseSave(JSON.stringify(save))?.profiles[0]?.placement, p.placement);
  const broken = JSON.parse(JSON.stringify(save));
  broken.profiles[0].placement = { placed: 'mucho', date: 3 };
  assert.equal(parseSave(JSON.stringify(broken))?.profiles[0]?.placement, null);
});

/* ───────────── Respuesta escrita ───────────── */

test('respuesta escrita: acepta espacios, el signo menos raro y la coma, y rechaza lo que no es número', () => {
  const q = { skillId: 'eq1', prompt: 'x', choices: [], answer: '12', input: 'number' as const, hint: 'h', meta: {} };
  assert.equal(isCorrect(q, '12'), true);
  assert.equal(isCorrect(q, ' 12 '), true);
  assert.equal(isCorrect(q, '12,0'), true);
  assert.equal(isCorrect(q, '13'), false);
  assert.equal(isCorrect(q, ''), false);
  assert.equal(isCorrect(q, 'doce'), false);
  assert.equal(isCorrect(q, '1 2'), true, 'los espacios internos se ignoran');
  assert.equal(parseNumberInput('−5'), -5);
  assert.equal(parseNumberInput('3,5'), 3.5);
  assert.equal(parseNumberInput('abc'), null);
  assert.equal(parseNumberInput('1e3'), null);
  const choose = { ...q, input: undefined, choices: ['12', '13'] };
  assert.equal(isCorrect(choose as never, '12'), true);
  assert.equal(isCorrect(choose as never, '12.0'), false, 'elegir exige el texto exacto');
});

test('respuesta escrita: una sesión con preguntas escritas puntúa, usa Pista y no gasta la Lupa', () => {
  const region = findRegion('w8r3').region;
  const s = new Session('level', buildLevelQuestions(rng(), region, 2));
  assert.equal(s.current.input, 'number');
  assert.deepEqual(s.useLupa(rng()), [], 'no hay opciones que tachar');
  assert.equal(s.canUse('lupa'), false, 'con respuesta escrita la Lupa no aplica');
  assert.equal(s.canUse('pista'), true);
  assert.ok(s.usePista().length > 3);
  assert.equal(s.answer(` ${s.current.answer} `).correct, true);
  s.next();
  assert.equal(s.answer('999').correct, false);
  assert.equal(s.mistakes, 1);
});
