export const LEVELS_PER_REGION = 3;
export const QUESTIONS_PER_LEVEL = 8;
export const MAX_HEARTS = 3;
export const GUARDIAN_QUESTIONS = 10;
/** 85 % de aciertos para aprobar: con 10 preguntas son 9. */
export const GUARDIAN_PASS_RATIO = 0.85;
export const GUARDIAN_PASS_COUNT = Math.ceil(GUARDIAN_QUESTIONS * GUARDIAN_PASS_RATIO);
export const REVIEW_QUESTIONS = 5;

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
];

export interface UpcomingWorld {
  id: number;
  name: string;
  emoji: string;
  grade: string;
  ages: string;
}

export const UPCOMING_WORLDS: UpcomingWorld[] = [
  { id: 4, name: 'Ciudad de las Tablas', emoji: '🏙️', grade: '3.º grado', ages: '8 a 9 años' },
  { id: 5, name: 'Volcán de las Fracciones', emoji: '🌋', grade: '4.º grado', ages: '9 a 10 años' },
  { id: 6, name: 'Océano Decimal', emoji: '🌊', grade: '5.º grado', ages: '10 a 11 años' },
  { id: 7, name: 'Estación Espacial', emoji: '🚀', grade: '6.º grado', ages: '11 a 12 años' },
  { id: 8, name: 'Laboratorio', emoji: '🧪', grade: '7.º grado', ages: '12 a 13 años' },
  { id: 9, name: 'Castillo del Álgebra', emoji: '🏯', grade: '8.º y 9.º', ages: '13 a 14 años' },
  { id: 10, name: 'Torre de las Funciones', emoji: '🗼', grade: '10.º y 11.º', ages: '14 a 16 años' },
  { id: 11, name: 'Cumbre', emoji: '🏁', grade: '12.º grado', ages: '16 a 17 años' },
];

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
