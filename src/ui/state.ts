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
  | 'parents'
  | 'sleep';

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
}

export interface ResultState {
  ref: LevelRef;
  outcome: Outcome;
  reward: Reward;
  tip: string | null;
}

export interface GateState {
  a: number;
  b: number;
  reason: string;
  error: boolean;
}

export interface ViewState {
  screen: Screen;
  save: SaveFile;
  profile: Profile | null;
  regionId: string | null;
  play: PlayState | null;
  result: ResultState | null;
  gate: GateState | null;
  toast: string | null;
  today: DayKey;
  dueCount: number;
}
