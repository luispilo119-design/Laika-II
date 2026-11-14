/**
 * Módulo "descent": la Fase 3, bajar al sitio y recorrerlo en primera persona.
 * Dueño: Parte B — tarea B5 (docs/PARTE-B.md).
 *
 * El terreno sale de `env.elevationGrid` alrededor de `mission.site`; el HUD muestra lo que da
 * `env.sample` en el punto donde está la persona. La escena (scene.js, con Three.js) se carga
 * bajo demanda. Si el dispositivo no tiene WebGL, queda una vista fija con los datos del sitio.
 */
import './descent.css';
import messages from './i18n.js';
import { AREA_M, GRID, areaBBox, makeHeightField, toLatLon } from './terrain.js';

// Punto de ejemplo para cuando todavía no hay sitio de aterrizaje (el mismo que usa "routes").
const EXAMPLE_SITE = { lat: 1.0, lon: 3.0 };
const HUD_EVERY_MS = 400;

/** @type {import('../../core/types.js').Reference[]} */
const REFERENCES = [
  {
    // Radio medio volumétrico de Marte: 3389.5 km (para pasar metros a grados).
    id: 'nssdca-mars-fact',
    title: 'Mars Fact Sheet',
    org: 'NASA GSFC · NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    verified: true,
  },
];

/** Hora elegida en la vista previa (null = la del reloj de la misión). No se escribe en el store. */
const ui = { hour: null };

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'descent',
  phase: 3,
  owner: 'B',
  task: 'B5',
  fullscreen: true,
  messages,
  references: REFERENCES,
  mount(el, ctx) {
    const { t, store, env, navigate, modules } = ctx;
    const { lang, mission, clock } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const num = (value, digits = 0) =>
      new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

    const hasSite = Boolean(mission.site && Number.isFinite(mission.site.lat) && Number.isFinite(mission.site.lon));
    const site = hasSite ? { lat: mission.site.lat, lon: mission.site.lon, name: mission.site.name } : EXAMPLE_SITE;
    const hour = () => ui.hour ?? clock.localHour;
    const coords = (lat, lon) =>
      `${num(Math.abs(lat), 3)}° ${t(lat >= 0 ? 'descent.card.n' : 'descent.card.s')}, ${num(Math.abs(lon), 3)}° ${t(
        lon >= 0 ? 'descent.card.e' : 'descent.card.w',
      )}`;
    const clockText = (h) => {
      const minutes = Math.round(h * 60) % (24 * 60);
      return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    };
    const nextModule = modules.find((m) => m.id === 'hubs') ? 'hubs' : 'home';

    const READOUTS = ['temperature', 'pressure', 'radiation', 'elevation', 'slope', 'dust', 'position'];

    el.innerHTML = `
      <div class="descent">
        <canvas class="descent__canvas" aria-label="${t('descent.canvasLabel')}"></canvas>

        <div class="descent__top">
          <button type="button" class="btn" data-go="home">${t('descent.back')}</button>
          <button type="button" class="btn" data-go="${nextModule}">${t('descent.next', { name: t(`${nextModule}.title`) })}</button>
          ${env.isMock ? `<span class="badge badge--warn">${t('core.mockBadge')}</span>` : ''}
        </div>

        <aside class="descent__hud" aria-label="${t('descent.hud.title')}">
          <dl>
            ${READOUTS.map((id) => `<div><dt>${t(`descent.hud.${id}`)}</dt><dd data-read="${id}">—</dd></div>`).join('')}
          </dl>
          <label class="descent__hour">
            <span>${t('descent.hud.hour')} <output data-read="hour"></output></span>
            <input type="range" min="0" max="24" step="0.5" value="${hour()}" data-hour />
          </label>
          <p class="descent__note">${t('descent.hud.hourNote')}</p>
        </aside>

        <div class="descent__intro">
          <h1>${t('descent.title')}</h1>
          <p class="descent__site">${site.name ? `${site.name} · ` : ''}${coords(site.lat, site.lon)}</p>
          ${
            hasSite
              ? ''
              : `<p class="descent__notice">${t('descent.noSite')}
                   <button type="button" class="btn" data-go="map">${t('descent.goMap')}</button></p>`
          }
          <p class="descent__status" role="status">${t('descent.loading')}</p>
          <button type="button" class="btn btn--primary" data-descend disabled>${t('descent.descend')}</button>
          <p class="descent__note">${t('descent.decorNote', { km: num(AREA_M / 1000) })}</p>
        </div>

        <div class="descent__stick" hidden aria-hidden="true"><span class="descent__knob"></span></div>
        <p class="descent__hint" hidden>${t('descent.hint')}</p>
      </div>
    `;

    const root = el.querySelector('.descent');
    const canvas = el.querySelector('.descent__canvas');
    const intro = el.querySelector('.descent__intro');
    const status = el.querySelector('.descent__status');
    const descendBtn = el.querySelector('[data-descend]');
    const stick = el.querySelector('.descent__stick');
    const knob = el.querySelector('.descent__knob');
    const hint = el.querySelector('.descent__hint');
    const hourSlider = el.querySelector('[data-hour]');
    const read = (id) => el.querySelector(`[data-read="${id}"]`);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let alive = true;
    let scene = null;
    let field = null;
    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let landed = false;

    // ---------- HUD: lo que mide el entorno donde está la persona ----------

    function paintHud() {
      const where = scene ? scene.state() : { x: 0, z: 0 };
      const { lat, lon } = toLatLon(site, where.x, where.z);
      const sample = env.sample(lat, lon, { ...clock, localHour: hour() });
      read('temperature').textContent = t('descent.unit.celsius', { v: num(sample.temperatureC) });
      read('pressure').textContent = t('descent.unit.pascal', { v: num(sample.pressurePa) });
      read('radiation').textContent = t('descent.unit.msvDay', { v: num(sample.radiationMSvDay, 2) });
      read('elevation').textContent = t('descent.unit.meters', { v: num(field ? field.elevationAt(where.x, where.z) : sample.elevationM) });
      read('slope').textContent = t('descent.unit.degrees', { v: num(sample.slopeDeg, 1) });
      read('dust').textContent = t('descent.unit.tau', { v: num(sample.dustOpacity, 2) });
      read('position').textContent = coords(lat, lon);
      read('hour').textContent = clockText(hour());
      return sample;
    }

    function applyEnvironment() {
      const sample = paintHud();
      scene?.setEnvironment({ hour: hour(), tau: sample.dustOpacity });
    }

    // ---------- Entradas: teclado, arrastre para mirar y palanca táctil ----------

    const keys = new Set();
    const look = { x: 0, y: 0, pointer: null, lastX: 0, lastY: 0 };
    const pad = { x: 0, y: 0, pointer: null };
    const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

    function onKeyDown(event) {
      if (!MOVE_KEYS.has(event.code) || event.target.closest?.('input, textarea, select')) return;
      if (event.code.startsWith('Arrow')) event.preventDefault(); // que las flechas no desplacen la página
      keys.add(event.code);
    }
    const onKeyUp = (event) => keys.delete(event.code);
    const onBlur = () => keys.clear();

    function onLookDown(event) {
      if (look.pointer !== null) return;
      look.pointer = event.pointerId;
      look.lastX = event.clientX;
      look.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }
    function onLookMove(event) {
      if (event.pointerId !== look.pointer) return;
      look.x += event.clientX - look.lastX;
      look.y += event.clientY - look.lastY;
      look.lastX = event.clientX;
      look.lastY = event.clientY;
    }
    function onLookUp(event) {
      if (event.pointerId === look.pointer) look.pointer = null;
    }

    function movePad(event) {
      const box = stick.getBoundingClientRect();
      const radius = box.width / 2;
      let dx = (event.clientX - (box.left + radius)) / radius;
      let dy = (event.clientY - (box.top + radius)) / radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      pad.x = dx;
      pad.y = dy;
      knob.style.transform = `translate(${dx * radius * 0.55}px, ${dy * radius * 0.55}px)`;
    }
    function onPadDown(event) {
      if (pad.pointer !== null) return;
      pad.pointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      movePad(event);
    }
    function onPadMove(event) {
      if (event.pointerId === pad.pointer) movePad(event);
    }
    function onPadUp(event) {
      if (event.pointerId !== pad.pointer) return;
      pad.pointer = null;
      pad.x = 0;
      pad.y = 0;
      knob.style.transform = '';
    }

    function readInput() {
      const key = (code) => (keys.has(code) ? 1 : 0);
      const input = {
        forward: Math.max(-1, Math.min(1, key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - pad.y)),
        strafe: Math.max(-1, Math.min(1, key('KeyD') - key('KeyA') + pad.x)),
        turn: key('ArrowRight') - key('ArrowLeft'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        lookX: look.x,
        lookY: look.y,
      };
      look.x = 0;
      look.y = 0;
      return input;
    }

    // ---------- Bucle ----------

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.update(dt, readInput());
      scene.render();
      if (!landed && scene.state().mode === 'ground') {
        landed = true;
        stick.hidden = false;
        hint.hidden = false;
        root.classList.add('is-landed');
      }
      if (now - lastHud > HUD_EVERY_MS) {
        lastHud = now;
        paintHud();
      }
    }

    function syncLoop() {
      if (!scene || !alive) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    const resizeObserver = new ResizeObserver(() => scene?.resize(root.clientWidth, root.clientHeight));

    // ---------- Carga del terreno y de la escena ----------

    async function load() {
      try {
        await env.ready();
        const elevation = await env.elevationGrid(areaBBox(site), GRID);
        if (!alive) return;
        field = makeHeightField(elevation);
        paintHud();
        const { createScene } = await import('./scene.js');
        if (!alive) return;
        const css = getComputedStyle(el);
        const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
        scene = createScene({
          canvas,
          field,
          // Colores aproximados, tomados de la paleta de la app; no son una medición del color real.
          palette: {
            groundDark: color('--rust-700', '#96483a'),
            groundMid: color('--rust-500', '#a5583b'),
            groundLight: color('--rust-300', '#cf8a63'),
            rock: color('--line', '#3a231c'),
            sky: color('--rust-300', '#cf8a63'),
            dust: color('--rust-500', '#a5583b'),
            night: color('--bg-sunken', '#0d0706'),
            sun: color('--cream', '#fffff3'),
          },
        });
        scene.resize(root.clientWidth, root.clientHeight);
        applyEnvironment();
        scene.update(0, readInput());
        scene.render();
        resizeObserver.observe(root);
        status.textContent = t('descent.ready');
        descendBtn.disabled = false;
        syncLoop();
      } catch {
        if (!alive) return;
        // Sin WebGL o sin datos: vista fija con los datos del sitio (línea de corte de B5).
        scene = null;
        root.classList.add('is-fallback');
        status.textContent = t('descent.fallback');
        descendBtn.hidden = true;
        paintHud();
      }
    }

    // ---------- Eventos de la interfaz ----------

    function onClick(event) {
      const go = event.target.closest('[data-go]')?.dataset.go;
      if (go) return navigate(go);
      if (event.target.closest('[data-descend]') && scene) {
        scene.startDescent(reducedMotion.matches);
        intro.hidden = true;
        canvas.focus({ preventScroll: true });
      }
      return undefined;
    }

    function onHour() {
      ui.hour = Number(hourSlider.value);
      applyEnvironment();
    }

    el.addEventListener('click', onClick);
    hourSlider.addEventListener('input', onHour);
    canvas.addEventListener('pointerdown', onLookDown);
    canvas.addEventListener('pointermove', onLookMove);
    canvas.addEventListener('pointerup', onLookUp);
    canvas.addEventListener('pointercancel', onLookUp);
    stick.addEventListener('pointerdown', onPadDown);
    stick.addEventListener('pointermove', onPadMove);
    stick.addEventListener('pointerup', onPadUp);
    stick.addEventListener('pointercancel', onPadUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', syncLoop);

    canvas.tabIndex = 0;
    paintHud();
    load();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      el.removeEventListener('click', onClick);
      hourSlider.removeEventListener('input', onHour);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', syncLoop);
      scene?.dispose(); // libera el contexto WebGL
      scene = null;
    };
  },
};

export default mod;
