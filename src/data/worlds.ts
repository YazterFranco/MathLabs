export const LEVELS_PER_REGION = 3;
export const QUESTIONS_PER_LEVEL = 8;
export const MAX_HEARTS = 3;
/** Energía ⚡ que se conserva entre partidas: cada error en un nivel gasta una; con 0 es Game Over. */
export const MAX_ENERGY = 5;
/** Una energía se recupera sola cada 5 minutos. */
export const ENERGY_REGEN_MS = 5 * 60 * 1000;
/** «Recargar practicando»: preguntas fáciles; cada acierto devuelve una energía. */
export const RECHARGE_QUESTIONS = 5;
/** Segundos de «meta» por pregunta en cada mundo (1 a 11); las de escribir suman `TYPED_EXTRA_SECONDS`. */
export const PAR_SECONDS_PER_QUESTION = [15, 15, 15, 15, 20, 20, 25, 25, 35, 35, 40] as const;
export const TYPED_EXTRA_SECONDS = 10;
/** Con el 60 % del tiempo meta o menos el bono es Rayo; con la meta o menos, Veloz. */
export const RAYO_TIME_RATIO = 0.6;
/** Contrarreloj: 60 segundos para acertar todo lo posible; las estrellas que da tienen tope. */
export const SPRINT_MS = 60_000;
export const SPRINT_QUESTIONS = 40;
export const SPRINT_MAX_STARS = 15;
/** Premio de completar un mundo (además del de la región). */
export const WORLD_PRIZE_STARS = 20;
export const GUARDIAN_QUESTIONS = 10;
/** 85 % de aciertos para aprobar: con 10 preguntas son 9. */
export const GUARDIAN_PASS_RATIO = 0.85;
export const GUARDIAN_PASS_COUNT = Math.ceil(GUARDIAN_QUESTIONS * GUARDIAN_PASS_RATIO);
export const REVIEW_QUESTIONS = 5;
/** Prueba de nivel: una pregunta por región de cada mundo; con 4 de 5 se pasa al siguiente mundo. */
export const PLACEMENT_PASS_COUNT = 4;

export interface Region {
  id: string;
  name: string;
  emoji: string;
  /** La primera habilidad es la principal; el Guardián la mezcla con las anteriores del mundo. */
  skillIds: string[];
}

export interface World {
  id: number;
  name: string;
  emoji: string;
  grade: string;
  ages: string;
  theme: string;
  regions: Region[];
}

export const WORLDS: World[] = [
  {
    id: 1,
    name: 'Bosque de los Números',
    emoji: '🌳',
    grade: 'Preescolar',
    ages: '5 a 6 años',
    theme: 'forest',
    regions: [
      { id: 'w1r1', name: 'Claro de las Frutas', emoji: '🍎', skillIds: ['count10'] },
      { id: 'w1r2', name: 'Arroyo de los Peces', emoji: '🐟', skillIds: ['count20'] },
      { id: 'w1r3', name: 'Colina de los Mayores', emoji: '⛰️', skillIds: ['compare'] },
      { id: 'w1r4', name: 'Nido de las Sumas', emoji: '🪺', skillIds: ['add10'] },
      { id: 'w1r5', name: 'Cueva de las Restas', emoji: '🦇', skillIds: ['sub10'] },
    ],
  },
  {
    id: 2,
    name: 'Playa de las Sumas',
    emoji: '🏖️',
    grade: '1.º grado',
    ages: '6 a 7 años',
    theme: 'beach',
    regions: [
      { id: 'w2r1', name: 'Cala de las Sumas', emoji: '🐚', skillIds: ['add20'] },
      { id: 'w2r2', name: 'Bahía de las Restas', emoji: '🦀', skillIds: ['sub20'] },
      { id: 'w2r3', name: 'Isla de las Decenas', emoji: '🏝️', skillIds: ['tensOnes'] },
      { id: 'w2r4', name: 'Faro del Número Escondido', emoji: '🗼', skillIds: ['missingAddend'] },
      { id: 'w2r5', name: 'Arrecife de los Dobles', emoji: '🐠', skillIds: ['doubles'] },
    ],
  },
  {
    id: 3,
    name: 'Montaña del Cien',
    emoji: '🏔️',
    grade: '2.º grado',
    ages: '7 a 8 años',
    theme: 'mountain',
    regions: [
      { id: 'w3r1', name: 'Sendero de las Sumas', emoji: '🥾', skillIds: ['add100'] },
      { id: 'w3r2', name: 'Puente de las Restas', emoji: '🌉', skillIds: ['sub100'] },
      { id: 'w3r3', name: 'Cumbre de los Saltos', emoji: '🦘', skillIds: ['skipCount'] },
      { id: 'w3r4', name: 'Mercado de Monedas', emoji: '🪙', skillIds: ['money'] },
      { id: 'w3r5', name: 'Torre de las Centenas', emoji: '🏰', skillIds: ['placeValue3'] },
    ],
  },
  {
    id: 4,
    name: 'Ciudad de las Tablas',
    emoji: '🏙️',
    grade: '3.º grado',
    ages: '8 a 9 años',
    theme: 'city',
    regions: [
      { id: 'w4r1', name: 'Barrio de los Grupos', emoji: '🏘️', skillIds: ['groups'] },
      { id: 'w4r2', name: 'Parada del 2, 5 y 10', emoji: '🚌', skillIds: ['mult2510'] },
      { id: 'w4r3', name: 'Avenida del 3 y 4', emoji: '🚲', skillIds: ['mult34'] },
      { id: 'w4r4', name: 'Aeropuerto del 6 al 9', emoji: '🚀', skillIds: ['mult69'] },
      { id: 'w4r5', name: 'Pizzería de los Repartos', emoji: '🍕', skillIds: ['divide'] },
    ],
  },
  {
    id: 5,
    name: 'Volcán de las Fracciones',
    emoji: '🌋',
    grade: '4.º grado',
    ages: '9 a 10 años',
    theme: 'volcano',
    regions: [
      { id: 'w5r1', name: 'Cráter de las Partes', emoji: '🌋', skillIds: ['fractionRead'] },
      { id: 'w5r2', name: 'Río de Lava', emoji: '🌊', skillIds: ['fractionCompare'] },
      { id: 'w5r3', name: 'Cueva de los Gemelos', emoji: '👯', skillIds: ['fractionEquiv'] },
      { id: 'w5r4', name: 'Puente de Cristal', emoji: '🌉', skillIds: ['fractionAdd'] },
      { id: 'w5r5', name: 'Mina de los Tesoros', emoji: '💎', skillIds: ['fractionOf'] },
    ],
  },
  {
    id: 6,
    name: 'Océano Decimal',
    emoji: '🌊',
    grade: '5.º grado',
    ages: '10 a 11 años',
    theme: 'ocean',
    regions: [
      { id: 'w6r1', name: 'Arrecife de las Décimas', emoji: '🪸', skillIds: ['decimalPlace'] },
      { id: 'w6r2', name: 'Fosa de las Comparaciones', emoji: '🦑', skillIds: ['decimalCompare'] },
      { id: 'w6r3', name: 'Barco de las Sumas', emoji: '🚢', skillIds: ['decimalAdd'] },
      { id: 'w6r4', name: 'Isla del Porcentaje', emoji: '🏝️', skillIds: ['percent'] },
      { id: 'w6r5', name: 'Puerto de las Figuras', emoji: '⚓', skillIds: ['perimeterArea'] },
    ],
  },
  {
    id: 7,
    name: 'Estación Espacial',
    emoji: '🚀',
    grade: '6.º grado',
    ages: '11 a 12 años',
    theme: 'space',
    regions: [
      { id: 'w7r1', name: 'Cabina de Razones', emoji: '🛰️', skillIds: ['ratio'] },
      { id: 'w7r2', name: 'Órbita de los Negativos', emoji: '❄️', skillIds: ['integerOrder'] },
      { id: 'w7r3', name: 'Módulo de Energía', emoji: '🔌', skillIds: ['integerAdd'] },
      { id: 'w7r4', name: 'Sala de Control', emoji: '🎛️', skillIds: ['orderOps'] },
      { id: 'w7r5', name: 'Taller de Múltiplos', emoji: '🔧', skillIds: ['gcdLcm'] },
    ],
  },
  {
    id: 8,
    name: 'Laboratorio',
    emoji: '🧪',
    grade: '7.º grado',
    ages: '12 a 13 años',
    theme: 'lab',
    regions: [
      { id: 'w8r1', name: 'Mesa de Variables', emoji: '🧪', skillIds: ['evalExpr'] },
      { id: 'w8r2', name: 'Probeta de Términos', emoji: '🧫', skillIds: ['simplify'] },
      { id: 'w8r3', name: 'Balanza de Ecuaciones', emoji: '⚖️', skillIds: ['eq1'] },
      { id: 'w8r4', name: 'Reactor de Dos Pasos', emoji: '⚗️', skillIds: ['eq2'] },
      { id: 'w8r5', name: 'Tienda del Laboratorio', emoji: '🏷️', skillIds: ['discount'] },
    ],
  },
  {
    id: 9,
    name: 'Castillo del Álgebra',
    emoji: '🏯',
    grade: '8.º y 9.º grado',
    ages: '13 a 14 años',
    theme: 'castle',
    regions: [
      { id: 'w9r1', name: 'Puente Levadizo', emoji: '🌉', skillIds: ['eqBoth'] },
      { id: 'w9r2', name: 'Torre Gemela', emoji: '🗼', skillIds: ['system'] },
      { id: 'w9r3', name: 'Armería de Paréntesis', emoji: '🛡️', skillIds: ['expand'] },
      { id: 'w9r4', name: 'Taller de Factores', emoji: '🧩', skillIds: ['factor'] },
      { id: 'w9r5', name: 'Trono de las Raíces', emoji: '👑', skillIds: ['quadratic'] },
    ],
  },
  {
    id: 10,
    name: 'Torre de las Funciones',
    emoji: '🗼',
    grade: '10.º y 11.º grado',
    ages: '14 a 16 años',
    theme: 'tower',
    regions: [
      { id: 'w10r1', name: 'Máquina de Funciones', emoji: '⚙️', skillIds: ['linearFn'] },
      { id: 'w10r2', name: 'Rampa de Pendientes', emoji: '📐', skillIds: ['slope'] },
      { id: 'w10r3', name: 'Ejes del Mirador', emoji: '🧭', skillIds: ['lineCuts'] },
      { id: 'w10r4', name: 'Sótano de Exponentes', emoji: '⚡', skillIds: ['exponents'] },
      { id: 'w10r5', name: 'Cúpula de la Parábola', emoji: '🌈', skillIds: ['parabola'] },
    ],
  },
  {
    id: 11,
    name: 'Cumbre',
    emoji: '🏁',
    grade: '12.º grado',
    ages: '16 a 17 años',
    theme: 'summit',
    regions: [
      { id: 'w11r1', name: 'Refugio de Triángulos', emoji: '⛺', skillIds: ['trig'] },
      { id: 'w11r2', name: 'Glaciar de Logaritmos', emoji: '🧊', skillIds: ['logExp'] },
      { id: 'w11r3', name: 'Sendero de Progresiones', emoji: '🥾', skillIds: ['seq'] },
      { id: 'w11r4', name: 'Campamento de Conteo', emoji: '🏕️', skillIds: ['counting'] },
      { id: 'w11r5', name: 'Cima de las Derivadas', emoji: '🏔️', skillIds: ['derivative'] },
    ],
  },
];

export interface UpcomingWorld {
  id: number;
  name: string;
  emoji: string;
  grade: string;
  ages: string;
}

export const UPCOMING_WORLDS: UpcomingWorld[] = [];

export const ALL_REGIONS: Region[] = WORLDS.flatMap((w) => w.regions);

export function findRegion(regionId: string): { world: World; region: Region; index: number } {
  for (const world of WORLDS) {
    const index = world.regions.findIndex((r) => r.id === regionId);
    if (index >= 0) return { world, region: world.regions[index] as Region, index };
  }
  throw new Error(`Región desconocida: ${regionId}`);
}

export function findWorld(worldId: number): World {
  const world = WORLDS.find((w) => w.id === worldId);
  if (!world) throw new Error(`Mundo desconocido: ${worldId}`);
  return world;
}
