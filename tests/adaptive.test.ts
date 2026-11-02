import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_RECENT, RECENT_WINDOW, needsSupport, nextDifficulty, recentAccuracy, startDifficulty } from '../src/engine/adaptive.ts';
import { buildAdaptiveLevel, buildGuardianQuestions, buildReviewQuestions } from '../src/engine/builders.ts';
import { findRegion } from '../src/data/worlds.ts';
import { dueSkills } from '../src/engine/progress.ts';
import { createRng } from '../src/engine/rng.ts';
import { MemoryStore, emptySave, loadSave, newProfile, parseSave, persist, recordAttempt, skillProgress, type SkillProgress } from '../src/engine/save.ts';
import { Session } from '../src/engine/session.ts';
import type { Difficulty } from '../src/engine/types.ts';

const TODAY = '2026-11-02';
const sp = (recent: string, mastery: SkillProgress['mastery'] = 'attempted'): SkillProgress => ({
  mastery, attempts: recent.length, correct: 0, last: null, nextReview: null, reviewStep: 0, recent,
});
const profile = () => newProfile({ nickname: 'Test', avatar: '🦁', mascot: '🦊', ageBand: '7-8' }, TODAY, 'p1');

test('historial reciente: guarda las últimas 10 respuestas y su precisión', () => {
  const p = profile();
  for (let i = 0; i < 14; i++) recordAttempt(p, 'add20', i % 2 === 0, TODAY);
  const s = skillProgress(p, 'add20');
  assert.equal(s.recent.length, RECENT_WINDOW);
  assert.equal(s.recent, '1010101010');
  assert.equal(s.attempts, 14);
  assert.equal(recentAccuracy(s), 0.5);
  assert.equal(recentAccuracy(sp('1'.repeat(MIN_RECENT - 1))), null, 'con pocas respuestas no se juzga');
  assert.equal(needsSupport(sp('1100000')), true);
  assert.equal(needsSupport(sp('1111100')), false);
});

test('dificultad inicial: base del nivel, con ajuste de un punto según el historial', () => {
  assert.equal(startDifficulty(0, undefined), 1);
  assert.equal(startDifficulty(2, undefined), 3);
  assert.equal(startDifficulty(0, sp('1111111111', 'proficient')), 2, 'habilidad sólida: más reto');
  assert.equal(startDifficulty(2, sp('1111111111', 'mastered')), 3, 'nunca pasa de 3');
  assert.equal(startDifficulty(0, sp('1111111111', 'familiar')), 1, 'sin dominio no sube');
  assert.equal(startDifficulty(1, sp('0010000100')), 1, 'le cuesta mucho: más calma');
  assert.equal(startDifficulty(0, sp('0000000000')), 1, 'nunca baja de 1');
});

test('dificultad en el nivel: 3 aciertos seguidos suben, 2 errores de 3 bajan, siempre a ±1 de la base', () => {
  assert.equal(nextDifficulty(2, 2, [true, true]), 2);
  assert.equal(nextDifficulty(2, 2, [true, true, true]), 3);
  assert.equal(nextDifficulty(2, 3, [true, true, true, true]), 3, 'no pasa de base + 1');
  assert.equal(nextDifficulty(2, 2, [true, false, false]), 1);
  assert.equal(nextDifficulty(2, 1, [false, false, false]), 1, 'no baja de base - 1');
  assert.equal(nextDifficulty(2, 3, [true, true, false]), 3, 'un solo error no baja');
  assert.equal(nextDifficulty(2, 3, [true, false, false]), 2);
  assert.equal(nextDifficulty(1, 1, [false, false]), 1, 'base 1 nunca baja');
  assert.equal(nextDifficulty(3, 3, [true, true, true]), 3, 'base 3 nunca sube');
  assert.equal(nextDifficulty(2, 2, [false, true, false, true, false, true]), 2, 'alternar no cambia nada');
});

/** Juega un nivel adaptativo y devuelve la dificultad de cada pregunta. */
function playLevel(levelIndex: number, answers: boolean[], skill?: SkillProgress, seed = 5): Difficulty[] {
  const { region } = findRegion('w3r1');
  const { questions, base, adapt } = buildAdaptiveLevel(createRng(seed), region, levelIndex, skill);
  const s = new Session('level', questions, adapt);
  s.baseDifficulty = base;
  const seen: Difficulty[] = [];
  for (let i = 0; i < answers.length; i++) {
    seen.push(s.current.difficulty as Difficulty);
    s.answer(answers[i] ? s.current.answer : s.current.choices.find((c) => c !== s.current.answer) as string);
    if (s.finished) break;
    s.next();
  }
  return seen;
}

test('nivel adaptativo: con aciertos seguidos sube el reto y con errores lo baja, sin salirse de ±1', () => {
  const ok = Array(8).fill(true);
  assert.deepEqual(playLevel(0, ok), [1, 1, 1, 2, 2, 2, 2, 2]);
  assert.deepEqual(playLevel(1, [true, true, true, true, true, true, true, true]), [2, 2, 2, 3, 3, 3, 3, 3]);
  assert.deepEqual(playLevel(1, Array(8).fill(false)), [2, 2, 1], 'sin corazones el nivel termina a la tercera pregunta');
  assert.deepEqual(playLevel(1, [false, false, true, true, true, true, true, true]), [2, 2, 1, 1, 1, 2, 3, 3]);
  const mixed = playLevel(2, [true, true, true, false, false, true, true, true]);
  assert.deepEqual(mixed, [3, 3, 3, 3, 3, 2, 2, 2], 'el nivel 3 no pasa de 3 y baja a 2 tras dos errores');
  for (let seed = 1; seed <= 60; seed++) {
    const random = Array.from({ length: 8 }, (_, i) => (seed * 7 + i * 3) % 5 !== 0);
    for (const level of [0, 1, 2]) {
      const base = level + 1;
      for (const d of playLevel(level, random, undefined, seed)) assert.ok(d >= Math.max(1, base - 1) && d <= Math.min(3, base + 1));
    }
  }
});

test('nivel adaptativo: arranca más difícil si la habilidad ya es sólida y no repite preguntas', () => {
  const solid = playLevel(0, [true, true], sp('1111111111', 'proficient'));
  assert.deepEqual(solid, [2, 2]);
  for (let seed = 1; seed <= 100; seed++) {
    const { region } = findRegion('w1r1');
    const { questions, adapt } = buildAdaptiveLevel(createRng(seed), region, 2);
    const s = new Session('level', questions, adapt);
    const prompts: string[] = [];
    while (!s.finished) {
      prompts.push(`${s.current.prompt}|${s.current.visual ?? ''}`);
      s.answer(s.current.answer);
      if (!s.finished) s.next();
    }
    assert.equal(prompts.length, 8);
    assert.ok(new Set(prompts).size >= 6, `demasiadas repeticiones en seed ${seed}`);
  }
});

test('el Guardián no se adapta: siempre es el examen de dificultad 3 (más repaso en 2)', () => {
  for (const id of ['w1r1', 'w3r4']) {
    const { world, index } = findRegion(id);
    const qs = buildGuardianQuestions(createRng(3), world, index);
    const main = world.regions[index]?.skillIds[0];
    assert.ok(qs.filter((q) => q.skillId === main).every((q) => q.difficulty === 3));
    assert.ok(qs.filter((q) => q.skillId !== main).every((q) => q.difficulty === 2));
  }
});

test('repaso: las habilidades que más cuestan van primero y reciben una pregunta extra', () => {
  const p = profile();
  const due = (id: string, recent: string, review: string) => {
    const s = skillProgress(p, id);
    s.mastery = 'proficient';
    s.recent = recent;
    s.nextReview = review;
  };
  due('count10', '1111111111', '2026-11-01');
  due('add10', '0101010100', '2026-11-02'); // 30 %
  due('sub10', '1111111100', '2026-11-01'); // 80 %
  due('compare', '', '2026-10-30'); // sin datos: neutral
  assert.deepEqual(dueSkills(p, TODAY), ['add10', 'compare', 'sub10', 'count10']);
  const qs = buildReviewQuestions(createRng(2), ['add10', 'sub10', 'count10']);
  const count = (id: string) => qs.filter((q) => q.skillId === id).length;
  assert.equal(count('add10'), 2);
  assert.equal(count('sub10'), 2);
  assert.equal(count('count10'), 1);
});

test('guardado: `recent` se conserva, se sanea y los guardados antiguos siguen cargando', () => {
  const p = profile();
  recordAttempt(p, 'add10', true, TODAY);
  recordAttempt(p, 'add10', false, TODAY);
  const store = new MemoryStore();
  persist(store, { ...emptySave(), profiles: [p], activeId: p.id });
  assert.equal(loadSave(store).profiles[0]?.skills['add10']?.recent, '10');

  const old = JSON.parse(JSON.stringify({ ...emptySave(), profiles: [p], activeId: p.id }));
  delete old.profiles[0].skills.add10.recent;
  assert.equal(parseSave(JSON.stringify(old))?.profiles[0]?.skills['add10']?.recent, '');
  old.profiles[0].skills.add10.recent = '<script>';
  assert.equal(parseSave(JSON.stringify(old))?.profiles[0]?.skills['add10']?.recent, '');
  old.profiles[0].skills.add10.recent = '1'.repeat(40);
  assert.equal(parseSave(JSON.stringify(old))?.profiles[0]?.skills['add10']?.recent.length, RECENT_WINDOW);
});
