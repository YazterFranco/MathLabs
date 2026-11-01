import { buildChoices } from './choices.ts';
import type { Rng } from './rng.ts';
import type { Difficulty, Generator, Question, Skill } from './types.ts';

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
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill {
  const skill = BY_ID.get(id);
  if (!skill) throw new Error(`Habilidad desconocida: ${id}`);
  return skill;
}

export function generateQuestion(skillId: string, rng: Rng, difficulty: Difficulty): Question {
  return getSkill(skillId).generate(rng, difficulty);
}
