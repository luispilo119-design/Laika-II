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
import L from 'leaflet';
import { AREA_M, GRID, areaBBox, makeHeightField, toLatLon, toLocal, insideArea } from './terrain.js';
import { IMAGERY_REFERENCES } from './tiles.js';
import { createMarsMap } from '../../core/marsmap.js';
import { loadRovers, stopsOf, ROVER_IDS, ROVER_REFERENCES } from '../../core/rovers.js';
import { routeCenter, localPaths, localStops, nearestStop, pointAtDistance, elevationProfile } from './traverse.js';
import { formatHour } from '../../core/clock.js';

// Punto de ejemplo para cuando todavía no hay sitio de aterrizaje (el mismo que usa "routes").
const EXAMPLE_SITE = { lat: 1.0, lon: 3.0 };
const HUD_EVERY_MS = 400;
const MINIMAP_M = 2000; // lado del mini mapa, centrado en la persona
const EDGE_RELOAD_M = 1500; // a esta distancia del borde se ofrece cargar el terreno de más allá

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
  ...IMAGERY_REFERENCES,
  ...ROVER_REFERENCES,
];

const ROUTE_COLORS = { perseverance: '#ffd166', curiosity: '#5bd1c9' };
const ROUTE_REGION = { perseverance: 'Jezero', curiosity: 'Gale' };
const REPLAY_SPEEDS = [100, 400, 1600]; // m/s a lo largo del recorrido

/** Hora elegida en la vista previa (null = la del reloj de la misión). No se escribe en el store. */
const ui = { hour: null, place: null, stop: null, replaySpeed: 1 };

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
    const landing = hasSite ? { lat: mission.site.lat, lon: mission.site.lon, name: mission.site.name } : EXAMPLE_SITE;
    // Se puede explorar otra zona sin cambiar el sitio de aterrizaje de la misión.
    let site = ui.place ?? landing;
    const hour = () => ui.hour ?? clock.localHour;
    const coords = (lat, lon) =>
      `${num(Math.abs(lat), 3)}° ${t(lat >= 0 ? 'descent.card.n' : 'descent.card.s')}, ${num(Math.abs(lon), 3)}° ${t(
        lon >= 0 ? 'descent.card.e' : 'descent.card.w',
      )}`;
    const nextModule = modules.find((m) => m.id === 'hubs') ? 'hubs' : 'home';
    const prevModule = modules.find((m) => m.id === 'transit') ? 'transit' : 'home';

    const READOUTS = ['temperature', 'pressure', 'radiation', 'elevation', 'slope', 'dust', 'position', 'distance'];

    el.innerHTML = `
      <div class="descent">
        <canvas class="descent__canvas" aria-label="${t('descent.canvasLabel')}"></canvas>

        <div class="descent__top">
          <button type="button" class="btn" data-go="${prevModule}">${t('descent.prev', { name: t(`${prevModule}.title`) })}</button>
          <button type="button" class="btn" data-go="map">${t('descent.toMap')}</button>
          <button type="button" class="btn" data-ascend hidden>${t('descent.ascend')}</button>
          <button type="button" class="btn" data-place-open>${t('descent.place.open')}</button>
          <button type="button" class="btn" data-routes-open aria-expanded="false">${t('descent.routes.open')}</button>
          <button type="button" class="btn" data-go="${nextModule}">${t('descent.next', { name: t(`${nextModule}.title`) })}</button>
          ${env.isMock ? `<span class="badge badge--warn">${t('core.mockBadge')}</span>` : ''}
        </div>

        <aside class="descent__hud" aria-label="${t('descent.hud.title')}">
          <dl>
            ${READOUTS.map((id) => `<div><dt>${t(`descent.hud.${id}`)}</dt><dd data-read="${id}">—</dd></div>`).join('')}
          </dl>
          <p class="descent__note" data-modeled hidden>${t('descent.hud.modeled')}</p>
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
          <details class="descent__about">
            <summary>${t('descent.aboutTitle')}</summary>
            <p class="descent__note">${t('descent.decorNote', { km: num(AREA_M / 1000) })}</p>
            <p class="descent__note" data-imagery-note>${t('descent.imagery.loading')}</p>
          </details>
        </div>

        <div class="descent__aerial" hidden>
          <div class="descent__aerial-zoom">
            <button type="button" class="btn" data-zoom="in" aria-label="${t('descent.aerial.zoomIn')}">+</button>
            <button type="button" class="btn" data-zoom="out" aria-label="${t('descent.aerial.zoomOut')}">−</button>
          </div>
          <div class="descent__aerial-actions">
            <button type="button" class="btn btn--primary" data-descend-pin hidden>${t('descent.aerial.descendHere')}</button>
            <button type="button" class="btn" data-reload-here hidden>${t('descent.aerial.reloadHere')}</button>
          </div>
          <p class="descent__aerial-hint">${t('descent.aerial.hint')}</p>
        </div>

        <section class="descent__vehicle" hidden aria-label="${t('descent.rover.title')}">
          <h2>${t('descent.rover.title')}</h2>
          <div class="descent__gauge-row">
            <div class="descent__speed"><strong data-veh="speed">0</strong><span>km/h</span></div>
            <div class="descent__veh-bars">
              <p><span>${t('descent.rover.battery')}</span><b data-veh="battery"></b></p>
              <div class="glyph-bar glyph-bar--square" data-veh-bar="battery" style="--tone:#7fc98b;--value:1"></div>
              <p><span>${t('descent.rover.damage')}</span><b data-veh="damage"></b></p>
              <div class="glyph-bar glyph-bar--square" data-veh-bar="damage" style="--tone:#e2664f;--value:0"></div>
            </div>
          </div>
          <dl class="descent__veh-list">
            <div><dt>${t('descent.rover.odometer')}</dt><dd data-veh="odometer"></dd></div>
            <div><dt>${t('descent.rover.tilt')}</dt><dd data-veh="tilt"></dd></div>
            <div><dt>${t('descent.rover.grade')}</dt><dd data-veh="grade"></dd></div>
          </dl>
          <p class="descent__veh-warn" data-veh="warn" role="status"></p>
          <div class="descent__veh-actions">
            <button type="button" class="btn" data-repair hidden>${t('descent.rover.repair')}</button>
          </div>
          <p class="descent__note">${t('descent.rover.note')}</p>
        </section>

        <canvas class="descent__minimap" width="180" height="180" hidden aria-label="${t('descent.minimap')}"></canvas>

        <div class="descent__board">
          <button type="button" class="btn btn--primary" data-board hidden>${t('descent.rover.board')}</button>
          <button type="button" class="btn btn--primary" data-exit hidden>${t('descent.rover.exit')}</button>
        </div>

        <div class="descent__place" hidden role="dialog" aria-modal="true" aria-label="${t('descent.place.title')}">
          <div class="descent__place-box">
            <div class="descent__place-head">
              <h2>${t('descent.place.title')}</h2>
              <button type="button" class="btn" data-place-close>${t('descent.place.close')}</button>
            </div>
            <p class="descent__note">${t('descent.place.hint')}</p>
            <div class="descent__place-map"></div>
            <div class="descent__place-actions">
              <button type="button" class="btn" data-place-landing>${t('descent.place.landing')}</button>
            </div>
          </div>
        </div>

        <section class="descent__routes descent__panel" hidden aria-label="${t('descent.routes.title')}">
          <div class="descent__panel-head">
            <h2>${t('descent.routes.title')}</h2>
            <button type="button" class="btn" data-routes-close aria-label="${t('descent.close')}">×</button>
          </div>
          <div class="descent__routes-pick">
            ${ROVER_IDS.map(
              (id) => `<button type="button" class="btn" data-route-go="${id}" style="--route:${ROUTE_COLORS[id]}">
                <span class="descent__swatch"></span>${t('descent.routes.go', { name: id === 'perseverance' ? 'Perseverance' : 'Curiosity', region: ROUTE_REGION[id] })}</button>`,
            ).join('')}
          </div>
          <p class="descent__note" data-routes-status>${t('descent.routes.loading')}</p>
          <div class="descent__routes-body" hidden>
            <p class="descent__routes-stop" data-stop-label aria-live="polite"></p>
            <label class="descent__routes-slider">
              <span class="descent__sr">${t('descent.routes.slider')}</span>
              <input type="range" min="0" max="1" step="1" value="0" data-stop-slider />
            </label>
            <div class="descent__routes-row">
              <button type="button" class="btn" data-stop-step="-1" aria-label="${t('descent.routes.prev')}">◀</button>
              <button type="button" class="btn" data-replay>${t('descent.routes.play')}</button>
              <button type="button" class="btn" data-replay-speed aria-label="${t('descent.routes.speedLabel')}"></button>
              <button type="button" class="btn" data-stop-step="1" aria-label="${t('descent.routes.next')}">▶</button>
            </div>
            <div class="descent__routes-row">
              <button type="button" class="btn btn--primary" data-stop-photos>${t('descent.routes.photos')}</button>
              <button type="button" class="btn" data-stop-descend>${t('descent.aerial.descendHere')}</button>
            </div>
            <canvas class="descent__profile" width="340" height="96" aria-label="${t('descent.routes.profile')}"></canvas>
            <p class="descent__note">${t('descent.routes.note')}</p>
          </div>
        </section>

        <div class="descent__stick" hidden aria-hidden="true"><span class="descent__knob"></span></div>
        <p class="descent__hint" hidden>${t('descent.hint')}</p>
      </div>
    `;

    const root = el.querySelector('.descent');
    let canvas = el.querySelector('.descent__canvas');
    const intro = el.querySelector('.descent__intro');
    const status = el.querySelector('.descent__status');
    const descendBtn = el.querySelector('[data-descend]');
    const stick = el.querySelector('.descent__stick');
    const knob = el.querySelector('.descent__knob');
    const hint = el.querySelector('.descent__hint');
    const hourSlider = el.querySelector('[data-hour]');
    const read = (id) => el.querySelector(`[data-read="${id}"]`);
    const modeledNote = el.querySelector('[data-modeled]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const vehPanel = el.querySelector('.descent__vehicle');
    const veh = (id) => el.querySelector(`[data-veh="${id}"]`);
    const vehBar = (id) => el.querySelector(`[data-veh-bar="${id}"]`);
    const boardBtn = el.querySelector('[data-board]');
    const exitBtn = el.querySelector('[data-exit]');
    const repairBtn = el.querySelector('[data-repair]');
    const minimap = el.querySelector('.descent__minimap');
    const placeBox = el.querySelector('.descent__place');
    const aerialBox = el.querySelector('.descent__aerial');
    const descendPinBtn = el.querySelector('[data-descend-pin]');
    const reloadHereBtn = el.querySelector('[data-reload-here]');
    const imageryNote = el.querySelector('[data-imagery-note]');
    let placeMap = null;
    let pinPoint = null; // punto elegido tocando el suelo en la vista aérea
    /** Foto orbital ya cargada: { canvas, cover, layer } (también la usa el mini mapa). */
    let imagery = null;
    let imageryAbort = null;

    let alive = true;
    let scene = null;
    let field = null;
    let raf = 0;
    let last = 0;
    let lastHud = 0;
    let landed = false;

    // ---------- HUD: lo que mide el entorno donde está la persona ----------

    function paintHud() {
      const where = scene ? scene.state() : { x: 0, z: 0, mode: 'above' };
      const { lat, lon } = toLatLon(site, where.x, where.z);
      const sample = env.sample(lat, lon, { ...clock, localHour: hour() });
      // Los campos que salen de un modelo (no de una medición) llevan un asterisco y su nota.
      const modeled = sample.modeled ?? [];
      const mark = (field) => (modeled.includes(field) ? ' *' : '');
      read('temperature').textContent = t('descent.unit.celsius', { v: num(sample.temperatureC) }) + mark('temperatureC');
      read('pressure').textContent = t('descent.unit.pascal', { v: num(sample.pressurePa) }) + mark('pressurePa');
      read('radiation').textContent = t('descent.unit.msvDay', { v: num(sample.radiationMSvDay, 2) }) + mark('radiationMSvDay');
      read('elevation').textContent = t('descent.unit.meters', { v: num(field ? field.elevationAt(where.x, where.z) : sample.elevationM) });
      read('slope').textContent = t('descent.unit.degrees', { v: num(sample.slopeDeg, 1) });
      read('dust').textContent = t('descent.unit.tau', { v: num(sample.dustOpacity, 2) }) + mark('dustOpacity');
      modeledNote.hidden = modeled.length === 0;
      read('position').textContent = coords(lat, lon);
      const meters = Math.hypot(where.x, where.z);
      read('distance').textContent =
        meters < 1000 ? t('descent.unit.meters', { v: num(meters) }) : t('descent.unit.km', { v: num(meters / 1000, 2) });
      paintVehicle(where);
      drawMinimap();
      read('hour').textContent = formatHour(hour());
      return sample;
    }

    function paintVehicle(where) {
      const mode = where.mode;
      const driving = mode === 'driving';
      vehPanel.hidden = !driving;
      boardBtn.hidden = !(mode === 'ground' && where.canBoard);
      exitBtn.hidden = !driving;
      minimap.hidden = !(mode === 'ground' || driving);
      if (landed) hint.hidden = mode !== 'ground';
      const aerial = mode === 'aerial';
      aerialBox.hidden = !aerial || !scene;
      descendPinBtn.hidden = !(aerial && pinPoint);
      const nearEdge = !insideArea(where.x, where.z, EDGE_RELOAD_M);
      reloadHereBtn.hidden = !(nearEdge && (aerial || mode === 'ground'));
      if (!where.vehicle) return;
      const v = where.vehicle;
      veh('speed').textContent = num(Math.abs(v.speed) * 3.6);
      veh('battery').textContent = `${num(v.battery * 100)} %`;
      veh('damage').textContent = `${num(v.damage * 100)} %`;
      vehBar('battery').style.setProperty('--value', v.battery.toFixed(3));
      vehBar('battery').style.setProperty('--tone', v.battery < 0.15 ? '#e2664f' : v.battery < 0.4 ? '#e8b04a' : '#7fc98b');
      vehBar('damage').style.setProperty('--value', v.damage.toFixed(3));
      veh('odometer').textContent = t('descent.unit.km', { v: num(v.odometer / 1000, 2) });
      veh('tilt').textContent = t('descent.unit.degrees', { v: num(v.tilt, 1) });
      veh('grade').textContent = `${num(v.grade * 100)} %`;
      veh('warn').textContent = v.warn ? t(`descent.rover.warn.${v.warn}`) : '';
      veh('warn').dataset.level = v.warn ?? '';
      repairBtn.hidden = v.damage <= 0;
    }

    /** Mini mapa de 2 km centrado en la persona: foto orbital, recorrido, vehículo y posición. */
    function drawMinimap() {
      if (!scene || minimap.hidden) return;
      const g = minimap.getContext('2d');
      const W = minimap.width;
      const k = W / MINIMAP_M;
      const data = scene.mapData();
      const where = scene.state();
      const P = (x, z) => [W / 2 + (x - where.x) * k, W / 2 + (z - where.z) * k];
      g.clearRect(0, 0, W, W);
      g.fillStyle = 'rgba(20, 12, 10, 0.78)';
      g.fillRect(0, 0, W, W);
      if (imagery) {
        // Parte de la foto orbital que cae en el mini mapa (la foto va de norte a sur y de oeste a este).
        const { canvas: img, cover } = imagery;
        const nw = toLatLon(site, where.x - MINIMAP_M / 2, where.z - MINIMAP_M / 2);
        const se = toLatLon(site, where.x + MINIMAP_M / 2, where.z + MINIMAP_M / 2);
        const sx = ((nw.lon - cover.west) / (cover.east - cover.west)) * img.width;
        const sy = ((cover.north - nw.lat) / (cover.north - cover.south)) * img.height;
        const sw = ((se.lon - nw.lon) / (cover.east - cover.west)) * img.width;
        const sh = ((nw.lat - se.lat) / (cover.north - cover.south)) * img.height;
        g.globalAlpha = 0.85;
        g.drawImage(img, sx, sy, sw, sh, 0, 0, W, W);
        g.globalAlpha = 1;
      }
      g.strokeStyle = '#e8b04a';
      g.lineWidth = 1.5;
      g.beginPath();
      data.track.forEach(([x, z], i) => {
        const [px, py] = P(x, z);
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.stroke();
      const [vx, vy] = P(data.vehicle.x, data.vehicle.z);
      g.fillStyle = '#7fc98b';
      g.fillRect(vx - 3, vy - 3, 6, 6);
      const a = (where.headingDeg * Math.PI) / 180;
      g.fillStyle = '#e2664f';
      g.beginPath();
      g.moveTo(W / 2 + Math.sin(a) * 7, W / 2 - Math.cos(a) * 7);
      g.lineTo(W / 2 + Math.sin(a + 2.5) * 5, W / 2 - Math.cos(a + 2.5) * 5);
      g.lineTo(W / 2 + Math.sin(a - 2.5) * 5, W / 2 - Math.cos(a - 2.5) * 5);
      g.closePath();
      g.fill();
    }

    // ---------- Rutas reales de los rovers ----------

    const routesBox = el.querySelector('.descent__routes');
    const routesBody = el.querySelector('.descent__routes-body');
    const routesStatus = el.querySelector('[data-routes-status]');
    const routesOpenBtn = el.querySelector('[data-routes-open]');
    const stopLabel = el.querySelector('[data-stop-label]');
    const stopSlider = el.querySelector('[data-stop-slider]');
    const replayBtn = el.querySelector('[data-replay]');
    const replaySpeedBtn = el.querySelector('[data-replay-speed]');
    const profileCanvas = el.querySelector('.descent__profile');
    /** active = rover cuyo recorrido está en el terreno cargado; stops con x, z locales. */
    const routes = { data: null, active: null, stops: [], index: 0, replay: null };
    const roverName = (id) => (id === 'perseverance' ? 'Perseverance' : 'Curiosity');

    function setRoutesOpen(open) {
      routesBox.hidden = !open;
      routesOpenBtn.setAttribute('aria-expanded', String(open));
      if (!open) return;
      intro.hidden = true;
      const mode = scene?.state().mode;
      if (mode === 'ground' || mode === 'driving') ascendNow();
    }

    async function loadRoutes() {
      try {
        routes.data = await loadRovers();
        if (alive) showRoutesInArea();
      } catch {
        if (alive) routesStatus.textContent = t('descent.routes.failed');
      }
    }

    /** Dibuja los recorridos que pasan por el terreno cargado y elige el rover activo. */
    function showRoutesInArea() {
      if (!scene || !routes.data) return;
      const list = [];
      routes.active = null;
      routes.stops = [];
      for (const id of ROVER_IDS) {
        const rover = routes.data.rovers[id];
        if (!rover) continue;
        const paths = localPaths(rover, site);
        if (!paths.some((path) => path.some(([x, z]) => insideArea(x, z, 0)))) continue;
        const stops = localStops(stopsOf(rover), site);
        list.push({ paths, stops: stops.map((stop) => [stop.x, stop.z]), color: ROUTE_COLORS[id] });
        if (!routes.active || site.rover === id) {
          routes.active = id;
          routes.stops = stops;
        }
      }
      scene.setRoutes(list);
      paintRoutes();
      if (!routes.active) return;
      const remembered = ui.stop?.rover === routes.active ? ui.stop.index : routes.stops.length - 1;
      selectStop(Math.min(remembered, routes.stops.length - 1), { fly: false, pin: site.rover === routes.active });
    }

    function paintRoutes() {
      const has = Boolean(routes.active);
      routesBody.hidden = !has;
      let status = t('descent.routes.none');
      if (!routes.data) status = t('descent.routes.loading');
      else if (has) status = t('descent.routes.inArea', { name: roverName(routes.active) });
      routesStatus.textContent = status;
      for (const btn of el.querySelectorAll('[data-route-go]')) btn.setAttribute('aria-pressed', String(btn.dataset.routeGo === routes.active));
      if (has) stopSlider.max = String(routes.stops.length - 1);
      replaySpeedBtn.textContent = `×${REPLAY_SPEEDS[ui.replaySpeed] / REPLAY_SPEEDS[0]}`;
      replayBtn.textContent = routes.replay ? t('descent.routes.pause') : t('descent.routes.play');
    }

    function selectStop(index, { fly = true, pin = true } = {}) {
      const stop = routes.stops[index];
      if (!stop || !scene) return;
      routes.index = index;
      ui.stop = { rover: routes.active, index };
      stopSlider.value = String(index);
      stopLabel.textContent =
        t('descent.routes.stop', { sol: num(stop.sol), km: num(stop.distM / 1000, 2), i: num(index + 1), n: num(routes.stops.length) }) +
        (stop.elevM === null ? '' : ` · ${t('descent.routes.elev', { m: num(stop.elevM) })}`);
      if (pin) {
        pinPoint = { x: stop.x, z: stop.z };
        scene.setPin(pinPoint);
      }
      if (fly) scene.flyTo(stop.x, stop.z, Math.min(scene.state().aerialDist, 2500));
      drawProfile();
      lastHud = 0;
    }

    /** Perfil de elevación medido por el rover, con la parada elegida marcada. */
    function drawProfile() {
      const g = profileCanvas.getContext('2d');
      const W = profileCanvas.width;
      const H = profileCanvas.height;
      g.clearRect(0, 0, W, H);
      const pts = elevationProfile(routes.stops);
      if (pts.length < 2) return;
      const maxKm = pts[pts.length - 1][0] || 1;
      let lo = Infinity;
      let hi = -Infinity;
      for (const [, e] of pts) {
        lo = Math.min(lo, e);
        hi = Math.max(hi, e);
      }
      const left = 4;
      const X = (km) => left + (km / maxKm) * (W - left - 4);
      const Y = (e) => 16 + (1 - (e - lo) / (hi - lo || 1)) * (H - 34);
      g.fillStyle = 'rgba(207, 138, 99, 0.22)';
      g.beginPath();
      g.moveTo(X(0), H - 18);
      for (const [k, e] of pts) g.lineTo(X(k), Y(e));
      g.lineTo(X(maxKm), H - 18);
      g.closePath();
      g.fill();
      g.strokeStyle = ROUTE_COLORS[routes.active];
      g.lineWidth = 1.5;
      g.beginPath();
      pts.forEach(([k, e], i) => (i ? g.lineTo(X(k), Y(e)) : g.moveTo(X(k), Y(e))));
      g.stroke();
      const stop = routes.stops[routes.index];
      if (stop) {
        g.strokeStyle = '#fffff3';
        g.beginPath();
        g.moveTo(X(stop.distM / 1000), 12);
        g.lineTo(X(stop.distM / 1000), H - 18);
        g.stroke();
      }
      g.fillStyle = '#cbb8a6';
      g.font = '11px ui-monospace, monospace';
      g.fillText(t('descent.unit.meters', { v: num(hi) }), left, 11);
      g.fillText(t('descent.unit.meters', { v: num(lo) }), left, H - 4);
      const kmText = t('descent.unit.km', { v: num(maxKm, 1) });
      g.fillText(kmText, W - 4 - g.measureText(kmText).width, H - 4);
    }

    function startReplay() {
      if (!routes.active || !scene) return;
      const lastStop = routes.stops[routes.stops.length - 1];
      const from = routes.stops[routes.index];
      routes.replay = { distM: from && from.distM < lastStop.distM ? from.distM : 0 };
      paintRoutes();
    }
    function stopReplay() {
      routes.replay = null;
      paintRoutes();
    }
    /** Avanza la repetición: el marcador sigue el recorrido real y la vista aérea lo acompaña. */
    function stepReplay(dt) {
      if (scene.state().mode !== 'aerial') {
        stopReplay();
        return;
      }
      const r = routes.replay;
      r.distM += REPLAY_SPEEDS[ui.replaySpeed] * dt;
      const p = pointAtDistance(routes.stops, r.distM);
      pinPoint = { x: p.x, z: p.z };
      scene.setPin(pinPoint);
      scene.flyTo(p.x, p.z, scene.state().aerialDist);
      if (p.index !== routes.index) selectStop(p.index, { fly: false, pin: false });
      if (r.distM >= routes.stops[routes.stops.length - 1].distM) stopReplay();
    }

    function goToRoute(id) {
      if (!routes.data) return;
      if (routes.active === id && site.rover === id) {
        selectStop(routes.index);
        return;
      }
      const center = routeCenter(routes.data.rovers[id]);
      ui.stop = null;
      reloadAt({ lat: center.lat, lon: center.lon, name: `${ROUTE_REGION[id]} · ${roverName(id)}`, rover: id });
      intro.hidden = true; // reloadAt la vuelve a mostrar; aquí el panel de rutas ya explica dónde se está
    }

    function applyEnvironment() {
      const sample = paintHud();
      scene?.setEnvironment({ hour: hour(), tau: sample.dustOpacity });
    }

    // ---------- Entradas: teclado, arrastre para mirar y palanca táctil ----------

    const keys = new Set();
    const look = { x: 0, y: 0 };
    const pad = { x: 0, y: 0, pointer: null };
    const gestures = { zoom: 1, tilt: 0, rotate: 0 };
    const pointers = new Map(); // dedos o ratón sobre el lienzo: id → { x, y, sx, sy, t0, button }
    let pair = null; // dos dedos: { dist, angle, midY }
    const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    const ZOOM_KEYS = { Equal: 0.8, NumpadAdd: 0.8, Minus: 1.25, NumpadSubtract: 1.25 };

    function toggleVehicle() {
      if (!scene) return;
      const st = scene.state();
      if (st.mode === 'driving') scene.exitVehicle();
      else if (st.canBoard) scene.board();
      lastHud = 0;
    }

    function onKeyDown(event) {
      if (event.target.closest?.('input, textarea, select')) return;
      if (event.code === 'KeyE') {
        if (!event.repeat) toggleVehicle();
        return;
      }
      if (ZOOM_KEYS[event.code] && scene?.state().mode === 'aerial') {
        gestures.zoom *= ZOOM_KEYS[event.code];
        return;
      }
      if (!MOVE_KEYS.has(event.code)) return;
      if (event.code.startsWith('Arrow')) event.preventDefault(); // que las flechas no desplacen la página
      keys.add(event.code);
    }
    const onKeyUp = (event) => keys.delete(event.code);
    const onBlur = () => keys.clear();

    function pairState() {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 };
    }

    /** Al empezar a explorar la vista aérea, la tarjeta de inicio deja libre la pantalla. */
    function exploring() {
      if (scene && !intro.hidden && scene.state().mode === 'aerial') intro.hidden = true;
    }

    function onLookDown(event) {
      exploring();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, sx: event.clientX, sy: event.clientY, t0: performance.now(), button: event.button });
      canvas.setPointerCapture(event.pointerId);
      pair = pointers.size === 2 ? pairState() : null;
    }
    function onLookMove(event) {
      const p = pointers.get(event.pointerId);
      if (!p) return;
      const dx = event.clientX - p.x;
      const dy = event.clientY - p.y;
      p.x = event.clientX;
      p.y = event.clientY;
      if (pointers.size === 1) {
        // Con el botón derecho (o Mayús) en la vista aérea: girar e inclinar en lugar de desplazar.
        if ((p.button === 2 || event.shiftKey) && scene?.state().mode === 'aerial') {
          gestures.rotate += dx * 0.005;
          gestures.tilt += dy * 0.004;
        } else {
          look.x += dx;
          look.y += dy;
        }
      } else if (pointers.size === 2 && pair) {
        const now = pairState();
        gestures.zoom *= pair.dist / now.dist;
        gestures.tilt += (now.midY - pair.midY) * 0.004;
        let turn = now.angle - pair.angle;
        if (turn > Math.PI) turn -= 2 * Math.PI;
        if (turn < -Math.PI) turn += 2 * Math.PI;
        gestures.rotate -= turn;
        pair = now;
      }
    }
    function onLookUp(event) {
      const p = pointers.get(event.pointerId);
      if (!p) return;
      const tap = pointers.size === 1 && Math.hypot(p.x - p.sx, p.y - p.sy) < 8 && performance.now() - p.t0 < 500;
      pointers.delete(event.pointerId);
      pair = pointers.size === 2 ? pairState() : null;
      if (tap && event.type === 'pointerup' && p.button !== 2) onTap(event.clientX, event.clientY);
    }
    function onWheel(event) {
      if (scene?.state().mode !== 'aerial') return;
      event.preventDefault();
      exploring();
      gestures.zoom *= Math.exp(Math.max(-200, Math.min(200, event.deltaY)) * 0.0015);
    }
    const onContextMenu = (event) => event.preventDefault();

    /** Tocar el suelo en la vista aérea marca un punto al que se puede bajar. */
    function onTap(clientX, clientY) {
      if (!scene || scene.state().mode !== 'aerial') return;
      const box = canvas.getBoundingClientRect();
      const hit = scene.pick(((clientX - box.left) / box.width) * 2 - 1, -(((clientY - box.top) / box.height) * 2 - 1));
      pinPoint = hit ? { x: hit.x, z: hit.z } : null;
      scene.setPin(pinPoint);
      onPick?.(pinPoint);
      lastHud = 0;
    }
    /** Lo que pasa además al tocar un punto (lo usa el panel de rutas para elegir paradas). */
    let onPick = null;

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
        zoom: gestures.zoom,
        tilt: gestures.tilt,
        rotate: gestures.rotate,
        forward: Math.max(-1, Math.min(1, key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - pad.y)),
        strafe: Math.max(-1, Math.min(1, key('KeyD') - key('KeyA') + pad.x)),
        turn: key('ArrowRight') - key('ArrowLeft'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        lookX: look.x,
        lookY: look.y,
      };
      look.x = 0;
      look.y = 0;
      gestures.zoom = 1;
      gestures.tilt = 0;
      gestures.rotate = 0;
      return input;
    }

    // ---------- Bucle ----------

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.update(dt, readInput());
      if (routes.replay) stepReplay(dt);
      scene.render();
      if (!landed && scene.state().mode === 'ground') {
        landed = true;
        stick.hidden = false;
        hint.hidden = false;
        root.classList.add('is-landed');
        el.querySelector('[data-ascend]').hidden = false;
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
        intro.querySelector('.descent__site').textContent = `${site.name ? `${site.name} · ` : ''}${coords(site.lat, site.lon)}`;
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
          site,
          equipment: site === landing,
          seed: Math.round((site.lat + 90) * 100) * 40000 + Math.round((site.lon + 180) * 100),
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
        return;
      }
      loadGroundImagery();
      loadRoutes();
    }

    /** Foto orbital del terreno. Va aparte del try de load(): si falla, la escena sigue con sus colores. */
    async function loadGroundImagery() {
      imageryAbort?.abort();
      const controller = new AbortController();
      imageryAbort = controller;
      imagery = null;
      imageryNote.textContent = t('descent.imagery.loading');
      try {
        const { loadImagery } = await import('./imagery.js');
        const result = await loadImagery(areaBBox(site), { signal: controller.signal });
        if (!alive || controller.signal.aborted || !scene) return;
        scene.setImagery(result.canvas, result.cover);
        imagery = result;
        const key = result.layer.controlled ? 'descent.imagery.controlled' : 'descent.imagery.uncontrolled';
        imageryNote.textContent = t(key, { name: t(`descent.imagery.layer.${result.layer.id}`) });
      } catch {
        if (!alive || controller.signal.aborted) return;
        imageryNote.textContent = t('descent.imagery.failed');
      }
    }

    // ---------- Eventos de la interfaz ----------

    async function reloadAt(place) {
      ui.place = place;
      site = place ?? landing;
      imageryAbort?.abort();
      imagery = null;
      pinPoint = null;
      routes.replay = null;
      routes.active = null;
      routes.stops = [];
      paintRoutes();
      cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver.disconnect();
      scene?.dispose();
      scene = null;
      field = null;
      landed = false;
      root.classList.remove('is-landed');
      stick.hidden = true;
      hint.hidden = true;
      el.querySelector('[data-ascend]').hidden = true;
      // El contexto WebGL anterior quedó liberado: se usa un canvas nuevo.
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
      bindCanvas();
      intro.hidden = false;
      descendBtn.disabled = true;
      descendBtn.hidden = false;
      status.textContent = t('descent.loading');
      paintHud();
      await load();
    }

    function openPlace() {
      placeBox.hidden = false;
      if (!placeMap) {
        placeMap = createMarsMap(el.querySelector('.descent__place-map'), { basemap: 'mola', center: [site.lat, site.lon], zoom: 3 });
        const star = L.divIcon({ className: 'descent__place-star', html: '<span>★</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
        L.marker([landing.lat, landing.lon], { icon: star, interactive: false }).addTo(placeMap.map);
        for (const h of store.get().mission.hubs ?? []) {
          L.circleMarker([h.lat, h.lon], { radius: 6, color: '#161412', weight: 2, fillColor: '#eab422', fillOpacity: 1 })
            .bindTooltip(t(`hubs.type.${h.type}.name`))
            .on('click', () => {
              placeBox.hidden = true;
              reloadAt({ lat: h.lat, lon: h.lon, name: t(`hubs.type.${h.type}.name`) });
            })
            .addTo(placeMap.map);
        }
        placeMap.map.on('click', (e) => {
          placeBox.hidden = true;
          reloadAt({ lat: Math.max(-85, Math.min(85, e.latlng.lat)), lon: e.latlng.lng });
        });
      }
      setTimeout(() => placeMap.map.invalidateSize(), 50);
    }

    function onClick(event) {
      const go = event.target.closest('[data-go]')?.dataset.go;
      if (go) return navigate(go);
      if (event.target.closest('[data-place-open]')) return openPlace();
      if (event.target.closest('[data-place-close]')) {
        placeBox.hidden = true;
        return undefined;
      }
      const zoom = event.target.closest('[data-zoom]')?.dataset.zoom;
      if (zoom) {
        gestures.zoom *= zoom === 'in' ? 0.6 : 1.6;
        return undefined;
      }
      if (event.target.closest('[data-descend-pin]') && scene && pinPoint) {
        stopReplay();
        scene.descendTo(pinPoint.x, pinPoint.z, reducedMotion.matches);
        pinPoint = null;
        intro.hidden = true;
        routesBox.hidden = true;
        canvas.focus({ preventScroll: true });
        return undefined;
      }
      if (event.target.closest('[data-reload-here]') && scene) {
        const where = scene.state();
        const here = toLatLon(site, where.x, where.z);
        return reloadAt({ lat: here.lat, lon: here.lon });
      }
      if (event.target.closest('[data-place-landing]')) {
        placeBox.hidden = true;
        return reloadAt(null);
      }
      if (event.target.closest('[data-board]') || event.target.closest('[data-exit]')) {
        toggleVehicle();
        canvas.focus({ preventScroll: true });
        return undefined;
      }
      if (event.target.closest('[data-repair]') && scene) {
        scene.repair();
        lastHud = 0;
        return undefined;
      }
      if (event.target.closest('[data-ascend]') && scene) {
        ascendNow();
        intro.hidden = false;
        return undefined;
      }
      if (event.target.closest('[data-descend]') && scene) {
        scene.startDescent(reducedMotion.matches);
        intro.hidden = true;
        routesBox.hidden = true;
        canvas.focus({ preventScroll: true });
        return undefined;
      }
      // Rutas de los rovers
      if (event.target.closest('[data-routes-open]')) {
        setRoutesOpen(routesBox.hidden);
        return undefined;
      }
      if (event.target.closest('[data-routes-close]')) {
        setRoutesOpen(false);
        return undefined;
      }
      const routeGo = event.target.closest('[data-route-go]')?.dataset.routeGo;
      if (routeGo) {
        goToRoute(routeGo);
        return undefined;
      }
      const stepBy = event.target.closest('[data-stop-step]')?.dataset.stopStep;
      if (stepBy && routes.active) {
        stopReplay();
        selectStop(Math.max(0, Math.min(routes.stops.length - 1, routes.index + Number(stepBy))));
        return undefined;
      }
      if (event.target.closest('[data-replay]')) {
        if (routes.replay) stopReplay();
        else startReplay();
        return undefined;
      }
      if (event.target.closest('[data-replay-speed]')) {
        ui.replaySpeed = (ui.replaySpeed + 1) % REPLAY_SPEEDS.length;
        paintRoutes();
        return undefined;
      }
      if (event.target.closest('[data-stop-descend]') && scene && routes.active) {
        stopReplay();
        const stop = routes.stops[routes.index];
        routesBox.hidden = true;
        scene.descendTo(stop.x, stop.z, reducedMotion.matches);
        canvas.focus({ preventScroll: true });
        return undefined;
      }
      if (event.target.closest('[data-stop-photos]') && routes.active) {
        openPhotos(routes.active, routes.index);
        return undefined;
      }
      return undefined;
    }

    /** Vuelve a la vista aérea desde el suelo o el vehículo. */
    function ascendNow() {
      if (!scene) return;
      scene.ascend();
      landed = false;
      stick.hidden = true;
      hint.hidden = true;
      root.classList.remove('is-landed');
      el.querySelector('[data-ascend]').hidden = true;
      lastHud = 0;
    }

    function onStopSlider() {
      stopReplay();
      selectStop(Number(stopSlider.value));
    }

    onPick = (point) => {
      if (!point || !routes.active || !scene) return;
      const index = nearestStop(routes.stops, point.x, point.z, Math.max(25, scene.state().aerialDist * 0.025));
      if (index < 0) return;
      stopReplay();
      selectStop(index, { fly: false });
      setRoutesOpen(true);
    };

    /** Panel de fotos de una parada (se completa en la sección de fotos). */
    function openPhotos() {}

    function onHour() {
      ui.hour = Number(hourSlider.value);
      applyEnvironment();
    }

    el.addEventListener('click', onClick);
    hourSlider.addEventListener('input', onHour);
    stopSlider.addEventListener('input', onStopSlider);
    function bindCanvas() {
      canvas.addEventListener('pointerdown', onLookDown);
      canvas.addEventListener('pointermove', onLookMove);
      canvas.addEventListener('pointerup', onLookUp);
      canvas.addEventListener('pointercancel', onLookUp);
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('contextmenu', onContextMenu);
      canvas.tabIndex = 0;
    }
    bindCanvas();
    stick.addEventListener('pointerdown', onPadDown);
    stick.addEventListener('pointermove', onPadMove);
    stick.addEventListener('pointerup', onPadUp);
    stick.addEventListener('pointercancel', onPadUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', syncLoop);

    paintHud();
    load();

    return () => {
      alive = false;
      imageryAbort?.abort();
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      el.removeEventListener('click', onClick);
      hourSlider.removeEventListener('input', onHour);
      stopSlider.removeEventListener('input', onStopSlider);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', syncLoop);
      scene?.dispose(); // libera el contexto WebGL
      scene = null;
      placeMap?.destroy();
    };
  },
};

export default mod;
