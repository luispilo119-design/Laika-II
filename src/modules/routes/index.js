/**
 * Módulo "routes": rutas de conducción entre dos puntos. Dueño: Parte B — tarea B4.
 *
 * La persona marca origen y destino sobre el mapa y elige un vehículo; la ruta se busca con A*
 * sobre una rejilla de costo hecha con `env.elevationGrid` (pendiente) y `env.craters`
 * (cráteres que el vehículo evita). El cálculo está en routing.js; los vehículos, en profiles.js.
 */
import L from 'leaflet';
import './routes.css';
import messages from './i18n.js';
import { createMarsMap } from '../../core/marsmap.js';
import { PROFILES, PROFILE_IDS, REFERENCES, refOf } from './profiles.js';
import {
  MARS_RADIUS_KM,
  SLOPE_SLOWDOWN,
  CRATER_BLOCK_FACTOR,
  CRATER_RING_FACTOR,
  CRATER_RING_PENALTY,
  distanceKm,
  routeBBox,
  expandBBox,
  planRoute,
} from './routing.js';

const SAVE_KEY = 'laika2.routes.v1';
const GRID_SIZE = 96; // celdas por lado de la rejilla de costo
const KM_PER_DEG = (Math.PI * MARS_RADIUS_KM) / 180;
const CRATER_MARGIN_DEG = 2; // se piden cráteres hasta ~118 km fuera del recuadro de trabajo

// Puntos de ejemplo para cuando todavía no hay sitio de aterrizaje ni hubs. No son un lugar
// con nombre: solo sirven para que la pantalla muestre una ruta desde el primer momento.
const EXAMPLE_ORIGIN = [1.0, 3.0];
const EXAMPLE_OFFSET = [0.7, 3.6]; // destino de ejemplo = origen + este desplazamiento (grados)

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const round4 = (v) => Math.round(v * 1e4) / 1e4;

function readSaved() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(SAVE_KEY) ?? 'null') ?? {};
  } catch {
    return {};
  }
}

/**
 * Lo que la persona eligió aquí. `origin` / `destination` en null = usar el valor por defecto
 * (sitio de aterrizaje y primer hub). Vive fuera del DOM porque el shell vuelve a montar el
 * módulo al cambiar de idioma; la ruta guardada sí va al store, en `mission.routes`.
 */
const saved = readSaved();
const ui = {
  origin: isPoint(saved.origin) ? saved.origin : null,
  destination: isPoint(saved.destination) ? saved.destination : null,
  profile: PROFILE_IDS.includes(saved.profile) ? saved.profile : PROFILE_IDS[0],
  pick: 'destination',
};

function persist() {
  try {
    const { origin, destination, profile } = ui;
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify({ origin, destination, profile }));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Contorno de un cráter como polígono [lat, lon] (L.circle mediría con el radio de la Tierra). */
function craterOutline(crater, factor = 1) {
  const radiusKm = (crater.diameterKm / 2) * factor;
  const dLat = radiusKm / KM_PER_DEG;
  const dLon = radiusKm / (KM_PER_DEG * Math.max(0.05, Math.cos((crater.lat * Math.PI) / 180)));
  const ring = [];
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * 2 * Math.PI;
    ring.push([crater.lat + dLat * Math.cos(a), crater.lon + dLon * Math.sin(a)]);
  }
  return ring;
}

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'routes',
  phase: 4,
  owner: 'B',
  task: 'B4',
  messages,
  references: REFERENCES,
  mount(el, ctx) {
    const { t, store, env, navigate } = ctx;
    const { lang, mission } = store.get();
    const locale = lang === 'es' ? 'es-MX' : 'en-US';
    const num = (value, digits = 0) =>
      new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

    const site = mission.site && Number.isFinite(mission.site.lat) ? [mission.site.lat, mission.site.lon] : null;
    const hub = mission.hubs?.[0] && Number.isFinite(mission.hubs[0].lat) ? [mission.hubs[0].lat, mission.hubs[0].lon] : null;
    const defaultOrigin = site ?? EXAMPLE_ORIGIN;
    const defaultDestination = hub ?? [
      clamp(defaultOrigin[0] + EXAMPLE_OFFSET[0], -85, 85),
      clamp(defaultOrigin[1] + EXAMPLE_OFFSET[1], -179, 179),
    ];
    const origin = () => ui.origin ?? defaultOrigin;
    const destination = () => ui.destination ?? defaultDestination;

    let alive = true;
    let runId = 0;
    let current = null; // última ruta calculada con éxito

    const coords = ([lat, lon]) =>
      `${num(Math.abs(lat), 2)}° ${t(lat >= 0 ? 'routes.card.n' : 'routes.card.s')}, ${num(Math.abs(lon), 2)}° ${t(
        lon >= 0 ? 'routes.card.e' : 'routes.card.w',
      )}`;
    const duration = (hours) => {
      const minutes = Math.round(hours * 60);
      return t('routes.duration', { h: num(Math.floor(minutes / 60)), min: minutes % 60 });
    };
    const sourceLink = (id) => {
      const ref = refOf(id);
      return `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.org)} — ${esc(ref.title)}</a>`;
    };

    const notices = [
      env.isMock ? `<p class="routes__notice">${t('routes.notice.mock')}</p>` : '',
      site
        ? ''
        : `<p class="routes__notice">${t('routes.notice.noSite')}
             <button type="button" class="btn" data-go="map">${t('routes.notice.goMap')}</button></p>`,
      hub
        ? ''
        : `<p class="routes__notice">${t('routes.notice.noHub')}
             <button type="button" class="btn" data-go="hubs">${t('routes.notice.goHubs')}</button></p>`,
    ].join('');

    const pointRow = (which, letter) => `
      <div class="routes__point" data-point="${which}">
        <button type="button" class="routes__pick" data-pick="${which}">
          <span class="routes__letter" aria-hidden="true">${letter}</span>
          <span>${t(`routes.points.${which}`)}</span>
        </button>
        <label>${t('routes.points.lat')}
          <input type="number" inputmode="decimal" step="0.01" min="-85" max="85" data-coord="${which}:0" />
        </label>
        <label>${t('routes.points.lon')}
          <input type="number" inputmode="decimal" step="0.01" min="-180" max="180" data-coord="${which}:1" />
        </label>
      </div>`;

    el.innerHTML = `
      <div class="routes">
        <div class="routes__map" role="application" aria-label="${t('routes.mapLabel')}"></div>
        <div class="routes__side">
          <header>
            <h1>${t('routes.title')}</h1>
            <p class="routes__lead">${t('routes.desc')}</p>
          </header>
          ${notices}

          <section>
            <h2>${t('routes.points.title')}</h2>
            <p class="routes__hint">${t('routes.points.hint')}</p>
            ${pointRow('origin', 'A')}
            ${pointRow('destination', 'B')}
            <button type="button" class="btn" data-points-reset>${t('routes.points.reset')}</button>
          </section>

          <section>
            <h2>${t('routes.vehicle.title')}</h2>
            <div class="routes__profiles" role="group" aria-label="${t('routes.vehicle.title')}">
              ${PROFILE_IDS.map((id) => {
                const p = PROFILES[id];
                return `
                <button type="button" class="routes__profile" data-profile="${id}">
                  <strong>${t(`routes.profile.${id}.name`)}</strong>
                  <span>${t('routes.vehicle.summary', { speed: num(p.speedKmh), slope: num(p.maxSlopeDeg), crater: num(p.avoidCraterKm) })}</span>
                </button>`;
              }).join('')}
            </div>
            <div class="routes__profile-note"></div>
          </section>

          <section class="routes__result" aria-live="polite"></section>

          <section class="routes__saved"></section>

          <details class="routes__model">
            <summary>${t('routes.model.title')}</summary>
            <ul>
              <li>${t('routes.model.grid')}</li>
              <li>${t('routes.model.slope', { percent: num((1 - SLOPE_SLOWDOWN) * 100) })}</li>
              <li>${t('routes.model.crater', {
                block: num(CRATER_BLOCK_FACTOR, 1),
                ring: num(CRATER_RING_FACTOR, 1),
                penalty: num(CRATER_RING_PENALTY, 1),
              })}</li>
              <li>${t('routes.model.radius', { radius: num(MARS_RADIUS_KM, 1) })} ${sourceLink('nssdca-mars-fact')}</li>
              <li>${t('routes.model.rover')} ${sourceLink('nasa-perseverance-components')}</li>
            </ul>
          </details>
        </div>
      </div>
    `;

    const resultBox = el.querySelector('.routes__result');
    const savedBox = el.querySelector('.routes__saved');
    const profileNote = el.querySelector('.routes__profile-note');
    const css = getComputedStyle(el);
    const color = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const COLORS = {
      route: color('--cream', '#fffff3'),
      saved: color('--rust-300', '#cf8a63'),
      crater: color('--bad', '#e2664f'),
    };

    // ---------- Mapa ----------

    const start = origin();
    const end = destination();
    const mars = createMarsMap(el.querySelector('.routes__map'), {
      basemap: 'mola',
      center: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
      zoom: 5,
    });
    const { map } = mars;
    const cratersLayer = L.layerGroup().addTo(map);
    const savedLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const pin = (letter) =>
      L.divIcon({ className: 'routes__pin', html: `<span>${letter}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
    const markers = {
      origin: L.marker(start, { icon: pin('A'), keyboard: false, interactive: false }).addTo(map),
      destination: L.marker(end, { icon: pin('B'), keyboard: false, interactive: false }).addTo(map),
    };
    let fitNext = true;

    function onMapClick(event) {
      setPoint(ui.pick, [event.latlng.lat, event.latlng.lng]);
      if (ui.pick === 'origin') ui.pick = 'destination'; // tras fijar A, lo siguiente suele ser B
      paintControls();
    }
    map.on('click', onMapClick);

    // ---------- Estado → controles ----------

    function paintControls() {
      for (const which of ['origin', 'destination']) {
        const point = which === 'origin' ? origin() : destination();
        el.querySelector(`[data-pick="${which}"]`).setAttribute('aria-pressed', String(ui.pick === which));
        for (const axis of [0, 1]) {
          const input = el.querySelector(`[data-coord="${which}:${axis}"]`);
          if (document.activeElement !== input) input.value = String(round4(point[axis]));
        }
        markers[which].setLatLng(point);
      }
      for (const button of el.querySelectorAll('[data-profile]')) {
        button.setAttribute('aria-pressed', String(button.dataset.profile === ui.profile));
      }
      const profile = PROFILES[ui.profile];
      profileNote.innerHTML = `
        <p>${t(`routes.profile.${ui.profile}.speed`)} ${profile.speedRef ? sourceLink(profile.speedRef) : ''}</p>
        <p class="routes__assumed"><span class="badge badge--warn">${t('routes.vehicle.assumedTag')}</span>
          ${t(profile.speedRef ? 'routes.vehicle.assumed' : 'routes.vehicle.assumedAll')}</p>`;
    }

    function setPoint(which, point) {
      ui[which] = [round4(clamp(point[0], -85, 85)), round4(clamp(point[1], -180, 180))];
      persist();
      paintControls();
      compute();
    }

    // ---------- Cálculo ----------

    async function compute() {
      const id = ++runId;
      const from = origin();
      const to = destination();
      const profile = PROFILES[ui.profile];
      current = null;

      if (distanceKm(from, to) < 0.5) {
        routeLayer.clearLayers();
        cratersLayer.clearLayers();
        resultBox.innerHTML = `<p class="routes__fail">${t('routes.fail.same')}</p>`;
        return;
      }
      resultBox.innerHTML = `<p class="routes__hint">${t('routes.computing')}</p>`;

      let result;
      let cellKm;
      try {
        await env.ready();
        const bbox = routeBBox(from, to);
        const [elevation, craters] = await Promise.all([
          env.elevationGrid(bbox, GRID_SIZE),
          env.craters(expandBBox(bbox, CRATER_MARGIN_DEG), profile.avoidCraterKm),
        ]);
        if (!alive || id !== runId) return;
        cellKm = ((bbox.north - bbox.south) / (GRID_SIZE - 1)) * KM_PER_DEG;
        result = planRoute({ origin: from, destination: to, profile, elevation, craters });
        result.craters = craters.filter((crater) => crater.diameterKm >= profile.avoidCraterKm);
      } catch {
        if (!alive || id !== runId) return;
        resultBox.innerHTML = `<p class="routes__fail">${t('routes.fail.data')}</p>`;
        return;
      }

      // Cráteres que este vehículo evita, haya ruta o no: explican por dónde no se pasa.
      cratersLayer.clearLayers();
      for (const crater of result.craters) {
        L.polygon(craterOutline(crater, CRATER_BLOCK_FACTOR), {
          color: COLORS.crater,
          weight: 1,
          fillOpacity: 0.25,
          interactive: false,
        }).addTo(cratersLayer);
      }
      routeLayer.clearLayers();

      if (!result.ok) {
        resultBox.innerHTML = `<p class="routes__fail">${t(`routes.fail.${result.reason}`, {
          vehicle: t(`routes.profile.${ui.profile}.name`),
        })}</p>`;
        return;
      }

      current = { ...result, profile: ui.profile };
      const line = L.polyline(result.points, { color: COLORS.route, weight: 4, interactive: false }).addTo(routeLayer);
      if (fitNext) {
        map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 8 });
        fitNext = false;
      }
      paintResult(result, cellKm);
    }

    // ---------- Resultado ----------

    function elevationChart(route) {
      const W = 600;
      const H = 150;
      const pad = { left: 4, right: 4, top: 10, bottom: 10 };
      const lo = route.lowest.elevM;
      const hi = route.highest.elevM;
      const span = Math.max(1, hi - lo);
      const x = (km) => pad.left + (km / route.distanceKm) * (W - pad.left - pad.right);
      const y = (elev) => H - pad.bottom - ((elev - lo) / span) * (H - pad.top - pad.bottom);
      const line = route.samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.km).toFixed(1)} ${y(s.elevM).toFixed(1)}`).join(' ');
      const area = `${line} L${x(route.distanceKm).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
      const steep = route.maxSlope.deg >= 1 ? `<line class="routes__chart-mark" x1="${x(route.maxSlope.km).toFixed(1)}" x2="${x(route.maxSlope.km).toFixed(1)}" y1="0" y2="${H}" />` : '';
      return `
        <figure class="routes__chart">
          <figcaption>${t('routes.result.profileTitle')}</figcaption>
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
            aria-label="${t('routes.result.profileAlt', { low: num(lo), high: num(hi), km: num(route.distanceKm) })}">
            <path class="routes__chart-area" d="${area}" />
            <path class="routes__chart-line" d="${line}" />
            ${steep}
          </svg>
          <div class="routes__chart-axis">
            <span>${t('routes.result.kmZero')}</span>
            <span>${t('routes.result.elevRange', { low: num(lo), high: num(hi) })}</span>
            <span>${t('routes.result.km', { km: num(route.distanceKm) })}</span>
          </div>
          ${route.maxSlope.deg >= 1 ? `<p class="routes__hint">${t('routes.result.markNote')}</p>` : ''}
        </figure>`;
    }

    function stepText(step) {
      const km = num(step.km);
      if (step.type === 'depart') return t('routes.step.depart', { dir: t(`routes.dir.${step.dir}`) });
      if (step.type === 'crater') {
        return t('routes.step.crater', { km, side: t(`routes.dir.${step.side}`), size: num(step.diameterKm) });
      }
      if (step.type === 'slope') return t('routes.step.slope', { km, deg: num(step.deg, 1) });
      if (step.type === 'high') return t('routes.step.high', { km, elev: num(step.elevM) });
      return t('routes.step.arrive', { km, time: duration(step.hours) });
    }

    function paintResult(route, cellKm) {
      resultBox.innerHTML = `
        <h2>${t('routes.result.title')}</h2>
        <dl class="routes__stats">
          <div><dt>${t('routes.result.distance')}</dt><dd>${t('routes.result.km', { km: num(route.distanceKm) })}</dd></div>
          <div><dt>${t('routes.result.time')}</dt><dd>${duration(route.durationH)}</dd></div>
          <div><dt>${t('routes.result.maxSlope')}</dt><dd>${num(route.maxSlope.deg, 1)}°</dd></div>
        </dl>
        <p class="routes__hint">${t('routes.result.timeNote', { vehicle: t(`routes.profile.${ui.profile}.name`) })}</p>
        ${elevationChart(route)}
        <h3>${t('routes.result.stepsTitle')}</h3>
        <ol class="routes__steps">${route.steps.map((step) => `<li>${stepText(step)}</li>`).join('')}</ol>
        <button type="button" class="btn btn--primary" data-save>${t('routes.result.save')}</button>
        <p class="routes__hint">${t('routes.result.gridNote', { n: GRID_SIZE, km: num(cellKm, 1) })}</p>
      `;
    }

    // ---------- Rutas guardadas (mission.routes) ----------

    function paintSaved() {
      const routes = store.get().mission.routes ?? [];
      savedLayer.clearLayers();
      for (const route of routes) {
        L.polyline(route.points, { color: COLORS.saved, weight: 2, dashArray: '6 6', interactive: false }).addTo(savedLayer);
      }
      savedBox.innerHTML = `
        <h2>${t('routes.saved.title')}</h2>
        ${
          routes.length === 0
            ? `<p class="routes__hint">${t('routes.saved.empty')}</p>`
            : `<ul class="routes__saved-list">
                ${routes
                  .map(
                    (route) => `
                  <li>
                    <span>
                      <strong>${esc(t(`routes.profile.${route.profile}.name`))}</strong>
                      ${t('routes.result.km', { km: num(route.distanceKm) })}${
                        Number.isFinite(route.durationH) ? ` · ${duration(route.durationH)}` : ''
                      }
                    </span>
                    <button type="button" class="btn" data-show="${esc(route.id)}">${t('routes.saved.show')}</button>
                    <button type="button" class="btn" data-delete="${esc(route.id)}">${t('routes.saved.remove')}</button>
                  </li>`,
                  )
                  .join('')}
              </ul>`
        }`;
    }

    function saveCurrent() {
      if (!current) return;
      const route = {
        id: `r-${Date.now().toString(36)}`,
        profile: current.profile,
        points: current.points.map(([lat, lon]) => [round4(lat), round4(lon)]),
        distanceKm: Math.round(current.distanceKm * 10) / 10,
        durationH: Math.round(current.durationH * 100) / 100,
      };
      store.set('mission.routes', [...(store.get().mission.routes ?? []), route]);
      paintSaved();
      savedBox.querySelector(`[data-show="${route.id}"]`)?.focus();
    }

    // ---------- Eventos ----------

    function onClick(event) {
      const target = event.target;
      const go = target.closest('[data-go]')?.dataset.go;
      if (go) return navigate(go);
      const pick = target.closest('[data-pick]')?.dataset.pick;
      if (pick) {
        ui.pick = pick;
        return paintControls();
      }
      const profile = target.closest('[data-profile]')?.dataset.profile;
      if (profile) {
        ui.profile = profile;
        persist();
        paintControls();
        return compute();
      }
      if (target.closest('[data-points-reset]')) {
        ui.origin = null;
        ui.destination = null;
        ui.pick = 'destination';
        fitNext = true;
        persist();
        paintControls();
        return compute();
      }
      if (target.closest('[data-save]')) return saveCurrent();
      const show = target.closest('[data-show]')?.dataset.show;
      if (show) {
        const route = store.get().mission.routes.find((r) => r.id === show);
        if (route) map.fitBounds(L.latLngBounds(route.points), { padding: [40, 40], maxZoom: 8 });
        return undefined;
      }
      const remove = target.closest('[data-delete]')?.dataset.delete;
      if (remove) {
        store.set('mission.routes', store.get().mission.routes.filter((r) => r.id !== remove));
        paintSaved();
        savedBox.querySelector('button')?.focus();
      }
      return undefined;
    }

    function onChange(event) {
      const key = event.target.dataset?.coord;
      if (!key) return;
      const [which, axis] = key.split(':');
      const value = Number(event.target.value);
      if (event.target.value === '' || !Number.isFinite(value)) return paintControls();
      const point = [...(which === 'origin' ? origin() : destination())];
      point[Number(axis)] = value;
      fitNext = true;
      setPoint(which, point);
      return undefined;
    }

    el.addEventListener('click', onClick);
    el.addEventListener('change', onChange);

    paintControls();
    paintSaved();
    compute();

    return () => {
      alive = false;
      runId += 1;
      el.removeEventListener('click', onClick);
      el.removeEventListener('change', onChange);
      map.off('click', onMapClick);
      mars.destroy();
    };
  },
};

export default mod;
