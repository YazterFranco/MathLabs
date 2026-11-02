import { COSTUMES, MASCOT_STAGES, POWER_INFO, STICKERS, AVATARS, MASCOTS } from '../data/shop.ts';
import {
  GUARDIAN_PASS_COUNT,
  GUARDIAN_QUESTIONS,
  LEVELS_PER_REGION,
  PLACEMENT_PASS_COUNT,
  MAX_HEARTS,
  UPCOMING_WORLDS,
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
import { MASTERY_EMOJI, MASTERY_LABEL } from '../engine/mastery.ts';
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
    ${button('start', '¡Jugar!', 'btn-primary btn-xl')}
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
    <header class="topbar">
      <span class="who">${esc(p.avatar)} <strong>${esc(p.nickname)}</strong></span>
      <span class="streak" aria-label="Racha de ${p.streak.days} días">🔥 ${p.streak.days}</span>
      <span class="wallet" aria-label="${p.wallet} estrellas">⭐ ${p.wallet}</span>
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
    <section class="upcoming"><h2>Próximamente</h2><ul>${timeline}</ul></section>
    ${button('switch-profile', 'Cambiar de explorador', 'btn-ghost')}
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
            <span class="level-num">${i + 1}</span><span class="level-stars">${stars(got)}</span></button>`
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
    <ol class="levels">${levels}</ol>
    <section class="card guardian ${guardianOpen ? '' : 'is-locked'}">
      <h2>🛡️ Reto del Guardián</h2>
      <p>${GUARDIAN_QUESTIONS} preguntas sin poderes. Necesitas ${GUARDIAN_PASS_COUNT} aciertos para pasar.${prevNames.length ? ' Incluye un repaso de lo anterior.' : ''}</p>
      ${rp.guardianPassed ? `<p class="ok">¡Guardián vencido! Mejor marca: ${rp.guardianBest}/${GUARDIAN_QUESTIONS}</p>` : rp.guardianTries ? `<p class="muted">Mejor marca: ${rp.guardianBest}/${GUARDIAN_QUESTIONS}</p>` : ''}
      ${guardianOpen ? button('open-guardian', rp.guardianPassed ? 'Practicar de nuevo' : 'Enfrentar al Guardián', 'btn-primary') : '<p class="muted">🔒 Completa los 3 niveles para desbloquearlo.</p>'}
    </section>
  </main>`;
}

function heartsHtml(n: number): string {
  return Array.from({ length: MAX_HEARTS }, (_, i) => `<span aria-hidden="true">${i < n ? '❤️' : '🖤'}</span>`).join('');
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
    body = `<p>${s.total} preguntas y ${MAX_HEARTS} corazones. Elige los poderes que quieres llevar: se gastan solo si los usas.</p>
      <ul class="powers">${picks}</ul>`;
  } else if (ref.kind === 'guardian') {
    body = `<p>${s.total} preguntas. Aquí no hay poderes ni corazones: demuestra lo que sabes. Con ${GUARDIAN_PASS_COUNT} aciertos pasas.</p>
      <p class="muted">Si no pasas, no pasa nada: practicas y vuelves a intentarlo.</p>`;
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
            return `<li><button type="button" class="btn btn-soft btn-small" data-action="use-power" data-id="${k}" ${used || locked ? 'disabled' : ''} aria-label="${POWER_INFO[k].name}: ${POWER_INFO[k].desc}">${POWER_INFO[k].emoji} ${POWER_INFO[k].name}</button></li>`;
          })
          .join('')}</ul>`
      : '';

  let feedback = '';
  if (fb) {
    if (fb.neutral) feedback = `<p class="feedback neutral" role="status">Respuesta guardada.</p>`;
    else if (fb.correct) {
      const extra =
        fb.combo === 'rayo'
          ? ' ⚡ ¡Rayo! Recuperas un corazón.'
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

  const status = s.usesHearts
    ? `<span class="hearts" aria-label="${s.hearts} corazones">${heartsHtml(s.hearts)}</span>`
    : `<span class="muted">Sin ayudas</span>`;
  const streak = s.usesHearts && s.streak >= 2 ? `<span class="combo">🔥 ${s.streak}${s.chispaArmed ? ' ✨' : ''}</span>` : '';
  const pct = Math.round((s.index / s.total) * 100);
  return `<main class="screen play">
    <header class="topbar">
      ${button('quit-play', '✕', 'btn-ghost btn-icon', 'aria-label="Salir de la partida"')}
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.index}" aria-label="Pregunta ${s.index + 1} de ${s.total}"><span style="width:${pct}%"></span></div>
      ${status}${streak}
    </header>
    <section class="question card" aria-live="polite">
      ${s.baseDifficulty && q.difficulty && q.difficulty > s.baseDifficulty ? '<span class="pill bonus">🚀 Reto extra</span>' : ''}
      ${q.visual ? `<p class="visual" aria-label="Dibujo de la pregunta">${visualHtml(q.visual)}</p>` : ''}
      <h2 class="prompt ${q.prompt.length > 34 ? 'is-long' : ''}">${esc(q.prompt)}</h2>
      ${p.settings.voice ? button('speak', '🔊 Escuchar', 'btn-soft btn-small') : ''}
    </section>
    ${powerBar}
    <ul class="choices">${choices}</ul>
    ${feedback}${note}
    ${showContinue ? button('continue', 'Seguir', 'btn-primary btn-xl') : ''}
  </main>`;
}

function play(v: ViewState): string {
  const pl = v.play as PlayState;
  return pl.phase === 'intro' ? playIntro(v, pl) : playQuestion(v, pl);
}

function missedList(r: ResultState): string {
  if (!r.outcome.missed.length) return '';
  return `<section class="card"><h2>Para repasar</h2><ul class="missed">${r.outcome.missed
    .map(
      (m) => `<li>${m.question.visual ? `<span class="visual-small">${esc(m.question.visual)}</span>` : ''}
      <span>${esc(m.question.prompt)}</span>
      <span class="muted">Tu respuesta: ${esc(m.chosen)} · Correcta: <strong>${esc(m.question.answer)}</strong></span></li>`,
    )
    .join('')}</ul></section>`;
}

function result(v: ViewState): string {
  const r = v.result as ResultState;
  const o = r.outcome;
  const rw = r.reward;
  let title: string;
  let sub = '';
  let head = '';
  if (r.ref.kind === 'level') {
    if (o.lost) {
      title = '¡Casi lo logras!';
      sub = 'Se acabaron los corazones. Practicar un poco más y lo consigues.';
    } else {
      title = o.stars === 3 ? '¡Perfecto!' : '¡Nivel superado!';
      head = `<p class="big-stars" aria-label="${starsLabel(o.stars)}">${stars(o.stars)}</p>`;
      sub = `${o.correct} de ${o.total} aciertos`;
    }
  } else if (r.ref.kind === 'guardian') {
    title = o.passed ? '¡Venciste al Guardián!' : 'El Guardián resistió';
    sub = `${o.correct} de ${o.total} aciertos (hacen falta ${GUARDIAN_PASS_COUNT})`;
    head = `<p class="big-emoji" aria-hidden="true">${o.passed ? '🏅' : '🛡️'}</p>`;
  } else {
    title = o.mistakes === 0 ? '¡Memoria de elefante!' : '¡Repaso hecho!';
    sub = `${o.correct} de ${o.total} aciertos`;
    head = `<p class="big-emoji" aria-hidden="true">🐘</p>`;
  }

  const lines: string[] = [];
  if (rw.wallet > 0) lines.push(`<li>⭐ +${rw.wallet} estrellas</li>`);
  if (rw.chest) lines.push('<li>🎁 ¡Cofre por nivel perfecto!</li>');
  if (rw.powerGift) lines.push(`<li>${POWER_INFO[rw.powerGift].emoji} Nuevo poder: ${POWER_INFO[rw.powerGift].name}</li>`);
  for (const c of rw.masteryChanges) {
    if (c.from !== c.to) lines.push(`<li>${MASTERY_EMOJI[c.to]} ${esc(getSkill(c.skillId).name)}: ${MASTERY_LABEL[c.to]}</li>`);
  }
  if (rw.regionCompleted) lines.push('<li>🗺️ ¡Región completada!</li>');
  if (rw.worldCompleted) lines.push('<li>🌍 ¡Mundo completado!</li>');
  if (o.bestStreak >= 3 && r.ref.kind === 'level') lines.push(`<li>🔥 Mejor racha: ${o.bestStreak}</li>`);

  const passedLevel = r.ref.kind === 'level' && !o.lost;
  const buttons: string[] = [];
  if (passedLevel) {
    const last = r.ref.kind === 'level' && r.ref.level >= LEVELS_PER_REGION - 1;
    buttons.push(button('result-next', last ? 'Ir al Guardián' : 'Siguiente nivel', 'btn-primary btn-xl'));
  } else if (r.ref.kind === 'level' || (r.ref.kind === 'guardian' && !o.passed)) {
    buttons.push(button('result-retry', 'Intentar otra vez', 'btn-primary btn-xl'));
  }
  if (r.ref.kind !== 'review') buttons.push(button('result-region', 'Volver a la región', 'btn-soft'));
  buttons.push(button('result-map', 'Ir al mapa', r.ref.kind === 'review' || (r.ref.kind === 'guardian' && o.passed) ? 'btn-primary btn-xl' : 'btn-ghost'));

  const tip = r.tip ? `<section class="card tip"><p>💡 ${esc(r.tip)}</p></section>` : '';
  return `<main class="screen result">
    <section class="card center">
      ${head}
      <h1>${esc(title)}</h1>
      <p class="lead">${esc(sub)}</p>
      ${lines.length ? `<ul class="rewards">${lines.join('')}</ul>` : ''}
      <div class="stack">${buttons.join('')}</div>
    </section>
    ${tip}
    ${r.ref.kind === 'level' && o.lost ? '' : missedList(r)}
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
    <ul class="choices">${choices}</ul>
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
