import { findRegion, LEVELS_PER_REGION } from '../data/worlds.ts';
import { buildGuardianQuestions, buildLevelQuestions, buildReviewQuestions } from '../engine/builders.ts';
import { dayKey, type DayKey } from '../engine/dates.ts';
import {
  applyOutcome,
  buyItem,
  claimChest,
  dueSkills,
  equipCostume,
  isGuardianUnlocked,
  isLevelUnlocked,
  isRegionUnlocked,
  type LevelRef,
} from '../engine/progress.ts';
import { getSkill } from '../engine/questions.ts';
import { randomRng, type Rng } from '../engine/rng.ts';
import {
  MAX_PROFILES,
  SESSION_LIMITS,
  loadSave,
  newProfile,
  parseSave,
  persist,
  recordAttempt,
  type AgeBand,
  type KeyValueStore,
  type Profile,
  type SaveFile,
} from '../engine/save.ts';
import { Session } from '../engine/session.ts';
import { POWER_INFO } from '../data/shop.ts';
import type { PowerKind } from '../engine/types.ts';
import { Sound } from './sound.ts';
import { canSpeak, speak, spokenText, stopSpeaking } from './speech.ts';
import type { GateState, PlayState, ResultState, Screen, ViewState } from './state.ts';
import { renderView } from './views.ts';

export interface SpeechApi {
  can(): boolean;
  speak(text: string): void;
  stop(): void;
}

export interface AppDeps {
  root: HTMLElement;
  store: KeyValueStore;
  rng?: Rng;
  now?: () => Date;
  sound?: Sound;
  speech?: SpeechApi;
}

const POWERS: PowerKind[] = ['lupa', 'pista', 'escudo'];
const IDLE_CUTOFF_MS = 2 * 60 * 1000;
const EXTRA_MS = 10 * 60 * 1000;
/** Acciones que arrancan o continúan el juego: si ya se pasó el tiempo, llevan a la pantalla de descanso. */
const GUARDED = new Set([
  'select-profile',
  'open-region',
  'open-level',
  'open-guardian',
  'start-review',
  'result-next',
  'result-retry',
  'result-region',
  'result-map',
  'back-map',
  'open-shop',
]);

export class App {
  private readonly root: HTMLElement;
  private readonly store: KeyValueStore;
  private readonly rng: Rng;
  private readonly now: () => Date;
  private readonly sound: Sound;
  private readonly speech: SpeechApi;

  private saveFile: SaveFile;
  private screen: Screen = 'welcome';
  private regionId: string | null = null;
  private play: PlayState | null = null;
  private result: ResultState | null = null;
  private gate: GateState | null = null;
  private gateThen: (() => void) | null = null;
  private toastText: string | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTouch = 0;
  private playedMs = new Map<string, number>();
  private extraMs = new Map<string, number>();
  private lastRenderedScreen: Screen | null = null;

  constructor(deps: AppDeps) {
    this.root = deps.root;
    this.store = deps.store;
    this.rng = deps.rng ?? randomRng();
    this.now = deps.now ?? (() => new Date());
    this.sound = deps.sound ?? new Sound();
    this.speech = deps.speech ?? { can: canSpeak, speak, stop: stopSpeaking };
    this.saveFile = loadSave(this.store);
    this.lastTouch = this.now().getTime();

    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    this.root.addEventListener('submit', (e) => this.onSubmit(e));
    this.root.ownerDocument.addEventListener('keydown', (e) => this.onKey(e));
    this.render();
  }

  /* ───────────── Acceso para pruebas ───────────── */

  get state(): { screen: Screen; save: SaveFile; play: PlayState | null; result: ResultState | null } {
    return { screen: this.screen, save: this.saveFile, play: this.play, result: this.result };
  }

  /* ───────────── Utilidades ───────────── */

  private get profile(): Profile | null {
    return this.saveFile.profiles.find((p) => p.id === this.saveFile.activeId) ?? null;
  }
  private get today(): DayKey {
    return dayKey(this.now());
  }

  private save(): void {
    if (!persist(this.store, this.saveFile)) this.showToast('No se pudo guardar. Revisa el espacio del navegador.');
  }

  private showToast(text: string): void {
    this.toastText = text;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastText = null;
      this.toastTimer = null;
      this.render();
    }, 3200);
  }

  private clearAdvance(): void {
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
  }

  private go(screen: Screen): void {
    this.screen = screen;
  }

  private tickClock(): void {
    const t = this.now().getTime();
    const p = this.profile;
    const onGameScreen = this.screen !== 'welcome' && this.screen !== 'profiles' && this.screen !== 'create' && this.screen !== 'sleep';
    if (p && onGameScreen) {
      const delta = t - this.lastTouch;
      if (delta > 0 && delta < IDLE_CUTOFF_MS) this.playedMs.set(p.id, (this.playedMs.get(p.id) ?? 0) + delta);
    }
    this.lastTouch = t;
  }

  private overLimit(): boolean {
    const p = this.profile;
    if (!p) return false;
    const allowed = p.sessionLimitMin * 60_000 + (this.extraMs.get(p.id) ?? 0);
    return (this.playedMs.get(p.id) ?? 0) >= allowed;
  }

  private askGate(reason: string, then: () => void): void {
    this.gate = { a: this.rng.int(6, 9), b: this.rng.int(6, 9), reason, error: false };
    this.gateThen = then;
  }

  private viewState(): ViewState {
    const p = this.profile;
    return {
      screen: this.screen,
      save: this.saveFile,
      profile: p,
      regionId: this.regionId,
      play: this.play,
      result: this.result,
      gate: this.gate,
      toast: this.toastText,
      today: this.today,
      dueCount: p ? dueSkills(p, this.today).length : 0,
    };
  }

  /* ───────────── Pintado ───────────── */

  private render(): void {
    // Sin perfil activo solo se pueden ver las pantallas de entrada.
    if (!this.profile && !['welcome', 'profiles', 'create'].includes(this.screen)) this.screen = 'welcome';
    this.root.innerHTML = renderView(this.viewState());
    const doc = this.root.ownerDocument;
    if (this.gate) {
      (doc.getElementById('gate-input') as HTMLInputElement | null)?.focus();
    } else if (this.lastRenderedScreen !== this.screen) {
      const main = this.root.querySelector<HTMLElement>('main');
      if (main) {
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
      doc.defaultView?.scrollTo?.(0, 0);
    }
    this.lastRenderedScreen = this.screen;
  }

  /* ───────────── Eventos ───────────── */

  private onClick(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    this.dispatch(el.dataset['action'] as string, el);
  }

  private onChange(e: Event): void {
    const el = (e.target as Element).closest<HTMLElement>('[data-change]');
    if (!el) return;
    this.tickClock();
    const p = this.profile;
    const kind = el.dataset['change'];
    if (kind === 'set-limit' && p) {
      const value = Number((el as HTMLSelectElement).value);
      if ((SESSION_LIMITS as readonly number[]).includes(value)) {
        p.sessionLimitMin = value;
        this.save();
        this.showToast(`Límite: ${value} minutos por sesión.`);
      }
    } else if (kind === 'toggle-sound' && p) {
      p.settings.sound = (el as HTMLInputElement).checked;
      this.sound.enabled = p.settings.sound;
      this.save();
    } else if (kind === 'toggle-voice' && p) {
      p.settings.voice = (el as HTMLInputElement).checked;
      if (!p.settings.voice) this.speech.stop();
      this.save();
    } else if (kind === 'import-file') {
      const file = (el as HTMLInputElement).files?.[0];
      if (file) void this.readImport(file);
    }
    this.render();
  }

  private onSubmit(e: Event): void {
    const form = (e.target as Element).closest<HTMLFormElement>('form[data-form]');
    if (!form) return;
    e.preventDefault();
    this.tickClock();
    const data = new FormData(form);
    if (form.dataset['form'] === 'gate') {
      const g = this.gate;
      if (!g) return;
      if (Number(String(data.get('answer')).trim()) === g.a * g.b) {
        const then = this.gateThen;
        this.gate = null;
        this.gateThen = null;
        then?.();
      } else {
        this.gate = { a: this.rng.int(6, 9), b: this.rng.int(6, 9), reason: g.reason, error: true };
      }
    } else if (form.dataset['form'] === 'create') {
      this.createProfile(data);
    }
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const pl = this.play;
    if (this.screen !== 'play' || !pl || pl.phase !== 'asking' || this.gate) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= pl.session.current.choices.length) {
      const choice = pl.session.current.choices[n - 1] as string;
      if (!pl.session.eliminated.has(choice)) {
        this.tickClock();
        this.answer(choice);
        this.render();
      }
    }
  }

  /* ───────────── Acciones ───────────── */

  private dispatch(action: string, el: HTMLElement): void {
    this.tickClock();
    if (GUARDED.has(action) && this.profile && this.overLimit() && this.screen !== 'play') {
      this.clearAdvance();
      this.play = null;
      this.go('sleep');
      this.render();
      return;
    }
    const id = el.dataset['id'] ?? '';
    switch (action) {
      case 'start':
        if (this.saveFile.profiles.length === 0) this.go('create');
        else this.go('profiles');
        break;
      case 'new-profile':
        if (this.saveFile.profiles.length > 0) {
          this.askGate('Crear otro explorador necesita a una persona adulta.', () => this.go('create'));
        } else this.go('create');
        break;
      case 'back-profiles':
        this.go(this.saveFile.profiles.length ? 'profiles' : 'welcome');
        break;
      case 'select-profile':
        this.selectProfile(id);
        break;
      case 'switch-profile':
        this.go('profiles');
        break;
      case 'open-region':
        this.openRegion(id);
        break;
      case 'back-map':
      case 'result-map':
      case 'sleep-map':
        this.clearAdvance();
        this.play = null;
        this.regionId = null;
        this.go(action === 'sleep-map' ? 'welcome' : 'map');
        break;
      case 'open-level':
        this.startLevel(Number(el.dataset['level']));
        break;
      case 'open-guardian':
        this.startGuardian();
        break;
      case 'start-review':
        this.startReview();
        break;
      case 'toggle-power':
        this.togglePower(id as PowerKind);
        break;
      case 'begin':
        this.begin();
        break;
      case 'use-power':
        this.usePower(id as PowerKind);
        break;
      case 'answer':
        this.answer(el.dataset['choice'] ?? '');
        break;
      case 'continue':
        this.advance();
        break;
      case 'speak':
        this.speakCurrent();
        break;
      case 'quit-play':
        this.quitPlay();
        break;
      case 'result-next':
        this.resultNext();
        break;
      case 'result-retry':
        this.resultRetry();
        break;
      case 'result-region':
        this.play = null;
        this.go(this.regionId ? 'region' : 'map');
        break;
      case 'open-shop':
        this.go('shop');
        break;
      case 'buy':
        this.buy(id);
        break;
      case 'equip':
        if (this.profile && equipCostume(this.profile, id)) this.save();
        break;
      case 'unequip':
        if (this.profile && equipCostume(this.profile, null)) this.save();
        break;
      case 'open-parents':
        this.askGate('Este panel es para familias.', () => this.go('parents'));
        break;
      case 'claim-chest':
        this.openChest();
        break;
      case 'export':
        this.exportSave();
        break;
      case 'reset-progress':
        this.askGate('Se borrará todo el progreso de este explorador.', () => this.resetProgress());
        break;
      case 'delete-profile':
        this.askGate('Se eliminará este explorador y su progreso.', () => this.deleteProfile());
        break;
      case 'extend-time':
        this.askGate('Añadir 10 minutos de juego.', () => {
          const p = this.profile;
          if (p) this.extraMs.set(p.id, (this.extraMs.get(p.id) ?? 0) + EXTRA_MS);
          this.go('map');
        });
        break;
      case 'gate-cancel':
        this.gate = null;
        this.gateThen = null;
        break;
      default:
        return;
    }
    this.render();
  }

  private createProfile(data: FormData): void {
    if (this.saveFile.profiles.length >= MAX_PROFILES) return;
    const age = String(data.get('age'));
    const ageBand: AgeBand = age === '7-8' || age === '9+' ? age : '5-6';
    const profile = newProfile(
      {
        nickname: String(data.get('nickname') ?? ''),
        avatar: String(data.get('avatar') ?? '🦁'),
        mascot: String(data.get('mascot') ?? '🦊'),
        ageBand,
      },
      this.today,
    );
    this.saveFile.profiles.push(profile);
    this.saveFile.activeId = profile.id;
    this.sound.enabled = profile.settings.sound;
    this.save();
    this.go('map');
  }

  private selectProfile(id: string): void {
    const p = this.saveFile.profiles.find((x) => x.id === id);
    if (!p) return;
    this.saveFile.activeId = p.id;
    this.sound.enabled = p.settings.sound;
    this.save();
    this.regionId = null;
    this.lastTouch = this.now().getTime();
    this.go('map');
  }

  private openRegion(id: string): void {
    const p = this.profile;
    if (!p || !isRegionUnlocked(p, id)) return;
    this.regionId = id;
    this.go('region');
  }

  private startPlay(ref: LevelRef, session: Session): void {
    const p = this.profile as Profile;
    this.clearAdvance();
    const loadout = new Set<PowerKind>(session.allowsPowers ? POWERS.filter((k) => p.inventory[k] > 0) : []);
    this.play = { ref, session, phase: 'intro', loadout, pick: null, feedback: null, note: null };
    this.result = null;
    this.go('play');
  }

  private startLevel(level: number): void {
    const p = this.profile;
    if (!p || !this.regionId || !isLevelUnlocked(p, this.regionId, level)) return;
    const { region } = findRegion(this.regionId);
    const qs = buildLevelQuestions(this.rng, region, level);
    this.startPlay({ kind: 'level', regionId: region.id, level }, new Session('level', qs));
  }

  private startGuardian(): void {
    const p = this.profile;
    if (!p || !this.regionId || !isGuardianUnlocked(p, this.regionId)) return;
    const { world, region, index } = findRegion(this.regionId);
    const qs = buildGuardianQuestions(this.rng, world, index);
    this.startPlay({ kind: 'guardian', regionId: region.id }, new Session('guardian', qs));
  }

  private startReview(): void {
    const p = this.profile;
    if (!p) return;
    const due = dueSkills(p, this.today).slice(0, 5);
    if (!due.length) return;
    this.regionId = null;
    const qs = buildReviewQuestions(this.rng, due);
    this.startPlay({ kind: 'review', skillIds: due }, new Session('review', qs));
  }

  private togglePower(kind: PowerKind): void {
    const pl = this.play;
    const p = this.profile;
    if (!pl || !p || !POWERS.includes(kind) || p.inventory[kind] <= 0) return;
    if (pl.loadout.has(kind)) pl.loadout.delete(kind);
    else pl.loadout.add(kind);
  }

  private begin(): void {
    const pl = this.play;
    if (!pl || pl.phase !== 'intro') return;
    pl.phase = 'asking';
    this.speakIfEnabled();
  }

  private speakIfEnabled(): void {
    const p = this.profile;
    if (p?.settings.voice && this.speech.can()) this.speakCurrent();
  }

  private speakCurrent(): void {
    const pl = this.play;
    if (!pl || !this.speech.can()) return;
    this.speech.speak(spokenText(pl.session.current.prompt));
  }

  private usePower(kind: PowerKind): void {
    const pl = this.play;
    const p = this.profile;
    if (!pl || !p || pl.phase !== 'asking' || !pl.loadout.has(kind) || p.inventory[kind] <= 0) return;
    const s = pl.session;
    if (!s.canUse(kind)) return;
    if (kind === 'lupa') {
      if (!s.useLupa(this.rng).length) return;
    } else if (kind === 'pista') {
      pl.note = s.usePista();
    } else {
      s.useEscudo();
      this.showToast(`${POWER_INFO.escudo.emoji} Escudo listo: un error no rompe tu racha.`);
    }
    p.inventory[kind] -= 1;
    this.save();
  }

  private answer(choice: string): void {
    const pl = this.play;
    const p = this.profile;
    if (!pl || !p || pl.phase !== 'asking') return;
    const s = pl.session;
    const q = s.current;
    const res = s.answer(choice);
    // Cada intento se guarda al momento: un cierre brusco no pierde nada.
    recordAttempt(p, q.skillId, res.correct, this.today);
    this.save();
    const neutral = s.kind === 'guardian';
    pl.pick = choice;
    pl.phase = 'feedback';
    pl.note = null;
    pl.feedback = { correct: res.correct, combo: res.combo, doubled: res.doubled, neutral, explain: !neutral && !res.correct };
    if (!neutral) this.sound.play(res.combo ? 'combo' : res.correct ? 'ok' : 'bad');
    if (!pl.feedback.explain) {
      this.clearAdvance();
      this.advanceTimer = setTimeout(() => {
        this.advanceTimer = null;
        this.tickClock();
        this.advance();
        this.render();
      }, neutral ? 650 : 1000);
    }
  }

  private advance(): void {
    const pl = this.play;
    if (!pl || pl.phase !== 'feedback') return;
    this.clearAdvance();
    if (pl.session.finished) {
      this.finishPlay();
      return;
    }
    pl.session.next();
    pl.phase = 'asking';
    pl.pick = null;
    pl.feedback = null;
    pl.note = null;
    this.speakIfEnabled();
  }

  private finishPlay(): void {
    const pl = this.play;
    const p = this.profile;
    if (!pl || !p) return;
    this.speech.stop();
    const outcome = pl.session.outcome();
    const reward = applyOutcome(p, pl.ref, outcome, this.rng, this.today);
    this.save();
    let tip: string | null = null;
    if (pl.ref.kind !== 'review') {
      const needsTip = outcome.lost || (pl.ref.kind === 'guardian' && !outcome.passed) || outcome.mistakes >= 3;
      if (needsTip) tip = getSkill(findRegion(pl.ref.regionId).region.skillIds[0] as string).tip;
      this.regionId = pl.ref.regionId;
    }
    this.result = { ref: pl.ref, outcome, reward, tip };
    this.sound.play(outcome.lost || (pl.ref.kind === 'guardian' && !outcome.passed) ? 'lose' : reward.chest || reward.regionCompleted ? 'chest' : 'win');
    this.go('result');
  }

  private quitPlay(): void {
    this.clearAdvance();
    this.speech.stop();
    const ref = this.play?.ref;
    this.play = null;
    if (ref && ref.kind !== 'review') {
      this.regionId = ref.regionId;
      this.go('region');
    } else this.go('map');
  }

  private resultNext(): void {
    const r = this.result;
    if (!r || r.ref.kind !== 'level') return;
    this.regionId = r.ref.regionId;
    if (r.ref.level < LEVELS_PER_REGION - 1) this.startLevel(r.ref.level + 1);
    else this.startGuardian();
  }

  private resultRetry(): void {
    const r = this.result;
    if (!r) return;
    if (r.ref.kind === 'level') {
      this.regionId = r.ref.regionId;
      this.startLevel(r.ref.level);
    } else if (r.ref.kind === 'guardian') {
      this.regionId = r.ref.regionId;
      this.startGuardian();
    }
  }

  private buy(id: string): void {
    const p = this.profile;
    if (!p) return;
    const res = buyItem(p, id);
    if (res === 'ok') {
      this.sound.play('chest');
      this.showToast('¡Compra hecha!');
      this.save();
    } else if (res === 'poor') this.showToast('Aún te faltan estrellas. ¡Sigue jugando!');
    else if (res === 'owned') this.showToast('Ya lo tienes.');
  }

  private openChest(): void {
    const p = this.profile;
    if (!p) return;
    const res = claimChest(p, this.today, this.rng);
    if (!res) return;
    this.sound.play('chest');
    this.save();
    this.showToast(`🎁 ¡+${res.wallet} ⭐ y un poder: ${POWER_INFO[res.power].name}!`);
  }

  private exportSave(): void {
    const doc = this.root.ownerDocument;
    const blob = new Blob([JSON.stringify(this.saveFile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = `matemundo-copia-${this.today}.json`;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast('Copia de seguridad descargada.');
  }

  private async readImport(file: File): Promise<void> {
    const text = await file.text();
    const parsed = parseSave(text);
    if (!parsed || parsed.profiles.length === 0) {
      this.showToast('Ese archivo no es una copia válida de Matemundo.');
      this.render();
      return;
    }
    this.askGate('Cargar la copia reemplaza lo que hay guardado en este dispositivo.', () => {
      this.saveFile = parsed;
      this.save();
      this.playedMs.clear();
      this.extraMs.clear();
      this.go('profiles');
      this.showToast('Copia cargada.');
    });
    this.render();
  }

  private resetProgress(): void {
    const p = this.profile;
    if (!p) return;
    const fresh = newProfile({ nickname: p.nickname, avatar: p.avatar, mascot: p.mascot, ageBand: p.ageBand }, this.today, p.id);
    fresh.settings = p.settings;
    const i = this.saveFile.profiles.findIndex((x) => x.id === p.id);
    this.saveFile.profiles[i] = fresh;
    this.save();
    this.go('map');
    this.showToast('Progreso reiniciado.');
  }

  private deleteProfile(): void {
    const p = this.profile;
    if (!p) return;
    this.saveFile.profiles = this.saveFile.profiles.filter((x) => x.id !== p.id);
    this.saveFile.activeId = null;
    this.save();
    this.go(this.saveFile.profiles.length ? 'profiles' : 'welcome');
    this.showToast('Explorador eliminado.');
  }
}
