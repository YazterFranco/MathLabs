import type { DayKey } from '../engine/dates.ts';
import type { LevelRef, Reward } from '../engine/progress.ts';
import type { Profile, SaveFile } from '../engine/save.ts';
import type { ComboEvent, Outcome, Session } from '../engine/session.ts';
import type { PowerKind } from '../engine/types.ts';

export type Screen =
  | 'welcome'
  | 'profiles'
  | 'create'
  | 'map'
  | 'region'
  | 'play'
  | 'result'
  | 'shop'
  | 'energy'
  | 'world-summary'
  | 'parents'
  | 'sleep'
  | 'placement-intro'
  | 'placement'
  | 'placement-result';

export interface Feedback {
  correct: boolean;
  combo: ComboEvent;
  doubled: boolean;
  /** Si se explica el error (pista y respuesta correcta). */
  explain: boolean;
  neutral: boolean;
}

export interface PlayState {
  ref: LevelRef;
  session: Session;
  phase: 'intro' | 'asking' | 'feedback';
  loadout: Set<PowerKind>;
  pick: string | null;
  feedback: Feedback | null;
  /** Texto de la Pista mágica en la pregunta actual. */
  note: string | null;
  /** Instante (ms) en que se mostró la pregunta actual; `null` si no hay una esperando respuesta. */
  qStart: number | null;
  /** Tiempo meta del nivel en segundos (0 si la partida no se cronometra). */
  parSec: number;
}

export interface ResultState {
  ref: LevelRef;
  outcome: Outcome;
  reward: Reward;
  tip: string | null;
  /** Tiempo meta del nivel (segundos); 0 si no se cronometró. */
  parSec: number;
}

export interface GateState {
  a: number;
  b: number;
  reason: string;
  error: boolean;
}

export interface PlacementState {
  /** Posición en WORLDS del mundo que se está evaluando. */
  worldIndex: number;
  session: Session;
  pick: string | null;
  phase: 'asking' | 'feedback';
  scores: number[];
  /** Mundos superados; solo se conoce cuando la prueba termina. */
  placed: number | null;
}

export interface ViewState {
  screen: Screen;
  save: SaveFile;
  profile: Profile | null;
  regionId: string | null;
  play: PlayState | null;
  placement: PlacementState | null;
  result: ResultState | null;
  gate: GateState | null;
  toast: string | null;
  today: DayKey;
  dueCount: number;
  /** Hora actual (ms): la usan el cronómetro y la cuenta atrás de la energía. */
  nowMs: number;
  summaryWorldId: number | null;
}
