import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../src/engine/rng.ts';
import { SKILLS, generateQuestion } from '../src/engine/questions.ts';
import type { Difficulty, Question } from '../src/engine/types.ts';

const emojiCount = (text: string | undefined): number =>
  (text ?? '').split(/\s+/).filter((t) => t && t !== '➕').length;

const dec = (t: number) => (t === 1 ? '1 decena' : `${t} decenas`);
const uni = (u: number) => (u === 1 ? '1 unidad' : `${u} unidades`);

/** Soluciona cada pregunta desde sus operandos, sin usar la lógica de las opciones. */
function solve(q: Question): string {
  const m = q.meta;
  const n = (k: string) => m[k] as number;
  switch (q.skillId) {
    case 'count10':
    case 'count20':
      assert.equal(emojiCount(q.visual), n('n'), 'el dibujo debe tener n elementos');
      return String(n('n'));
    case 'compare': {
      const nums = m['nums'] as number[];
      return String(m['mode'] === 'max' ? Math.max(...nums) : Math.min(...nums));
    }
    case 'add10': {
      const [left, right] = (q.visual as string).split('➕');
      assert.equal(emojiCount(left), n('a'));
      assert.equal(emojiCount(right), n('b'));
      return String(n('a') + n('b'));
    }
    case 'sub10':
      assert.equal(emojiCount(q.visual), n('n'));
      return String(n('n') - n('k'));
    case 'add20':
    case 'add100':
      assert.equal(q.prompt, `${n('a')} + ${n('b')} = ?`);
      return String(n('a') + n('b'));
    case 'sub20':
    case 'sub100':
      assert.equal(q.prompt, `${n('a')} − ${n('b')} = ?`);
      return String(n('a') - n('b'));
    case 'tensOnes': {
      const v = n('n');
      if (m['kind'] === 'blocks') {
        const [tens = '', ones = ''] = (q.visual as string).split('   ');
        assert.equal(emojiCount(tens) * 10 + emojiCount(ones), v);
        return String(v);
      }
      return `${dec(Math.floor(v / 10))} y ${uni(v % 10)}`;
    }
    case 'missingAddend':
      assert.match(q.prompt, /\?/);
      return String(n('sum') - n('a'));
    case 'doubles':
      return String(m['kind'] === 'half' ? n('n') / 2 : n('n') * 2);
    case 'skipCount': {
      const seq = m['seq'] as number[];
      const step = (seq[1] as number) - (seq[0] as number);
      seq.forEach((v, i) => assert.equal(v, (seq[0] as number) + step * i, 'serie aritmética'));
      assert.ok(q.prompt.includes('__'));
      return String(seq[n('idx')]);
    }
    case 'money': {
      const coins = m['coins'] as number[];
      assert.equal(emojiCount(q.visual), coins.length);
      return String(coins.reduce((a, b) => a + b, 0));
    }
    case 'placeValue3':
      return String(n('h') * 100 + n('t') * 10 + n('u'));
    case 'groups': {
      const parts = (q.visual as string).split('   ');
      assert.equal(parts.length, n('a'));
      for (const g of parts) assert.equal(emojiCount(g), n('b'));
      return String(n('a') * n('b'));
    }
    case 'mult2510':
    case 'mult34':
    case 'mult69':
      assert.equal(q.prompt, `${n('a')} × ${n('b')} = ?`);
      return String(n('a') * n('b'));
    case 'divide':
      assert.equal(n('p') % n('t'), 0, 'la división debe ser exacta');
      assert.equal(q.prompt, `${n('p')} ÷ ${n('t')} = ?`);
      return String(n('p') / n('t'));
    default:
      throw new Error(`sin solucionador para ${q.skillId}`);
  }
}

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

for (const skill of SKILLS) {
  test(`${skill.id}: la respuesta es correcta, única y está entre las opciones`, () => {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 300; seed++) {
        const q = generateQuestion(skill.id, createRng(seed * 7919 + d), d);
        const ctx = `${skill.id} d${d} seed${seed}: ${q.prompt}`;
        assert.equal(q.skillId, skill.id, ctx);
        assert.equal(q.answer, solve(q), ctx);
        assert.ok(q.choices.includes(q.answer), `${ctx} opciones sin respuesta`);
        assert.equal(new Set(q.choices).size, q.choices.length, `${ctx} opciones repetidas`);
        assert.ok(q.choices.length >= 3 && q.choices.length <= 4, `${ctx} cantidad de opciones: ${q.choices.length}`);
        assert.ok(q.hint.length > 5, `${ctx} sin pista`);
        for (const c of q.choices) assert.ok(!c.startsWith('-') && !c.includes('NaN'), `${ctx} opción inválida ${c}`);
      }
    }
  });
}

test('misma semilla, misma pregunta; semillas distintas, variedad', () => {
  const a = generateQuestion('add20', createRng(42), 2);
  const b = generateQuestion('add20', createRng(42), 2);
  assert.deepEqual(a, b);
  const prompts = new Set(Array.from({ length: 60 }, (_, i) => generateQuestion('add20', createRng(i + 1), 2).prompt));
  assert.ok(prompts.size > 15);
});

test('dificultad: los rangos de cada habilidad suben con el nivel', () => {
  const range = (skill: string, d: Difficulty, key: string) => {
    const values = Array.from({ length: 200 }, (_, i) => generateQuestion(skill, createRng(i + 1), d).meta[key] as number);
    return Math.max(...values);
  };
  assert.ok(range('count10', 1, 'n') <= 5);
  assert.ok(range('count10', 3, 'n') === 10);
  assert.ok(range('count20', 1, 'n') <= 13);
  assert.ok(range('count20', 3, 'n') === 20);
});

test('suma hasta 20: nivel 2 siempre cruza la decena', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { meta } = generateQuestion('add20', createRng(seed), 2);
    const sum = (meta['a'] as number) + (meta['b'] as number);
    assert.ok(sum > 10 && sum <= 20);
  }
});

test('resta hasta 100: nivel 1 sin préstamo, niveles 2 y 3 con préstamo', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const borrow = (d: Difficulty) => {
      const { meta } = generateQuestion('sub100', createRng(seed), d);
      return ((meta['a'] as number) % 10) < ((meta['b'] as number) % 10);
    };
    assert.equal(borrow(1), false);
    assert.equal(borrow(2), true);
    assert.equal(borrow(3), true);
  }
});

test('suma hasta 100: nivel 1 sin llevar, niveles 2 y 3 llevando', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const carry = (d: Difficulty) => {
      const { meta } = generateQuestion('add100', createRng(seed), d);
      return ((meta['a'] as number) % 10) + ((meta['b'] as number) % 10) >= 10;
    };
    assert.equal(carry(1), false);
    assert.equal(carry(2), true);
    assert.equal(carry(3), true);
  }
});

test('tablas: cada habilidad usa solo sus factores y la dificultad sube', () => {
  const factors = (skill: string, d: Difficulty) =>
    Array.from({ length: 300 }, (_, i) => generateQuestion(skill, createRng(i + 1), d).meta as Record<string, number>);
  const fixedOf = (m: Record<string, number>, allowed: number[]) => allowed.includes(m['a'] as number) || allowed.includes(m['b'] as number);
  for (const d of DIFFICULTIES) {
    assert.ok(factors('mult2510', d).every((m) => fixedOf(m, [2, 5, 10])));
    assert.ok(factors('mult34', d).every((m) => fixedOf(m, [3, 4])));
    assert.ok(factors('mult69', d).every((m) => fixedOf(m, [6, 7, 8, 9])));
  }
  assert.ok(factors('mult2510', 1).every((m) => fixedOf(m, [2, 10])), 'nivel 1: solo 2 y 10');
  assert.ok(factors('mult69', 1).every((m) => fixedOf(m, [6, 7])), 'nivel 1: solo 6 y 7');
  const maxProduct = (skill: string, d: Difficulty) => Math.max(...factors(skill, d).map((m) => (m['a'] as number) * (m['b'] as number)));
  assert.ok(maxProduct('mult34', 1) <= 20);
  assert.ok(maxProduct('mult34', 3) > 36);
});

test('división: nivel 1 solo con 2, 5 y 10; el cociente nunca es 0', () => {
  for (let i = 1; i <= 300; i++) {
    const m = generateQuestion('divide', createRng(i), 1).meta as Record<string, number>;
    assert.ok([2, 5, 10].includes(m['t'] as number));
    assert.ok((m['q'] as number) >= 1);
  }
});
