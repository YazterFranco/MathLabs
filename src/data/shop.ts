export interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

/** Trajes para la mascota; se ganan con estrellas, nunca con dinero real. */
export const COSTUMES: ShopItem[] = [
  { id: 'gorra', name: 'Gorra', emoji: '🧢', cost: 15 },
  { id: 'lazo', name: 'Lazo', emoji: '🎀', cost: 25 },
  { id: 'gafas', name: 'Gafas geniales', emoji: '🕶️', cost: 30 },
  { id: 'sombrero', name: 'Sombrero mágico', emoji: '🎩', cost: 40 },
  { id: 'casco', name: 'Casco de explorador', emoji: '⛑️', cost: 50 },
  { id: 'corona', name: 'Corona', emoji: '👑', cost: 80 },
];

export const STICKERS: ShopItem[] = [
  { id: 'st-cohete', name: 'Cohete', emoji: '🚀', cost: 8 },
  { id: 'st-arcoiris', name: 'Arcoíris', emoji: '🌈', cost: 8 },
  { id: 'st-dino', name: 'Dinosaurio', emoji: '🦖', cost: 10 },
  { id: 'st-pulpo', name: 'Pulpo', emoji: '🐙', cost: 10 },
  { id: 'st-helado', name: 'Helado', emoji: '🍦', cost: 8 },
  { id: 'st-planeta', name: 'Planeta', emoji: '🪐', cost: 12 },
  { id: 'st-globo', name: 'Globo', emoji: '🎈', cost: 6 },
  { id: 'st-trofeo', name: 'Trofeo', emoji: '🏆', cost: 15 },
  { id: 'st-mariposa', name: 'Mariposa', emoji: '🦋', cost: 8 },
  { id: 'st-volcan', name: 'Volcán', emoji: '🌋', cost: 12 },
  { id: 'st-estrella', name: 'Estrella fugaz', emoji: '🌠', cost: 10 },
  { id: 'st-delfin', name: 'Delfín', emoji: '🐬', cost: 10 },
];

export const AVATARS = ['🦁', '🐯', '🐸', '🦄', '🐙', '🦖', '🐧', '🐝'];
export const MASCOTS = ['🦊', '🐻', '🐰', '🐼', '🐲', '🦉'];

export const POWER_INFO = {
  lupa: { name: 'Lupa', emoji: '🔍', desc: 'Tacha 2 opciones incorrectas' },
  pista: { name: 'Pista mágica', emoji: '💡', desc: 'Muestra una pista' },
  escudo: { name: 'Escudo', emoji: '🛡️', desc: 'Un error no rompe tu combo' },
} as const;

/** Etapas de la mascota según las estrellas ganadas en total. */
export const MASCOT_STAGES = [
  { min: 0, name: 'Cría', scale: 1 },
  { min: 30, name: 'Aventurero', scale: 1.15 },
  { min: 120, name: 'Héroe', scale: 1.3 },
] as const;
