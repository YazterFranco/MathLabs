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
    case 'evalExpr': {
      const xs = /x = (\d+)/.exec(q.prompt);
      const ys = /y = (\d+)/.exec(q.prompt);
      const expr = /vale (.+)\?$/.exec(q.prompt)?.[1] as string;
      const js = expr.replace(/−/g, '-').replace(/(\d)([xy])/g, '$1*$2').replace(/x²/g, 'x**2');
      assert.match(js, /^[\d\sxy+\-*]+$/, 'expresión segura');
      return String(Function('x', 'y', `"use strict"; return (${js});`)(Number(xs?.[1]), Number(ys?.[1])));
    }
    case 'simplify': {
      const expr = q.prompt.replace(/ = \?$/, '').replace(/−/g, '-').replace(/\s+/g, '');
      let A = 0;
      let B = 0;
      for (const term of expr.match(/[+-]?\d*x|[+-]?\d+/g) as string[]) {
        if (term.endsWith('x')) A += Number(term.slice(0, -1).replace(/^([+-]?)$/, '$11'));
        else B += Number(term);
      }
      const coef = A === 1 ? 'x' : `${A}x`;
      return B === 0 ? coef : `${coef} ${B > 0 ? '+' : '−'} ${Math.abs(B)}`;
    }
    case 'eq1': {
      const [, left] = /^(.+?)\. ¿Cuánto vale x\?$/.exec(q.prompt) as RegExpExecArray;
      let r: RegExpExecArray | null;
      if ((r = /^x \+ (\d+) = (\d+)$/.exec(left as string))) return String(Number(r[2]) - Number(r[1]));
      if ((r = /^x − (\d+) = (\d+)$/.exec(left as string))) return String(Number(r[2]) + Number(r[1]));
      if ((r = /^(\d+)x = (\d+)$/.exec(left as string))) return String(Number(r[2]) / Number(r[1]));
      if ((r = /^x ÷ (\d+) = (\d+)$/.exec(left as string))) return String(Number(r[2]) * Number(r[1]));
      throw new Error(`ecuación desconocida: ${q.prompt}`);
    }
    case 'eq2': {
      let r: RegExpExecArray | null;
      if ((r = /^(\d+)x \+ (\d+) = (\d+)\./.exec(q.prompt))) return String((Number(r[3]) - Number(r[2])) / Number(r[1]));
      if ((r = /^(\d+)x − (\d+) = (\d+)\./.exec(q.prompt))) return String((Number(r[3]) + Number(r[2])) / Number(r[1]));
      if ((r = /^x ÷ (\d+) \+ (\d+) = (\d+)\./.exec(q.prompt))) return String((Number(r[3]) - Number(r[2])) * Number(r[1]));
      throw new Error(`ecuación desconocida: ${q.prompt}`);
    }
    case 'discount': {
      const r = /\$(\d+) (sube|tiene) (\d+)%/.exec(q.prompt) as RegExpExecArray;
      const price = Number(r[1]);
      const amount = (price * Number(r[3])) / 100;
      assert.ok(Number.isInteger(amount));
      return String(r[2] === 'sube' ? price + amount : price - amount);
    }
    case 'eqBoth': {
      const r = /^(\d+)x(?: ([+−]) (\d+))? = (\d*)x \+ (\d+)\./.exec(q.prompt) as RegExpExecArray;
      const a = Number(r[1]);
      const b = r[3] === undefined ? 0 : r[2] === '−' ? -Number(r[3]) : Number(r[3]);
      const c = r[4] === '' ? 1 : Number(r[4]);
      const e = Number(r[5]);
      const x = (e - b) / (a - c);
      assert.ok(Number.isInteger(x) && x > 0, `solución entera positiva: ${q.prompt}`);
      assert.equal(a * x + b, c * x + e, 'la x cumple la ecuación');
      return String(x);
    }
    case 'system': {
      let r: RegExpExecArray | null;
      if ((r = /suman (\d+) y su diferencia es (\d+)\. ¿Cuál es el (mayor|menor)\?/.exec(q.prompt))) {
        const S = Number(r[1]);
        const D = Number(r[2]);
        assert.equal((S + D) % 2, 0);
        return String(r[3] === 'mayor' ? (S + D) / 2 : (S - D) / 2);
      }
      const eqs = /^(.+), (.+)\. ¿Cuánto vale ([xy])\?$/.exec(q.prompt) as RegExpExecArray;
      const parse = (text: string): [number, number, number] => {
        const t = text.replace(/−/g, '-');
        let cx = 0;
        let cy = 0;
        const [lhs, rhs] = t.split(' = ') as [string, string];
        for (const term of lhs.replace(/ /g, '').match(/[+-]?\d*[xy]/g) as string[]) {
          const v = term.slice(-1);
          const num = term.slice(0, -1);
          const coef = num === '' || num === '+' ? 1 : num === '-' ? -1 : Number(num);
          if (v === 'x') cx += coef;
          else cy += coef;
        }
        return [cx, cy, Number(rhs)];
      };
      const [a1, b1, c1] = parse(eqs[1] as string);
      const [a2, b2, c2] = parse(eqs[2] as string);
      const det = a1 * b2 - a2 * b1;
      assert.notEqual(det, 0);
      const x = (c1 * b2 - c2 * b1) / det;
      const y = (a1 * c2 - a2 * c1) / det;
      assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 1, `solución entera positiva: ${q.prompt}`);
      return String(eqs[3] === 'x' ? x : y);
    }
    case 'expand': {
      const js = q.prompt
        .replace(/ = \?$/, '')
        .replace(/−/g, '-')
        .replace(/(\d)\(/g, '$1*(');
      assert.match(js, /^[\dx\s+\-*()]+$/, 'expresión segura');
      const f = (x: number) => Function('x', `"use strict"; return (${js});`)(x) as number;
      const B = f(0);
      const A = f(1) - B;
      assert.equal(f(5), A * 5 + B, 'es una expresión lineal');
      assert.ok(A >= 1);
      return B === 0 ? coefOf(A) : `${coefOf(A)} ${B > 0 ? '+' : '−'} ${Math.abs(B)}`;
    }
    case 'factor': {
      const text = q.prompt.replace('Factoriza: ', '').replace(/−/g, '-');
      let r: RegExpExecArray | null;
      const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
      if ((r = /^(\d+)x \+ (\d+)$/.exec(text))) {
        const A = Number(r[1]);
        const B = Number(r[2]);
        const k = g(A, B);
        return `${k}(${coefOf(A / k)} + ${B / k})`;
      }
      if ((r = /^x² - (\d+)$/.exec(text))) {
        const k = Math.sqrt(Number(r[1]));
        assert.ok(Number.isInteger(k));
        return `(x + ${k})(x − ${k})`;
      }
      r = /^x² ([+-]) (\d*)x ([+-]) (\d+)$/.exec(text) as RegExpExecArray;
      const S = (r[1] === '-' ? -1 : 1) * (r[2] === '' ? 1 : Number(r[2]));
      const P = (r[3] === '-' ? -1 : 1) * Number(r[4]);
      const roots: number[] = [];
      for (let p = -20; p <= 20; p++) for (let q2 = p; q2 <= 20; q2++) if (p + q2 === S && p * q2 === P) roots.push(p, q2);
      assert.equal(roots.length, 2, `factorización única: ${q.prompt}`);
      const f2 = (p: number) => `(x ${p < 0 ? '−' : '+'} ${Math.abs(p)})`;
      return `${f2(roots[0] as number)}${f2(roots[1] as number)}`;
    }
    case 'quadratic': {
      let r: RegExpExecArray | null;
      const text = q.prompt.replace(/−/g, '-');
      if ((r = /^x² = (\d+)\./.exec(text))) return String(Math.sqrt(Number(r[1])));
      if ((r = /^(\d+)x² = (\d+)\./.exec(text))) return String(Math.sqrt(Number(r[2]) / Number(r[1])));
      if ((r = /^x² \+ (\d+) = (\d+)\./.exec(text))) return String(Math.sqrt(Number(r[2]) - Number(r[1])));
      let poly: (x: number) => number;
      if ((r = /^\(x - (\d+)\)\(x - (\d+)\) = 0/.exec(text))) {
        const p = Number(r[1]);
        const q2 = Number(r[2]);
        poly = (x) => (x - p) * (x - q2);
      } else {
        r = /^x² ([+-]) (\d*)x ([+-]) (\d+) = 0/.exec(text) as RegExpExecArray;
        const S = (r[1] === '-' ? -1 : 1) * (r[2] === '' ? 1 : Number(r[2]));
        const P = (r[3] === '-' ? -1 : 1) * Number(r[4]);
        poly = (x) => x * x + S * x + P;
      }
      const roots: number[] = [];
      for (let x = -30; x <= 30; x++) if (poly(x) === 0) roots.push(x);
      assert.equal(roots.length, 2, `dos soluciones enteras: ${q.prompt}`);
      const ask = /(mayor|menor|positiva)\?$/.exec(text)?.[1];
      if (ask === 'mayor') return String(Math.max(...roots));
      if (ask === 'menor') return String(Math.min(...roots));
      return String(roots.find((v) => v > 0));
    }
    case 'linearFn': {
      const f = /^f\(x\) = (\d+)x ([+−]) (\d+)\. /.exec(q.prompt) as RegExpExecArray;
      const fn = (x: number): number => Number(f[1]) * x + (f[2] === '−' ? -1 : 1) * Number(f[3]);
      let r: RegExpExecArray | null;
      if ((r = /¿Cuánto vale f\((\d+)\) \+ f\((\d+)\)\?$/.exec(q.prompt))) return String(fn(Number(r[1])) + fn(Number(r[2])));
      if ((r = /Si f\(x\) = (\d+), ¿cuánto vale x\?$/.exec(q.prompt))) {
        for (let x = 0; x <= 80; x++) if (fn(x) === Number(r[1])) return String(x);
        throw new Error(`sin solución: ${q.prompt}`);
      }
      r = /¿Cuánto vale f\((\d+)\)\?$/.exec(q.prompt) as RegExpExecArray;
      return String(fn(Number(r[1])));
    }
    case 'slope': {
      const r = /\((\d+), (\d+)\) y \((\d+), (\d+)\)/.exec(q.prompt) as RegExpExecArray;
      const [x1, y1, x2, y2] = r.slice(1).map(Number) as [number, number, number, number];
      const m = (y2 - y1) / (x2 - x1);
      assert.ok(Number.isInteger(m) && m !== 0, `pendiente entera: ${q.prompt}`);
      return fmt(m);
    }
    case 'lineCuts': {
      let r: RegExpExecArray | null;
      if ((r = /^En y = (\d+)x \+ (\d+), ¿cuál es (la pendiente|el valor de y donde la recta corta al eje y)\?$/.exec(q.prompt))) return r[3] === 'la pendiente' ? r[1] as string : r[2] as string;
      r = /recta y = (−?)(\d+)x ([+−]) (\d+) al eje x\?$/.exec(q.prompt) as RegExpExecArray;
      const a = (r[1] === '−' ? -1 : 1) * Number(r[2]);
      const b = (r[3] === '−' ? -1 : 1) * Number(r[4]);
      for (let x = 1; x <= 60; x++) if (a * x + b === 0) return String(x);
      throw new Error(`sin corte entero: ${q.prompt}`);
    }
    case 'exponents': {
      const unsup = (t: string): number => Number([...t].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''));
      const mono = (t: string): [number, number] => {
        const r = /^(\d*)x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(t) as RegExpExecArray;
        return [r[1] === '' ? 1 : Number(r[1]), unsup(r[2] as string)];
      };
      const show = (c: number, e: number): string => `${c === 1 ? '' : c}x${[...String(e)].map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(ch)]).join('')}`;
      const text = q.prompt.replace(/ = \?$/, '');
      let r: RegExpExecArray | null;
      if ((r = /^\((.+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/.exec(text))) {
        const [c, e] = mono(r[1] as string);
        const p = unsup(r[2] as string);
        return show(c ** p, e * p);
      }
      if ((r = /^(.+) × (.+)$/.exec(text))) {
        const [c1, e1] = mono(r[1] as string);
        const [c2, e2] = mono(r[2] as string);
        return show(c1 * c2, e1 + e2);
      }
      r = /^(.+) ÷ (.+)$/.exec(text) as RegExpExecArray;
      const [c1, e1] = mono(r[1] as string);
      const [c2, e2] = mono(r[2] as string);
      assert.equal(c1 % c2, 0);
      return show(c1 / c2, e1 - e2);
    }
    case 'parabola': {
      let r: RegExpExecArray | null;
      let y: (x: number) => number;
      if ((r = /^y = \(x − (\d+)\)² \+ (\d+)\./.exec(q.prompt))) {
        const [h, k] = [Number(r[1]), Number(r[2])];
        y = (x) => (x - h) ** 2 + k;
      } else {
        r = /^y = x² − (\d+)x \+ (\d+)\./.exec(q.prompt) as RegExpExecArray;
        const [b, c] = [Number(r[1]), Number(r[2])];
        y = (x) => x * x - b * x + c;
      }
      let bestX = 0;
      for (let x = 0; x <= 40; x++) if (y(x) < y(bestX)) bestX = x;
      return String(q.prompt.includes('valor de x') ? bestX : y(bestX));
    }
    case 'trig': {
      let r: RegExpExecArray | null;
      if ((r = /(sen|cos) θ = (\d+)\/(\d+) y la hipotenusa mide (\d+)\./.exec(q.prompt))) {
        const k = Number(r[4]) / Number(r[3]);
        assert.ok(Number.isInteger(k));
        return String(k * Number(r[2]));
      }
      r = /catetos de (\d+) y (\d+), e hipotenusa de (\d+)\. Si θ es el ángulo opuesto al cateto de (\d+), ¿cuánto vale (sen|cos|tan) θ\?/.exec(q.prompt) as RegExpExecArray;
      const [a, b, c, opp] = r.slice(1, 5).map(Number) as [number, number, number, number];
      assert.equal(a * a + b * b, c * c, 'terna pitagórica');
      const adj = opp === a ? b : a;
      return r[5] === 'sen' ? `${opp}/${c}` : r[5] === 'cos' ? `${adj}/${c}` : `${opp}/${adj}`;
    }
    case 'logExp': {
      const fromSub = (t: string): number => Number([...t].map((c) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).join(''));
      const expOf = (b: number, v: number): number => {
        for (let e = 0; e <= 12; e++) if (b ** e === v) return e;
        throw new Error(`no es potencia: ${q.prompt}`);
      };
      let r: RegExpExecArray | null;
      if ((r = /^log([₀-₉]+) (\d+) = \?$/.exec(q.prompt))) return String(expOf(fromSub(r[1] as string), Number(r[2])));
      if ((r = /^(\d+)\^x = (\d+)\./.exec(q.prompt))) return String(expOf(Number(r[1]), Number(r[2])));
      if ((r = /^log([₀-₉]+) x = (\d+)\./.exec(q.prompt))) return String(fromSub(r[1] as string) ** Number(r[2]));
      r = /^(\d+)\^\(x \+ (\d+)\) = (\d+)\./.exec(q.prompt) as RegExpExecArray;
      return String(expOf(Number(r[1]), Number(r[3])) - Number(r[2]));
    }
    case 'seq': {
      const head = q.prompt.replace(/^Suma los primeros \d+ números de la lista /, '');
      const nums = (head.split('…')[0] as string).split(',').map((t) => t.trim()).filter(Boolean).map(Number);
      let r: RegExpExecArray | null;
      if ((r = /^Suma los primeros (\d+) /.exec(q.prompt))) {
        const diff = (nums[1] as number) - (nums[0] as number);
        let total = 0;
        for (let i = 0; i < Number(r[1]); i++) total += (nums[0] as number) + i * diff;
        return String(total);
      }
      if (/siguiente número/.test(q.prompt)) return String((nums[nums.length - 1] as number) + ((nums[1] as number) - (nums[0] as number)));
      const n = Number(/término número (\d+)/.exec(q.prompt)?.[1]);
      const [n1, n2, n3] = nums as [number, number, number];
      if (n2 - n1 === n3 - n2) return String(n1 + (n - 1) * (n2 - n1));
      assert.equal(n2 * n2, n1 * n3, 'progresión geométrica');
      return String(n1 * (n2 / n1) ** (n - 1));
    }
    case 'counting': {
      let r: RegExpExecArray | null;
      if ((r = /(\d+) camisas y (\d+) pantalones/.exec(q.prompt))) return String(Number(r[1]) * Number(r[2]));
      if ((r = /ordenar (\d+) libros/.exec(q.prompt))) return String(Array.from({ length: Number(r[1]) }, (_, i) => i + 1).reduce((x, y) => x * y, 1));
      if ((r = /grupo de (\d+) estudiantes se elegirá un comité de (\d+)\./.exec(q.prompt))) {
        const [n, k] = [Number(r[1]), Number(r[2])];
        let num = 1;
        let den = 1;
        for (let i = 0; i < k; i++) {
          num *= n - i;
          den *= i + 1;
        }
        return String(num / den);
      }
      if ((r = /carrera de (\d+) corredores/.exec(q.prompt))) return String(Number(r[1]) * (Number(r[1]) - 1) * (Number(r[1]) - 2));
      r = /entre (\d+) personas/.exec(q.prompt) as RegExpExecArray;
      return String(Number(r[1]) * (Number(r[1]) - 1));
    }
    case 'derivative': {
      const r = /^f\(x\) = (.+)\. ¿Cuánto vale f'\((\d+)\)\?$/.exec(q.prompt) as RegExpExecArray;
      const t = Number(r[2]);
      let total = 0;
      for (const term of (r[1] as string).split(' + ')) {
        const m = /^(\d*)x([⁰¹²³⁴⁵⁶⁷⁸⁹]*)$/.exec(term);
        if (!m) continue; // un número suelto no aporta
        const c = m[1] === '' ? 1 : Number(m[1]);
        const e = m[2] === '' ? 1 : Number([...(m[2] as string)].map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(ch)).join(''));
        total += c * e * t ** (e - 1);
      }
      return String(total);
    }
    default:
      throw new Error(`sin solucionador para ${q.skillId}`);
  }
}

const coefOf = (n: number): string => (n === 1 ? 'x' : `${n}x`);

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
        assert.ok(q.hint.length > 5, `${ctx} sin pista`);
        if (q.input === 'number') {
          assert.deepEqual(q.choices, [], `${ctx} la respuesta escrita no lleva opciones`);
          assert.match(q.answer, /^\d+$/, `${ctx} la respuesta escrita es un entero no negativo`);
          continue;
        }
        assert.ok(q.choices.includes(q.answer), `${ctx} opciones sin respuesta`);
        assert.equal(new Set(q.choices).size, q.choices.length, `${ctx} opciones repetidas`);
        assert.ok(q.choices.length >= 3 && q.choices.length <= 4, `${ctx} cantidad de opciones: ${q.choices.length}`);
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

test('respuesta escrita: solo el nivel 3 de las ecuaciones y los descuentos; los demás niveles eligen', () => {
  for (const skill of ['eq1', 'eq2', 'discount', 'eqBoth', 'system', 'quadratic', 'linearFn', 'lineCuts', 'parabola', 'trig', 'logExp', 'seq', 'counting', 'derivative']) {
    for (let seed = 1; seed <= 100; seed++) {
      assert.equal(generateQuestion(skill, createRng(seed), 3).input, 'number', skill);
      assert.equal(generateQuestion(skill, createRng(seed), 1).input, undefined, skill);
      assert.equal(generateQuestion(skill, createRng(seed), 2).input, undefined, skill);
    }
  }
  // La prueba de nivel y los repasos usan dificultad 2: nunca piden escribir.
});

test('simplificar: las opciones son expresiones distintas y ninguna empieza en 0 ni es negativa', () => {
  for (const d of DIFFICULTIES) {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateQuestion('simplify', createRng(seed), d);
      assert.equal(q.choices.length, 4, `${q.prompt}`);
      assert.ok(q.choices.every((c) => /^[1-9]\d*x|^x/.test(c)), `${q.prompt}: ${q.choices}`);
    }
  }
});

test('factorizar: las opciones son factorizaciones distintas y la correcta se reconoce al multiplicar', () => {
  for (const d of DIFFICULTIES) {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateQuestion('factor', createRng(seed), d);
      assert.equal(q.choices.length, 4, q.prompt);
      for (const c of q.choices) assert.ok(!c.startsWith('1('), `${q.prompt}: ${c}`);
    }
  }
});

test('quitar paréntesis: la coincidencia de errores típicos nunca iguala a la respuesta', () => {
  for (const d of DIFFICULTIES) {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateQuestion('expand', createRng(seed), d);
      assert.equal(q.choices.length, 4, q.prompt);
      assert.ok(q.choices.every((c) => /^[1-9]\d*x|^x/.test(c)), `${q.prompt}: ${q.choices}`);
    }
  }
});

test('exponentes: los exponentes del enunciado y de la respuesta caben en una sola cifra (se leen en voz alta)', () => {
  for (const d of DIFFICULTIES) {
    for (let seed = 1; seed <= 300; seed++) {
      const q = generateQuestion('exponents', createRng(seed), d);
      assert.equal(q.choices.length, 4, q.prompt);
      assert.ok(!/[⁰¹²³⁴⁵⁶⁷⁸⁹]{2,}/.test(q.prompt), `exponente de dos cifras en el enunciado: ${q.prompt}`);
      assert.ok(!/[⁰¹²³⁴⁵⁶⁷⁸⁹]{2,}/.test(q.answer), `exponente de dos cifras en la respuesta: ${q.answer}`);
    }
  }
});

test('pendiente: las opciones usan el signo menos tipográfico y nunca repiten la respuesta', () => {
  let negatives = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const q = generateQuestion('slope', createRng(seed), 3);
    if (q.answer.startsWith('−')) negatives++;
    assert.ok(q.choices.every((c) => !c.includes('-')), q.choices.join());
  }
  assert.ok(negatives > 50, 'el nivel 3 incluye pendientes negativas');
});
