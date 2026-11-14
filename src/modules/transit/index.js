/**
 * Módulo "transit": la Fase 2, los meses de viaje. Dueño: Parte B — tarea B3 (docs/PARTE-B.md).
 *
 * Cinco secciones: el viaje día a día, los cinco peligros del vuelo espacial, la rutina de
 * confinamiento, el caso "solo" y los juegos. Los cálculos están en trip.js, las reglas del
 * minijuego en game.js y las fuentes en data.js.
 */
import './transit.css';
import messages from './i18n.js';
import { submitScore, topScores, ALIAS_MAX } from '../../services/index.js';
import { REFERENCES, refOf, STAGES, METERS, HAZARDS, SOLO_CHANGES, SOLO_TIPS } from './data.js';
import { CAREER_LIMIT_MSV } from '../../core/journal.js';
import {
  tripInfo,
  estimates,
  stageOf,
  PLAN_KEYS,
  PLAN_STEP_H,
  DAY_H,
  DEFAULT_PLAN,
  planTotal,
  sanitizePlan,
  adjustPlan,
  planChecks,
} from './trip.js';
import { GAME_ID, TILES, roundSpec, makeSequence, expectedInput, roundPoints } from './game.js';

// Los peligros van al final: primero lo que la persona hace durante el viaje.
/** Dibujos de los medidores del cuerpo (se rellenan en paint()). */
const VIZ = {
  bone: `
    <svg viewBox="0 0 180 70" class="transit__bone" role="img" aria-hidden="true">
      <defs><clipPath id="transit-bone-clip">
        <path d="M30 22a14 14 0 1 1 6-20h108a14 14 0 1 1 6 20 14 14 0 1 1 -6 26H36a14 14 0 1 1 -6-26z" transform="translate(0 10)"/>
      </clipPath></defs>
      <path d="M30 22a14 14 0 1 1 6-20h108a14 14 0 1 1 6 20 14 14 0 1 1 -6 26H36a14 14 0 1 1 -6-26z" transform="translate(0 10)" class="transit__bone-shape"/>
      <g clip-path="url(#transit-bone-clip)">
        <rect x="20" y="0" width="140" height="70" class="transit__bone-fill"/>
        <g class="transit__bone-pores">${Array.from({ length: 18 }, (_, i) => `<circle cx="${26 + (i % 9) * 16}" cy="${i < 9 ? 28 : 46}" r="2.4"/>`).join('')}</g>
      </g>
      <text x="90" y="40" text-anchor="middle" class="transit__bone-loss"></text>
    </svg>`,
  dose: `
    <svg viewBox="0 0 120 70" class="transit__gauge" role="img" aria-hidden="true">
      <path d="M10 62 A50 50 0 0 1 110 62" class="transit__gauge-bg"/>
      <path d="M10 62 A50 50 0 0 1 110 62" class="transit__gauge-arc" stroke-dasharray="0 157"/>
      <text x="60" y="54" text-anchor="middle" class="transit__gauge-num"></text>
      <text x="60" y="68" text-anchor="middle" class="transit__gauge-of"></text>
    </svg>`,
  exercise: `
    <div class="transit__ex">
      <span class="transit__ex-num"></span>
      <div class="glyph-bar glyph-bar--square" style="--value:0;--tone:var(--red);--dot:10px;--gap:3px"></div>
    </div>`,
};

const TABS = ['trip', 'routine', 'solo', 'games', 'hazards'];
const SAVE_KEY = 'laika2.transit.v1';

// Ritmo del minijuego, en milisegundos.
const LIT_MS = 520;
const GAP_MS = 220;
const LEAD_MS = 900;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function readSaved() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(SAVE_KEY) ?? 'null') ?? {};
  } catch {
    return {};
  }
}

/**
 * Lo que la persona eligió en este módulo (sección abierta, día del viaje, rutina, alias).
 * Vive fuera del DOM porque el shell vuelve a montar el módulo al cambiar de idioma, y se guarda
 * en una clave propia de localStorage: no forma parte del estado compartido de la misión.
 */
const saved = readSaved();
const ui = {
  tab: TABS.includes(saved.tab) ? saved.tab : 'trip',
  day: Number.isFinite(saved.day) ? Math.max(0, Math.round(saved.day)) : 0,
  plan: sanitizePlan(saved.plan),
  alias: typeof saved.alias === 'string' ? saved.alias.slice(0, ALIAS_MAX) : '',
};

function persist() {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(ui));
  } catch {
    /* almacenamiento no disponible: se sigue en memoria */
  }
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'transit',
  phase: 2,
  owner: 'B',
  task: 'B3',
  messages,
  references: REFERENCES,
  mount(el, ctx) {
    const { t, store, navigate } = ctx;
    const { lang, mission } = store.get();
    // es-MX escribe los decimales con punto, igual que las cifras de los textos ("1.5 %").
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const trip = tripInfo(mission);
    ui.day = clamp(ui.day, 0, trip.days);

    let alive = true;
    let disposeTab = null;

    /** Enlaces a las fuentes que respaldan un bloque. */
    const sources = (refIds) => `
      <p class="transit__src">
        <span>${t('transit.source')}:</span>
        ${refIds
          .map((id) => refOf(id))
          .map((ref) => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.org)} — ${esc(ref.title)}</a>`)
          .join('')}
      </p>`;

    el.innerHTML = `
      <div class="transit">
        <header class="transit__head">
          <h1>${t('transit.title')}</h1>
          <p>${t('transit.desc')}</p>
        </header>
        <div class="transit__tabs" role="tablist" aria-label="${t('transit.tabsLabel')}">
          ${TABS.map(
            (tab) => `
            <button type="button" class="transit__tab" role="tab" id="transit-tab-${tab}"
              aria-controls="transit-panel" data-tab="${tab}">${t(`transit.tab.${tab}`)}</button>`,
          ).join('')}
        </div>
        <section class="transit__panel" id="transit-panel" role="tabpanel" tabindex="-1"></section>
      </div>
    `;
    const tabButtons = [...el.querySelectorAll('.transit__tab')];
    const panel = el.querySelector('.transit__panel');

    // ---------- Viaje ----------

    function renderTrip() {
      const summary = trip.isDefault
        ? `<div class="transit__notice">
             <p>${t('transit.trip.defaultNotice', { days: trip.days })}</p>
             ${sources(['jpl-approx-pos'])}
             <button type="button" class="btn btn--primary" data-go="hohmann">${t('transit.trip.planCta')}</button>
           </div>`
        : `<p class="transit__dates">${t('transit.trip.planned', {
            departure: dateFmt.format(new Date(trip.departure)),
            arrival: dateFmt.format(new Date(trip.arrival)),
            days: trip.days,
          })}</p>`;

      panel.innerHTML = `
        ${summary}

        <div class="transit__track" aria-hidden="true">
          <span class="transit__planet transit__planet--earth"></span>
          <div class="transit__track-line">
            ${STAGES.map((stage) => `<span class="transit__seg transit__seg--${stage.id}"></span>`).join('')}
            <span class="transit__ship">▲</span>
          </div>
          <span class="transit__planet transit__planet--mars"></span>
        </div>

        <div class="transit__day">
          <div class="transit__day-head">
            <label for="transit-day">${t('transit.trip.dayLabel')}</label>
            <output for="transit-day" class="transit__day-out"></output>
          </div>
          <input type="range" id="transit-day" min="0" max="${trip.days}" step="1" value="${ui.day}" />
          <div class="transit__day-btns">
            <button type="button" class="btn" data-day-step="-7">${t('transit.trip.backWeek')}</button>
            <button type="button" class="btn" data-day-step="-1">${t('transit.trip.backDay')}</button>
            <button type="button" class="btn" data-day-step="1">${t('transit.trip.nextDay')}</button>
            <button type="button" class="btn" data-day-step="7">${t('transit.trip.nextWeek')}</button>
          </div>
        </div>

        <h3>${t('transit.trip.stagesTitle')}</h3>
        <ol class="transit__stages">
          ${STAGES.map(
            (stage) => `
            <li class="transit__stage" data-stage="${stage.id}">
              <p class="transit__stage-name">
                ${t(`transit.stage.${stage.id}.name`)}
                <span class="badge transit__here" hidden>${t('transit.trip.here')}</span>
              </p>
              <p>${t(`transit.stage.${stage.id}.text`)}</p>
              ${sources(stage.refs)}
            </li>`,
          ).join('')}
        </ol>

        <h3 class="transit__meters-title"></h3>
        <div class="transit__meters transit__meters--visual">
          ${METERS.filter((meter) => meter.id !== 'comms')
            .map(
              (meter) => `
            <article class="transit__meter transit__meter--${meter.id}">
              <div class="transit__viz" data-viz="${meter.id}">${VIZ[meter.id]}</div>
              <p class="transit__meter-label">${t(`transit.meter.${meter.id}.label`)}</p>
              <p class="transit__meter-value" data-meter="${meter.id}"></p>
              <p class="transit__meter-note">${t(`transit.meter.${meter.id}.note`)}</p>
              ${sources(meter.refs)}
            </article>`,
            )
            .join('')}
        </div>
        <p class="transit__fine">${t('transit.trip.metersNote')}</p>
      `;

      const slider = panel.querySelector('#transit-day');
      const out = panel.querySelector('.transit__day-out');
      const metersTitle = panel.querySelector('.transit__meters-title');
      const value = (id) => panel.querySelector(`[data-meter="${id}"]`);

      function paint() {
        const est = estimates(ui.day);
        out.textContent = t('transit.trip.dayValue', { day: ui.day, days: trip.days });
        slider.setAttribute('aria-valuetext', out.textContent);
        metersTitle.textContent = t('transit.trip.metersTitle', { day: ui.day });
        value('bone').textContent = t('transit.meter.bone.value', {
          low: number.format(est.boneLossPct[0]),
          high: number.format(est.boneLossPct[1]),
        });
        value('dose').textContent = t('transit.meter.dose.value', { dose: whole.format(est.doseMSv) });
        value('exercise').textContent = t('transit.meter.exercise.value', { hours: whole.format(est.exerciseH) });
        // Gráficos: trayecto, hueso que se vacía, medidor de radiación y horas de ejercicio.
        const progress = trip.days ? ui.day / trip.days : 0;
        panel.querySelector('.transit__ship').style.left = `${(progress * 100).toFixed(2)}%`;
        const loss = est.boneLossPct[1];
        panel.querySelector('[data-viz="bone"] .transit__bone-fill').setAttribute('width', String(Math.max(0, 140 * (1 - loss / 20))));
        panel.querySelector('[data-viz="bone"] .transit__bone-loss').textContent = `−${number.format(est.boneLossPct[0])}–${number.format(loss)} %`;
        const share = Math.min(1, est.doseMSv / CAREER_LIMIT_MSV);
        panel.querySelector('[data-viz="dose"] .transit__gauge-arc').setAttribute('stroke-dasharray', `${(share * 157).toFixed(1)} 157`);
        panel.querySelector('[data-viz="dose"] .transit__gauge-num').textContent = whole.format(est.doseMSv);
        panel.querySelector('[data-viz="dose"] .transit__gauge-of').textContent = `/ ${CAREER_LIMIT_MSV} mSv`;
        const ex = panel.querySelector('[data-viz="exercise"] .glyph-bar');
        ex.style.setProperty('--value', String(progress));
        panel.querySelector('[data-viz="exercise"] .transit__ex-num').textContent = `${whole.format(est.exerciseH)} h`;
        const current = stageOf(ui.day, trip.days);
        for (const item of panel.querySelectorAll('.transit__stage')) {
          const here = item.dataset.stage === current;
          item.classList.toggle('is-current', here);
          item.querySelector('.transit__here').hidden = !here;
        }
      }

      function setDay(day) {
        ui.day = clamp(Math.round(day), 0, trip.days);
        slider.value = String(ui.day);
        persist();
        paint();
      }

      const onInput = () => setDay(Number(slider.value));
      const onClick = (event) => {
        const step = event.target.closest('[data-day-step]')?.dataset.dayStep;
        if (step) setDay(ui.day + Number(step));
        if (event.target.closest('[data-go="hohmann"]')) navigate('hohmann');
      };
      slider.addEventListener('input', onInput);
      panel.addEventListener('click', onClick);
      paint();
      return () => {
        slider.removeEventListener('input', onInput);
        panel.removeEventListener('click', onClick);
      };
    }

    // ---------- Peligros ----------

    function renderHazards() {
      panel.innerHTML = `
        <h2>${t('transit.hazards.heading')}</h2>
        <p class="transit__lead">${t('transit.hazards.lead')}</p>
        ${sources(['hrp-hazards'])}
        <div class="transit__hazards">
          ${HAZARDS.map(
            (hazard) => `
            <article class="transit__hazard">
              <header>
                <span class="transit__letter" aria-hidden="true">${hazard.letter}</span>
                <h3>${t(`transit.hazard.${hazard.id}.name`)}</h3>
              </header>
              <dl>
                ${['what', 'body', 'counter']
                  .map(
                    (part) => `
                  <dt>${t(`transit.hazards.${part}`)}</dt>
                  <dd>${t(`transit.hazard.${hazard.id}.${part}`)}</dd>`,
                  )
                  .join('')}
              </dl>
              ${sources(hazard.refs)}
            </article>`,
          ).join('')}
        </div>
      `;
    }

    // ---------- Rutina ----------

    function renderRoutine(focusSelector) {
      const plan = ui.plan;
      const rest = DAY_H - planTotal(plan);
      const checks = planChecks(plan);
      const hours = (h) => t('transit.routine.hours', { h: number.format(h) });
      const cap = (word) => word[0].toUpperCase() + word.slice(1);
      const checkLines = [
        t(`transit.routine.check.sleep${cap(checks.sleep)}`, { h: number.format(plan.sleep) }),
        t(`transit.routine.check.exercise${cap(checks.exercise)}`, { h: number.format(plan.exercise) }),
        t('transit.routine.check.work', { h: number.format(plan.work) }),
        t('transit.routine.check.leisure', { h: number.format(plan.leisure) }),
      ];

      panel.innerHTML = `
        <h2>${t('transit.routine.heading')}</h2>
        <p class="transit__lead">${t('transit.routine.lead')}</p>

        <div class="transit__plan">
          ${PLAN_KEYS.map((key) => {
            const name = t(`transit.routine.${key}`);
            return `
            <div class="transit__plan-row" data-kind="${key}">
              <span class="transit__plan-name"><i class="transit__swatch" aria-hidden="true"></i>${name}</span>
              <button type="button" class="btn transit__step" data-plan="${key}" data-delta="-1"
                aria-label="${t('transit.routine.less', { name })}" ${plan[key] <= 0 ? 'disabled' : ''}>−</button>
              <span class="transit__plan-hours">${hours(plan[key])}</span>
              <button type="button" class="btn transit__step" data-plan="${key}" data-delta="1"
                aria-label="${t('transit.routine.more', { name })}" ${rest <= 0 ? 'disabled' : ''}>+</button>
            </div>`;
          }).join('')}
          <div class="transit__plan-row" data-kind="rest">
            <span class="transit__plan-name"><i class="transit__swatch" aria-hidden="true"></i>${t('transit.routine.rest')}</span>
            <span class="transit__plan-hours">${hours(rest)}</span>
          </div>
        </div>

        <div class="transit__bar" role="img" aria-label="${t('transit.routine.barLabel')}: ${[...PLAN_KEYS, 'rest']
          .map((key) => `${t(`transit.routine.${key}`)} ${hours(key === 'rest' ? rest : plan[key])}`)
          .join(', ')}">
          ${[...PLAN_KEYS, 'rest']
            .map((key) => {
              const h = key === 'rest' ? rest : plan[key];
              return h > 0 ? `<span data-kind="${key}" style="flex-grow:${h}"></span>` : '';
            })
            .join('')}
        </div>
        ${rest <= 0 ? `<p class="transit__fine">${t('transit.routine.full')}</p>` : ''}

        <h3>${t('transit.routine.checksTitle')}</h3>
        <ul class="transit__checks">
          <li data-state="${checks.sleep}">${checkLines[0]}</li>
          <li data-state="${checks.exercise}">${checkLines[1]}</li>
          <li>${checkLines[2]}</li>
          <li>${checkLines[3]}</li>
        </ul>
        ${sources(['nasa-sleep-brief', 'nasa-bone-muscle', 'hrp-isolation', 'hrp-body'])}

        <div class="transit__row">
          <button type="button" class="btn" data-plan-reset>${t('transit.routine.reset')}</button>
        </div>
        <p class="transit__fine">${t('transit.disclaimer')}</p>
      `;

      if (focusSelector) {
        const target = panel.querySelector(focusSelector);
        (target && !target.disabled ? target : panel).focus({ preventScroll: true });
      }

      const onClick = (event) => {
        const step = event.target.closest('[data-plan]');
        if (step) {
          const { plan: key, delta } = step.dataset;
          ui.plan = adjustPlan(ui.plan, key, Number(delta) * PLAN_STEP_H);
          persist();
          rerender(`[data-plan="${key}"][data-delta="${delta}"]`);
        } else if (event.target.closest('[data-plan-reset]')) {
          ui.plan = { ...DEFAULT_PLAN };
          persist();
          rerender('[data-plan-reset]');
        }
      };
      panel.addEventListener('click', onClick);
      return () => panel.removeEventListener('click', onClick);
    }

    // ---------- Caso solo ----------

    function renderSolo() {
      const list = (items, prefix) =>
        items.map((item) => `<li>${t(`${prefix}.${item.id}`)}${sources(item.refs)}</li>`).join('');
      panel.innerHTML = `
        <h2>${t('transit.solo.heading')}</h2>
        <p class="transit__lead">${t('transit.solo.lead')}</p>
        <p class="transit__notice transit__notice--plain">${t('transit.disclaimer')}</p>

        <h3>${t('transit.solo.changesTitle')}</h3>
        <ul class="transit__points">${list(SOLO_CHANGES, 'transit.solo.change')}</ul>

        <h3>${t('transit.solo.tipsTitle')}</h3>
        <ul class="transit__points">${list(SOLO_TIPS, 'transit.solo.tip')}</ul>

      `;
    }

    // ---------- Juegos ----------

    function renderGames() {
      panel.innerHTML = `
        <h2>${t('transit.games.heading')}</h2>
        <p class="transit__lead">${t('transit.games.lead')}</p>

        <div class="transit__game">
          <div class="transit__game-main">
            <h3>${t('transit.games.title')}</h3>
            <p>${t('transit.games.rules')}</p>
            <div class="transit__hud">
              <span class="badge" data-hud="round"></span>
              <span class="badge" data-hud="points"></span>
            </div>
            <p class="transit__status" role="status" aria-live="polite"></p>
            <div class="transit__console" role="group" aria-label="${t('transit.games.consoleLabel')}">
              ${TILES.map(
                (tile, index) => `
                <button type="button" class="transit__tile" data-tile="${index}" aria-disabled="true">
                  <span class="transit__tile-code">${tile.code}</span>
                  <span class="transit__tile-name">${t(`transit.tile.${tile.id}`)}</span>
                </button>`,
              ).join('')}
            </div>
            <div class="transit__row">
              <button type="button" class="btn btn--primary" data-game-start>${t('transit.games.start')}</button>
            </div>
            <form class="transit__score-form" hidden>
              <label for="transit-alias">${t('transit.games.aliasLabel', { max: ALIAS_MAX })}</label>
              <div class="transit__row">
                <input id="transit-alias" name="alias" type="text" maxlength="${ALIAS_MAX}" autocomplete="nickname"
                  value="${esc(ui.alias)}" />
                <button type="submit" class="btn btn--primary">${t('transit.games.save')}</button>
              </div>
            </form>
            <p class="transit__saved" role="status" aria-live="polite"></p>
          </div>

          <aside class="transit__board">
            <h3>${t('transit.games.boardTitle')}</h3>
            <p class="transit__board-source"></p>
            <ol class="transit__board-list"></ol>
          </aside>
        </div>

      `;

      const status = panel.querySelector('.transit__status');
      const tiles = [...panel.querySelectorAll('.transit__tile')];
      const startBtn = panel.querySelector('[data-game-start]');
      const form = panel.querySelector('.transit__score-form');
      const aliasInput = panel.querySelector('#transit-alias');
      const savedLine = panel.querySelector('.transit__saved');
      const hud = (id) => panel.querySelector(`[data-hud="${id}"]`);

      const timers = new Set();
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
      };

      const game = { phase: 'idle', round: 0, points: 0, completed: 0, want: [], at: 0, length: 0, reversed: false };

      function paintHud() {
        hud('round').textContent = t('transit.games.round', { n: Math.max(1, game.round) });
        hud('points').textContent = t('transit.games.points', { points: game.points });
      }

      function setInput(enabled) {
        for (const tile of tiles) tile.setAttribute('aria-disabled', String(!enabled));
      }

      function flash(index, className, ms) {
        tiles[index].classList.add(className);
        later(() => tiles[index].classList.remove(className), ms);
      }

      function startRound() {
        game.round += 1;
        const spec = roundSpec(game.round);
        const sequence = makeSequence(spec.length);
        Object.assign(game, { phase: 'show', length: spec.length, reversed: spec.reversed, at: 0 });
        game.want = expectedInput(sequence, spec.reversed);
        setInput(false);
        paintHud();
        status.textContent = t(spec.reversed ? 'transit.games.watchReversed' : 'transit.games.watch', { n: game.round });
        sequence.forEach((tile, i) => later(() => flash(tile, 'is-lit', LIT_MS), LEAD_MS + i * (LIT_MS + GAP_MS)));
        later(
          () => {
            game.phase = 'input';
            setInput(true);
            status.textContent = t(spec.reversed ? 'transit.games.turnReversed' : 'transit.games.turn');
          },
          LEAD_MS + sequence.length * (LIT_MS + GAP_MS),
        );
      }

      function endGame() {
        game.phase = 'over';
        setInput(false);
        status.textContent = t('transit.games.over', { points: game.points, rounds: game.completed });
        startBtn.textContent = t('transit.games.again');
        startBtn.hidden = false;
        form.hidden = game.points === 0;
      }

      function onTile(index) {
        if (game.phase !== 'input') return;
        if (index !== game.want[game.at]) {
          flash(index, 'is-wrong', 600);
          endGame();
          return;
        }
        flash(index, 'is-right', 260);
        game.at += 1;
        if (game.at < game.want.length) return;
        game.points += roundPoints(game.length, game.reversed);
        game.completed += 1;
        game.phase = 'pause';
        setInput(false);
        paintHud();
        status.textContent = t('transit.games.good');
        later(startRound, 1000);
      }

      function newGame() {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        for (const tile of tiles) tile.classList.remove('is-lit', 'is-right', 'is-wrong');
        Object.assign(game, { round: 0, points: 0, completed: 0 });
        startBtn.hidden = true;
        form.hidden = true;
        savedLine.textContent = '';
        startRound();
      }

      async function loadBoard() {
        const board = await topScores(GAME_ID, 5);
        if (!alive || !panel.contains(form)) return;
        panel.querySelector('.transit__board-source').textContent = t(
          board.source === 'cloud' ? 'transit.games.boardCloud' : 'transit.games.boardLocal',
        );
        const list = panel.querySelector('.transit__board-list');
        list.replaceChildren();
        if (board.rows.length === 0) {
          const empty = document.createElement('li');
          empty.className = 'transit__board-empty';
          empty.textContent = t('transit.games.boardEmpty');
          list.append(empty);
          return;
        }
        for (const row of board.rows) {
          const item = document.createElement('li');
          const alias = document.createElement('span');
          alias.textContent = row.alias; // texto de otras personas: nunca como HTML
          const points = document.createElement('strong');
          points.textContent = whole.format(row.points);
          item.append(alias, points);
          list.append(item);
        }
      }

      const onClick = (event) => {
        const tile = event.target.closest('.transit__tile');
        if (tile) onTile(Number(tile.dataset.tile));
        else if (event.target.closest('[data-game-start]')) newGame();
      };

      const onSubmit = async (event) => {
        event.preventDefault();
        if (form.hidden) return;
        ui.alias = aliasInput.value.trim().slice(0, ALIAS_MAX);
        persist();
        form.hidden = true; // una puntuación se guarda una sola vez
        const result = await submitScore(GAME_ID, ui.alias, game.points);
        if (!alive || !panel.contains(form)) return;
        savedLine.textContent = t(result.cloud ? 'transit.games.savedCloud' : 'transit.games.savedLocal');
        loadBoard();
      };

      panel.addEventListener('click', onClick);
      form.addEventListener('submit', onSubmit);
      status.textContent = t('transit.games.idle');
      paintHud();
      loadBoard();

      return () => {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        panel.removeEventListener('click', onClick);
        form.removeEventListener('submit', onSubmit);
      };
    }

    // ---------- Pestañas ----------

    const renderers = { trip: renderTrip, hazards: renderHazards, routine: renderRoutine, solo: renderSolo, games: renderGames };

    function rerender(focusSelector) {
      disposeTab?.();
      disposeTab = renderers[ui.tab](focusSelector) ?? null;
    }

    function showTab(tab) {
      ui.tab = tab;
      persist();
      for (const button of tabButtons) {
        const selected = button.dataset.tab === tab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      }
      panel.setAttribute('aria-labelledby', `transit-tab-${tab}`);
      rerender();
      el.scrollTop = 0;
    }

    function onTabClick(event) {
      const tab = event.target.closest('.transit__tab')?.dataset.tab;
      if (tab && tab !== ui.tab) showTab(tab);
    }

    function onTabKey(event) {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      const at = TABS.indexOf(ui.tab);
      let next;
      if (step) next = (at + step + TABS.length) % TABS.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = TABS.length - 1;
      else return;
      event.preventDefault();
      showTab(TABS[next]);
      tabButtons[next].focus();
    }

    const tablist = el.querySelector('.transit__tabs');
    tablist.addEventListener('click', onTabClick);
    tablist.addEventListener('keydown', onTabKey);
    showTab(ui.tab);

    return () => {
      alive = false;
      disposeTab?.();
      tablist.removeEventListener('click', onTabClick);
      tablist.removeEventListener('keydown', onTabKey);
    };
  },
};

export default mod;
