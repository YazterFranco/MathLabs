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
    case 'fractionRead': {
      const cells = (q.visual as string).split(' ');
      assert.equal(cells.length, n('parts'));
      assert.equal(cells.filter((c) => c === '🟧').length, n('n'));
      return `${n('n')}/${n('parts')}`;
    }
    case 'fractionCompare': {
      const f = m['fracs'] as number[];
      const list = Array.from({ length: f.length / 2 }, (_, i) => [f[2 * i] as number, f[2 * i + 1] as number]);
      assert.deepEqual(q.choices.slice().sort(), list.map(([a, b]) => `${a}/${b}`).sort());
      const best = list.reduce((x, y) => ((y[0] as number) * (x[1] as number) > (x[0] as number) * (y[1] as number) === (m['mode'] === 'max') ? y : x));
      return `${best[0]}/${best[1]}`;
    }
    case 'fractionEquiv':
      assert.equal(q.prompt, `${n('n')}/${n('den')} = __/${n('den') * n('k')}`);
      return String(n('n') * n('k'));
    case 'fractionAdd': {
      const sub = m['kind'] === 'sub';
      assert.equal(q.prompt, `${n('a')}/${n('den')} ${sub ? '−' : '+'} ${n('b')}/${n('den')} = ?`);
      return `${sub ? n('a') - n('b') : n('a') + n('b')}/${n('den')}`;
    }
    case 'fractionOf':
      assert.equal(n('total') % n('den'), 0, 'la fracción debe dar un número entero');
      assert.equal(q.prompt, `${n('n')}/${n('den')} de ${n('total')} = ?`);
      return String((n('total') / n('den')) * n('n'));
    case 'decimalPlace': {
      if (m['digit'] !== undefined) {
        const names = [['unidad', 'unidades'], ['décima', 'décimas'], ['centésima', 'centésimas']];
        assert.match(q.prompt, new RegExp(`En ${n('u')}\\.${n('t')}${n('h')}, `));
        return `${n('digit')} ${(names[n('pos')] as string[])[n('digit') === 1 ? 0 : 1]}`;
      }
      return String(Number((n('u') * 100 + n('t') * 10 + n('h')) / 100));
    }
    case 'decimalCompare': {
      const cents = m['cents'] as number[];
      assert.deepEqual(q.choices.map((c) => Math.round(Number(c) * 100)).sort((a, b) => a - b), [...cents].sort((a, b) => a - b));
      return String(Number((m['mode'] === 'max' ? Math.max(...cents) : Math.min(...cents)) / 100));
    }
    case 'decimalAdd': {
      const sign = m['kind'] === 'sub' ? '−' : '+';
      assert.equal(q.prompt, `${n('a') / 100} ${sign} ${n('b') / 100} = ?`);
      return String((m['kind'] === 'sub' ? n('a') - n('b') : n('a') + n('b')) / 100);
    }
    case 'percent':
      assert.equal(q.prompt, `${n('p')}% de ${n('total')} = ?`);
      assert.equal((n('total') * n('p')) % 100, 0, 'el porcentaje debe dar un entero');
      return String((n('total') * n('p')) / 100);
    case 'perimeterArea': {
      const { a, b } = { a: n('a'), b: n('b') };
      if (m['square']) assert.equal(a, b);
      if (m['kind'] === 'area') {
        assert.match(q.prompt, new RegExp(`${a} cm`));
        return String(a * b);
      }
      if (m['kind'] === 'perimeter') return String(2 * (a + b));
      assert.match(q.prompt, new RegExp(`es ${2 * (a + b)} cm y un lado mide ${a} cm`));
      return String(b);
    }
    case 'ratio':
      if (m['kind'] === 'scale') {
        assert.match(q.prompt, new RegExp(`Si hay ${n('a') * n('k')} `));
        return String(n('b') * n('k'));
      }
      assert.equal(n('price') % n('n'), 0, 'el precio unitario debe ser entero');
      assert.match(q.prompt, new RegExp(`^${n('n')} \\S+ cuestan \\$${n('price')}\\. ¿Cuánto cuestan ${n('m')} `));
      return String((n('price') / n('n')) * n('m'));
    case 'integerOrder': {
      const nums = m['nums'] as number[];
      assert.deepEqual(q.choices.map(parseInt_).sort((x, y) => x - y), [...nums].sort((x, y) => x - y));
      return fmt(m['mode'] === 'max' ? Math.max(...nums) : Math.min(...nums));
    }
    case 'integerAdd': {
      const sub = m['kind'] === 'sub';
      assert.equal(q.prompt, `${fmt(n('a'))} ${sub ? '−' : '+'} ${n('b') < 0 ? `(${fmt(n('b'))})` : n('b')} = ?`);
      return fmt(sub ? n('a') - n('b') : n('a') + n('b'));
    }
    case 'orderOps': {
      // Evalúa la expresión tal como se ve en pantalla con la precedencia de JavaScript, que es la de la aritmética.
      const expr = q.prompt.replace(/ = \?$/, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/(\d+)²/g, '$1**2');
      assert.match(expr, /^[\d\s+\-*/()]+$/, 'expresión segura');
      const value = Function(`"use strict"; return (${expr});`)() as number;
      assert.ok(Number.isInteger(value) && value >= 0, `resultado entero y no negativo: ${expr} = ${value}`);
      return String(value);
    }
    case 'gcdLcm': {
      const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
      const a = n('a');
      const b = n('b');
      return String(m['kind'] === 'lcm' ? (a * b) / g(a, b) : g(a, b));
    }
    default:
      throw new Error(`sin solucionador para ${q.skillId}`);
  }
}

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

const fmt = (v: number): string => (v < 0 ? `−${-v}` : String(v));
const parseInt_ = (text: string): number => Number(text.replace('−', '-'));

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

test('fracciones: ninguna opción repite el valor de otra y todas son propias cuando corresponde', () => {
  const value = (c: string) => {
    const [a = 0, b = 1] = c.split('/').map(Number);
    return a / b;
  };
  for (const skill of ['fractionRead', 'fractionCompare', 'fractionAdd']) {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 300; seed++) {
        const q = generateQuestion(skill, createRng(seed), d);
        const values = q.choices.map(value);
        assert.equal(new Set(values.map((v) => v.toFixed(9))).size, values.length, `${skill} d${d} seed${seed}: ${q.choices}`);
        assert.ok(values.every((v) => v < 1), `${skill} d${d} seed${seed}: fracción impropia en ${q.choices}`);
      }
    }
  }
});

test('fracciones: el nivel 1 compara con el mismo denominador y el nivel 2 con el mismo numerador', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const f1 = generateQuestion('fractionCompare', createRng(seed), 1).meta['fracs'] as number[];
    assert.ok(f1.filter((_, i) => i % 2 === 1).every((x) => x === f1[1]));
    const f2 = generateQuestion('fractionCompare', createRng(seed), 2).meta['fracs'] as number[];
    assert.ok(f2.filter((_, i) => i % 2 === 0).every((x) => x === f2[0]));
  }
});

test('decimales: formato limpio, comparaciones con trampa y sumas alineadas', () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const skill of ['decimalPlace', 'decimalCompare', 'decimalAdd']) {
      for (const d of DIFFICULTIES) {
        const q = generateQuestion(skill, createRng(seed), d);
        for (const c of [...q.choices, q.answer]) {
          if (/^\d/.test(c) && !c.includes(' ')) assert.match(c, /^\d+(\.\d{1,2})?$/, `${skill}: ${c}`);
          assert.ok(!/\.\d*0$/.test(c) || !c.includes('.'), `${skill}: sobra un 0 final en ${c}`);
        }
      }
    }
    const add1 = generateQuestion('decimalAdd', createRng(seed), 1).meta as Record<string, number>;
    assert.equal((add1['a'] as number) % 10, 0, 'nivel 1: solo décimas');
    assert.equal((add1['b'] as number) % 10, 0);
    const sub = generateQuestion('decimalAdd', createRng(seed), 3).meta as Record<string, number | string>;
    if (sub['kind'] === 'sub') assert.ok((sub['a'] as number) > (sub['b'] as number), 'la resta nunca da negativo');
  }
});

test('decimales: en los niveles 2 y 3 siempre hay una trampa de longitud (décimas junto a centésimas)', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const d of [2, 3] as Difficulty[]) {
      const cents = generateQuestion('decimalCompare', createRng(seed), d).meta['cents'] as number[];
      assert.ok(cents.some((c) => c % 10 === 0) && cents.some((c) => c % 10 !== 0));
    }
  }
});

test('enteros: usan el signo menos «−» y nunca el guion en la pantalla', () => {
  for (const skill of ['integerOrder', 'integerAdd']) {
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = generateQuestion(skill, createRng(seed), d);
        assert.ok(![q.prompt, q.answer, ...q.choices].some((t) => t.includes('-')), `${skill} d${d} seed${seed}`);
      }
    }
  }
});

test('enteros: el nivel 1 suma con un solo negativo y la resta con negativo aparece en el nivel 3', () => {
  let negativeSubtrahend = false;
  for (let seed = 1; seed <= 300; seed++) {
    const m1 = generateQuestion('integerAdd', createRng(seed), 1).meta as Record<string, number | string>;
    assert.equal(((m1['a'] as number) < 0 ? 1 : 0) + ((m1['b'] as number) < 0 ? 1 : 0), 1);
    const m3 = generateQuestion('integerAdd', createRng(seed), 3).meta as Record<string, number | string>;
    if (m3['kind'] === 'sub' && (m3['b'] as number) < 0) negativeSubtrahend = true;
  }
  assert.ok(negativeSubtrahend, 'a − (−b) debe aparecer en el nivel 3');
});

test('orden de operaciones: el error de ir de izquierda a derecha nunca coincide con la respuesta', () => {
  for (const d of DIFFICULTIES) {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateQuestion('orderOps', createRng(seed), d);
      const t = q.meta['t'] as number;
      if (t === 1 || t === 4) {
        const { a, b, c } = q.meta as Record<string, number>;
        assert.notEqual(q.answer, String(((a as number) + (b as number)) * (c as number)), `${q.prompt} cae en la trampa`);
      }
      assert.ok(q.choices.length >= 3);
    }
  }
});

test('razones: la respuesta es un entero y el nivel 3 siempre pide buscar el valor unitario', () => {
  for (let seed = 1; seed <= 200; seed++) {
    assert.equal(generateQuestion('ratio', createRng(seed), 3).meta['kind'], 'unit');
    assert.equal(generateQuestion('ratio', createRng(seed), 1).meta['kind'], 'scale');
  }
});
