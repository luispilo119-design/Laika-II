/**
 * Módulo "hohmann": planear el viaje desde la Tierra (Fase 1). Dueño: Parte A — tarea A1.
 *
 * Escribe en el store: mission.departure, mission.arrival, mission.arrivalLs y clock.ls.
 * El cálculo vive en orbit.js (funciones puras, probadas en tests/orbit.test.js);
 * este archivo solo dibuja y maneja la interacción.
 */
import './hohmann.css';
import { createHohmann3D } from './scene3d.js';
import { renderEquations } from './equations.js';
import messages from './i18n.js';
import {
  addDays,
  distanceAu,
  findWindows,
  hohmannIdeal,
  isDustSeason,
  lightMinutes,
  northernSeason,
  periodDays,
  planetPosition,
  transferPosition,
  wrap180,
  AU_KM,
  ELEMENTS,
} from './orbit.js';

const DAY_MS = 86400000;
const MIN_DATE = '1960-01-01';
const MAX_DATE = '2047-12-31';
const BURN_DAYS = 6; // tramo de la línea de tiempo que se muestra como "impulso" o "llegada"
const TAIL_DAYS = 25; // días que se siguen mostrando después de llegar
const PLAY_SECONDS = 22; // duración de la animación completa
const VIEW_RADIUS_AU = 1.8;
const SEARCH_BACK_DAYS = 800; // las ventanas se buscan desde esta cantidad de días antes de la fecha elegida
const EARTH_COLOR = '#6fb1e8';
const SUN_COLOR = '#f4c95d';

/** Lo que la persona eligió; sobrevive a los remontajes por cambio de idioma. */
const ui = { fromISO: null, selectedISO: null };

const isoDay = (date) => date.toISOString().slice(0, 10);
const sameMoment = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < DAY_MS;

function windowsFrom(from) {
  const all = findWindows(addDays(from, -SEARCH_BACK_DAYS), 6).filter((w) => w.arrival.getUTCFullYear() < 2050);
  let lastPast = -1;
  all.forEach((w, i) => {
    if (w.departure < from) lastPast = i;
  });
  return all.slice(Math.max(0, lastPast), Math.max(0, lastPast) + 5).map((w) => ({ ...w, past: w.departure < from }));
}

function orbitPath(planet, start) {
  const period = periodDays(ELEMENTS[planet].a[0]);
  const points = [];
  for (let i = 0; i <= 144; i++) points.push(planetPosition(planet, addDays(start, (period * i) / 144)));
  return points;
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'hohmann',
  phase: 1,
  owner: 'A',
  task: 'A1',
  messages,
  references: [
    {
      id: 'jpl-approx-pos',
      title: 'Approximate Positions of the Planets',
      org: 'NASA/JPL Solar System Dynamics',
      url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
      verified: true,
    },
    {
      id: 'mars24-algorithm',
      title: 'Mars24 Sunclock — Algorithm and Worked Examples',
      org: 'NASA GISS',
      url: 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html',
      year: 2025,
      verified: true,
    },
    {
      id: 'mars24-notes',
      title: 'Mars24 Sunclock — Technical Notes on Mars Solar Time',
      org: 'NASA GISS',
      url: 'https://www.giss.nasa.gov/tools/mars24/help/notes.html',
      year: 2023,
      verified: true,
    },
    {
      id: 'nasa-dust-storms',
      title: 'Mars Atmospheric Temperature and Dust Storm Tracking',
      org: 'NASA Science',
      url: 'https://science.nasa.gov/resource/mars-atmospheric-temperature-and-dust-storm-tracking/',
      year: 2016,
      verified: true,
    },
    {
      id: 'mars2020',
      title: 'Mars 2020: Perseverance Rover',
      org: 'NASA Science',
      url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
      verified: true,
    },
    {
      id: 'jpl-astro-par',
      title: 'Astrodynamic Parameters',
      org: 'NASA/JPL Solar System Dynamics',
      url: 'https://ssd.jpl.nasa.gov/astro_par.html',
      verified: true,
    },
    {
      id: 'jpl-phys-par',
      title: 'Planetary Physical Parameters',
      org: 'NASA/JPL Solar System Dynamics',
      url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html',
      verified: true,
    },
  ],

  mount(el, ctx) {
    const { t, store, navigate } = ctx;
    const lang = store.get().lang;
    const dateFormat = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const fmtDate = (date) => dateFormat.format(date);
    const num = (value, digits = 0) =>
      value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const ideal = hohmannIdeal();

    el.innerHTML = `
      <div class="hohmann">
        <section class="hohmann__stage">
          <div class="hohmann__canvas-wrap"><canvas></canvas><p class="hohmann__drag">${t('hohmann.drag')}</p></div>
          <div class="hohmann__transport">
            <button type="button" class="btn btn--primary" data-play></button>
            <input type="range" min="0" max="1000" value="0" aria-label="${t('hohmann.timeline')}" />
          </div>
          <dl class="hohmann__stats">
            <div><dt>${t('hohmann.stat.date')}</dt><dd data-stat="date"></dd></div>
            <div><dt>${t('hohmann.stat.phase')}</dt><dd data-stat="phase"></dd></div>
            <div><dt data-stat="tripLabel"></dt><dd data-stat="trip"></dd></div>
            <div><dt data-stat="distLabel"></dt><dd data-stat="dist"></dd></div>
          </dl>
        </section>

        <section class="hohmann__panel">
          <h1>${t('hohmann.title')}</h1>
          <p class="hohmann__intro">${t('hohmann.intro')}</p>

          <div class="hohmann__planbar" data-planbar></div>

          <h2 class="hohmann__h"><span class="hohmann__num">1</span>${t('hohmann.windows')}</h2>
          <label class="hohmann__from">
            <span>${t('hohmann.planFrom')}</span>
            <input type="date" min="${MIN_DATE}" max="${MAX_DATE}" />
          </label>
          <div class="hohmann__windows"></div>
          <button type="button" class="btn hohmann__math-open" aria-haspopup="dialog" data-math-open>
            <span class="hohmann__math-mark" aria-hidden="true">ƒ(x)</span>${t('hohmann.math.open')}
          </button>

          <h2 class="hohmann__h"><span class="hohmann__num">2</span>${t('hohmann.watch')}</h2>
          <div class="hohmann__steps" role="group">
            ${[1, 2, 3, 4]
              .map(
                (n) =>
                  `<button type="button" class="btn" data-step="${n}"><span class="hohmann__step-n">${n}</span>${t(`hohmann.phase.${n}.name`)}</button>`,
              )
              .join('')}
          </div>
          <div class="hohmann__phase" aria-live="polite">
            <h2 data-phase="name"></h2>
            <p data-phase="text"></p>
            <p class="hohmann__live" data-phase="live"></p>
          </div>

          <div class="hohmann__summary"></div>

          <details class="hohmann__how">
            <summary>${t('hohmann.how.title')}</summary>
            <p>${t('hohmann.how.p1')}</p>
            <p>${t('hohmann.how.p2')}</p>
            <p>${t('hohmann.how.p3', {
              days: num(ideal.transferDays),
              dv1: num(ideal.dvDepartureKmS, 2),
              dv2: num(ideal.dvArrivalKmS, 2),
            })}</p>
            <p data-how="p4"></p>
          </details>
        </section>
        <dialog class="hohmann__math" aria-labelledby="hohmann-math-title"></dialog>
      </div>
    `;

    const $ = (selector) => el.querySelector(selector);
    const canvas = $('canvas');
    const g = canvas.getContext('2d');
    const slider = $('.hohmann__transport input');
    const playBtn = $('[data-play]');
    const dateInput = $('.hohmann__from input');
    const windowsBox = $('.hohmann__windows');
    const summaryBox = $('.hohmann__summary');
    const planBar = $('[data-planbar]');
    const mathBtn = $('[data-math-open]');
    const mathDialog = $('.hohmann__math');
    const stat =(name) => $(`[data-stat="${name}"]`);
    const phaseEl = (name) => $(`[data-phase="${name}"]`);

    const css = getComputedStyle(document.documentElement);
    const color = {
      mars: css.getPropertyValue('--rust-300').trim() || '#cf8a63',
      cream: css.getPropertyValue('--cream').trim() || '#fffff3',
      dim: css.getPropertyValue('--text-dim').trim() || '#b99f8c',
      line: css.getPropertyValue('--line').trim() || '#3a231c',
    };

    // Vista 3D; si el navegador no tiene WebGL se queda el dibujo 2D en el canvas.
    const three = createHohmann3D($('.hohmann__canvas-wrap'), {
      earth: EARTH_COLOR,
      mars: '#e0734a',
      ship: '#fffff3',
      sun: SUN_COLOR,
      labels: {
        sun: t('hohmann.label.sun'),
        earth: t('hohmann.label.earth'),
        mars: t('hohmann.label.mars'),
        ship: t('hohmann.label.ship'),
        departure: t('hohmann.label.departure'),
        arrival: t('hohmann.label.arrival'),
        angle: '',
      },
    });
    if (three) canvas.hidden = true;
    else $('.hohmann__drag').hidden = true;

    // Comparación con una misión real, para la nota de exactitud.
    const [window2020] = findWindows(new Date(Date.UTC(2020, 0, 1)), 1);
    $('[data-how="p4"]').textContent = t('hohmann.how.p4', {
      model: fmtDate(window2020.departure),
      real: fmtDate(new Date(Date.UTC(2020, 6, 30))),
    });

    /** Estado de la pantalla */
    let windows = [];
    let plan = null;
    let paths = null;
    let t0 = 0;
    let t1 = 1;
    let time = 0;
    let playing = false;
    let raf = 0;
    let lastFrame = 0;
    let shownPhase = 0;
    let size = { w: 0, h: 0 };

    const depMs = () => plan.departure.getTime();
    const arrMs = () => plan.arrival.getTime();

    function phaseAt(ms) {
      if (ms < depMs()) return 1;
      if (ms < depMs() + BURN_DAYS * DAY_MS) return 2;
      if (ms < arrMs() - BURN_DAYS * DAY_MS) return 3;
      return 4;
    }

    function phaseStart(n) {
      return [t0, depMs(), depMs() + BURN_DAYS * DAY_MS, arrMs()][n - 1];
    }

    /* ---------- Dibujo ---------- */

    function draw() {
      if (three && plan) {
        const now = new Date(time);
        const phase = phaseAt(time);
        const earthNow = planetPosition('earth', now);
        const marsNow = planetPosition('mars', now);
        const fraction = (time - depMs()) / (arrMs() - depMs());
        const flying = fraction >= 0 && fraction < 1;
        three.update({
          plan,
          phase,
          earth: earthNow,
          mars: marsNow,
          fraction,
          ship: flying ? transferPosition(plan, fraction) : null,
          shipAhead: flying ? transferPosition(plan, Math.min(1, fraction + 0.01)) : null,
          angleDeg: phase === 1 ? wrap180(marsNow.lon - earthNow.lon) : null,
        });
        return;
      }
      const { w, h } = size;
      if (!w || !plan) return;
      const dpr = window.devicePixelRatio || 1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) / 2 / VIEW_RADIUS_AU;
      const P = (p) => [cx + p.x * scale, cy - p.y * scale];
      const now = new Date(time);
      const phase = phaseAt(time);
      const earth = planetPosition('earth', now);
      const mars = planetPosition('mars', now);
      const fraction = (time - depMs()) / (arrMs() - depMs());

      const strokePath = (points, style, width, dash = []) => {
        g.beginPath();
        points.forEach((p, i) => {
          const [x, y] = P(p);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.strokeStyle = style;
        g.lineWidth = width;
        g.setLineDash(dash);
        g.stroke();
        g.setLineDash([]);
      };
      const dot = (p, radius, fill) => {
        const [x, y] = P(p);
        g.beginPath();
        g.arc(x, y, radius, 0, Math.PI * 2);
        g.fillStyle = fill;
        g.fill();
      };
      const ring = (p, radius, style, width = 1.5) => {
        const [x, y] = P(p);
        g.beginPath();
        g.arc(x, y, radius, 0, Math.PI * 2);
        g.strokeStyle = style;
        g.lineWidth = width;
        g.stroke();
      };
      const label = (p, text, fill, dx = 10, dy = -10) => {
        const [x, y] = P(p);
        g.font = '12px system-ui, sans-serif';
        g.fillStyle = fill;
        g.textAlign = x + dx + 60 > w ? 'right' : 'left';
        g.fillText(text, g.textAlign === 'right' ? x - dx : x + dx, y + dy);
      };

      // Órbitas
      g.globalAlpha = 0.55;
      strokePath(paths.earth, EARTH_COLOR, 1.5);
      strokePath(paths.mars, color.mars, 1.5);
      g.globalAlpha = 1;

      // Elipse de transferencia: punteada completa, sólida hasta donde va la nave
      g.globalAlpha = phase === 1 ? 0.45 : 0.8;
      strokePath(paths.transfer, color.cream, 1.2, [5, 5]);
      g.globalAlpha = 1;
      if (fraction > 0) {
        const upTo = Math.max(1, Math.round(Math.min(1, fraction) * (paths.transfer.length - 1)));
        strokePath(paths.transfer.slice(0, upTo + 1), color.cream, 2.4);
      }

      // Fase 1: ángulo entre la Tierra y Marte vistos desde el Sol
      if (phase === 1) {
        const angle = wrap180(mars.lon - earth.lon);
        g.globalAlpha = 0.7;
        strokePath([{ x: 0, y: 0 }, earth], EARTH_COLOR, 1);
        strokePath([{ x: 0, y: 0 }, mars], color.mars, 1);
        g.globalAlpha = 1;
        const r = 0.42 * scale;
        const a0 = (-earth.lon * Math.PI) / 180;
        const a1 = (-(earth.lon + angle) * Math.PI) / 180;
        g.beginPath();
        g.arc(cx, cy, r, a0, a1, angle > 0);
        g.strokeStyle = color.cream;
        g.lineWidth = 1.5;
        g.stroke();
        const mid = ((earth.lon + angle / 2) * Math.PI) / 180;
        g.font = '600 13px system-ui, sans-serif';
        g.fillStyle = color.cream;
        g.textAlign = 'center';
        g.fillText(`${Math.round(angle)}°`, cx + Math.cos(mid) * (r + 18), cy - Math.sin(mid) * (r + 18) + 4);
      }

      // Puntos de salida y de llegada
      ring(plan.earthAtDeparture, phase === 2 ? 11 : 7, EARTH_COLOR, phase === 2 ? 2.5 : 1.5);
      ring(plan.marsAtArrival, phase === 4 ? 11 : 7, color.mars, phase === 4 ? 2.5 : 1.5);
      label(plan.earthAtDeparture, t('hohmann.label.departure'), color.dim, 12, 16);
      label(plan.marsAtArrival, t('hohmann.label.arrival'), color.dim, 12, 16);

      // Sol y planetas
      dot({ x: 0, y: 0 }, 9, SUN_COLOR);
      label({ x: 0, y: 0 }, t('hohmann.label.sun'), color.dim, 12, 4);
      dot(earth, 6, EARTH_COLOR);
      label(earth, t('hohmann.label.earth'), EARTH_COLOR);
      dot(mars, 5, color.mars);
      label(mars, t('hohmann.label.mars'), color.mars);

      // Nave
      if (fraction >= 0 && fraction < 1) {
        const ship = transferPosition(plan, fraction);
        dot(ship, 4, color.cream);
        ring(ship, 8, color.cream, 1);
        label(ship, t('hohmann.label.ship'), color.cream, 12, -12);
      }
    }

    /* ---------- Textos que cambian con el tiempo ---------- */

    function renderPhaseCard(phase) {
      shownPhase = phase;
      phaseEl('name').textContent = `${phase} · ${t(`hohmann.phase.${phase}.name`)}`;
      phaseEl('text').textContent = t(`hohmann.phase.${phase}.text`, {
        synodic: num(ideal.synodicDays),
        phase: num(ideal.phaseAngleDeg),
        dvLeo: num(plan.dvFromLeoKmS, 2),
        dv1: num(plan.dvDepartureKmS, 2),
        days: num(plan.transferDays),
        dv2: num(Math.abs(plan.dvArrivalKmS), 2),
      });
      for (const btn of el.querySelectorAll('[data-step]')) {
        const active = Number(btn.dataset.step) === phase;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      }
    }

    function renderDynamic() {
      if (!plan) return;
      const now = new Date(time);
      const phase = phaseAt(time);
      if (phase !== shownPhase) renderPhaseCard(phase);
      slider.value = String(Math.round(((time - t0) / (t1 - t0)) * 1000));

      const earth = planetPosition('earth', now);
      const mars = planetPosition('mars', now);
      const totalDays = Math.round(plan.transferDays);
      const tripDay = Math.min(totalDays, Math.max(0, Math.round((time - depMs()) / DAY_MS)));
      const inFlight = time >= depMs() && time < arrMs();
      const target = inFlight ? transferPosition(plan, (time - depMs()) / (arrMs() - depMs())) : mars;
      const au = distanceAu(target, inFlight ? { x: earth.x, y: earth.y } : earth);
      const minutes = lightMinutes(au);

      stat('date').textContent = fmtDate(now);
      stat('phase').textContent = t(`hohmann.phase.${phase}.name`);
      if (time < depMs()) {
        stat('tripLabel').textContent = t('hohmann.stat.countdown');
        stat('trip').textContent = t('hohmann.stat.days', { n: num(Math.ceil((depMs() - time) / DAY_MS)) });
      } else if (time < arrMs()) {
        stat('tripLabel').textContent = t('hohmann.stat.tripDay');
        stat('trip').textContent = t('hohmann.stat.dayOf', { n: num(tripDay), total: num(totalDays) });
      } else {
        stat('tripLabel').textContent = t('hohmann.stat.tripDay');
        stat('trip').textContent = t('hohmann.stat.arrived');
      }
      stat('distLabel').textContent = t(inFlight ? 'hohmann.stat.shipDistance' : 'hohmann.stat.marsDistance');
      stat('dist').textContent = t('hohmann.stat.distance', {
        mkm: num((au * AU_KM) / 1e6),
        min: num(minutes, 1),
      });

      const live = {
        1: () => ({ angle: num(wrap180(mars.lon - earth.lon)) }),
        2: () => ({ date: fmtDate(plan.departure) }),
        3: () => ({ n: num(tripDay), total: num(totalDays), min: num(minutes, 1) }),
        4: () => ({
          date: fmtDate(plan.arrival),
          ls: num(plan.arrivalLs),
          season: t(`hohmann.season.${northernSeason(plan.arrivalLs)}`),
        }),
      }[phase]();
      phaseEl('live').textContent = t(`hohmann.phase.${phase}.live`, live);

      draw();
    }

    /* ---------- Ventanas y resumen ---------- */

    function renderWindows() {
      windowsBox.replaceChildren();
      mathBtn.disabled = !plan;
      if (windows.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'hohmann__empty';
        empty.textContent = t('hohmann.noWindows');
        windowsBox.append(empty);
        return;
      }
      const firstFuture = windows.find((w) => !w.past);
      for (const w of windows) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hohmann__window';
        const selected = plan && sameMoment(w.departure, plan.departure);
        btn.classList.toggle('is-active', Boolean(selected));
        btn.setAttribute('aria-pressed', String(Boolean(selected)));
        const tag = w.past ? t('hohmann.windowPast') : w === firstFuture ? t('hohmann.windowNext') : '';
        btn.innerHTML = `
          <span class="hohmann__window-date">${fmtDate(w.departure)}</span>
          ${tag ? `<span class="badge${w.past ? '' : ' badge--warn'}">${tag}</span>` : ''}
          <span class="hohmann__window-sub">${t('hohmann.windowTrip', { days: num(w.transferDays) })} · ${t(
            'hohmann.windowArrive',
            { date: fmtDate(w.arrival) },
          )}</span>
        `;
        btn.addEventListener('click', () => selectWindow(w));
        windowsBox.append(btn);
      }
    }

    function renderSummary() {
      if (!plan) {
        summaryBox.replaceChildren();
        planBar.replaceChildren();
        return;
      }
      const mission = store.get().mission;
      const saved = mission.departure && sameMoment(mission.departure, plan.departure);
      const dusty = isDustSeason(plan.arrivalLs);
      const row = (key, value) => `<div><dt>${t(`hohmann.summary.${key}`)}</dt><dd>${value}</dd></div>`;
      summaryBox.innerHTML = `
        <h2 class="hohmann__h">${t('hohmann.summary.title')}${
          saved ? ` <span class="badge hohmann__saved">${t('hohmann.saved')}</span>` : ''
        }</h2>
        <dl>
          ${row('departure', fmtDate(plan.departure))}
          ${row('arrival', fmtDate(plan.arrival))}
          ${row('trip', t('hohmann.summary.tripValue', { days: num(plan.transferDays) }))}
          ${row('dv', t('hohmann.summary.dvValue', { dv: num(plan.dvFromLeoKmS, 2) }))}
          ${row(
            'season',
            t('hohmann.summary.seasonValue', {
              ls: num(plan.arrivalLs),
              season: t(`hohmann.season.${northernSeason(plan.arrivalLs)}`),
            }),
          )}
        </dl>
        <p class="hohmann__dust${dusty ? ' is-warn' : ''}">${t(dusty ? 'hohmann.summary.dustYes' : 'hohmann.summary.dustNo')}</p>
      `;
      planBar.innerHTML = `
        <div class="hohmann__planbar-info">
          <span class="kicker">${saved ? t('hohmann.saved') : t('hohmann.selected')}</span>
          <strong>${fmtDate(plan.departure)} → ${fmtDate(plan.arrival)}</strong>
          <span>${t('hohmann.summary.tripValue', { days: num(plan.transferDays) })} · Ls ${num(plan.arrivalLs)}°</span>
        </div>
        <button type="button" class="btn btn--primary hohmann__use">${t(saved ? 'hohmann.goMap' : 'hohmann.use')}</button>
      `;
      planBar.querySelector('.hohmann__use').addEventListener('click', () => {
        store.set('mission.departure', plan.departure.toISOString());
        store.set('mission.arrival', plan.arrival.toISOString());
        store.set('mission.arrivalLs', plan.arrivalLs);
        store.set('clock.ls', plan.arrivalLs);
        navigate('map');
      });
    }

    function selectWindow(w) {
      setPlaying(false);
      plan = w;
      ui.selectedISO = w.departure.toISOString();
      const from = new Date(`${ui.fromISO}T00:00:00Z`);
      const waitDays = Math.min(200, Math.max(60, (w.departure.getTime() - from.getTime()) / DAY_MS));
      t0 = depMs() - waitDays * DAY_MS;
      t1 = arrMs() + TAIL_DAYS * DAY_MS;
      time = t0;
      paths = {
        earth: orbitPath('earth', plan.departure),
        mars: orbitPath('mars', plan.departure),
        transfer: Array.from({ length: 65 }, (_, i) => transferPosition(plan, i / 64)),
      };
      three?.setPaths(paths);
      shownPhase = 0;
      renderWindows();
      renderSummary();
      renderDynamic();
    }

    function setFrom(iso) {
      ui.fromISO = iso;
      dateInput.value = iso;
      windows = windowsFrom(new Date(`${iso}T00:00:00Z`));
      const wanted =
        (ui.selectedISO && windows.find((w) => sameMoment(w.departure, ui.selectedISO))) ||
        windows.find((w) => !w.past) ||
        windows[0];
      if (wanted) selectWindow(wanted);
      else {
        plan = null;
        renderWindows();
        renderSummary();
      }
    }

    /* ---------- Reproducción ---------- */

    function setPlaying(value) {
      playing = value;
      playBtn.textContent = t(playing ? 'hohmann.pause' : 'hohmann.play');
      cancelAnimationFrame(raf);
      if (playing) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    function tick(nowMs) {
      if (!playing) return;
      const dt = Math.min(0.1, (nowMs - lastFrame) / 1000);
      lastFrame = nowMs;
      time += ((t1 - t0) * dt) / PLAY_SECONDS;
      if (time >= t1) {
        time = t1;
        renderDynamic();
        setPlaying(false);
        return;
      }
      renderDynamic();
      raf = requestAnimationFrame(tick);
    }

    playBtn.addEventListener('click', () => {
      if (!plan) return;
      if (!playing && time >= t1) time = t0;
      setPlaying(!playing);
    });
    slider.addEventListener('input', () => {
      if (!plan) return;
      setPlaying(false);
      time = t0 + (Number(slider.value) / 1000) * (t1 - t0);
      renderDynamic();
    });
    for (const btn of el.querySelectorAll('[data-step]')) {
      btn.addEventListener('click', () => {
        if (!plan) return;
        setPlaying(false);
        time = phaseStart(Number(btn.dataset.step));
        renderDynamic();
      });
    }
    /* ---------- Diálogo de ecuaciones ---------- */

    function closeMath() {
      if (mathDialog.open) mathDialog.close();
    }

    mathBtn.addEventListener('click', () => {
      if (!plan) return;
      setPlaying(false);
      mathDialog.innerHTML = renderEquations({ t, lang, num, fmtDate, plan, searchBackDays: SEARCH_BACK_DAYS });
      if (typeof mathDialog.showModal === 'function') mathDialog.showModal();
      else mathDialog.setAttribute('open', '');
      mathDialog.querySelector('.hohmann__math-body').scrollTop = 0;
      mathDialog.querySelector('[data-math-close]').focus();
    });
    mathDialog.addEventListener('click', (event) => {
      // Cerrar con el botón o tocando fuera de la caja (el fondo cuenta como el propio <dialog>).
      if (event.target === mathDialog || event.target.closest('[data-math-close]')) closeMath();
    });
    mathDialog.addEventListener('close', () => mathBtn.focus());

    dateInput.addEventListener('change', () => {
      const iso = dateInput.value;
      if (!iso || iso < MIN_DATE || iso > MAX_DATE) {
        dateInput.value = ui.fromISO;
        return;
      }
      ui.selectedISO = null;
      setFrom(iso);
    });

    const resizeObserver = new ResizeObserver(() => {
      const box = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { w: box.width, h: box.height };
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      draw();
    });
    resizeObserver.observe(canvas.parentElement);

    /* ---------- Arranque ---------- */

    setPlaying(false);
    if (!ui.fromISO) {
      const saved = store.get().mission.departure;
      if (saved) {
        ui.selectedISO = saved;
        ui.fromISO = isoDay(addDays(new Date(saved), -1));
      } else {
        ui.fromISO = isoDay(new Date());
      }
    }
    setFrom(ui.fromISO);

    return () => {
      closeMath();
      cancelAnimationFrame(raf);
      playing = false;
      resizeObserver.disconnect();
      three?.dispose();
    };
  },
};

export default mod;
