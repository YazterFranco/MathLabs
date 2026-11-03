import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ENERGY, SPRINT_MAX_STARS, SPRINT_QUESTIONS, WORLDS, findRegion } from '../src/data/worlds.ts';
import { ACHIEVEMENTS, ACHIEVEMENT_STARS, checkAchievements, noteAnswer } from '../src/engine/achievements.ts';
import { buildLevelQuestions, buildSprintQuestions } from '../src/engine/builders.ts';
import { adjustEnergy } from '../src/engine/energy.ts';
import { applyOutcome, nextStep } from '../src/engine/progress.ts';
import { QUESTS, QUESTS_PER_DAY, QUEST_BONUS_STARS, QUEST_REWARD, claimQuest, ensureQuests, questsFor, trackQuests } from '../src/engine/quests.ts';
import { createRng } from '../src/engine/rng.ts';
import { newProfile, parseSave, regionProgress } from '../src/engine/save.ts';
import { Session } from '../src/engine/session.ts';

const TODAY = '2026-11-02';
const T0 = 1_800_000_000_000;
const rng = () => createRng(5);
const profile = (id = 'p1') => newProfile({ nickname: 'Sol', avatar: '🦁', mascot: '🦊', ageBand: '9+' }, TODAY, id);

function run(session: Session, wrongAt: number[] = []) {
  while (!session.finished) {
    const q = session.current;
    const wrong = q.choices.find((c) => c !== q.answer) ?? 'x';
    session.answer(wrongAt.includes(session.index) ? wrong : q.answer);
    if (!session.finished) session.next();
  }
  return session.outcome();
}

/* ───────────── Seguir jugando ───────────── */

test('seguir jugando: empieza en el primer nivel y avanza por niveles, Guardián y regiones', () => {
  const p = profile();
  assert.deepEqual(nextStep(p), { kind: 'level', regionId: 'w1r1', level: 0 });
  regionProgress(p, 'w1r1').levels = [3, 1, 0];
  assert.deepEqual(nextStep(p), { kind: 'level', regionId: 'w1r1', level: 2 });
  regionProgress(p, 'w1r1').levels = [3, 1, 2];
  assert.deepEqual(nextStep(p), { kind: 'guardian', regionId: 'w1r1' });
  regionProgress(p, 'w1r1').guardianPassed = true;
  assert.deepEqual(nextStep(p), { kind: 'level', regionId: 'w1r2', level: 0 });
});

test('seguir jugando: con todo vencido no queda nada pendiente', () => {
  const p = profile();
  for (const w of WORLDS) for (const r of w.regions) Object.assign(regionProgress(p, r.id), { levels: [1, 1, 1], guardianPassed: true });
  assert.equal(nextStep(p), null);
});

/* ───────────── Misiones del día ───────────── */

test('misiones: tres distintas, iguales todo el día y cambian otro día', () => {
  const a = questsFor('p1', TODAY);
  assert.equal(a.length, QUESTS_PER_DAY);
  assert.equal(new Set(a.map((q) => q.id)).size, QUESTS_PER_DAY);
  assert.deepEqual(questsFor('p1', TODAY), a);
  const days = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => questsFor('p1', d).map((q) => q.id).join());
  assert.ok(new Set([a.map((q) => q.id).join(), ...days]).size > 1, 'no deben repetirse siempre');
  const p = profile();
  const day = ensureQuests(p, TODAY);
  assert.equal(ensureQuests(p, TODAY), day, 'el mismo día no se regeneran');
  assert.notEqual(ensureQuests(p, '2026-11-03').day, TODAY);
});

test('misiones: los eventos suman progreso y se cobran una sola vez', () => {
  const p = profile();
  p.quests = {
    day: TODAY,
    bonusClaimed: false,
    items: [
      { id: 'answer', goal: QUESTS.answer.goal, progress: 0, claimed: false },
      { id: 'streak', goal: QUESTS.streak.goal, progress: 0, claimed: false },
      { id: 'levels', goal: QUESTS.levels.goal, progress: 0, claimed: false },
    ],
  };
  adjustEnergy(p, -3, T0);
  for (let i = 1; i <= 4; i++) trackQuests(p, TODAY, { type: 'answer', correct: true, streak: i });
  assert.equal(p.quests.items[1]!.progress, 4);
  trackQuests(p, TODAY, { type: 'answer', correct: false, streak: 0 });
  assert.equal(p.quests.items[1]!.progress, 4, 'la mejor racha no baja');
  const done = trackQuests(p, TODAY, { type: 'answer', correct: true, streak: 5 });
  assert.deepEqual(done.map((q) => q.id), ['streak']);
  assert.equal(claimQuest(p, 0, TODAY, rng(), T0), null, 'sin terminar no se cobra');
  const wallet = p.wallet;
  const claim = claimQuest(p, 1, TODAY, rng(), T0);
  assert.deepEqual(claim, { stars: QUEST_REWARD.stars, energy: 1, bonusPower: null });
  assert.equal(p.wallet, wallet + QUEST_REWARD.stars);
  assert.equal(p.energy, 3);
  assert.equal(claimQuest(p, 1, TODAY, rng(), T0), null, 'no se cobra dos veces');
  assert.equal(p.stats.questsDone, 1);
});

test('misiones: cobrar las tres da el cofre de misiones', () => {
  const p = profile();
  p.quests = {
    day: TODAY,
    bonusClaimed: false,
    items: [
      { id: 'sprint', goal: 1, progress: 0, claimed: false },
      { id: 'perfect', goal: 1, progress: 0, claimed: false },
      { id: 'speed', goal: 1, progress: 0, claimed: false },
    ],
  };
  trackQuests(p, TODAY, { type: 'sprint' });
  trackQuests(p, TODAY, { type: 'level', perfect: true, speed: true });
  const powers = p.inventory.lupa + p.inventory.pista + p.inventory.escudo;
  assert.equal(claimQuest(p, 0, TODAY, rng(), T0)?.bonusPower, null);
  assert.equal(claimQuest(p, 1, TODAY, rng(), T0)?.bonusPower, null);
  const last = claimQuest(p, 2, TODAY, rng(), T0);
  assert.ok(last?.bonusPower);
  assert.equal(last?.stars, QUEST_REWARD.stars + QUEST_BONUS_STARS);
  assert.equal(last?.energy, 0, 'con la energía llena no se suma');
  assert.equal(p.energy, MAX_ENERGY);
  assert.equal(p.inventory.lupa + p.inventory.pista + p.inventory.escudo, powers + 1);
});

/* ───────────── Logros ───────────── */

test('logros: ids únicos y metas positivas', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  assert.ok(ACHIEVEMENTS.every((a) => a.goal > 0 && /^[a-z0-9-]+$/.test(a.id)));
});

test('logros: se ganan una vez, con estrellas, y cuentan aciertos y rachas', () => {
  const p = profile();
  assert.deepEqual(checkAchievements(p), []);
  for (let i = 1; i <= 8; i++) noteAnswer(p, true, i);
  noteAnswer(p, false, 0);
  assert.equal(p.stats.answered, 9);
  assert.equal(p.stats.correct, 8);
  assert.equal(p.stats.bestStreak, 8);
  const fresh = checkAchievements(p);
  assert.deepEqual(fresh.map((a) => a.id), ['imparable']);
  assert.equal(p.wallet, ACHIEVEMENT_STARS);
  assert.deepEqual(checkAchievements(p), [], 'no se repite');
});

test('logros: un nivel completo y perfecto desbloquea Primeros pasos y Perfección', () => {
  const p = profile();
  const s = new Session('level', buildLevelQuestions(rng(), findRegion('w1r1').region, 0));
  applyOutcome(p, { kind: 'level', regionId: 'w1r1', level: 0 }, run(s), rng(), TODAY, { nowMs: T0 });
  assert.equal(p.stats.levels, 1);
  assert.equal(p.stats.perfects, 1);
  const ids = checkAchievements(p).map((a) => a.id);
  assert.ok(ids.includes('primer-nivel') && ids.includes('perfecto'));
});

/* ───────────── Contrarreloj ───────────── */

test('contrarreloj: preguntas mezcladas, fáciles primero y sin repetir', () => {
  const qs = buildSprintQuestions(rng(), ['add10', 'sub10', 'compare']);
  assert.equal(qs.length, SPRINT_QUESTIONS);
  assert.ok(qs.slice(0, 8).every((q) => q.difficulty === 1));
  assert.ok(qs.slice(8).every((q) => q.difficulty === 2));
  assert.equal(new Set(qs.map((q) => q.skillId)).size, 3);
});

test('contrarreloj: al acabarse el tiempo cuenta lo respondido y guarda el récord', () => {
  const p = profile();
  const s = new Session('review', buildSprintQuestions(rng(), ['add10']));
  for (let i = 0; i < 6; i++) {
    s.answer(i === 2 ? 'x' : s.current.answer);
    s.next();
  }
  s.stop();
  assert.equal(s.finished, true);
  assert.equal(s.answer(s.current.answer).correct, false, 'después del tiempo no se responde');
  const o = s.outcome();
  assert.equal(o.correct, 5);
  const r1 = applyOutcome(p, { kind: 'sprint' }, o, rng(), TODAY, { nowMs: T0 });
  assert.equal(r1.wallet, 5);
  assert.equal(r1.sprintRecord, true);
  assert.equal(p.stats.sprintBest, 5);
  const r2 = applyOutcome(p, { kind: 'sprint' }, { ...o, correct: 3 }, rng(), TODAY, { nowMs: T0 });
  assert.equal(r2.sprintRecord, false);
  assert.equal(p.stats.sprintBest, 5);
  const r3 = applyOutcome(p, { kind: 'sprint' }, { ...o, correct: 30 }, rng(), TODAY, { nowMs: T0 });
  assert.equal(r3.wallet, SPRINT_MAX_STARS, 'las estrellas tienen tope');
  assert.equal(p.stats.sprints, 3);
});

/* ───────────── Guardado ───────────── */

test('guardado: estadísticas, logros, misiones y vibración se limpian al cargar', () => {
  const raw = {
    version: 1,
    activeId: 'p1',
    profiles: [
      {
        id: 'p1',
        nickname: 'Sol',
        stats: { correct: 12.7, answered: -4, levels: 'x', bestStreak: 9 },
        achievements: ['perfecto', 'perfecto', '<script>', 7],
        quests: { day: TODAY, bonusClaimed: 'si', items: [{ id: 'answer', goal: 15, progress: 99, claimed: false }, { id: 'hackear', goal: 1 }] },
      },
    ],
  };
  const p = parseSave(JSON.stringify(raw))!.profiles[0]!;
  assert.equal(p.stats.correct, 12);
  assert.equal(p.stats.answered, 0);
  assert.equal(p.stats.levels, 0);
  assert.equal(p.stats.bestStreak, 9);
  assert.equal(p.stats.sprintBest, 0);
  assert.deepEqual(p.achievements, ['perfecto']);
  assert.equal(p.quests?.items.length, 1);
  assert.equal(p.quests?.items[0]!.progress, 15);
  assert.equal(p.quests?.bonusClaimed, false);
  assert.equal(p.settings.vibrate, true);
  const old = parseSave(JSON.stringify({ version: 1, activeId: null, profiles: [{ id: 'p2', nickname: 'Viejo' }] }))!.profiles[0]!;
  assert.equal(old.quests, null);
  assert.deepEqual(old.achievements, []);
  assert.equal(old.stats.levels, 0);
});
