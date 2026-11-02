import { buildChoices } from './choices.ts';
import type { Rng } from './rng.ts';
import type { Difficulty, Generator, Meta, Question, Skill } from './types.ts';

const OBJECTS = ['🍎', '🐟', '⭐', '🐞', '🍓', '🎈', '🐥', '🌸'];

/** Emojis en grupos de 5 para que contar sea fácil. */
const grouped = (emoji: string, n: number): string => {
  const parts: string[] = [];
  for (let i = 0; i < n; i += 5) {
    parts.push(Array(Math.min(5, n - i)).fill(emoji).join(' '));
  }
  return parts.join('   ');
};

const byLevel = <T>(d: Difficulty, easy: T, medium: T, hard: T): T =>
  d === 1 ? easy : d === 2 ? medium : hard;

/** Repite `make` hasta que `ok` se cumpla; devuelve el último intento si nunca pasa. */
function sample<T>(make: () => T, ok: (value: T) => boolean, tries = 300): T {
  let last = make();
  for (let i = 0; i < tries; i++) {
    if (ok(last)) return last;
    last = make();
  }
  return last;
}

const dec = (t: number): string => (t === 1 ? '1 decena' : `${t} decenas`);
const uni = (u: number): string => (u === 1 ? '1 unidad' : `${u} unidades`);
const cent = (h: number): string => (h === 1 ? '1 centena' : `${h} centenas`);

/* ───────────── Mundo 1 · Bosque de los Números ───────────── */

const count10: Generator = (rng, d) => {
  const [lo, hi] = byLevel<[number, number]>(d, [1, 5], [3, 8], [5, 10]);
  const n = rng.int(lo, hi);
  const { choices, answer } = buildChoices(rng, n, [n - 1, n + 1, n - 2, n + 2], { min: 1, max: 12 });
  return {
    skillId: 'count10',
    prompt: '¿Cuántos hay?',
    visual: grouped(rng.pick(OBJECTS), n),
    choices,
    answer,
    hint: 'Toca cada uno con tu dedo y cuenta en voz alta.',
    meta: { n },
  };
};

const count20: Generator = (rng, d) => {
  const [lo, hi] = byLevel<[number, number]>(d, [11, 13], [11, 16], [14, 20]);
  const n = rng.int(lo, hi);
  const { choices, answer } = buildChoices(rng, n, [n - 1, n + 1, n - 5, n + 5, n + 2], { min: 5, max: 25 });
  return {
    skillId: 'count20',
    prompt: '¿Cuántos hay?',
    visual: grouped(rng.pick(OBJECTS), n),
    choices,
    answer,
    hint: 'Cuenta de cinco en cinco: 5, 10, 15… y luego los que sobran.',
    meta: { n },
  };
};

const compare: Generator = (rng, d) => {
  const max = byLevel(d, 10, 15, 20);
  const set = new Set<number>();
  while (set.size < 3) set.add(rng.int(1, max));
  const nums = [...set];
  const big = rng.chance(0.5);
  const target = big ? Math.max(...nums) : Math.min(...nums);
  return {
    skillId: 'compare',
    prompt: `¿Cuál número es el ${big ? 'mayor' : 'menor'}?`,
    choices: nums.map(String),
    answer: String(target),
    hint: big ? 'El mayor es el que tiene más cosas.' : 'El menor es el que tiene menos cosas.',
    meta: { nums, mode: big ? 'max' : 'min' },
  };
};

const add10: Generator = (rng, d) => {
  const maxSum = byLevel(d, 5, 8, 10);
  const a = rng.int(1, maxSum - 1);
  const b = rng.int(1, maxSum - a);
  const sum = a + b;
  const obj = rng.pick(OBJECTS);
  const { choices, answer } = buildChoices(rng, sum, [a, b, sum + 1, sum - 1, sum + 2], { min: 1, max: 12 });
  return {
    skillId: 'add10',
    prompt: '¿Cuántos hay en total?',
    visual: `${grouped(obj, a)}   ➕   ${grouped(obj, b)}`,
    choices,
    answer,
    hint: 'Junta todos los dibujos y cuéntalos desde el principio.',
    meta: { a, b },
  };
};

const sub10: Generator = (rng, d) => {
  const [lo, hi] = byLevel<[number, number]>(d, [2, 5], [3, 8], [4, 10]);
  const n = rng.int(lo, hi);
  const k = rng.int(1, n - 1);
  const rest = n - k;
  const { choices, answer } = buildChoices(rng, rest, [n + k, n, k, rest + 1, rest - 1], { min: 0, max: 20 });
  return {
    skillId: 'sub10',
    prompt: `Hay ${n} y se van ${k}. ¿Cuántos quedan?`,
    visual: grouped(rng.pick(OBJECTS), n),
    choices,
    answer,
    hint: `Tacha ${k} dibujos y cuenta los que quedan.`,
    meta: { n, k },
  };
};

/* ───────────── Mundo 2 · Playa de las Sumas ───────────── */

const add20: Generator = (rng, d) => {
  let a: number;
  let b: number;
  if (d === 1) {
    a = rng.int(1, 6);
    b = rng.int(1, 10 - a);
  } else if (d === 2) {
    a = rng.int(5, 9);
    b = rng.int(11 - a, 9);
  } else {
    const total = rng.int(12, 20);
    a = rng.int(Math.max(3, total - 9), Math.min(total - 3, 15));
    b = total - a;
  }
  const sum = a + b;
  const { choices, answer } = buildChoices(rng, sum, [sum - 10, sum + 10, sum + 1, sum - 1, sum - 2], {
    min: 1,
    max: 30,
  });
  const hint =
    a < 10 && sum > 10
      ? `Completa 10 primero: ${a} + ${10 - a} = 10, y sobran ${sum - 10}.`
      : 'Empieza en el número más grande y cuenta hacia adelante.';
  return { skillId: 'add20', prompt: `${a} + ${b} = ?`, choices, answer, hint, meta: { a, b } };
};

const sub20: Generator = (rng, d) => {
  let a: number;
  let b: number;
  if (d === 1) {
    a = rng.int(5, 10);
    b = rng.int(1, a - 1);
  } else if (d === 2) {
    a = rng.int(11, 18);
    b = rng.int((a % 10) + 1, 9);
  } else {
    a = rng.int(12, 20);
    b = rng.int(3, a - 1);
  }
  const rest = a - b;
  const { choices, answer } = buildChoices(rng, rest, [a + b, rest + 1, rest - 1, rest + 2, a], {
    min: 0,
    max: 40,
  });
  return {
    skillId: 'sub20',
    prompt: `${a} − ${b} = ?`,
    choices,
    answer,
    hint: `Empieza en ${a} y cuenta hacia atrás ${b} pasos.`,
    meta: { a, b },
  };
};

const tensOnes: Generator = (rng, d) => {
  const n = rng.int(11, byLevel(d, 29, 59, 99));
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (d >= 2 && rng.chance(0.5)) {
    const options = new Set<string>([
      `${dec(t)} y ${uni(u)}`,
      `${dec(u)} y ${uni(t)}`,
      `${dec(t)} y ${uni(u === 9 ? 8 : u + 1)}`,
      `${dec(t === 9 ? 8 : t + 1)} y ${uni(u)}`,
    ]);
    const answer = `${dec(t)} y ${uni(u)}`;
    const choices = rng.shuffle([...options]).slice(0, 4);
    if (!choices.includes(answer)) choices[0] = answer;
    return {
      skillId: 'tensOnes',
      prompt: `¿Cuántas decenas y unidades tiene el ${n}?`,
      choices: rng.shuffle(choices),
      answer,
      hint: `En el ${n}, el ${t} son las decenas y el ${u} son las unidades.`,
      meta: { n, kind: 'words' },
    };
  }
  const tens = Array(t).fill('🟦').join(' ');
  const ones = u > 0 ? `   ${Array(u).fill('🔹').join(' ')}` : '';
  const { choices, answer } = buildChoices(rng, n, [u * 10 + t, t + u, n + 1, n - 1, n + 10, n - 10], {
    min: 10,
    max: 99,
  });
  return {
    skillId: 'tensOnes',
    prompt: '🟦 vale 10 y 🔹 vale 1. ¿Qué número es?',
    visual: `${tens}${ones}`,
    choices,
    answer,
    hint: 'Cuenta de diez en diez los cuadros azules y luego suma los puntitos.',
    meta: { n, kind: 'blocks' },
  };
};

const missingAddend: Generator = (rng, d) => {
  const maxSum = byLevel(d, 10, 15, 20);
  const sum = rng.int(4, maxSum);
  const a = rng.int(1, sum - 1);
  const missing = sum - a;
  const { choices, answer } = buildChoices(rng, missing, [sum + a, sum, a, missing + 1, missing - 1], {
    min: 0,
    max: 40,
  });
  return {
    skillId: 'missingAddend',
    prompt: rng.chance(0.5) ? `${a} + ? = ${sum}` : `? + ${a} = ${sum}`,
    choices,
    answer,
    hint: `¿Cuánto falta para llegar de ${a} a ${sum}? Cuenta hacia adelante.`,
    meta: { a, sum },
  };
};

const doubles: Generator = (rng, d) => {
  if (d === 3 && rng.chance(0.5)) {
    const half = rng.int(1, 10);
    const whole = half * 2;
    const { choices, answer } = buildChoices(rng, half, [whole, half + 1, half - 1, whole - 2], { min: 1, max: 25 });
    return {
      skillId: 'doubles',
      prompt: `La mitad de ${whole} es…`,
      choices,
      answer,
      hint: 'La mitad es repartir en dos partes iguales.',
      meta: { kind: 'half', n: whole },
    };
  }
  const n = rng.int(1, byLevel(d, 5, 10, 10));
  const twice = n * 2;
  const { choices, answer } = buildChoices(rng, twice, [n, twice + 1, twice - 1, n * 3], { min: 1, max: 30 });
  return {
    skillId: 'doubles',
    prompt: d === 1 || rng.chance(0.5) ? `${n} + ${n} = ?` : `El doble de ${n} es…`,
    choices,
    answer,
    hint: 'El doble es sumar el mismo número dos veces.',
    meta: { kind: 'double', n },
  };
};

/* ───────────── Mundo 3 · Montaña del Cien ───────────── */

const add100: Generator = (rng, d) => {
  const [a, b] = sample<[number, number]>(
    () => {
      if (d === 1) {
        return rng.chance(0.5)
          ? [rng.int(1, 9) * 10, rng.int(1, 9) * 10]
          : [rng.int(11, 89), rng.int(1, 9)];
      }
      if (d === 2) return [rng.int(11, 89), rng.int(2, 9)];
      return [rng.int(11, 80), rng.int(11, 80)];
    },
    ([x, y]) => {
      const carry = (x % 10) + (y % 10) >= 10;
      if (d === 1) return x + y <= 100 && !carry;
      if (d === 2) return carry && x + y <= 99;
      return carry && x + y <= 100;
    },
  );
  const sum = a + b;
  const carries = (a % 10) + (b % 10) >= 10;
  const { choices, answer } = buildChoices(rng, sum, [sum - 10, sum + 10, sum + 1, sum - 1], {
    min: 1,
    max: 120,
  });
  return {
    skillId: 'add100',
    prompt: `${a} + ${b} = ?`,
    choices,
    answer,
    hint: carries
      ? 'Suma las unidades; si llegan a 10 o más, lleva 1 decena y súmala con las demás.'
      : 'Suma las unidades por un lado y las decenas por otro.',
    meta: { a, b },
  };
};

const sub100: Generator = (rng, d) => {
  const [a, b] = sample<[number, number]>(
    () => {
      if (d === 1) return [rng.int(11, 99), rng.chance(0.5) ? rng.int(1, 9) : rng.int(1, 9) * 10];
      if (d === 2) return [rng.int(21, 99), rng.int(2, 9)];
      const big = rng.int(31, 99);
      return [big, rng.int(11, big - 1)];
    },
    ([x, y]) => {
      if (x <= y) return false;
      const borrow = x % 10 < y % 10;
      return d === 1 ? !borrow : borrow;
    },
  );
  const rest = a - b;
  const noBorrow = (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
  const { choices, answer } = buildChoices(rng, rest, [noBorrow, rest + 10, rest - 10, rest + 1, rest - 1], {
    min: 0,
    max: 100,
  });
  return {
    skillId: 'sub100',
    prompt: `${a} − ${b} = ?`,
    choices,
    answer,
    hint: 'Si las unidades no alcanzan, pide prestada una decena y resta de nuevo.',
    meta: { a, b },
  };
};

const skipCount: Generator = (rng, d) => {
  const len = 5;
  let start: number;
  let step: number;
  let dir = 1;
  if (d === 1) {
    step = rng.pick([5, 10]);
    start = step * rng.int(0, 2);
  } else if (d === 2) {
    step = rng.pick([2, 5, 10]);
    start = step * rng.int(0, 3);
  } else {
    step = rng.pick([2, 3, 4, 5, 10]);
    dir = rng.chance(0.4) ? -1 : 1;
    start = dir === 1 ? rng.int(0, 10) : step * (len - 1) + rng.int(0, 10);
  }
  const seq = Array.from({ length: len }, (_, i) => start + dir * step * i);
  const idx = rng.int(1, len - 1);
  const target = seq[idx] as number;
  const { choices, answer } = buildChoices(rng, target, [target + 1, target - 1, target + step, target - step, target + 2], {
    min: 0,
    max: 200,
  });
  const text = seq.map((v, i) => (i === idx ? '__' : String(v))).join(',  ');
  return {
    skillId: 'skipCount',
    prompt: `Completa la serie: ${text}`,
    choices,
    answer,
    hint: `Mira cuánto cambia de un número al siguiente: salta de ${step} en ${step}.`,
    meta: { seq, idx },
  };
};

const money: Generator = (rng, d) => {
  const pool = byLevel<number[]>(d, [5, 10], [5, 10, 25], [1, 5, 10, 25]);
  const count = d === 1 ? rng.int(2, 3) : d === 2 ? rng.int(3, 4) : rng.int(4, 5);
  const coins = Array.from({ length: count }, () => rng.pick(pool)).sort((x, y) => y - x);
  const total = coins.reduce((acc, c) => acc + c, 0);
  const step = d === 3 ? 1 : 5;
  const wrongs = step === 5 ? [total + 5, total - 5, total + 10, total - 10] : [total + 1, total - 1, total + 5, total - 5, total + 10];
  const { choices, answer } = buildChoices(rng, total, wrongs, { min: 1, max: 200, step });
  return {
    skillId: 'money',
    prompt: '¿Cuántos centavos hay en total?',
    visual: coins.map((c) => `🪙${c}¢`).join('   '),
    choices,
    answer,
    hint: 'Empieza por la moneda más grande y sigue sumando.',
    meta: { coins },
  };
};

const placeValue3: Generator = (rng, d) => {
  const h = rng.int(1, 9);
  let t: number;
  let u: number;
  if (d === 1) {
    t = rng.int(1, 9);
    u = 0;
  } else if (d === 2) {
    t = rng.int(1, 9);
    u = rng.int(1, 9);
  } else if (rng.chance(0.5)) {
    t = 0;
    u = rng.int(1, 9);
  } else {
    t = rng.int(1, 9);
    u = 0;
  }
  const n = h * 100 + t * 10 + u;
  const prompt =
    d === 1
      ? `¿Qué número es ${cent(h)} y ${dec(t)}?`
      : `¿Qué número es ${cent(h)}, ${dec(t)} y ${uni(u)}?`;
  const { choices, answer } = buildChoices(
    rng,
    n,
    [t * 100 + h * 10 + u, h * 100 + u * 10 + t, u * 100 + t * 10 + h, n + 10, n - 10, n + 100],
    { min: 100, max: 999 },
  );
  return {
    skillId: 'placeValue3',
    prompt,
    choices,
    answer,
    hint: 'Las centenas valen 100, las decenas valen 10 y las unidades valen 1.',
    meta: { h, t, u },
  };
};

/* ───────────── Mundo 4 · Ciudad de las Tablas ───────────── */

const groups: Generator = (rng, d) => {
  const [aLo, aHi, bLo, bHi] = byLevel<[number, number, number, number]>(d, [2, 3, 2, 4], [2, 5, 2, 5], [3, 6, 3, 6]);
  const a = rng.int(aLo, aHi);
  const b = rng.int(bLo, bHi);
  const total = a * b;
  const emoji = rng.pick(OBJECTS);
  const { choices, answer } = buildChoices(rng, total, [a + b, total + b, total - b, total + a, total - a], { min: 2, max: 40 });
  return {
    skillId: 'groups',
    prompt: `${a} grupos de ${b}: ¿cuántos hay en total?`,
    visual: Array.from({ length: a }, () => Array(b).fill(emoji).join(' ')).join('   '),
    choices,
    answer,
    hint: `Suma ${Array(a).fill(b).join(' + ')}. Multiplicar es sumar el mismo número varias veces.`,
    meta: { a, b },
  };
};

/** Pregunta de tabla: el factor fijo va a la izquierda o a la derecha al azar (la multiplicación conmuta). */
function tableQuestion(rng: Rng, skillId: string, t: number, n: number, hint: string): Question {
  const answerValue = t * n;
  const left = rng.chance(0.5);
  const { choices, answer } = buildChoices(
    rng,
    answerValue,
    [t * (n + 1), t * (n - 1), t + n, answerValue + t, answerValue - t, answerValue + 1, answerValue - 1],
    { min: 0, max: 150 },
  );
  const [x, y] = left ? [t, n] : [n, t];
  return { skillId, prompt: `${x} × ${y} = ?`, choices, answer, hint, meta: { a: x, b: y } };
}

const mult2510: Generator = (rng, d) => {
  const t = d === 1 ? rng.pick([2, 10]) : rng.pick([2, 5, 10]);
  const n = byLevel<number>(d, rng.int(1, 5), rng.int(2, 10), rng.int(6, 12));
  const hint =
    t === 2 ? 'Multiplicar por 2 es sumar el número dos veces.' : t === 5 ? 'Los múltiplos de 5 terminan en 0 o en 5: salta de 5 en 5.' : 'Multiplicar por 10 es poner un cero al final.';
  return tableQuestion(rng, 'mult2510', t, n, hint);
};

const mult34: Generator = (rng, d) => {
  const t = rng.pick([3, 4]);
  const n = byLevel<number>(d, rng.int(1, 5), rng.int(2, 10), rng.int(6, 12));
  const hint = t === 3 ? 'Por 3 es el doble del número más el número.' : 'Por 4 es el doble del doble.';
  return tableQuestion(rng, 'mult34', t, n, hint);
};

const mult69: Generator = (rng, d) => {
  const t = d === 1 ? rng.pick([6, 7]) : rng.pick([6, 7, 8, 9]);
  const n = byLevel<number>(d, rng.int(2, 6), rng.int(2, 9), rng.int(6, 10));
  const hint =
    t === 6
      ? 'Por 6 es por 5 más una vez el número.'
      : t === 9
        ? 'Por 9 es por 10 menos una vez el número.'
        : 'Parte el número en dos partes fáciles, por ejemplo 5 y lo que sobra, y suma los resultados.';
  return tableQuestion(rng, 'mult69', t, n, hint);
};

const divide: Generator = (rng, d) => {
  const t = d === 1 ? rng.pick([2, 5, 10]) : d === 2 ? rng.pick([2, 3, 4, 5, 10]) : rng.int(2, 9);
  const q = byLevel<number>(d, rng.int(1, 5), rng.int(2, 10), rng.int(2, 10));
  const p = t * q;
  const { choices, answer } = buildChoices(rng, q, [q + 1, q - 1, p - t, t, q + 2], { min: 0, max: 100 });
  return {
    skillId: 'divide',
    prompt: `${p} ÷ ${t} = ?`,
    choices,
    answer,
    hint: `Piensa: ¿qué número multiplicado por ${t} da ${p}?`,
    meta: { p, t, q },
  };
};

/* ───────────── Mundo 5 · Volcán de las Fracciones ───────────── */

type Frac = [num: number, den: number];
const fr = ([n, d]: Frac): string => `${n}/${d}`;
const sameValue = (a: Frac, b: Frac): boolean => a[0] * b[1] === b[0] * a[1];

/** Opciones de fracciones: nunca repite un valor (1/2 y 2/4 no pueden estar juntas) y no deja respuestas ambiguas. */
function fractionChoices(rng: Rng, answer: Frac, wrongs: Frac[], proper = true, count = 4): { choices: string[]; answer: string } {
  const picked: Frac[] = [];
  const valid = (w: Frac): boolean =>
    Number.isInteger(w[0]) && Number.isInteger(w[1]) && w[0] >= 1 && w[1] >= 2 && (!proper || w[0] < w[1]) && !sameValue(w, answer) && !picked.some((p) => sameValue(p, w));
  for (const w of rng.shuffle(wrongs)) if (picked.length < count - 1 && valid(w)) picked.push(w);
  for (let k = 1; picked.length < count - 1 && k <= 12; k++) {
    const near: Frac[] = [[answer[0] + k, answer[1]], [answer[0] - k, answer[1]], [answer[0], answer[1] + k], [answer[0], answer[1] - k]];
    for (const w of rng.shuffle(near)) if (picked.length < count - 1 && valid(w)) picked.push(w);
  }
  return { choices: rng.shuffle([answer, ...picked]).map(fr), answer: fr(answer) };
}

const fractionRead: Generator = (rng, d) => {
  const parts = byLevel<number>(d, rng.int(2, 4), rng.int(3, 6), rng.int(5, 10));
  const n = rng.int(1, parts - 1);
  const { choices, answer } = fractionChoices(rng, [n, parts], [[parts - n, parts], [n, parts - n], [parts, n], [n + 1, parts], [n, parts + 1]]);
  const bar = Array.from({ length: parts }, (_, i) => (i < n ? '🟧' : '⬜')).join(' ');
  return {
    skillId: 'fractionRead',
    prompt: '¿Qué fracción está pintada?',
    visual: bar,
    choices,
    answer,
    hint: 'Arriba va cuántas partes están pintadas; abajo, en cuántas partes iguales se partió todo.',
    meta: { n, parts },
  };
};

const fractionCompare: Generator = (rng, d) => {
  let fracs: Frac[];
  if (d === 1) {
    const den = rng.int(4, 10);
    const nums = rng.shuffle(Array.from({ length: den - 1 }, (_, i) => i + 1)).slice(0, 3);
    fracs = nums.map((x) => [x, den] as Frac);
  } else if (d === 2) {
    const num = rng.int(1, 4);
    const dens = rng.shuffle(Array.from({ length: 12 - num }, (_, i) => num + 1 + i)).slice(0, 3);
    fracs = dens.map((x) => [num, x] as Frac);
  } else {
    const dens = [2, 3, 4, 5, 6, 8, 10, 12];
    fracs = sample<Frac[]>(
      () => Array.from({ length: 4 }, () => { const den = rng.pick(dens); return [rng.int(1, den - 1), den] as Frac; }),
      (list) => list.every((a, i) => list.every((b, j) => i === j || !sameValue(a, b))),
    );
  }
  const mode = d === 1 ? 'max' : rng.pick(['max', 'min']);
  const best = fracs.reduce((a, b) => {
    const bigger = b[0] * a[1] > a[0] * b[1];
    return (mode === 'max') === bigger ? b : a;
  });
  const hint =
    d === 1
      ? 'Si las partes son del mismo tamaño, gana la que tiene más partes pintadas.'
      : d === 2
        ? 'Con el mismo número arriba, entre más partes tiene el entero, más pequeña es cada parte.'
        : 'Compara cada una con 1/2, o busca fracciones equivalentes con el mismo número abajo.';
  return {
    skillId: 'fractionCompare',
    prompt: mode === 'max' ? '¿Cuál fracción es la mayor?' : '¿Cuál fracción es la menor?',
    choices: fracs.map(fr),
    answer: fr(best),
    hint,
    meta: { fracs: fracs.flat(), mode },
  };
};

const fractionEquiv: Generator = (rng, d) => {
  const den = d === 1 ? rng.int(2, 4) : rng.int(2, d === 2 ? 5 : 6);
  const n = d === 1 ? 1 : rng.int(1, den - 1);
  const k = d === 1 ? 2 : rng.int(2, d === 2 ? 3 : 5);
  const target = n * k;
  const { choices, answer } = buildChoices(rng, target, [n + (den * k - den), target + 1, target - 1, n + k, target + k], { min: 1, max: 60 });
  return {
    skillId: 'fractionEquiv',
    prompt: `${n}/${den} = __/${den * k}`,
    choices,
    answer,
    hint: `El de abajo se multiplicó por ${k}; multiplica también el de arriba por ${k}.`,
    meta: { n, den, k },
  };
};

const fractionAdd: Generator = (rng, d) => {
  const den = byLevel<number>(d, rng.int(3, 6), rng.int(5, 10), rng.int(5, 12));
  const sub = d === 3 && rng.chance(0.5);
  let a: number;
  let b: number;
  if (sub) {
    a = rng.int(2, den - 1);
    b = rng.int(1, a - 1);
  } else {
    a = rng.int(1, den - 2);
    b = rng.int(1, den - 1 - a);
  }
  const result = sub ? a - b : a + b;
  const { choices, answer } = fractionChoices(
    rng,
    [result, den],
    sub
      ? [[a + b, den], [result + 1, den], [result - 1, den], [result, 2 * den]]
      : [[result, 2 * den], [result + 1, den], [result - 1, den], [a * b, den], [result + 2, den]],
  );
  return {
    skillId: 'fractionAdd',
    prompt: `${a}/${den} ${sub ? '−' : '+'} ${b}/${den} = ?`,
    choices,
    answer,
    hint: 'Las partes son del mismo tamaño: suma o resta solo los de arriba y deja el de abajo igual.',
    meta: { a, b, den, kind: sub ? 'sub' : 'add' },
  };
};

const fractionOf: Generator = (rng, d) => {
  let n: number;
  let den: number;
  let q: number;
  if (d === 1) {
    n = 1;
    den = rng.int(2, 4);
    q = rng.int(1, 5);
  } else if (d === 2) {
    n = 1;
    den = rng.pick([2, 3, 4, 5, 6, 8, 10]);
    q = rng.int(2, 8);
  } else {
    den = rng.pick([3, 4, 5, 6, 8]);
    n = rng.int(2, den - 1);
    q = rng.int(2, 10);
  }
  const total = den * q;
  const result = n * q;
  const { choices, answer } = buildChoices(rng, result, [q, result + q, result - q, total - result, n * den, result + 1], { min: 1, max: 100 });
  return {
    skillId: 'fractionOf',
    prompt: `${n}/${den} de ${total} = ?`,
    choices,
    answer,
    hint: `Reparte ${total} en ${den} partes iguales${n > 1 ? ` y toma ${n} de ellas` : ''}: divide entre ${den}${n > 1 ? ` y multiplica por ${n}` : ''}.`,
    meta: { n, den, total },
  };
};

/* ───────────── Mundo 6 · Océano Decimal ───────────── */

/** Los decimales se calculan en centésimas (enteros) para no arrastrar errores de coma flotante. */
const fmtDec = (cents: number): string => {
  const whole = Math.floor(cents / 100);
  const frac = cents % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
};

function decimalChoices(rng: Rng, cents: number, wrongs: number[], step: number): { choices: string[]; answer: string } {
  const { choices, answer } = buildChoices(rng, cents, wrongs, { min: 1, max: 100_000, step });
  return { choices: choices.map((c) => fmtDec(Number(c))), answer: fmtDec(Number(answer)) };
}

const PLACE_NAMES: Array<[one: string, many: string]> = [
  ['unidad', 'unidades'],
  ['décima', 'décimas'],
  ['centésima', 'centésimas'],
  ['milésima', 'milésimas'],
];
const count = (n: number, [one, many]: [string, string]): string => `${n} ${n === 1 ? one : many}`;

const decimalPlace: Generator = (rng, d): Question => {
  if (d === 3) {
    const [u, t, h] = sample<number[]>(
      () => [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)],
      ([a, b, c]) => a !== b && b !== c && a !== c,
    ) as [number, number, number];
    const pos = rng.int(0, 2);
    const digit = [u, t, h][pos] as number;
    const names = [0, 1, 2, 3].map((i) => count(digit, PLACE_NAMES[i] as [string, string]));
    return {
      skillId: 'decimalPlace',
      prompt: `En ${u}.${t}${h}, ¿qué valor tiene el ${digit}?`,
      choices: rng.shuffle(names),
      answer: names[pos] as string,
      hint: 'Después del punto: primero las décimas, luego las centésimas. Antes del punto están las unidades.',
      meta: { u, t, h, pos, digit },
    };
  }
  const u = rng.int(1, 9);
  const t = d === 1 ? rng.int(1, 9) : rng.int(0, 9);
  const h = d === 1 ? 0 : rng.int(1, 9);
  const v = u * 100 + t * 10 + h;
  const prompt =
    d === 1
      ? `¿Qué número es ${count(u, PLACE_NAMES[0] as [string, string])} y ${count(t, PLACE_NAMES[1] as [string, string])}?`
      : `¿Qué número es ${count(u, PLACE_NAMES[0] as [string, string])}, ${count(t, PLACE_NAMES[1] as [string, string])} y ${count(h, PLACE_NAMES[2] as [string, string])}?`;
  const swapped = u * 100 + h * 10 + t;
  const { choices, answer } = decimalChoices(rng, v, [swapped, v + 10, v - 10, v + 100, v - 100, v + 1], d === 1 ? 10 : 1);
  return {
    skillId: 'decimalPlace',
    prompt,
    choices,
    answer,
    hint: 'Las décimas van justo después del punto; las centésimas, en el siguiente lugar.',
    meta: { u, t, h },
  };
};

const decimalCompare: Generator = (rng, d) => {
  const count4 = d === 3 ? 4 : 3;
  let values: number[];
  if (d === 1) {
    const whole = rng.int(0, 3) * 100;
    values = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count4).map((t) => whole + t * 10);
  } else {
    // Mezcla décimas y centésimas: 0.5 es mayor que 0.45 aunque 45 sea mayor que 5.
    const whole = d === 2 ? rng.int(0, 2) * 100 : rng.int(0, 5) * 100;
    values = sample<number[]>(
      () => Array.from({ length: count4 }, () => whole + (rng.chance(0.4) ? rng.int(1, 9) * 10 : rng.int(1, 99))),
      (list) => new Set(list).size === list.length && list.some((v) => v % 10 === 0) && list.some((v) => v % 10 !== 0),
    );
  }
  const mode = d === 1 ? 'max' : rng.pick(['max', 'min']);
  const best = mode === 'max' ? Math.max(...values) : Math.min(...values);
  return {
    skillId: 'decimalCompare',
    prompt: mode === 'max' ? '¿Cuál número es el mayor?' : '¿Cuál número es el menor?',
    choices: values.map(fmtDec),
    answer: fmtDec(best),
    hint:
      d === 1
        ? 'Compara primero las unidades y después las décimas.'
        : 'No mires cuántas cifras tiene: compara cifra por cifra desde la izquierda. 0.5 es igual a 0.50.',
    meta: { cents: values, mode },
  };
};

const decimalAdd: Generator = (rng, d) => {
  const sub = d === 3 && rng.chance(0.5);
  const tenths = (): number => rng.int(1, 99) * 10;
  const mixed = (): number => (rng.chance(0.5) ? tenths() : rng.int(11, 999));
  let a: number;
  let b: number;
  if (d === 1) {
    a = tenths();
    b = tenths();
  } else {
    a = sample(mixed, (x) => x % 10 !== 0 || rng.chance(0.3));
    b = sample(mixed, (x) => x % 10 !== 0 || rng.chance(0.3));
  }
  if (sub && a < b) [a, b] = [b, a];
  if (sub && a === b) a += 15;
  const result = sub ? a - b : a + b;
  const { choices, answer } = decimalChoices(rng, result, [result + 10, result - 10, result + 100, result - 100, result + 1, result - 1], d === 1 ? 10 : 5);
  return {
    skillId: 'decimalAdd',
    prompt: `${fmtDec(a)} ${sub ? '−' : '+'} ${fmtDec(b)} = ?`,
    choices,
    answer,
    hint: 'Alinea los puntos: décimas con décimas y centésimas con centésimas. Si falta una cifra, imagina un 0.',
    meta: { a, b, kind: sub ? 'sub' : 'add' },
  };
};

const percent: Generator = (rng, d) => {
  const p = d === 1 ? rng.pick([50, 10, 100]) : d === 2 ? rng.pick([25, 20, 50, 75, 10]) : rng.pick([5, 15, 30, 40, 60, 90, 25, 75]);
  const base = 100 / gcd(p, 100);
  const total = base * rng.int(1, Math.max(1, Math.floor((d === 1 ? 60 : d === 2 ? 120 : 200) / base)));
  const result = (total * p) / 100;
  const { choices, answer } = buildChoices(rng, result, [total - result, result + 10, result - 10, p, result * 2, result + 5], { min: 1, max: 400 });
  const hint =
    p === 50
      ? 'El 50 % es la mitad.'
      : p === 10
        ? 'El 10 % es dividir entre 10.'
        : p === 25
          ? 'El 25 % es la mitad de la mitad.'
          : p === 100
            ? 'El 100 % es todo.'
            : 'Busca primero el 10 % (dividir entre 10) y arma el porcentaje con él.';
  return { skillId: 'percent', prompt: `${p}% de ${total} = ?`, choices, answer, hint, meta: { p, total } };
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const perimeterArea: Generator = (rng, d) => {
  const kind = d === 1 ? 'area' : d === 2 ? rng.pick(['area', 'perimeter']) : rng.pick(['area', 'perimeter', 'side']);
  const square = d >= 2 && kind !== 'side' && rng.chance(0.3);
  const [lo, hi] = byLevel<[number, number]>(d, [2, 6], [2, 10], [3, 12]);
  const a = rng.int(lo, hi);
  const b = square ? a : sample(() => rng.int(lo, hi), (x) => x !== a);
  const area = a * b;
  const perimeter = 2 * (a + b);
  let prompt: string;
  let result: number;
  let wrongs: number[];
  let hint: string;
  if (kind === 'side') {
    prompt = `El perímetro de un rectángulo es ${perimeter} cm y un lado mide ${a} cm. ¿Cuánto mide el otro lado?`;
    result = b;
    wrongs = [perimeter / 2, perimeter - a, b + 1, b - 1, a + b + 1];
    hint = `Los dos lados distintos suman la mitad del perímetro (${perimeter / 2}). Réstale ${a}.`;
  } else {
    const shape = square ? `Un cuadrado tiene lados de ${a} cm.` : `Un rectángulo mide ${a} cm de largo y ${b} cm de ancho.`;
    if (kind === 'area') {
      prompt = `${shape} ¿Cuál es su área en cm²?`;
      result = area;
      wrongs = [perimeter, a + b, area + a, area - b, area + 2];
      hint = 'El área es cuántos cuadritos caben adentro: largo × ancho.';
    } else {
      prompt = `${shape} ¿Cuál es su perímetro en cm?`;
      result = perimeter;
      wrongs = [area, a + b, perimeter + 2, perimeter - 2, a * 2 + b];
      hint = 'El perímetro es el contorno: suma todos los lados (dos largos y dos anchos).';
    }
  }
  const { choices, answer } = buildChoices(rng, result, wrongs, { min: 1, max: 300 });
  return { skillId: 'perimeterArea', prompt, choices, answer, hint, meta: { kind, a, b, square: square ? 1 : 0 } };
};

/* ───────────── Mundo 7 · Estación Espacial ───────────── */

/** Los negativos usan el signo menos «−» (U+2212), el mismo de las restas, y no el guion. */
const fmtInt = (n: number): string => (n < 0 ? `−${-n}` : String(n));
const paren = (n: number): string => (n < 0 ? `(${fmtInt(n)})` : String(n));

function intChoices(rng: Rng, answer: number, wrongs: number[]): { choices: string[]; answer: string } {
  const { choices, answer: a } = buildChoices(rng, answer, wrongs, { min: -200, max: 200 });
  return { choices: choices.map((c) => fmtInt(Number(c))), answer: fmtInt(Number(a)) };
}

const RATIO_PAIRS: Array<[string, string]> = [
  ['astronautas', 'robots'],
  ['naves', 'satélites'],
  ['cohetes', 'planetas'],
  ['estrellas', 'cometas'],
];
const SHOP_ITEMS = ['boletos', 'paquetes', 'cuadernos', 'stickers'];

const ratio: Generator = (rng, d): Question => {
  const unit = d === 3 || (d === 2 && rng.chance(0.4));
  if (!unit) {
    const [aLo, aHi, kHi] = byLevel<[number, number, number]>(d, [1, 3, 4], [2, 5, 6], [2, 5, 6]);
    const a = rng.int(aLo, aHi);
    const b = sample(() => rng.int(aLo, aHi + 1), (x) => x !== a);
    const k = rng.int(2, kHi);
    const [x, y] = rng.pick(RATIO_PAIRS);
    const result = b * k;
    const { choices, answer } = buildChoices(rng, result, [b + k, a * k, result + b, result - b, result + k], { min: 1, max: 100 });
    return {
      skillId: 'ratio',
      prompt: `Por cada ${a} ${x} hay ${b} ${y}. Si hay ${a * k} ${x}, ¿cuántos ${y} hay?`,
      choices,
      answer,
      hint: `${a} ${x} se repiten ${k} veces; repite también los ${b} ${y} ${k} veces.`,
      meta: { kind: 'scale', a, b, k },
    };
  }
  const n = rng.int(2, 6);
  const u = rng.int(2, 9);
  const m = sample(() => rng.int(2, 12), (x) => x !== n);
  const price = n * u;
  const result = m * u;
  const item = rng.pick(SHOP_ITEMS);
  const { choices, answer } = buildChoices(rng, result, [price + (m - n), result + u, result - u, u + m, price * 2], { min: 1, max: 200 });
  return {
    skillId: 'ratio',
    prompt: `${n} ${item} cuestan $${price}. ¿Cuánto cuestan ${m} ${item}?`,
    choices,
    answer,
    hint: `Busca el precio de 1: $${price} ÷ ${n}. Luego multiplícalo por ${m}.`,
    meta: { kind: 'unit', n, price, m },
  };
};

const integerOrder: Generator = (rng, d) => {
  const limit = byLevel<number>(d, 5, 12, 30);
  const nums = sample<number[]>(
    () => Array.from({ length: 4 }, () => rng.int(-limit, limit)),
    (list) => new Set(list).size === 4 && list.some((x) => x < 0) && list.some((x) => x >= 0),
  );
  const mode = rng.pick(['max', 'min']);
  const best = mode === 'max' ? Math.max(...nums) : Math.min(...nums);
  return {
    skillId: 'integerOrder',
    prompt: mode === 'max' ? '¿Cuál es el número mayor?' : '¿Cuál es el número menor?',
    choices: nums.map(fmtInt),
    answer: fmtInt(best),
    hint: 'En la recta numérica, los números crecen hacia la derecha. Entre negativos, el más lejos del 0 es el menor.',
    meta: { nums, mode },
  };
};

const integerAdd: Generator = (rng, d) => {
  let a: number;
  let b: number;
  const sub = d === 3 && rng.chance(0.5);
  if (d === 1) {
    const big = rng.int(2, 10);
    const small = rng.int(1, big - 1);
    [a, b] = rng.chance(0.5) ? [-small, big] : [big, -small];
  } else {
    const pick = (): number => rng.pick([-1, 1]) * rng.int(1, d === 2 ? 12 : 20);
    a = pick();
    b = pick();
  }
  const result = sub ? a - b : a + b;
  const wrongs = [Math.abs(a) + Math.abs(b), -result, result + 1, result - 1, sub ? a + b : a - b, result + 2];
  const { choices, answer } = intChoices(rng, result, wrongs);
  return {
    skillId: 'integerAdd',
    prompt: `${fmtInt(a)} ${sub ? '−' : '+'} ${paren(b)} = ?`,
    choices,
    answer,
    hint: sub
      ? 'Restar un número es sumar su opuesto: a − (−b) es lo mismo que a + b.'
      : 'Si los signos son distintos, resta los valores y deja el signo del que está más lejos del 0.',
    meta: { a, b, kind: sub ? 'sub' : 'add' },
  };
};

const orderOps: Generator = (rng, d) => {
  const templates = d === 1 ? [1, 2] : d === 2 ? [3, 4, 5] : [6, 7];
  const t = rng.pick(templates);
  const r = (lo: number, hi: number): number => rng.int(lo, hi);
  let prompt = '';
  let value = 0;
  let traps: number[] = [];
  let meta: Record<string, number> = {};
  const done = (): boolean => value >= 0 && value <= 300 && traps.every((x) => x !== value);
  const build = (): void => {
    const a = r(2, 9);
    const b = r(2, 9);
    const c = r(2, 9);
    const dd = r(2, 6);
    const e = r(2, 4);
    meta = { t, a, b, c };
    if (t === 1) {
      prompt = `${a} + ${b} × ${c} = ?`;
      value = a + b * c;
      traps = [(a + b) * c];
    } else if (t === 2) {
      prompt = `${a * b + 5} − ${b} × ${c} = ?`;
      value = a * b + 5 - b * c;
      traps = [(a * b + 5 - b) * c];
    } else if (t === 3) {
      prompt = `(${a} + ${b}) × ${c} = ?`;
      value = (a + b) * c;
      traps = [a + b * c];
    } else if (t === 4) {
      prompt = `${a} + ${b} × ${c} − ${dd} = ?`;
      value = a + b * c - dd;
      traps = [(a + b) * c - dd];
      meta = { t, a, b, c, d: dd };
    } else if (t === 5) {
      prompt = `${a * e} ÷ ${e} + ${b} × ${c} = ?`;
      value = a + b * c;
      traps = [((a * e) / e + b) * c];
      meta = { t, a, b, c, e };
    } else if (t === 6) {
      prompt = `(${a} + ${b}) × ${c} − ${dd * e} ÷ ${e} = ?`;
      value = (a + b) * c - dd;
      traps = [((a + b) * c - dd * e) / e, a + b * c - dd];
      meta = { t, a, b, c, d: dd, e };
    } else {
      prompt = `${a}² + ${b} × ${c} = ?`;
      value = a * a + b * c;
      traps = [2 * a + b * c, (a * a + b) * c];
    }
  };
  do build();
  while (!done());
  const { choices, answer } = buildChoices(rng, value, [...traps, value + 1, value - 1, value + 10, value - 10, value + 2], { min: 0, max: 400 });
  return {
    skillId: 'orderOps',
    prompt,
    choices,
    answer,
    hint: 'Primero los paréntesis y las potencias, luego × y ÷ de izquierda a derecha, y al final + y −.',
    meta,
  };
};

function gcdOf(a: number, b: number): number {
  return b === 0 ? a : gcdOf(b, a % b);
}

const gcdLcm: Generator = (rng, d) => {
  const kind = d === 1 ? 'lcm' : rng.pick(['gcd', 'lcm']);
  const [a, b] = sample<[number, number]>(
    () => {
      if (d === 1) return [rng.int(2, 6), rng.int(2, 6)];
      if (d === 2) return [rng.int(4, 12), rng.int(4, 12)];
      return [rng.int(6, 36), rng.int(6, 36)];
    },
    ([x, y]) => x !== y && (kind === 'lcm' ? (x * y) / gcdOf(x, y) <= (d === 1 ? 30 : 200) : gcdOf(x, y) > 1 && gcdOf(x, y) < Math.min(x, y)),
  );
  const g = gcdOf(a, b);
  const l = (a * b) / g;
  const result = kind === 'lcm' ? l : g;
  const wrongs = kind === 'lcm' ? [a * b, a + b, Math.max(a, b), l * 2, l + a, l - Math.min(a, b)] : [Math.min(a, b), 1, g * 2, a - b, l];
  const { choices, answer } = buildChoices(rng, result, wrongs, { min: 1, max: 500 });
  return {
    skillId: 'gcdLcm',
    prompt: kind === 'lcm' ? `¿Cuál es el mínimo común múltiplo de ${a} y ${b}?` : `¿Cuál es el máximo común divisor de ${a} y ${b}?`,
    choices,
    answer,
    hint:
      kind === 'lcm'
        ? `Escribe los múltiplos de cada uno (${a}, ${a * 2}, ${a * 3}… y ${b}, ${b * 2}, ${b * 3}…) y busca el primero que se repite.`
        : 'Busca el número más grande que divide a los dos sin dejar resto.',
    meta: { a, b, kind },
  };
};

/* ───────────── Mundo 8 · Laboratorio ───────────── */

/** Pregunta de respuesta escrita: sin opciones, la respuesta es un entero no negativo. */
function typedQuestion(skillId: string, prompt: string, answer: number, hint: string, meta: Meta): Question {
  return { skillId, prompt, choices: [], input: 'number', answer: String(answer), hint, meta };
}

const evalExpr: Generator = (rng, d) => {
  const x = rng.int(2, 9);
  let prompt: string;
  let value: number;
  let a: number;
  let b: number;
  let hint: string;
  if (d === 1) {
    a = rng.int(2, 6);
    b = rng.int(1, 9);
    if (rng.chance(0.5)) {
      prompt = `Si x = ${x}, ¿cuánto vale ${a}x?`;
      value = a * x;
      b = 0;
    } else {
      prompt = `Si x = ${x}, ¿cuánto vale x + ${b}?`;
      value = x + b;
    }
    hint = 'Cambia la x por su valor. Un número pegado a la x significa multiplicar: 3x es 3 × x.';
  } else if (d === 2) {
    a = rng.int(2, 9);
    const minus = rng.chance(0.5);
    b = minus ? rng.int(1, a * x - 1) : rng.int(1, 12);
    prompt = `Si x = ${x}, ¿cuánto vale ${a}x ${minus ? '−' : '+'} ${b}?`;
    value = minus ? a * x - b : a * x + b;
    hint = 'Primero multiplica (el número por la x) y después suma o resta.';
  } else {
    const y = rng.int(2, 9);
    a = rng.int(2, 7);
    b = rng.int(2, 7);
    if (rng.chance(0.5)) {
      prompt = `Si x = ${x} e y = ${y}, ¿cuánto vale ${a}x + ${b}y?`;
      value = a * x + b * y;
    } else {
      prompt = `Si x = ${x}, ¿cuánto vale x² + ${b}?`;
      value = x * x + b;
    }
    hint = 'Cambia cada letra por su número. x² es x × x. Multiplica primero y suma al final.';
  }
  const { choices, answer } = buildChoices(rng, value, [value + 1, value - 1, a + x + b, x + b, value + b, value - b], { min: 0, max: 300 });
  return { skillId: 'evalExpr', prompt, choices, answer, hint, meta: { x, a, b } };
};

const fmtLin = (a: number, b: number): string => {
  const coef = a === 1 ? 'x' : `${a}x`;
  if (b === 0) return coef;
  return `${coef} ${b > 0 ? '+' : '−'} ${Math.abs(b)}`;
};

const simplify: Generator = (rng, d) => {
  let prompt: string;
  let A: number;
  let B: number;
  let wrongs: string[];
  if (d === 1) {
    const a = rng.int(2, 9);
    const b = rng.int(2, 9);
    A = a + b;
    B = 0;
    prompt = `${a}x + ${b}x = ?`;
    wrongs = [`${A}x²`, `${A + 1}x`, `${A - 1}x`, `${a * b}x`, `${a}x + ${b}`];
  } else {
    const [a, b, c, e] = sample<number[]>(
      () => [rng.int(2, 9), rng.int(1, 9), rng.int(2, 9), rng.int(1, 9)],
      ([p, , q]) => d === 2 || (p as number) !== (q as number),
    ) as [number, number, number, number];
    const signs = d === 2 ? [1, 1, 1] : sample<number[]>(() => [rng.pick([1, -1]), rng.pick([1, -1]), rng.pick([1, -1])], ([, s2, s3]) => (s2 as number) < 0 || (s3 as number) < 0);
    const [sB, sC, sD] = signs as [number, number, number];
    A = a + sC * c;
    B = sB * b + sD * e;
    if (A < 1) {
      A = a + c;
      prompt = `${a}x ${sB < 0 ? '−' : '+'} ${b} + ${c}x ${sD < 0 ? '−' : '+'} ${e} = ?`;
      B = sB * b + sD * e;
    } else {
      prompt = `${a}x ${sB < 0 ? '−' : '+'} ${b} ${sC < 0 ? '−' : '+'} ${c}x ${sD < 0 ? '−' : '+'} ${e} = ?`;
    }
    wrongs = [fmtLin(A + 1, B), fmtLin(A - 1, B), fmtLin(A, -B), `${A + B}x`, fmtLin(A, B + 1), fmtLin(A, B - 1)];
  }
  const answer = fmtLin(A, B);
  const picked: string[] = [];
  for (const w of rng.shuffle(wrongs)) if (picked.length < 3 && w !== answer && !picked.includes(w) && !w.startsWith('0x') && !w.startsWith('-')) picked.push(w);
  for (let k = 1; picked.length < 3 && k < 20; k++) {
    const extra = fmtLin(A + k, B);
    if (extra !== answer && !picked.includes(extra)) picked.push(extra);
  }
  return {
    skillId: 'simplify',
    prompt,
    choices: rng.shuffle([answer, ...picked]),
    answer,
    hint: 'Junta los términos con x entre sí y los números sueltos entre sí. No se pueden mezclar x con números.',
    meta: { d },
  };
};

const eq1: Generator = (rng, d) => {
  const kind = d === 1 ? rng.pick(['add', 'sub']) : d === 2 ? rng.pick(['mul', 'div']) : rng.pick(['add', 'sub', 'mul', 'div']);
  const big = d === 3;
  const x = rng.int(2, big ? 15 : 10);
  const a = rng.int(2, big ? 20 : 9);
  let prompt: string;
  let wrongs: number[];
  let hint: string;
  if (kind === 'add') {
    prompt = `x + ${a} = ${x + a}. ¿Cuánto vale x?`;
    wrongs = [x + a + a, x + 1, x - 1, a];
    hint = `Para dejar sola la x, resta ${a} a los dos lados.`;
  } else if (kind === 'sub') {
    prompt = `x − ${a} = ${x}. ¿Cuánto vale x?`;
    wrongs = [x - a, x + a + 1, x + 1, a];
    hint = `Para dejar sola la x, suma ${a} a los dos lados.`;
  } else if (kind === 'mul') {
    prompt = `${a}x = ${a * x}. ¿Cuánto vale x?`;
    wrongs = [a * x - a, a * x + a, x + 1, a];
    hint = `${a}x es ${a} × x. Divide los dos lados entre ${a}.`;
  } else {
    prompt = `x ÷ ${a} = ${x}. ¿Cuánto vale x?`;
    wrongs = [x + a, x - a, x + 1, a];
    hint = `x se dividió entre ${a}. Multiplica los dos lados por ${a}.`;
  }
  const result = kind === 'sub' ? x + a : kind === 'div' ? x * a : x;
  const meta = { kind, a, x };
  if (big) return typedQuestion('eq1', prompt, result, hint, meta);
  const { choices, answer } = buildChoices(rng, result, wrongs, { min: 1, max: 200 });
  return { skillId: 'eq1', prompt, choices, answer, hint, meta };
};

const eq2: Generator = (rng, d) => {
  const kind = d === 1 ? 'add' : rng.pick(d === 2 ? ['add', 'sub', 'div'] : ['add', 'sub', 'div', 'sub']);
  const x = rng.int(2, d === 3 ? 15 : 9);
  const a = rng.int(2, d === 3 ? 9 : 5);
  let b = rng.int(1, d === 3 ? 20 : 12);
  let prompt: string;
  let hint: string;
  let c: number;
  let xValue = x;
  if (kind === 'add') {
    c = a * x + b;
    prompt = `${a}x + ${b} = ${c}. ¿Cuánto vale x?`;
    hint = `Primero resta ${b} a los dos lados; luego divide entre ${a}.`;
  } else if (kind === 'sub') {
    b = rng.int(1, a * x - 1);
    c = a * x - b;
    prompt = `${a}x − ${b} = ${c}. ¿Cuánto vale x?`;
    hint = `Primero suma ${b} a los dos lados; luego divide entre ${a}.`;
  } else {
    xValue = x * a;
    c = x + b;
    prompt = `x ÷ ${a} + ${b} = ${c}. ¿Cuánto vale x?`;
    hint = `Primero resta ${b} a los dos lados; luego multiplica por ${a}.`;
  }
  const meta = { kind, a, b, x: xValue };
  if (d === 3) return typedQuestion('eq2', prompt, xValue, hint, meta);
  const { choices, answer } = buildChoices(rng, xValue, [c - b, c + b, xValue + 1, xValue - 1, c], { min: 1, max: 300 });
  return { skillId: 'eq2', prompt, choices, answer, hint, meta };
};

const discount: Generator = (rng, d) => {
  const up = d === 3 && rng.chance(0.4);
  const p = d === 1 ? rng.pick([50, 10]) : d === 2 ? rng.pick([10, 20, 25, 50]) : rng.pick([5, 15, 30, 35, 40, 20, 25]);
  const price = 20 * rng.int(1, d === 1 ? 5 : d === 2 ? 10 : 15);
  const amount = (price * p) / 100;
  const result = up ? price + amount : price - amount;
  const prompt = up
    ? `Un artículo de $${price} sube ${p}%. ¿Cuánto cuesta ahora?`
    : `Un artículo de $${price} tiene ${p}% de descuento. ¿Cuánto cuesta ahora?`;
  const hint = up
    ? `Calcula el ${p}% de ${price} y súmalo al precio.`
    : `Calcula el ${p}% de ${price} y réstalo al precio. Ojo: la pregunta es cuánto se paga, no cuánto se ahorra.`;
  const meta = { price, p, up: up ? 1 : 0 };
  if (d === 3) return typedQuestion('discount', prompt, result, hint, meta);
  const { choices, answer } = buildChoices(rng, result, [amount, up ? price - amount : price + amount, price, result + 5, result - 5], { min: 1, max: 600 });
  return { skillId: 'discount', prompt, choices, answer, hint, meta };
};

/* ───────────── Mundo 9 · Castillo del Álgebra ───────────── */

const coefX = (n: number): string => (n === 1 ? 'x' : `${n}x`);
const signed = (n: number): string => (n < 0 ? '−' : '+');

/** Mezcla la respuesta con errores típicos distintos; si faltan, rellena con variaciones. */
function textChoices(rng: Rng, answer: string, wrongs: string[], fill: (k: number) => string): string[] {
  const picked: string[] = [];
  for (const w of rng.shuffle(wrongs)) if (picked.length < 3 && w !== answer && !picked.includes(w) && !w.startsWith('1(')) picked.push(w);
  for (let k = 1; picked.length < 3 && k < 40; k++) {
    const extra = fill(k);
    if (extra !== answer && !picked.includes(extra)) picked.push(extra);
  }
  return rng.shuffle([answer, ...picked]);
}

const eqBoth: Generator = (rng, d) => {
  const c = rng.int(1, d === 1 ? 3 : 5);
  const k = rng.int(1, d === 1 ? 4 : 6);
  const a = c + k;
  const x = rng.int(2, d === 3 ? 14 : 9);
  const sub = d === 3 && rng.chance(0.5);
  const b = d === 1 ? 0 : sub ? rng.int(1, Math.min(12, k * x - 1)) : rng.int(1, 12);
  const e = sub ? k * x - b : b + k * x;
  const left = b === 0 ? `${a}x` : `${a}x ${sub ? '−' : '+'} ${b}`;
  const prompt = `${left} = ${coefX(c)} + ${e}. ¿Cuánto vale x?`;
  const hint = sub
    ? `Resta ${coefX(c)} a los dos lados para juntar las x. Después suma ${b} a los dos lados y divide entre ${k}.`
    : b === 0
      ? `Resta ${coefX(c)} a los dos lados: quedan ${k === 1 ? 'x' : `${k}x`} = ${e}. Luego divide entre ${k}.`
      : `Resta ${coefX(c)} a los dos lados para juntar las x. Después resta ${b} y divide entre ${k}.`;
  const meta = { a, b, c, e, x, sub: sub ? 1 : 0 };
  if (d === 3) return typedQuestion('eqBoth', prompt, x, hint, meta);
  const { choices, answer } = buildChoices(rng, x, [x + 1, x - 1, e - b, e + b, e, x + 2, x * 2], { min: 1, max: 100 });
  return { skillId: 'eqBoth', prompt, choices, answer, hint, meta };
};

const system: Generator = (rng, d) => {
  if (d === 1) {
    const [big, small] = sample<[number, number]>(
      () => [rng.int(4, 14), rng.int(1, 10)],
      ([p, q]) => p > q,
    );
    const S = big + small;
    const D = big - small;
    const askBig = rng.chance(0.5);
    const result = askBig ? big : small;
    const { choices, answer } = buildChoices(rng, result, [S / 2, D, S - D, result + 1, result - 1, S], { min: 1, max: 60 });
    return {
      skillId: 'system',
      prompt: `Dos números suman ${S} y su diferencia es ${D}. ¿Cuál es el ${askBig ? 'mayor' : 'menor'}?`,
      choices,
      answer,
      hint: `El mayor es el menor más ${D}. Si a ${S} le restas ${D}, quedan dos números menores iguales: divídelos entre 2.`,
      meta: { x: big, y: small, S, D },
    };
  }
  const x = rng.int(2, d === 3 ? 12 : 9);
  const y = rng.int(1, d === 3 ? 12 : 8);
  const ask = rng.pick(['x', 'y']);
  const result = ask === 'x' ? x : y;
  if (d === 2) {
    const sum = x + y;
    const diff = Math.abs(x - y);
    const first = `x + y = ${sum}`;
    const second = x >= y ? `x − y = ${diff}` : `y − x = ${diff}`;
    const prompt = `${first}, ${second}. ¿Cuánto vale ${ask}?`;
    const { choices, answer } = buildChoices(rng, result, [sum, diff, result + 1, result - 1, sum - result + 1, (sum + diff) / 2 + 1], { min: 1, max: 60 });
    return {
      skillId: 'system',
      prompt,
      choices,
      answer,
      hint: 'Suma las dos ecuaciones: la letra que aparece con + y con − desaparece. Resuelve la que queda y luego usa la primera ecuación.',
      meta: { x, y },
    };
  }
  const doubleX = rng.chance(0.5);
  const P = doubleX ? 2 * x + y : x + 2 * y;
  const prompt = `${doubleX ? '2x + y' : 'x + 2y'} = ${P}, x + y = ${x + y}. ¿Cuánto vale ${ask}?`;
  const hint = doubleX
    ? 'Resta la segunda ecuación a la primera: 2x − x = x, y la y desaparece. Así sale x; con ella, y.'
    : 'Resta la segunda ecuación a la primera: 2y − y = y, y la x desaparece. Así sale y; con ella, x.';
  return typedQuestion('system', prompt, result, hint, { x, y, doubleX: doubleX ? 1 : 0 });
};

const expand: Generator = (rng, d) => {
  let prompt: string;
  let A: number;
  let B: number;
  let wrongs: string[];
  const a = rng.int(2, d === 3 ? 6 : 9);
  const b = rng.int(2, 9);
  if (d === 1) {
    prompt = `${a}(x + ${b}) = ?`;
    A = a;
    B = a * b;
    wrongs = [fmtLin(a, b), fmtLin(1, a * b), fmtLin(a, a + b), fmtLin(a * b, a), fmtLin(a, a * b + 1)];
  } else if (d === 2) {
    prompt = `${a}(x − ${b}) = ?`;
    A = a;
    B = -a * b;
    wrongs = [fmtLin(a, -b), fmtLin(a, a * b), fmtLin(1, -a * b), fmtLin(a, -(a + b)), fmtLin(a, -a * b - 1)];
  } else {
    const [c, e, op, sg] = sample<[number, number, number, number]>(
      () => [rng.int(2, 6), rng.int(2, 9), rng.pick([1, -1]), rng.pick([1, -1])],
      ([cc, , o]) => a + o * cc >= 1,
    );
    prompt = `${a}(x + ${b}) ${signed(op)} ${c}(x ${signed(sg)} ${e}) = ?`;
    A = a + op * c;
    B = a * b + op * sg * c * e;
    wrongs = [fmtLin(A, a * b + c * e), fmtLin(A, a * b - c * e), fmtLin(A, -B), fmtLin(a + c, B), fmtLin(A, a * b + op * sg * e), fmtLin(A, B + c)];
  }
  const answer = fmtLin(A, B);
  return {
    skillId: 'expand',
    prompt,
    choices: textChoices(rng, answer, wrongs, (k) => fmtLin(A, B + k)),
    answer,
    hint: 'El número de afuera multiplica a cada término del paréntesis, también al segundo. Cuidado con el signo.',
    meta: { A, B },
  };
};

const fmtFactor = (p: number): string => `(x ${signed(p)} ${Math.abs(p)})`;
const fmtPair = (p: number, q: number): string => (p <= q ? `${fmtFactor(p)}${fmtFactor(q)}` : `${fmtFactor(q)}${fmtFactor(p)}`);

const factor: Generator = (rng, d) => {
  let prompt: string;
  let answer: string;
  let wrongs: string[];
  let hint: string;
  if (d === 1) {
    const [g, p, q] = sample<[number, number, number]>(
      () => [rng.int(2, 6), rng.int(1, 4), rng.int(1, 7)],
      ([, pp, qq]) => gcdOf(pp, qq) === 1,
    );
    prompt = `Factoriza: ${g * p}x + ${g * q}`;
    answer = `${g}(${coefX(p)} + ${q})`;
    wrongs = [`${g}(${coefX(p)} + ${g * q})`, `${g * p}(x + ${q})`, `${p}(${g}x + ${q})`, `${g}(${coefX(p)} − ${q})`, `${g + 1}(${coefX(p)} + ${q})`, `${g}(${coefX(p + 1)} + ${q})`];
    hint = `Busca el número que divide a ${g * p} y a ${g * q} a la vez, sácalo afuera y deja en el paréntesis lo que queda.`;
  } else if (d === 2) {
    const k = rng.int(2, 12);
    prompt = `Factoriza: x² − ${k * k}`;
    answer = `(x + ${k})(x − ${k})`;
    wrongs = [`(x − ${k})(x − ${k})`, `(x + ${k})(x + ${k})`, `(x − ${k * k})(x + 1)`, `(x + ${k})(x − ${k + 1})`, `(x + ${k * k})(x − 1)`];
    hint = `x² − ${k * k} es una resta de cuadrados: ${k * k} = ${k} × ${k}. Se factoriza como (x + ${k})(x − ${k}).`;
  } else {
    const [p, q] = sample<[number, number]>(
      () => [rng.pick([-1, 1]) * rng.int(1, 9), rng.pick([-1, 1]) * rng.int(1, 9)],
      ([pp, qq]) => pp + qq !== 0 && (pp < 0 || qq < 0 || rng.chance(0.4)),
    );
    const S = p + q;
    const P = p * q;
    prompt = `Factoriza: x² ${signed(S)} ${Math.abs(S) === 1 ? '' : Math.abs(S)}x ${signed(P)} ${Math.abs(P)}`;
    answer = fmtPair(p, q);
    wrongs = [fmtPair(-p, -q), fmtPair(p, -q), fmtPair(-p, q), fmtPair(p + 1, q), fmtPair(p, q + 1), fmtPair(p - 1, q)].filter((w) => !w.includes('(x + 0)') && !w.includes('(x − 0)'));
    hint = `Busca dos números que multiplicados den ${P} y sumados den ${S}. Esos son los que van en los paréntesis.`;
  }
  return {
    skillId: 'factor',
    prompt,
    choices: textChoices(rng, answer, wrongs, (k) => fmtPair(k + 1, k + 2)),
    answer,
    hint,
    meta: { d },
  };
};

const fmtQuad = (S: number, P: number): string => `x² ${signed(S)} ${Math.abs(S) === 1 ? '' : Math.abs(S)}x ${signed(P)} ${Math.abs(P)}`;

const quadratic: Generator = (rng, d) => {
  if (d <= 2) {
    const k = rng.int(2, d === 1 ? 12 : 9);
    const mult = d === 2 && rng.chance(0.5);
    const m = rng.int(2, 5);
    const a = rng.int(1, 20);
    const prompt = d === 1 ? `x² = ${k * k}. ¿Cuánto vale x si es positivo?` : mult ? `${m}x² = ${m * k * k}. ¿Cuánto vale x si es positivo?` : `x² + ${a} = ${k * k + a}. ¿Cuánto vale x si es positivo?`;
    const hint =
      d === 1
        ? `Busca el número que multiplicado por sí mismo da ${k * k}.`
        : mult
          ? `Divide los dos lados entre ${m}: x² = ${k * k}. Luego busca el número que multiplicado por sí mismo da ${k * k}.`
          : `Resta ${a} a los dos lados: x² = ${k * k}. Luego busca el número que multiplicado por sí mismo da ${k * k}.`;
    const { choices, answer } = buildChoices(rng, k, [k + 1, k - 1, k * k, k * 2, k + 2, m * k], { min: 1, max: 150 });
    return { skillId: 'quadratic', prompt, choices, answer, hint, meta: { k, d } };
  }
  const form = rng.pick(['factored', 'trinomial', 'mixed']);
  let prompt: string;
  let result: number;
  let hint: string;
  let p: number;
  let q: number;
  if (form === 'mixed') {
    [p, q] = sample<[number, number]>(
      () => [rng.int(1, 10), rng.int(1, 10)],
      ([pp, qq]) => pp !== qq,
    );
    prompt = `${fmtQuad(q - p, -p * q)} = 0. ¿Cuál es la solución positiva?`;
    result = p;
    hint = `Busca dos números que multiplicados den ${-p * q} y sumados den ${q - p}: son −${p} y ${q}. Cada paréntesis igualado a 0 da una solución.`;
  } else {
    [p, q] = sample<[number, number]>(
      () => [rng.int(1, 12), rng.int(1, 12)],
      ([pp, qq]) => pp < qq,
    );
    const big = rng.chance(0.5);
    result = big ? q : p;
    const ask = big ? 'mayor' : 'menor';
    prompt = form === 'factored' ? `(x − ${p})(x − ${q}) = 0. ¿Cuál es la solución ${ask}?` : `${fmtQuad(-(p + q), p * q)} = 0. ¿Cuál es la solución ${ask}?`;
    hint =
      form === 'factored'
        ? `Un producto es 0 cuando un factor es 0: x − ${p} = 0 o x − ${q} = 0.`
        : `Busca dos números que multiplicados den ${p * q} y sumados den ${p + q}; con ellos armas (x − ${p})(x − ${q}) = 0.`;
  }
  return typedQuestion('quadratic', prompt, result, hint, { p, q, form });
};

/* ───────────── Registro ───────────── */

export const SKILLS: Skill[] = [
  { id: 'count10', name: 'Contar hasta 10', emoji: '🍎', tip: 'Toca cada dibujo una sola vez mientras cuentas.', generate: count10 },
  { id: 'count20', name: 'Contar hasta 20', emoji: '🐟', tip: 'Cuenta de cinco en cinco y luego los que sobran.', generate: count20 },
  { id: 'compare', name: 'Mayor y menor', emoji: '⚖️', tip: 'El mayor es el que tiene más; el menor, el que tiene menos.', generate: compare },
  { id: 'add10', name: 'Sumar hasta 10', emoji: '➕', tip: 'Junta los dos grupos y cuenta todo desde el principio.', generate: add10 },
  { id: 'sub10', name: 'Restar hasta 10', emoji: '➖', tip: 'Tacha los que se van y cuenta los que quedan.', generate: sub10 },
  { id: 'add20', name: 'Sumar hasta 20', emoji: '🐚', tip: 'Completa 10 primero y suma lo que sobra.', generate: add20 },
  { id: 'sub20', name: 'Restar hasta 20', emoji: '🦀', tip: 'Cuenta hacia atrás desde el número más grande.', generate: sub20 },
  { id: 'tensOnes', name: 'Decenas y unidades', emoji: '🟦', tip: 'La cifra de la izquierda son decenas; la de la derecha, unidades.', generate: tensOnes },
  { id: 'missingAddend', name: 'El número escondido', emoji: '🔦', tip: 'Cuenta cuánto falta para llegar al total.', generate: missingAddend },
  { id: 'doubles', name: 'Dobles y mitades', emoji: '🪞', tip: 'Doble es sumar dos veces el mismo número; mitad es repartir en dos.', generate: doubles },
  { id: 'add100', name: 'Sumar hasta 100', emoji: '🧗', tip: 'Suma unidades con unidades y decenas con decenas; si pasas de 10, lleva 1.', generate: add100 },
  { id: 'sub100', name: 'Restar hasta 100', emoji: '🌉', tip: 'Si las unidades no alcanzan, pide prestada una decena.', generate: sub100 },
  { id: 'skipCount', name: 'Saltos de número', emoji: '🦘', tip: 'Fíjate cuánto cambia de un número al siguiente y repítelo.', generate: skipCount },
  { id: 'money', name: 'Monedas', emoji: '🪙', tip: 'Suma primero las monedas grandes y luego las pequeñas.', generate: money },
  { id: 'placeValue3', name: 'Centenas, decenas y unidades', emoji: '🏰', tip: 'Centena vale 100, decena vale 10 y unidad vale 1.', generate: placeValue3 },
  { id: 'groups', name: 'Grupos iguales', emoji: '🏘️', tip: 'Cuenta cuántos grupos hay y cuántos hay en cada uno; luego suma el mismo número varias veces.', generate: groups },
  { id: 'mult2510', name: 'Tablas del 2, 5 y 10', emoji: '🚌', tip: 'Por 2 es el doble, por 5 salta de 5 en 5 y por 10 añade un cero.', generate: mult2510 },
  { id: 'mult34', name: 'Tablas del 3 y 4', emoji: '🚲', tip: 'Por 3 es el doble más uno; por 4 es el doble del doble.', generate: mult34 },
  { id: 'mult69', name: 'Tablas del 6 al 9', emoji: '🚀', tip: 'Apóyate en tablas fáciles: por 6 es por 5 más uno; por 9 es por 10 menos uno.', generate: mult69 },
  { id: 'divide', name: 'Repartir y dividir', emoji: '🍕', tip: 'Dividir es buscar qué número por el divisor da el total.', generate: divide },
  { id: 'fractionRead', name: 'Leer fracciones', emoji: '🌋', tip: 'Abajo: en cuántas partes iguales se partió el entero. Arriba: cuántas partes se toman.', generate: fractionRead },
  { id: 'fractionCompare', name: 'Comparar fracciones', emoji: '🌊', tip: 'Mismo número abajo: gana el de arriba mayor. Mismo número arriba: gana el de abajo menor.', generate: fractionCompare },
  { id: 'fractionEquiv', name: 'Fracciones equivalentes', emoji: '👯', tip: 'Lo que le hagas al número de abajo, hazlo también al de arriba.', generate: fractionEquiv },
  { id: 'fractionAdd', name: 'Sumar y restar fracciones', emoji: '🌉', tip: 'Con el mismo número abajo, suma o resta solo los de arriba.', generate: fractionAdd },
  { id: 'fractionOf', name: 'Fracción de un número', emoji: '💎', tip: 'Divide entre el de abajo y multiplica por el de arriba.', generate: fractionOf },
  { id: 'decimalPlace', name: 'Leer decimales', emoji: '🪸', tip: 'Después del punto: primero las décimas y luego las centésimas.', generate: decimalPlace },
  { id: 'decimalCompare', name: 'Comparar decimales', emoji: '🦑', tip: 'Compara cifra por cifra desde la izquierda; tener más cifras no hace mayor un número.', generate: decimalCompare },
  { id: 'decimalAdd', name: 'Sumar y restar decimales', emoji: '🚢', tip: 'Alinea los puntos y suma o resta como siempre.', generate: decimalAdd },
  { id: 'percent', name: 'Porcentajes', emoji: '🏝️', tip: 'El 10 % es dividir entre 10; el 50 %, la mitad; el 25 %, la mitad de la mitad.', generate: percent },
  { id: 'perimeterArea', name: 'Perímetro y área', emoji: '⚓', tip: 'Perímetro: suma los lados. Área: largo × ancho.', generate: perimeterArea },
  { id: 'ratio', name: 'Razones y proporciones', emoji: '🛰️', tip: 'Si multiplicas un lado de la razón por un número, multiplica el otro por el mismo.', generate: ratio },
  { id: 'integerOrder', name: 'Números negativos', emoji: '❄️', tip: 'En la recta, los números crecen hacia la derecha; el −9 es menor que el −2.', generate: integerOrder },
  { id: 'integerAdd', name: 'Sumar y restar con signo', emoji: '🔌', tip: 'Signos distintos: resta y deja el signo del mayor. Restar un negativo es sumar.', generate: integerAdd },
  { id: 'orderOps', name: 'Orden de las operaciones', emoji: '🎛️', tip: 'Paréntesis y potencias primero; luego × y ÷; al final + y −.', generate: orderOps },
  { id: 'gcdLcm', name: 'Múltiplos y divisores', emoji: '🔧', tip: 'El mínimo común múltiplo es el primer múltiplo que comparten; el máximo común divisor, el mayor que divide a ambos.', generate: gcdLcm },
  { id: 'evalExpr', name: 'Expresiones con letras', emoji: '🧪', tip: 'Cambia cada letra por su número; 3x significa 3 × x.', generate: evalExpr },
  { id: 'simplify', name: 'Simplificar expresiones', emoji: '🧫', tip: 'Junta los términos con x entre sí y los números sueltos entre sí.', generate: simplify },
  { id: 'eq1', name: 'Ecuaciones de un paso', emoji: '⚖️', tip: 'Haz lo contrario a lo que le pasó a la x, en los dos lados.', generate: eq1 },
  { id: 'eq2', name: 'Ecuaciones de dos pasos', emoji: '⚗️', tip: 'Primero deshaz la suma o resta; después, la multiplicación o división.', generate: eq2 },
  { id: 'discount', name: 'Descuentos y aumentos', emoji: '🏷️', tip: 'Calcula el porcentaje y réstalo (descuento) o súmalo (aumento) al precio.', generate: discount },
  { id: 'eqBoth', name: 'Ecuaciones con x en los dos lados', emoji: '🌉', tip: 'Resta la x más pequeña a los dos lados para juntar todas las x en un solo lado.', generate: eqBoth },
  { id: 'system', name: 'Dos ecuaciones, dos incógnitas', emoji: '🗼', tip: 'Suma o resta las dos ecuaciones para que una letra desaparezca.', generate: system },
  { id: 'expand', name: 'Quitar paréntesis', emoji: '🛡️', tip: 'El número de afuera multiplica a todo lo que hay dentro del paréntesis.', generate: expand },
  { id: 'factor', name: 'Factorizar', emoji: '🧩', tip: 'Busca dos números que multiplicados den el último y sumados den el del medio.', generate: factor },
  { id: 'quadratic', name: 'Ecuaciones cuadráticas', emoji: '👑', tip: 'Un producto es 0 cuando uno de sus factores es 0.', generate: quadratic },
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill {
  const skill = BY_ID.get(id);
  if (!skill) throw new Error(`Habilidad desconocida: ${id}`);
  return skill;
}

export function generateQuestion(skillId: string, rng: Rng, difficulty: Difficulty): Question {
  return { ...getSkill(skillId).generate(rng, difficulty), difficulty };
}
