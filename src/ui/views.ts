import { COSTUMES, MASCOT_STAGES, POWER_INFO, STICKERS, AVATARS, MASCOTS } from '../data/shop.ts';
import {
  GUARDIAN_PASS_COUNT,
  GUARDIAN_QUESTIONS,
  LEVELS_PER_REGION,
  PLACEMENT_PASS_COUNT,
  MAX_ENERGY,
  RAYO_TIME_RATIO,
  RECHARGE_QUESTIONS,
  UPCOMING_WORLDS,
  WORLD_PRIZE_STARS,
  WORLDS,
  findRegion,
  type Region,
  type World,
} from '../data/worlds.ts';
import {
  isGuardianUnlocked,
  isLevelUnlocked,
  isRegionUnlocked,
  isWorldUnlocked,
  regionStars,
} from '../engine/progress.ts';
import { msToNextEnergy } from '../engine/energy.ts';
import { MASTERY_EMOJI, MASTERY_LABEL } from '../engine/mastery.ts';
import { MEDAL_EMOJI, MEDAL_NAME, worldSummary } from '../engine/summary.ts';
import { CHEST_ENERGY } from '../engine/progress.ts';
import { SPEED_BONUS, formatClock, liveTier } from '../engine/time.ts';
import { getSkill } from '../engine/questions.ts';
import { recentAccuracy, needsSupport } from '../engine/adaptive.ts';
import { MAX_PROFILES, SESSION_LIMITS, regionProgress, skillProgress, type Profile, type SkillProgress } from '../engine/save.ts';
import type { PowerKind } from '../engine/types.ts';
import { esc, shortDate } from './dom.ts';
import type { PlacementState, PlayState, ResultState, ViewState } from './state.ts';

const POWERS: PowerKind[] = ['lupa', 'pista', 'escudo'];

/* ───────────── Piezas pequeñas ───────────── */

const button = (action: string, label: string, cls = '', extra = ''): string =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;

const stars = (earned: number, max = 3): string =>
  Array.from({ length: max }, (_, i) => `<span class="star ${i < earned ? 'on' : ''}" aria-hidden="true">★</span>`).join('');

const starsLabel = (earned: number, max = 3): string => `${earned} de ${max} estrellas`;

const energyIcons = (n: number, max: number = MAX_ENERGY): string =>
  Array.from({ length: max }, (_, i) => `<span class="en ${i < n ? 'on' : 'off'}" aria-hidden="true">⚡</span>`).join('');

/** «+1 ⚡ en 3:12»; vacío si la energía está llena. Se actualiza sola cada medio segundo. */
function energyCountdown(p: Profile, nowMs: number): string {
  const left = msToNextEnergy(p, nowMs);
  return `<span class="muted" data-clock="energy">${left === null ? '' : `+1 ⚡ en ${formatClock(left + 999)}`}</span>`;
}

function mascotStage(p: Profile): { name: string; scale: number } {
  let stage: { name: string; scale: number } = MASCOT_STAGES[0];
  for (const s of MASCOT_STAGES) if (p.totalEarned >= s.min) stage = s;
  return stage;
}

function mascot(p: Profile, big = false): string {
  const stage = mascotStage(p);
  const costume = COSTUMES.find((c) => c.id === p.costumeEquipped);
  return `<span class="mascot ${big ? 'big' : ''}" style="--grow:${stage.scale}" role="img" aria-label="Tu mascota, ${esc(stage.name)}">
    <span class="mascot-body">${esc(p.mascot)}</span>${costume ? `<span class="mascot-costume">${costume.emoji}</span>` : ''}</span>`;
}

function topBar(p: Profile, title: string, back?: { action: string; label: string }): string {
  return `<header class="topbar">
    ${back ? button(back.action, `← ${esc(back.label)}`, 'btn-ghost') : `<span class="who">${esc(p.avatar)} <strong>${esc(p.nickname)}</strong></span>`}
    <h1 class="topbar-title">${esc(title)}</h1>
    ${button('go-home', '🏠', 'btn-ghost btn-icon', 'aria-label="Ir al inicio" title="Inicio"')}
    <span class="wallet" aria-label="${p.wallet} estrellas para gastar">⭐ ${p.wallet}</span>
  </header>`;
}

function toast(v: ViewState): string {
  return v.toast ? `<div class="toast" role="status">${esc(v.toast)}</div>` : '';
}

function gate(v: ViewState): string {
  const g = v.gate;
  if (!g) return '';
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title">
    <form class="sheet" data-form="gate" autocomplete="off">
      <h2 id="gate-title">Solo para personas adultas</h2>
      <p>${esc(g.reason)}</p>
      <label class="field" for="gate-input">¿Cuánto es ${g.a} × ${g.b}?</label>
      <input id="gate-input" name="answer" inputmode="numeric" pattern="[0-9]*" maxlength="3" required autofocus />
      ${g.error ? '<p class="error" role="alert">Esa no es la respuesta. Inténtalo otra vez.</p>' : ''}
      <div class="row">
        ${button('gate-cancel', 'Cancelar', 'btn-ghost')}
        <button type="submit" class="btn btn-primary">Continuar</button>
      </div>
    </form>
  </div>`;
}

/* ───────────── Pantallas ───────────── */

function welcome(v: ViewState): string {
  const hasProfiles = v.save.profiles.length > 0;
  return `<main class="screen welcome">
    <div class="logo" aria-hidden="true">🧮</div>
    <h1 class="brand">Matemundo</h1>
    <p class="lead">Explora mundos, vence a los Guardianes y domina las mates paso a paso.</p>
    ${
      v.profile
        ? `${button('continue-as', `Continuar como ${esc(v.profile.avatar)} ${esc(v.profile.nickname)}`, 'btn-primary btn-xl', `data-id="${esc(v.profile.id)}"`)}
           ${button('start', 'Cambiar de explorador', 'btn-ghost')}`
        : button('start', '¡Jugar!', 'btn-primary btn-xl')
    }
    <ul class="promises">
      <li>Sin anuncios ni compras con dinero real</li>
      <li>Tu progreso se guarda solo en este dispositivo</li>
      ${hasProfiles ? '' : '<li>Solo pedimos un apodo, nunca tu nombre real</li>'}
    </ul>
  </main>`;
}

function profiles(v: ViewState): string {
  const cards = v.save.profiles
    .map(
      (p) => `<li>
        <button type="button" class="profile-card" data-action="select-profile" data-id="${esc(p.id)}">
          <span class="profile-avatar">${esc(p.avatar)}</span>
          <span class="profile-name">${esc(p.nickname)}</span>
          <span class="profile-meta">⭐ ${p.totalEarned} · 🔥 ${p.streak.days}</span>
        </button>
      </li>`,
    )
    .join('');
  const canAdd = v.save.profiles.length < MAX_PROFILES;
  return `<main class="screen">
    <h1>¿Quién juega hoy?</h1>
    ${v.save.profiles.length ? `<ul class="profile-list">${cards}</ul>` : '<p class="lead">Crea tu primer explorador para empezar.</p>'}
    ${canAdd ? button('new-profile', '＋ Nuevo explorador', 'btn-primary') : '<p class="muted">Ya hay cuatro exploradores en este dispositivo.</p>'}
  </main>`;
}

function create(): string {
  const radios = (name: string, items: string[], checked: string): string =>
    items
      .map(
        (item) => `<label class="pick"><input type="radio" name="${name}" value="${esc(item)}" ${item === checked ? 'checked' : ''} />
        <span class="pick-face">${esc(item)}</span></label>`,
      )
      .join('');
  const ages: Array<[string, string]> = [
    ['5-6', '5 a 6 años'],
    ['7-8', '7 a 8 años'],
    ['9+', '9 años o más'],
  ];
  return `<main class="screen">
    <form class="card form" data-form="create" autocomplete="off">
      <h1>Nuevo explorador</h1>
      <label class="field" for="nick">Tu apodo</label>
      <input id="nick" name="nickname" maxlength="12" placeholder="Por ejemplo: Rayo" required />
      <p class="hint">Usa un apodo, no tu nombre real.</p>
      <fieldset><legend>Tu personaje</legend><div class="picks">${radios('avatar', AVATARS, AVATARS[0] as string)}</div></fieldset>
      <fieldset><legend>Tu mascota</legend><div class="picks">${radios('mascot', MASCOTS, MASCOTS[0] as string)}</div></fieldset>
      <fieldset><legend>¿Cuántos años tienes?</legend>
        <div class="age-row">${ages
          .map(
            ([val, label], i) => `<label class="pick pick-text"><input type="radio" name="age" value="${val}" ${i === 0 ? 'checked' : ''} /><span class="pick-face">${label}</span></label>`,
          )
          .join('')}</div>
      </fieldset>
      <div class="row">
        ${button('back-profiles', 'Volver', 'btn-ghost')}
        <button type="submit" class="btn btn-primary">¡Crear!</button>
      </div>
    </form>
  </main>`;
}

function regionNode(p: Profile, region: Region): string {
  const unlocked = isRegionUnlocked(p, region.id);
  const rp = regionProgress(p, region.id);
  const earned = regionStars(p, region.id);
  const state = rp.guardianPassed ? 'done' : unlocked ? 'open' : 'locked';
  const label = `${region.name}. ${state === 'locked' ? 'Bloqueada' : state === 'done' ? 'Guardián vencido' : starsLabel(earned, LEVELS_PER_REGION * 3)}`;
  return `<li class="node ${state}">
    <button type="button" class="node-btn" ${unlocked ? `data-action="open-region" data-id="${region.id}"` : 'disabled'} aria-label="${esc(label)}">
      <span class="node-emoji" aria-hidden="true">${unlocked ? region.emoji : '🔒'}</span>
    </button>
    <span class="node-name">${esc(region.name)}</span>
    ${unlocked ? `<span class="node-stars" aria-hidden="true">${rp.guardianPassed ? '🛡️ ' : ''}★ ${earned}/${LEVELS_PER_REGION * 3}</span>` : ''}
  </li>`;
}

function worldBlock(p: Profile, world: World): string {
  const open = isWorldUnlocked(p, world.id);
  return `<section class="world" data-theme="${world.theme}" aria-label="${esc(world.name)}">
    <h2><span aria-hidden="true">${world.emoji}</span> ${esc(world.name)}</h2>
    <p class="muted">${esc(world.grade)} · ${esc(world.ages)}</p>
    ${p.medals.includes(world.id) ? button('open-summary', `${MEDAL_EMOJI[worldSummary(p, world.id).tier]} Ver resumen del mundo`, 'btn-soft btn-small', `data-id="${world.id}"`) : ''}
    ${open ? `<ol class="trail">${world.regions.map((r) => regionNode(p, r)).join('')}</ol>` : '<p class="locked-note">🔒 Vence al Guardián del mundo anterior para entrar.</p>'}
  </section>`;
}

function map(v: ViewState): string {
  const p = v.profile as Profile;
  const chestReady = p.chestLastDay !== v.today;
  const timeline = UPCOMING_WORLDS.map(
    (w) => `<li><span aria-hidden="true">${w.emoji}</span> ${esc(w.name)} <span class="muted">${esc(w.grade)}</span></li>`,
  ).join('');
  return `<main class="screen map">
    <header class="topbar map-bar">
      ${button('go-home', '🏠 Inicio', 'btn-ghost btn-small', 'aria-label="Volver al inicio"')}
      <span class="who">${esc(p.avatar)} <strong>${esc(p.nickname)}</strong></span>
      <span class="chips">
        <button type="button" class="energy-chip" data-action="open-energy" aria-label="Energía: ${p.energy} de ${MAX_ENERGY}. Abrir recarga">⚡ ${p.energy}/${MAX_ENERGY}</button>
        <span class="streak" aria-label="Racha de ${p.streak.days} días">🔥 ${p.streak.days}</span>
        <span class="wallet" aria-label="${p.wallet} estrellas">⭐ ${p.wallet}</span>
      </span>
    </header>
    <section class="hero-card">
      ${mascot(p, true)}
      <div>
        <p class="hero-title">${esc(mascotStage(p).name)}</p>
        <p class="muted">Poderes: ${POWERS.map((k) => `${POWER_INFO[k].emoji} ${p.inventory[k]}`).join(' · ')}</p>
      </div>
    </section>
    <div class="actions">
      ${chestReady ? button('claim-chest', '🎁 Cofre del día', 'btn-gold') : '<span class="muted pill">🎁 Cofre abierto, vuelve mañana</span>'}
      ${!p.placement && !regionProgress(p, 'w1r1').guardianPassed ? button('start-placement', '🎯 Prueba de nivel', 'btn-soft') : ''}
      ${v.dueCount > 0 ? button('start-review', `🔁 Repaso (${v.dueCount})`, 'btn-primary') : ''}
      ${button('open-shop', '🛍️ Tienda', 'btn-soft')}
      ${button('open-parents', '👪 Familias', 'btn-ghost')}
    </div>
    ${WORLDS.map((w) => worldBlock(p, w)).join('')}
    ${timeline ? `<section class="upcoming"><h2>Próximamente</h2><ul>${timeline}</ul></section>` : ''}
    <div class="actions">
      ${button('go-home', '🏠 Ir al inicio', 'btn-soft')}
      ${button('switch-profile', 'Cambiar de explorador', 'btn-ghost')}
    </div>
  </main>`;
}

function regionScreen(v: ViewState): string {
  const p = v.profile as Profile;
  const { world, region, index } = findRegion(v.regionId as string);
  const rp = regionProgress(p, region.id);
  const skill = getSkill(region.skillIds[0] as string);
  const sp = skillProgress(p, skill.id);
  const levels = Array.from({ length: LEVELS_PER_REGION }, (_, i) => {
    const open = isLevelUnlocked(p, region.id, i);
    const got = rp.levels[i] ?? 0;
    return `<li>${
      open
        ? `<button type="button" class="level-btn" data-action="open-level" data-level="${i}" aria-label="Nivel ${i + 1}, ${starsLabel(got)}">
            <span class="level-num">${i + 1}</span><span class="level-stars">${stars(got)}</span>${(rp.best[i] ?? 0) > 0 ? `<span class="level-time">⏱ ${formatClock(rp.best[i] as number)}</span>` : ''}</button>`
        : `<button type="button" class="level-btn" disabled aria-label="Nivel ${i + 1} bloqueado"><span class="level-num">🔒</span></button>`
    }</li>`;
  }).join('');
  const guardianOpen = isGuardianUnlocked(p, region.id);
  const prevNames = world.regions.slice(0, index).map((r) => r.name);
  return `<main class="screen region" data-theme="${world.theme}">
    ${topBar(p, region.name, { action: 'back-map', label: 'Mapa' })}
    <section class="card">
      <p class="big-emoji" aria-hidden="true">${region.emoji}</p>
      <h2>${esc(skill.name)}</h2>
      <p class="muted">${MASTERY_EMOJI[sp.mastery]} ${MASTERY_LABEL[sp.mastery]}</p>
      <p>${esc(skill.tip)}</p>
    </section>
    <h2>Niveles</h2>
    <section class="energy-bar" aria-label="Energía">
      <span class="energy-icons">${energyIcons(p.energy)}</span>
      ${energyCountdown(p, v.nowMs)}
      ${p.energy <= 0 ? button('open-energy', '🔋 Recargar', 'btn-gold btn-small') : ''}
    </section>
    <ol class="levels">${levels}</ol>
    <section class="card guardian ${guardianOpen ? '' : 'is-locked'}">
      <h2>🛡️ Reto del Guardián</h2>
      <p>${GUARDIAN_QUESTIONS} preguntas sin poderes. Necesitas ${GUARDIAN_PASS_COUNT} aciertos para pasar.${prevNames.length ? ' Incluye un repaso de lo anterior.' : ''}</p>
      ${rp.guardianPassed ? `<p class="ok">¡Guardián vencido! Mejor marca: ${rp.guardianBest}/${GUARDIAN_QUESTIONS}</p>` : rp.guardianTries ? `<p class="muted">Mejor marca: ${rp.guardianBest}/${GUARDIAN_QUESTIONS}</p>` : ''}
      ${guardianOpen ? button('open-guardian', rp.guardianPassed ? 'Practicar de nuevo' : 'Enfrentar al Guardián', 'btn-primary') : '<p class="muted">🔒 Completa los 3 niveles para desbloquearlo.</p>'}
    </section>
  </main>`;
}


/** Respuesta escrita: una caja numérica grande y un botón. Mantiene lo escrito mientras se corrige. */
function typedForm(locked: boolean, pick: string | null, state: 'good' | 'bad' | 'neutral' | null): string {
  const cls = state === 'good' ? 'is-correct' : state === 'bad' ? 'is-wrong' : state === 'neutral' ? 'is-picked' : '';
  return `<form class="typed" data-form="answer" autocomplete="off">
    <label class="field" for="typed-input">Escribe tu respuesta</label>
    <input id="typed-input" name="answer" class="typed-input ${cls}" inputmode="numeric" maxlength="6" value="${esc(pick ?? '')}" placeholder="?" ${locked ? 'disabled' : 'required'} />
    <button type="submit" class="btn btn-primary btn-xl" ${locked ? 'disabled' : ''}>Responder</button>
  </form>`;
}

/** Los grupos se separan con 3 espacios en la pregunta; aquí cada grupo se dibuja en su propia cajita. */
function visualHtml(visual: string): string {
  const parts = visual.split(/\s{3,}/).filter(Boolean);
  if (parts.length < 2) return esc(visual);
  return parts.map((part) => `<span class="vgroup">${esc(part)}</span>`).join(' ');
}

function playTitle(play: PlayState): string {
  const ref = play.ref;
  if (ref.kind === 'level') return `${findRegion(ref.regionId).region.name} · Nivel ${ref.level + 1}`;
  if (ref.kind === 'guardian') return `Reto del Guardián`;
  if (ref.kind === 'recharge') return 'Recargar energía';
  return 'Repaso';
}

function playIntro(v: ViewState, play: PlayState): string {
  const p = v.profile as Profile;
  const ref = play.ref;
  const s = play.session;
  let body: string;
  if (ref.kind === 'level') {
    const picks = POWERS.map((k) => {
      const have = p.inventory[k];
      const on = play.loadout.has(k);
      return `<li><button type="button" class="power ${on ? 'is-on' : ''}" data-action="toggle-power" data-id="${k}" aria-pressed="${on}" ${have === 0 ? 'disabled' : ''}>
        <span class="power-emoji" aria-hidden="true">${POWER_INFO[k].emoji}</span>
        <span class="power-name">${POWER_INFO[k].name}</span>
        <span class="power-desc">${POWER_INFO[k].desc}</span>
        <span class="power-count">x${have}</span></button></li>`;
    }).join('');
    const par = play.parSec;
    body = `<p>${s.total} preguntas. Cada error gasta 1 ⚡ de energía y ahora tienes <strong>${s.hearts}</strong>: si llegas a 0 es Game Over.</p>
      <p class="goal">⏱ Termina en <strong>${formatClock(par * 1000)}</strong> o menos y gana ⭐ y ⚡ extra; en <strong>${formatClock(par * RAYO_TIME_RATIO * 1000)}</strong> o menos, ¡el bono Rayo! (con 1 error como máximo)</p>
      <p class="muted">Elige los poderes que quieres llevar: se gastan solo si los usas.</p>
      <ul class="powers">${picks}</ul>`;
  } else if (ref.kind === 'guardian') {
    body = `<p>${s.total} preguntas. Aquí no hay poderes ni corazones: demuestra lo que sabes. Con ${GUARDIAN_PASS_COUNT} aciertos pasas.</p>
      <p class="muted">Si no pasas, no pasa nada: practicas y vuelves a intentarlo.</p>`;
  } else if (ref.kind === 'recharge') {
    body = `<p>${s.total} preguntas fáciles de lo que ya conoces. Cada acierto te devuelve <strong>1 ⚡</strong>. Sin prisa y sin perder energía.</p>
      <p class="muted">Ahora tienes ${p.energy} de ${MAX_ENERGY}.</p>`;
  } else {
    body = `<p>${s.total} preguntas para recordar lo que ya aprendiste. Cada acierto vale ⭐.</p>`;
  }
  return `<main class="screen play">
    ${topBar(p, playTitle(play), { action: 'quit-play', label: 'Salir' })}
    <section class="card">${body}${button('begin', '¡Empezar!', 'btn-primary btn-xl')}</section>
  </main>`;
}

function playQuestion(v: ViewState, play: PlayState): string {
  const p = v.profile as Profile;
  const s = play.session;
  const q = s.current;
  const fb = play.feedback;
  const locked = play.phase === 'feedback' || s.answered;
  const choices = q.choices
    .map((c) => {
      const out = s.eliminated.has(c);
      const cls: string[] = ['choice'];
      if (c.length > 8) cls.push('is-wide');
      if (out) cls.push('is-out');
      if (fb) {
        if (play.pick === c) cls.push(fb.neutral ? 'is-picked' : fb.correct ? 'is-correct' : 'is-wrong');
        if (fb.explain && c === q.answer) cls.push('is-correct');
      }
      return `<li><button type="button" class="${cls.join(' ')}" data-action="answer" data-choice="${esc(c)}" ${locked || out ? 'disabled' : ''}>${esc(c)}</button></li>`;
    })
    .join('');

  const powerBar =
    s.allowsPowers && play.phase === 'asking'
      ? `<ul class="power-bar">${POWERS.filter((k) => play.loadout.has(k))
          .map((k) => {
            const used = s.used.has(k);
            return `<li><button type="button" class="btn btn-soft btn-small" data-action="use-power" data-id="${k}" ${used || locked || !s.canUse(k) ? 'disabled' : ''} aria-label="${POWER_INFO[k].name}: ${POWER_INFO[k].desc}">${POWER_INFO[k].emoji} ${POWER_INFO[k].name}</button></li>`;
          })
          .join('')}</ul>`
      : '';

  let feedback = '';
  if (fb) {
    if (fb.neutral) feedback = `<p class="feedback neutral" role="status">Respuesta guardada.</p>`;
    else if (fb.correct) {
      const extra =
        fb.combo === 'rayo'
          ? ' ⚡ ¡Rayo! Recuperas 1 ⚡ de energía.'
          : fb.combo === 'chispa'
            ? ' ✨ ¡Chispa! La próxima vale doble.'
            : fb.doubled
              ? ' ✨ ¡Valió doble!'
              : '';
      feedback = `<p class="feedback good" role="status">¡Muy bien!${extra}</p>`;
    } else {
      feedback = `<div class="feedback bad" role="status"><p>Casi. La respuesta era <strong>${esc(q.answer)}</strong>.</p><p>💡 ${esc(q.hint)}</p></div>`;
    }
  }
  const note = play.note && !fb ? `<p class="feedback note" role="status">💡 ${esc(play.note)}</p>` : '';
  const showContinue = play.phase === 'feedback' && fb?.explain;

  const isRecharge = play.ref.kind === 'recharge';
  const status = s.usesHearts
    ? `<span class="hearts" aria-label="${s.hearts} de ${s.maxHearts} energías">${energyIcons(s.hearts, s.maxHearts)}</span>`
    : isRecharge
      ? `<span class="hearts" aria-label="${p.energy} de ${MAX_ENERGY} energías">${energyIcons(p.energy)}</span>`
      : `<span class="muted">Sin ayudas</span>`;
  const clock = play.parSec > 0 ? `<span class="clock t-${liveTier(s.activeMs, play.parSec)}" data-clock="level" aria-hidden="true">⏱ ${formatClock(s.activeMs)}</span>` : '';
  const streak = s.usesHearts && s.streak >= 2 ? `<span class="combo">🔥 ${s.streak}${s.chispaArmed ? ' ✨' : ''}</span>` : '';
  const pct = Math.round((s.index / s.total) * 100);
  return `<main class="screen play">
    <header class="topbar">
      ${button('quit-play', '✕', 'btn-ghost btn-icon', 'aria-label="Salir de la partida"')}
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.index}" aria-label="Pregunta ${s.index + 1} de ${s.total}"><span style="width:${pct}%"></span></div>
      ${status}${clock}${streak}
    </header>
    <section class="question card" aria-live="polite">
      ${s.baseDifficulty && q.difficulty && q.difficulty > s.baseDifficulty ? '<span class="pill bonus">🚀 Reto extra</span>' : ''}
      ${q.visual ? `<p class="visual" aria-label="Dibujo de la pregunta">${visualHtml(q.visual)}</p>` : ''}
      <h2 class="prompt ${q.prompt.length > 34 ? 'is-long' : ''}">${esc(q.prompt)}</h2>
      ${p.settings.voice ? button('speak', '🔊 Escuchar', 'btn-soft btn-small') : ''}
    </section>
    ${powerBar}
    ${q.input === 'number' ? typedForm(locked, play.pick, fb ? (fb.neutral ? 'neutral' : fb.correct ? 'good' : 'bad') : null) : `<ul class="choices">${choices}</ul>`}
    ${feedback}${note}
    ${showContinue ? button('continue', 'Seguir', 'btn-primary btn-xl') : ''}
  </main>`;
}

function play(v: ViewState): string {
  const pl = v.play as PlayState;
  return pl.phase === 'intro' ? playIntro(v, pl) : playQuestion(v, pl);
}

function missedList(r: ResultState, gameOver = false): string {
  if (!r.outcome.missed.length) return '';
  return `<section class="card missed-card"><h2>${gameOver ? '🔎 Tus errores' : 'Para repasar'}</h2><ul class="missed">${r.outcome.missed
    .map(
      (m) => `<li>${m.question.visual ? `<span class="visual-small">${esc(m.question.visual)}</span>` : ''}
      <span>${esc(m.question.prompt)}</span>
      <span class="muted">Tu respuesta: ${esc(m.chosen)} · Correcta: <strong>${esc(m.question.answer)}</strong></span></li>`,
    )
    .join('')}</ul></section>`;
}

function result(v: ViewState): string {
  const r = v.result as ResultState;
  const p = v.profile as Profile;
  const o = r.outcome;
  const rw = r.reward;
  const gameOver = r.ref.kind === 'level' && o.lost;
  let title: string;
  let sub = '';
  let head = '';
  if (r.ref.kind === 'level') {
    if (o.lost) {
      title = 'Game Over';
      sub = 'Te quedaste sin energía ⚡. Mira tus errores, recarga y vuelve con más fuerza.';
      head = `<p class="big-emoji" aria-hidden="true">💥</p>`;
    } else {
      title = o.stars === 3 ? '¡Perfecto!' : '¡Nivel superado!';
      head = `<p class="big-stars" aria-label="${starsLabel(o.stars)}">${stars(o.stars)}</p>`;
      sub = `${o.correct} de ${o.total} aciertos`;
    }
  } else if (r.ref.kind === 'guardian') {
    title = o.passed ? '¡Venciste al Guardián!' : 'El Guardián resistió';
    sub = `${o.correct} de ${o.total} aciertos (hacen falta ${GUARDIAN_PASS_COUNT})`;
    head = `<p class="big-emoji" aria-hidden="true">${o.passed ? '🏅' : '🛡️'}</p>`;
  } else if (r.ref.kind === 'recharge') {
    title = o.correct > 0 ? '¡Energía recargada!' : 'Sigue practicando';
    sub = `${o.correct} de ${o.total} aciertos · ⚡ ${p.energy} de ${MAX_ENERGY}`;
    head = `<p class="big-emoji" aria-hidden="true">🔋</p>`;
  } else {
    title = o.mistakes === 0 ? '¡Memoria de elefante!' : '¡Repaso hecho!';
    sub = `${o.correct} de ${o.total} aciertos`;
    head = `<p class="big-emoji" aria-hidden="true">🐘</p>`;
  }

  const lines: string[] = [];
  if (r.ref.kind === 'level' && rw.activeMs > 0) {
    lines.push(`<li>⏱ Tiempo: ${formatClock(rw.activeMs)}${r.parSec > 0 ? ` <span class="muted">(meta ${formatClock(r.parSec * 1000)})</span>` : ''}</li>`);
    if (rw.newRecord) lines.push('<li>🏆 ¡Nuevo récord personal!</li>');
  }
  if (rw.speed === 'rayo') {
    lines.push(`<li class="bonus-line">🚀 ¡Bono Rayo por rapidez! +${SPEED_BONUS.rayo.stars} ⭐ +${SPEED_BONUS.rayo.energy} ⚡ y un poder</li>`);
  } else if (rw.speed === 'veloz') {
    lines.push(`<li class="bonus-line">⚡ ¡Bono Veloz! +${SPEED_BONUS.veloz.stars} ⭐ +${SPEED_BONUS.veloz.energy} ⚡</li>`);
  } else if (r.ref.kind === 'level' && !o.lost && rw.activeMs > 0 && r.parSec > 0) {
    lines.push(`<li class="muted">Termina en ${formatClock(r.parSec * 1000)} o menos con 1 error como máximo para ganar un bono.</li>`);
  }
  if (rw.wallet > 0) lines.push(`<li>⭐ +${rw.wallet} estrellas</li>`);
  if (rw.energyGain > 0) lines.push(`<li>⚡ +${rw.energyGain} de energía</li>`);
  if (rw.chest) lines.push('<li>🎁 ¡Cofre por nivel perfecto!</li>');
  if (rw.powerGift) lines.push(`<li>${POWER_INFO[rw.powerGift].emoji} Nuevo poder: ${POWER_INFO[rw.powerGift].name}</li>`);
  for (const c of rw.masteryChanges) {
    if (c.from !== c.to) lines.push(`<li>${MASTERY_EMOJI[c.to]} ${esc(getSkill(c.skillId).name)}: ${MASTERY_LABEL[c.to]}</li>`);
  }
  if (rw.regionCompleted) lines.push('<li>🗺️ ¡Región completada!</li>');
  if (rw.worldCompleted) lines.push('<li>🌍 ¡Mundo completado!</li>');
  if (o.bestStreak >= 3 && r.ref.kind === 'level') lines.push(`<li>🔥 Mejor racha: ${o.bestStreak}</li>`);

  const worldPrize = rw.worldPrize
    ? `<section class="prize" aria-label="Premio del mundo">
        <p class="prize-title">🎖️ ¡Premio del mundo!</p>
        <p>+${rw.worldPrize.stars} ⭐ · un poder de cada tipo (${POWERS.map((k) => POWER_INFO[k].emoji).join(' ')}) · ⚡ energía llena · medalla</p>
      </section>`
    : '';

  const passedLevel = r.ref.kind === 'level' && !o.lost;
  const buttons: string[] = [];
  if (rw.worldCompleted && p.medals.length) buttons.push(button('result-summary', '🏅 Ver resumen del mundo', 'btn-gold btn-xl'));
  if (gameOver) {
    if (p.energy > 0) buttons.push(button('result-retry', `Intentar otra vez (⚡ ${p.energy})`, 'btn-primary btn-xl'));
    else buttons.push(button('start-recharge', '🔋 Recargar practicando', 'btn-primary btn-xl'));
  } else if (passedLevel) {
    const last = r.ref.kind === 'level' && r.ref.level >= LEVELS_PER_REGION - 1;
    buttons.push(button('result-next', last ? 'Ir al Guardián' : 'Siguiente nivel', rw.worldCompleted ? 'btn-soft' : 'btn-primary btn-xl'));
  } else if (r.ref.kind === 'guardian' && !o.passed) {
    buttons.push(button('result-retry', 'Intentar otra vez', 'btn-primary btn-xl'));
  } else if (r.ref.kind === 'recharge' && p.energy < MAX_ENERGY) {
    buttons.push(button('start-recharge', '🔋 Recargar otra vez', 'btn-primary btn-xl'));
  }
  if (r.ref.kind === 'level' || r.ref.kind === 'guardian' || (r.ref.kind === 'recharge' && v.regionId)) {
    buttons.push(button('result-region', 'Volver a la región', 'btn-soft'));
  }
  const mapPrimary = r.ref.kind === 'review' || (r.ref.kind === 'guardian' && o.passed && !rw.worldCompleted) || (r.ref.kind === 'recharge' && p.energy >= MAX_ENERGY);
  buttons.push(button('result-map', 'Ir al mapa', mapPrimary ? 'btn-primary btn-xl' : 'btn-ghost'));
  buttons.push(button('go-home', '🏠 Inicio', 'btn-ghost'));

  const energyPanel = gameOver
    ? `<div class="energy-panel" aria-label="Energía">
        <span class="energy-icons">${energyIcons(p.energy)}</span>
        ${energyCountdown(p, v.nowMs)}
        <p class="muted">Cada acierto al «Recargar practicando» devuelve 1 ⚡. También recuperas 1 ⚡ cada 5 minutos.</p>
      </div>`
    : '';

  const tip = r.tip ? `<section class="card tip"><p>💡 ${esc(r.tip)}</p></section>` : '';
  return `<main class="screen result ${gameOver ? 'is-gameover' : ''}">
    <section class="card center">
      ${head}
      <h1>${esc(title)}</h1>
      <p class="lead">${esc(sub)}</p>
      ${energyPanel}
      ${lines.length ? `<ul class="rewards">${lines.join('')}</ul>` : ''}
      ${worldPrize}
      <div class="stack">${buttons.join('')}</div>
    </section>
    ${missedList(r, gameOver)}
    ${tip}
  </main>`;
}

/** Pantalla de recarga: cuánta energía hay, cuándo llega la próxima y cómo ganar más. */
function energyScreen(v: ViewState): string {
  const p = v.profile as Profile;
  const full = p.energy >= MAX_ENERGY;
  return `<main class="screen energy">
    ${topBar(p, 'Energía', { action: v.regionId ? 'result-region' : 'back-map', label: v.regionId ? 'Región' : 'Mapa' })}
    <section class="card center">
      <p class="energy-icons big">${energyIcons(p.energy)}</p>
      <h2>${full ? '¡Energía llena!' : p.energy === 0 ? 'Sin energía' : `Tienes ${p.energy} de ${MAX_ENERGY}`}</h2>
      ${energyCountdown(p, v.nowMs)}
      <p>${p.energy === 0 ? 'Recárgala para seguir con los niveles.' : 'Cada error en un nivel gasta 1 ⚡.'}</p>
      ${full ? '' : button('start-recharge', '🔋 Recargar practicando', 'btn-primary btn-xl')}
      ${full ? '' : `<p class="muted">${RECHARGE_QUESTIONS} preguntas fáciles: cada acierto devuelve 1 ⚡.</p>`}
    </section>
    <section class="card">
      <h2>Más formas de ganar ⚡</h2>
      <ul class="ways">
        <li>⏱ Termina un nivel rápido: +${SPEED_BONUS.veloz.energy} ⚡</li>
        <li>🌟 Nivel perfecto: +1 ⚡</li>
        <li>🎁 Cofre del día: +${CHEST_ENERGY} ⚡</li>
        <li>🏅 Completa un mundo: energía llena</li>
        <li>🕒 Esperando: +1 ⚡ cada 5 minutos</li>
      </ul>
    </section>
  </main>`;
}

/** Resumen del mundo completado: medalla, estrellas, Guardianes y tiempos. */
function worldSummaryScreen(v: ViewState): string {
  const p = v.profile as Profile;
  const sum = worldSummary(p, v.summaryWorldId ?? 1);
  const next = WORLDS.find((w) => w.id === sum.world.id + 1);
  const rows = sum.regions
    .map(
      (r) => `<li>
        <span class="sum-emoji" aria-hidden="true">${r.region.emoji}</span>
        <span class="sum-name">${esc(r.region.name)}</span>
        <span class="sum-stats">★ ${r.stars}/${r.maxStars} · 🛡️ ${r.guardianBest}/${GUARDIAN_QUESTIONS}${r.bestMs ? ` · ⏱ ${formatClock(r.bestMs)}` : ''}</span>
        <span class="sum-mastery">${MASTERY_EMOJI[r.mastery]} ${MASTERY_LABEL[r.mastery]}</span>
      </li>`,
    )
    .join('');
  return `<main class="screen summary" data-theme="${sum.world.theme}">
    ${topBar(p, 'Resumen del mundo', { action: 'close-summary', label: 'Mapa' })}
    <section class="card center">
      <p class="medal" aria-hidden="true">${MEDAL_EMOJI[sum.tier]}</p>
      <h1>${sum.world.emoji} ${esc(sum.world.name)}</h1>
      <p class="lead">Medalla de ${MEDAL_NAME[sum.tier]} · ${esc(sum.world.grade)}</p>
      <ul class="sum-totals">
        <li><strong>⭐ ${sum.stars}/${sum.maxStars}</strong><span>estrellas en niveles</span></li>
        <li><strong>🛡️ ${sum.regions.filter((r) => r.guardianBest >= GUARDIAN_PASS_COUNT).length}/${sum.regions.length}</strong><span>Guardianes vencidos</span></li>
        <li><strong>🧠 ${sum.strong}/${sum.regions.length}</strong><span>habilidades sólidas</span></li>
      </ul>
      <p class="muted">Premio del mundo: +${WORLD_PRIZE_STARS} ⭐, un poder de cada tipo y la energía llena.</p>
    </section>
    <section class="card">
      <h2>Tu recorrido</h2>
      <ol class="sum-list">${rows}</ol>
      <p class="muted">Rejuega los niveles para ganar más estrellas y mejorar tus tiempos. Pasa de ${Math.round(sum.maxStars * 0.7)} ⭐ para Plata y de ${Math.round(sum.maxStars * 0.9)} ⭐ para Oro.</p>
    </section>
    ${
      sum.isFinal
        ? `<section class="card prize"><p class="prize-title">🏆 ¡Terminaste todos los mundos de Matemundo!</p>
            <p>Desde contar frutas hasta derivar funciones: ${WORLDS.length} mundos y ${WORLDS.length * 5} habilidades. ¡Eres un verdadero explorador de las mates!</p></section>`
        : next
          ? `<section class="card"><p>Siguiente aventura: <strong>${next.emoji} ${esc(next.name)}</strong> · ${esc(next.grade)}</p></section>`
          : ''
    }
    <div class="stack">
      ${button('close-summary', 'Ir al mapa', 'btn-primary btn-xl')}
      ${button('go-home', '🏠 Inicio', 'btn-ghost')}
    </div>
  </main>`;
}

function shop(v: ViewState): string {
  const p = v.profile as Profile;
  const item = (it: { id: string; name: string; emoji: string; cost: number }, owned: boolean, equipped: boolean, costume: boolean): string => {
    const can = p.wallet >= it.cost;
    let action: string;
    if (!owned) action = `<button type="button" class="btn btn-small ${can ? 'btn-gold' : 'btn-soft'}" data-action="buy" data-id="${it.id}" ${can ? '' : 'disabled'}>⭐ ${it.cost}</button>`;
    else if (costume) action = equipped ? button('unequip', 'Quitar', 'btn-soft btn-small') : `<button type="button" class="btn btn-soft btn-small" data-action="equip" data-id="${it.id}">Ponerlo</button>`;
    else action = '<span class="pill">Tuyo ✓</span>';
    return `<li class="shop-item ${owned ? 'owned' : ''}"><span class="shop-emoji" aria-hidden="true">${it.emoji}</span><span class="shop-name">${esc(it.name)}</span>${action}</li>`;
  };
  return `<main class="screen shop">
    ${topBar(p, 'Tienda', { action: 'back-map', label: 'Mapa' })}
    <section class="hero-card">${mascot(p, true)}<p class="muted">Solo se compra con estrellas ganadas jugando.</p></section>
    <h2>Trajes</h2>
    <ul class="shop-list">${COSTUMES.map((c) => item(c, p.costumesOwned.includes(c.id), p.costumeEquipped === c.id, true)).join('')}</ul>
    <h2>Pegatinas</h2>
    <ul class="shop-list">${STICKERS.map((s) => item(s, p.stickersOwned.includes(s.id), false, false)).join('')}</ul>
  </main>`;
}

function recentCell(sp: SkillProgress): string {
  const acc = recentAccuracy(sp);
  if (acc === null) return '—';
  return `${Math.round(acc * 100)}%${needsSupport(sp) ? ' 🔧 refuerzo' : ''}`;
}

function placementSummary(p: Profile): string {
  const pl = p.placement;
  if (!pl) return '';
  const next = WORLDS[pl.placed];
  return `<p><strong>${shortDate(pl.date)}</strong> · Prueba de nivel: ${pl.scores.map((x, i) => `Mundo ${i + 1} ${x}/5`).join(', ')}. ${
    pl.placed === 0 ? 'Empezó desde el principio.' : next ? `Empezó en el mundo ${next.id}.` : 'Superó todos los mundos disponibles.'
  }</p>`;
}

function parents(v: ViewState): string {
  const p = v.profile as Profile;
  const worlds = WORLDS.map(
    (w) => `<h3>${w.emoji} ${esc(w.name)}</h3>
    <table class="table"><thead><tr><th scope="col">Habilidad</th><th scope="col">Estado</th><th scope="col">Aciertos</th><th scope="col">Últimas</th></tr></thead><tbody>
    ${w.regions
      .map((r) => {
        const sk = getSkill(r.skillIds[0] as string);
        const sp = skillProgress(p, sk.id);
        const pct = sp.attempts ? Math.round((sp.correct / sp.attempts) * 100) : null;
        return `<tr><th scope="row">${esc(sk.name)}</th><td>${MASTERY_EMOJI[sp.mastery]} ${MASTERY_LABEL[sp.mastery]}</td><td>${pct === null ? '—' : `${pct}% (${sp.correct}/${sp.attempts})`}</td><td>${recentCell(sp)}</td></tr>`;
      })
      .join('')}
    </tbody></table>`,
  ).join('');
  const evidence = [...p.evidence].reverse().slice(0, 8);
  const evHtml = evidence.length
    ? `<ul class="evidence">${evidence
        .map((e) => {
          const label = e.kind === 'guardian' ? 'Guardián' : 'Repaso';
          let place = '';
          try {
            place = e.regionId ? findRegion(e.regionId).region.name : '';
          } catch {
            place = '';
          }
          return `<li><strong>${shortDate(e.date)}</strong> · ${label}${place ? ` · ${esc(place)}` : ''}: ${e.correct}/${e.total} ${e.passed ? '✅' : '↻'}
          ${e.misses.length ? `<ul>${e.misses.slice(0, 4).map((m) => `<li>${esc(m.prompt)} → respondió ${esc(m.chosen)}, correcta ${esc(m.answer)}</li>`).join('')}</ul>` : ''}</li>`;
        })
        .join('')}</ul>`
    : '<p class="muted">Todavía no hay retos del Guardián ni repasos.</p>';
  const limits = SESSION_LIMITS.map(
    (m) => `<option value="${m}" ${m === p.sessionLimitMin ? 'selected' : ''}>${m} minutos</option>`,
  ).join('');
  return `<main class="screen parents">
    ${topBar(p, 'Panel de familias', { action: 'back-map', label: 'Mapa' })}
    <section class="card">
      <h2>Tiempo de juego</h2>
      <p>Cuando se cumple el tiempo, el juego propone descansar. Un adulto puede ampliarlo.</p>
      <label class="field" for="limit">Límite por sesión</label>
      <select id="limit" data-change="set-limit">${limits}</select>
      <div class="toggles">
        <label class="toggle"><input type="checkbox" data-change="toggle-sound" ${p.settings.sound ? 'checked' : ''} /> Sonidos</label>
        <label class="toggle"><input type="checkbox" data-change="toggle-voice" ${p.settings.voice ? 'checked' : ''} /> Leer las preguntas en voz alta</label>
      </div>
    </section>
    <section class="card"><h2>Progreso de ${esc(p.nickname)}</h2>
      <p class="muted">Una habilidad pasa a «Competente» con 100% en un nivel o al vencer al Guardián (${GUARDIAN_PASS_COUNT} de ${GUARDIAN_QUESTIONS}). Se confirma como «Dominada» al repasarla días después. Los niveles ajustan el reto según las últimas 10 respuestas (🔧 indica que conviene reforzar).</p>
      ${worlds}</section>
    <section class="card"><h2>Últimas pruebas</h2>${placementSummary(p)}${evHtml}</section>
    <section class="card"><h2>Datos</h2>
      <p>Todo se guarda solo en este dispositivo. No hay cuentas ni analíticas.</p>
      <div class="stack">
        ${button('export', '⬇️ Descargar copia de seguridad', 'btn-soft')}
        <label class="btn btn-soft file-btn">⬆️ Cargar copia<input type="file" accept="application/json,.json" data-change="import-file" hidden /></label>
        ${button('reset-progress', 'Reiniciar progreso de este explorador', 'btn-danger')}
        ${button('delete-profile', 'Eliminar este explorador', 'btn-danger')}
      </div>
    </section>
  </main>`;
}

function placementIntro(v: ViewState): string {
  const p = v.profile as Profile;
  return `<main class="screen">
    <section class="card">
      <p class="big-emoji" aria-hidden="true">🎯</p>
      <h1>Prueba de nivel</h1>
      <p>${esc(p.nickname)}, ¿quieres empezar donde ya sabes? Haz una prueba corta, sin ayudas:</p>
      <ul class="bullets">
        <li>5 preguntas por mundo. Con ${PLACEMENT_PASS_COUNT} aciertos pasas al siguiente mundo.</li>
        <li>Se detiene en el primer mundo que no domines y ahí empiezas.</li>
        <li>Los temas que saltes volverán como repasos en los próximos días, para confirmar que los dominas.</li>
        <li>No ganas estrellas por saltar. Dura unos 5 minutos.</li>
      </ul>
      <div class="stack">
        ${button('begin-placement', 'Hacer la prueba', 'btn-primary btn-xl')}
        ${button('skip-placement', 'Empezar desde el principio', 'btn-soft')}
      </div>
    </section>
  </main>`;
}

function placementQuestion(v: ViewState, pl: PlacementState): string {
  const p = v.profile as Profile;
  const world = WORLDS[pl.worldIndex] as World;
  const s = pl.session;
  const q = s.current;
  const locked = pl.phase === 'feedback';
  const choices = q.choices
    .map(
      (c) => `<li><button type="button" class="choice ${c.length > 8 ? 'is-wide' : ''} ${pl.pick === c ? 'is-picked' : ''}" data-action="answer" data-choice="${esc(c)}" ${locked ? 'disabled' : ''}>${esc(c)}</button></li>`,
    )
    .join('');
  const pct = Math.round((s.index / s.total) * 100);
  return `<main class="screen play">
    <header class="topbar">
      ${button('quit-placement', '✕', 'btn-ghost btn-icon', 'aria-label="Salir de la prueba"')}
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.index}" aria-label="Pregunta ${s.index + 1} de ${s.total}"><span style="width:${pct}%"></span></div>
      <span class="pill">${world.emoji} Mundo ${world.id}</span>
    </header>
    <section class="question card" aria-live="polite">
      ${q.visual ? `<p class="visual" aria-label="Dibujo de la pregunta">${visualHtml(q.visual)}</p>` : ''}
      <h2 class="prompt ${q.prompt.length > 34 ? 'is-long' : ''}">${esc(q.prompt)}</h2>
      ${p.settings.voice ? button('speak', '🔊 Escuchar', 'btn-soft btn-small') : ''}
    </section>
    ${q.input === 'number' ? typedForm(locked, pl.pick, locked ? 'neutral' : null) : `<ul class="choices">${choices}</ul>`}
    ${locked ? '<p class="feedback neutral" role="status">Respuesta guardada.</p>' : ''}
  </main>`;
}

function placementResult(v: ViewState): string {
  const p = v.profile as Profile;
  const pl = v.placement as PlacementState;
  const placed = pl.placed ?? 0;
  const done = WORLDS.slice(0, placed);
  const next = WORLDS[placed];
  const rows = pl.scores
    .map((score, i) => {
      const w = WORLDS[i] as World;
      const ok = score >= PLACEMENT_PASS_COUNT;
      return `<li>${ok ? '✅' : '🔎'} ${w.emoji} ${esc(w.name)}: ${score} de ${w.regions.length}</li>`;
    })
    .join('');
  let headline: string;
  let detail: string;
  if (!next) {
    headline = '¡Increíble! Dominas todos los mundos de hoy';
    detail = 'Los repasos te irán confirmando cada tema. Pronto habrá más mundos.';
  } else if (placed === 0) {
    headline = `Empiezas en el ${next.emoji} ${next.name}`;
    detail = 'Vas a avanzar paso a paso y a ganar tus primeras estrellas. ¡Perfecto!';
  } else {
    headline = `¡Saltas ${done.length === 1 ? 'un mundo' : `${done.length} mundos`}! Empiezas en el ${next.emoji} ${next.name}`;
    detail = 'Los temas que saltaste volverán como repasos en los próximos días para confirmar que los dominas.';
  }
  return `<main class="screen result">
    <section class="card center">
      <p class="big-emoji" aria-hidden="true">${placed === 0 ? '🌱' : '🚀'}</p>
      <h1>${headline}</h1>
      <p class="lead">${detail}</p>
      <ul class="rewards">${rows}</ul>
      <p class="muted">${esc(p.nickname)}, tu prueba quedó guardada en el panel de familias.</p>
      <div class="stack">${button('back-map', 'Ir al mapa', 'btn-primary btn-xl')}</div>
    </section>
  </main>`;
}

function sleep(v: ViewState): string {
  const p = v.profile as Profile;
  return `<main class="screen sleep center">
    <div class="logo" aria-hidden="true">${mascot(p, true)}</div>
    <h1>¡Hora de descansar!</h1>
    <p class="lead">Has jugado ${p.sessionLimitMin} minutos. Estira las piernas, toma agua y vuelve más tarde. Tu progreso está guardado.</p>
    <div class="stack">
      ${button('sleep-map', 'Ir al inicio', 'btn-primary')}
      ${button('extend-time', 'Un adulto puede añadir tiempo', 'btn-ghost')}
    </div>
  </main>`;
}

export function renderView(v: ViewState): string {
  let theme = 'home';
  if (v.screen === 'placement' && v.placement) {
    theme = (WORLDS[v.placement.worldIndex] as World).theme;
  } else if (v.regionId) {
    try {
      theme = findRegion(v.regionId).world.theme;
    } catch {
      theme = 'home';
    }
  } else if (v.play?.ref.kind === 'level' || v.play?.ref.kind === 'guardian') {
    theme = findRegion(v.play.ref.regionId).world.theme;
  }
  let body: string;
  switch (v.screen) {
    case 'welcome':
      body = welcome(v);
      break;
    case 'profiles':
      body = profiles(v);
      break;
    case 'create':
      body = create();
      break;
    case 'map':
      body = map(v);
      break;
    case 'region':
      body = regionScreen(v);
      break;
    case 'play':
      body = play(v);
      break;
    case 'result':
      body = result(v);
      break;
    case 'shop':
      body = shop(v);
      break;
    case 'energy':
      body = energyScreen(v);
      break;
    case 'world-summary':
      body = worldSummaryScreen(v);
      break;
    case 'parents':
      body = parents(v);
      break;
    case 'placement-intro':
      body = placementIntro(v);
      break;
    case 'placement':
      body = placementQuestion(v, v.placement as PlacementState);
      break;
    case 'placement-result':
      body = placementResult(v);
      break;
    default:
      body = sleep(v);
  }
  return `<div class="app" data-theme="${theme}">${body}${gate(v)}${toast(v)}</div>`;
}
