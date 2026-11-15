/**
 * Módulo "map": mapa con capas y elección del sitio de aterrizaje.
 * Dueño: Parte A — tareas A2 (capas), A3 (datos y reloj) y A4 (ficha de zona).
 *
 * Mapas base y capas de Mars Trek (layers.js), sitios de aterrizaje y recorridos de rovers (core/sites.js, core/rovers.js),
 * reloj marciano, capas con escala numérica pintadas con ctx.env (envlayers.js), mejores zonas y la
 * ficha de zona del punto que se toca (zone.js), desde donde se elige el sitio de aterrizaje.
 */
import L from 'leaflet';
import './map.css';
import messages from './i18n.js';
import { createMarsMap, BASEMAPS, trekLayer } from '../../core/marsmap.js';
import { DATA_LAYERS, RAMPS } from './layers.js';
import { LANDING_SITES, SITE_REFERENCES } from '../../core/sites.js';
import { loadRovers, ROVER_REFERENCES } from '../../core/rovers.js';
import { ENV_LAYERS, createEnvOverlay, rampCss, craterMinDiameterKm } from './envlayers.js';
import { KM_PER_DEG } from '../../core/geo.js';
import { ENV_REFERENCES } from '../../core/env.js';
import { mountClockControl, formatHour } from '../../core/clock.js';
import { HUMAN_REFERENCES } from '../../core/human-needs.js';
import { zoneHtml, bestZones, ZONE_REFERENCES } from './zone.js';

const ROVERS = {
  perseverance: { color: '#ffd166', refId: 'nasa-track-perseverance' },
  curiosity: { color: '#5bd1c9', refId: 'nasa-track-curiosity' },
};

/** @type {import('../../core/types.js').Reference[]} */
const REFERENCES = [
  {
    id: 'trek-api',
    title: 'Mars Trek WMTS API — catálogo de capas',
    org: 'NASA/JPL Mars Trek',
    url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars',
    verified: true,
  },
  ...ROVER_REFERENCES,
  ...DATA_LAYERS.map((layer) => layer.reference),
  ...SITE_REFERENCES,
  ...ENV_REFERENCES,
  ...HUMAN_REFERENCES,
  ...ZONE_REFERENCES,
];
const refUrl = (id) => REFERENCES.find((r) => r.id === id)?.url ?? null;

/** Lo que la persona dejó encendido; sobrevive a los remontajes por cambio de idioma. */
const ui = {
  base: 'mola',
  data: {},
  opacity: {},
  sites: true,
  rovers: { perseverance: true, curiosity: true },
  env: {},
  envOpacity: {},
  craters: false,
  point: null,
  best: false,
  panelOpen: null,
  center: [0, 0],
  zoom: 2,
};

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'map',
  phase: 1,
  owner: 'A',
  task: 'A2',
  messages,
  references: REFERENCES,

  mount(el, ctx) {
    const { t, store } = ctx;
    const lang = store.get().lang;
    const dateFormat = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const fmtDate = (iso) => dateFormat.format(new Date(`${iso}T00:00:00Z`));
    const num = (value, digits = 0) =>
      value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const coords = (lat, lon) => t('map.coords', { lat: num(lat, 2), lon: num(lon, 2) });
    const sourceLink = (refId) => {
      const url = refUrl(refId);
      return url ? `<a href="${url}" target="_blank" rel="noopener">${t('map.panel.source')}</a>` : '';
    };

    el.innerHTML = `
      <div class="mapview">
        <aside class="mapview__panel">
          <div class="mapview__panel-head">
            <h1>${t('map.title')}</h1>
            <button type="button" class="btn btn--ghost" data-close>${t('map.panel.close')}</button>
          </div>
          <p class="mapview__hint">${t('map.hint')}</p>

          <h2>${t('map.panel.base')}</h2>
          <div class="mapview__base" role="radiogroup" aria-label="${t('map.panel.base')}"></div>
          <p class="mapview__note" data-base-note></p>

          <h2>${t('core.clock.title')}</h2>
          <div data-clock></div>

          <h2>${t('map.best.title')}</h2>
          <div class="mapview__best-actions">
            <button type="button" class="btn" data-best>${t('map.best.find')}</button>
            <button type="button" class="btn btn--ghost" data-best-clear>${t('map.best.clear')}</button>
          </div>
          <p class="mapview__note" data-best-note></p>
          <p class="mapview__note">${t('map.best.how')}</p>

          <h2>${t('map.panel.env')}</h2>
          <div data-env></div>

          <h2>${t('map.panel.data')}</h2>
          <div data-data></div>

          <h2>${t('map.panel.explore')}</h2>
          <div data-explore></div>
        </aside>
        <div class="mapview__stage">
          <div class="mapview__map"></div>
          <button type="button" class="btn mapview__toggle" data-toggle>${t('map.panel.toggle')}</button>
          <section class="mapview__sheet zone" data-zone hidden></section>
        </div>
      </div>
    `;

    const root = el.querySelector('.mapview');
    const mars = createMarsMap(el.querySelector('.mapview__map'), { basemap: ui.base, center: ui.center, zoom: ui.zoom });
    const map = mars.map;
    map.on('moveend', () => {
      const c = map.getCenter();
      ui.center = [c.lat, c.lng];
      ui.zoom = map.getZoom();
    });

    /* ---------- Panel ---------- */

    function setPanel(open) {
      ui.panelOpen = open;
      root.classList.toggle('is-panel-open', open);
      el.querySelector('[data-toggle]').hidden = open;
    }
    el.querySelector('[data-toggle]').addEventListener('click', () => setPanel(true));
    el.querySelector('[data-close]').addEventListener('click', () => setPanel(false));
    setPanel(ui.panelOpen ?? window.innerWidth > 900);

    /* ---------- Mapa base ---------- */

    const baseBox = el.querySelector('.mapview__base');
    const baseNote = el.querySelector('[data-base-note]');
    const baseButtons = {};
    function selectBase(id) {
      ui.base = id;
      mars.setBasemap(id);
      for (const [key, btn] of Object.entries(baseButtons)) {
        btn.classList.toggle('is-active', key === id);
        btn.setAttribute('aria-checked', String(key === id));
      }
      baseNote.textContent = t(`map.baseNote.${id}`);
    }
    // HRSC queda fuera del selector (se usa solo al acercarse a un recorrido): con MOLA basta.
    for (const id of Object.keys(BASEMAPS).filter((key) => key !== 'hrsc')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.setAttribute('role', 'radio');
      btn.textContent = t(BASEMAPS[id].labelKey);
      btn.addEventListener('click', () => selectBase(id));
      baseButtons[id] = btn;
      baseBox.append(btn);
    }
    selectBase(BASEMAPS[ui.base] && ui.base !== 'hrsc' ? ui.base : 'mola');

    /* ---------- Capas de datos ---------- */

    const dataBox = el.querySelector('[data-data]');
    const tileLayers = {};
    DATA_LAYERS.forEach((layer, index) => {
      const opacity = ui.opacity[layer.id] ?? layer.opacity;
      const row = document.createElement('div');
      row.className = 'mapview__layer';
      row.innerHTML = `
        <label class="mapview__check">
          <input type="checkbox" />
          <span>${t(`map.data.${layer.id}.name`)}</span>
        </label>
        <div class="mapview__layer-body" hidden>
          <p>${t(`map.data.${layer.id}.why`)}</p>
          ${
            layer.ramp
              ? `<div class="mapview__ramp" style="background:${RAMPS[layer.ramp]}"></div>
                 <div class="mapview__ramp-ends"><span>${t(`map.data.${layer.id}.low`)}</span><span>${t(`map.data.${layer.id}.high`)}</span></div>
                 <p class="mapview__note">${t('map.panel.relative')}${layer.noData ? ` ${t('map.panel.noData')}` : ''}</p>`
              : ''
          }
          <label class="mapview__opacity">
            <span>${t('map.panel.opacity')}</span>
            <input type="range" min="10" max="100" step="5" value="${Math.round(opacity * 100)}" />
          </label>
          <p class="mapview__source">${layer.credit} · ${sourceLink(layer.reference.id)}</p>
        </div>
      `;
      const checkbox = row.querySelector('input[type="checkbox"]');
      const body = row.querySelector('.mapview__layer-body');
      const slider = row.querySelector('input[type="range"]');

      function setOn(on) {
        ui.data[layer.id] = on;
        checkbox.checked = on;
        body.hidden = !on;
        row.classList.toggle('is-on', on);
        if (on) {
          tileLayers[layer.id] ??= trekLayer(layer.trekId, {
            ext: layer.ext,
            maxNativeZoom: layer.maxNativeZoom,
            bounds: layer.bounds,
            opacity: ui.opacity[layer.id] ?? layer.opacity,
            attribution: `${layer.credit} · NASA Mars Trek`,
            zIndex: 10 + index,
          });
          tileLayers[layer.id].addTo(map);
        } else if (tileLayers[layer.id]) {
          map.removeLayer(tileLayers[layer.id]);
        }
      }
      checkbox.addEventListener('change', () => setOn(checkbox.checked));
      slider.addEventListener('input', () => {
        ui.opacity[layer.id] = Number(slider.value) / 100;
        tileLayers[layer.id]?.setOpacity(ui.opacity[layer.id]);
      });
      dataBox.append(row);
      setOn(Boolean(ui.data[layer.id]));
    });

    /* ---------- Exploración: sitios de aterrizaje y rovers ---------- */

    const exploreBox = el.querySelector('[data-explore]');
    const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    const rust = cssVar('--rust-500', '#a5583b');
    const cream = cssVar('--cream', '#fffff3');

    function exploreRow({ label, swatch, checked, onToggle, onGo }) {
      const row = document.createElement('div');
      row.className = 'mapview__layer';
      row.innerHTML = `
        <div class="mapview__row">
          <label class="mapview__check">
            <input type="checkbox" />
            <span class="mapview__swatch" style="background:${swatch}"></span>
            <span>${label}</span>
          </label>
          ${onGo ? `<button type="button" class="btn btn--ghost" data-go>${t('map.explore.goTo')}</button>` : ''}
        </div>
        <div class="mapview__layer-body" data-info hidden></div>
      `;
      const checkbox = row.querySelector('input');
      checkbox.checked = checked;
      row.classList.toggle('is-on', checked);
      checkbox.addEventListener('change', () => {
        row.classList.toggle('is-on', checkbox.checked);
        onToggle(checkbox.checked);
      });
      row.querySelector('[data-go]')?.addEventListener('click', onGo);
      exploreBox.append(row);
      return { row, info: row.querySelector('[data-info]'), checkbox };
    }

    // Sitios de aterrizaje
    const sitesGroup = L.layerGroup();
    for (const site of LANDING_SITES) {
      const lines = [
        `<strong>${t('map.explore.landing', { name: site.name })}</strong>`,
        [site.region, site.date ? t('map.explore.landed', { date: fmtDate(site.date) }) : null].filter(Boolean).join(' · '),
        coords(site.lat, site.lon),
        site.approx ? `<small>${t('map.explore.approx')}</small>` : null,
        `<small>${sourceLink(site.refId)}</small>`,
      ].filter(Boolean);
      L.circleMarker([site.lat, site.lon], {
        radius: 7,
        color: cream,
        weight: 2,
        fillColor: rust,
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .bindPopup(lines.join('<br>'))
        .bindTooltip(site.name, { direction: 'top', offset: [0, -8] })
        .addTo(sitesGroup);
    }
    function setSites(on) {
      ui.sites = on;
      if (on) sitesGroup.addTo(map);
      else map.removeLayer(sitesGroup);
    }
    exploreRow({ label: t('map.explore.sites'), swatch: rust, checked: ui.sites, onToggle: setSites });
    setSites(ui.sites);

    // Recorridos de los rovers
    let alive = true;
    for (const [key, style] of Object.entries(ROVERS)) {
      const group = L.layerGroup();
      let bounds = null;
      const name = key === 'perseverance' ? 'Perseverance' : 'Curiosity';
      const setOn = (on) => {
        ui.rovers[key] = on;
        if (on) group.addTo(map);
        else map.removeLayer(group);
      };
      const { info } = exploreRow({
        label: t('map.explore.rover', { name }),
        swatch: style.color,
        checked: ui.rovers[key],
        onToggle: setOn,
        onGo: () => {
          if (!bounds) return;
          // El recorrido mide decenas de km: hace falta el mosaico más detallado para verlo sobre el terreno.
          if (BASEMAPS[ui.base].maxNativeZoom < 9) selectBase('themis');
          map.fitBounds(bounds.pad(0.25));
        },
      });
      info.hidden = false;
      info.innerHTML = `<p class="mapview__note">${t('map.explore.loading')}</p>`;
      setOn(ui.rovers[key]);

      loadRovers()
        .then((data) => {
          if (!alive) return;
          const rover = data.rovers[key];
          const summary = t('map.explore.roverInfo', { sol: num(rover.lastSol), km: num(rover.distanceKm, 2) });
          for (const path of rover.paths) {
            L.polyline(path, { color: style.color, weight: 3, opacity: 0.95, bubblingMouseEvents: false }).addTo(group);
          }
          bounds = L.latLngBounds(rover.paths.flat());
          L.circleMarker(rover.current, {
            radius: 6,
            color: '#140c0a',
            weight: 2,
            fillColor: style.color,
            fillOpacity: 1,
            bubblingMouseEvents: false,
          })
            .bindPopup(
              [
                `<strong>${t('map.explore.roverNow', { name: rover.name })}</strong>`,
                summary,
                coords(rover.current[0], rover.current[1]),
                `<small>${t('map.explore.roverData', { date: fmtDate(data.generated) })} ${sourceLink(style.refId)}</small>`,
              ].join('<br>'),
            )
            .bindTooltip(rover.name, { direction: 'top', offset: [0, -8] })
            .addTo(group);
          info.innerHTML = `
            <p>${summary}</p>
            <p class="mapview__source">${t('map.explore.roverData', { date: fmtDate(data.generated) })} ${sourceLink(style.refId)}</p>
          `;
        })
        .catch((err) => {
          console.warn('[map] recorridos no disponibles', err);
          if (alive) info.innerHTML = `<p class="mapview__note">${t('map.explore.failed')}</p>`;
        });
    }

    /* ---------- Reloj marciano y capas con escala numérica (datos de ctx.env) ---------- */

    const { env } = ctx;
    const unmountClock = mountClockControl(el.querySelector('[data-clock]'), ctx);
    const envBox = el.querySelector('[data-env]');
    const modelTag = `<span class="mapview__model">${t('map.panel.model')}</span>`;
    const envOverlays = {};

    for (const def of ENV_LAYERS) {
      const row = document.createElement('div');
      row.className = 'mapview__layer';
      const unit = def.unit ? ` ${def.unit}` : '';
      row.innerHTML = `
        <label class="mapview__check">
          <input type="checkbox" />
          <span>${t(`map.env.${def.id}.name`)}</span>
        </label>
        <div class="mapview__layer-body" hidden>
          <p>${t(`map.env.${def.id}.why`)}</p>
          <div class="mapview__ramp" style="background:${rampCss(def.ramp)}"></div>
          <div class="mapview__ramp-ends"><span>${num(def.min, def.digits)}${unit}</span><span>${num(def.max, def.digits)}${unit}</span></div>
          <p class="mapview__note">
            ${def.modeled ? `${modelTag} ` : ''}${def.clock ? t('map.panel.followsClock') : ''}${def.noData ? ` ${t('map.panel.noDataClear')}` : ''}
          </p>
          <label class="mapview__opacity">
            <span>${t('map.panel.opacity')}</span>
            <input type="range" min="10" max="100" step="5" value="${Math.round((ui.envOpacity[def.id] ?? def.opacity) * 100)}" />
          </label>
          <p class="mapview__source">${sourceLink(def.refId)}</p>
        </div>
      `;
      const checkbox = row.querySelector('input[type="checkbox"]');
      const body = row.querySelector('.mapview__layer-body');
      const slider = row.querySelector('input[type="range"]');

      const setOn = (on) => {
        ui.env[def.id] = on;
        checkbox.checked = on;
        body.hidden = !on;
        row.classList.toggle('is-on', on);
        if (on) {
          envOverlays[def.id] ??= createEnvOverlay(def, env, ui.envOpacity[def.id] ?? def.opacity);
          envOverlays[def.id].redraw(store.get().clock);
          envOverlays[def.id].overlay.addTo(map);
        } else if (envOverlays[def.id]) {
          map.removeLayer(envOverlays[def.id].overlay);
        }
      };
      checkbox.addEventListener('change', () => setOn(checkbox.checked));
      slider.addEventListener('input', () => {
        ui.envOpacity[def.id] = Number(slider.value) / 100;
        envOverlays[def.id]?.overlay.setOpacity(ui.envOpacity[def.id]);
      });
      envBox.append(row);
      setOn(Boolean(ui.env[def.id]));
    }

    // Cráteres: círculos al tamaño real; cuanto más zoom, más pequeños se muestran.
    const cratersGroup = L.layerGroup();
    const MAX_CRATERS = 400;
    const EARTH_M_PER_DEG = (Math.PI * 6378137) / 180; // Leaflet mide los círculos con el radio terrestre
    const craterRow = document.createElement('div');
    craterRow.className = 'mapview__layer';
    craterRow.innerHTML = `
      <label class="mapview__check">
        <input type="checkbox" />
        <span>${t('map.env.craters.name')}</span>
      </label>
      <div class="mapview__layer-body" hidden>
        <p>${t('map.env.craters.why')}</p>
        <p class="mapview__note" data-crater-count></p>
        <p class="mapview__source">${sourceLink('robbins2012')}</p>
      </div>
    `;
    const craterCheck = craterRow.querySelector('input');
    const craterBody = craterRow.querySelector('.mapview__layer-body');
    const craterCount = craterRow.querySelector('[data-crater-count]');
    let craterRequest = 0;
    async function drawCraters() {
      if (!ui.craters) return;
      const request = ++craterRequest;
      const b = map.getBounds();
      const minKm = craterMinDiameterKm(map.getZoom());
      try {
        const list = await env.craters({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, minKm);
        if (!alive || request !== craterRequest || !ui.craters) return;
        cratersGroup.clearLayers();
        for (const crater of list.slice(0, MAX_CRATERS)) {
          L.circle([crater.lat, crater.lon], {
            radius: (crater.diameterKm / 2 / KM_PER_DEG) * EARTH_M_PER_DEG,
            color: cream,
            weight: 1,
            opacity: 0.9,
            fillColor: rust,
            fillOpacity: 0.15,
            interactive: false,
          }).addTo(cratersGroup);
        }
        craterCount.textContent = t(list.length > MAX_CRATERS ? 'map.env.craters.countMax' : 'map.env.craters.count', {
          n: num(Math.min(list.length, MAX_CRATERS)),
          km: num(minKm),
        });
      } catch (err) {
        console.warn('[map] cráteres no disponibles', err);
        craterCount.textContent = t('map.env.craters.failed');
      }
    }
    function setCraters(on) {
      ui.craters = on;
      craterCheck.checked = on;
      craterBody.hidden = !on;
      craterRow.classList.toggle('is-on', on);
      if (on) {
        cratersGroup.addTo(map);
        drawCraters();
      } else {
        map.removeLayer(cratersGroup);
      }
    }
    craterCheck.addEventListener('change', () => setCraters(craterCheck.checked));
    map.on('moveend', drawCraters);
    envBox.append(craterRow);
    setCraters(ui.craters);

    /* ---------- Toque en el mapa: condiciones del punto en el instante del reloj ---------- */

    // Ficha de zona (A4): se abre al tocar el mapa y se actualiza con el reloj.
    const sheet = el.querySelector('[data-zone]');
    const pointMarker = L.circleMarker([0, 0], { radius: 9, color: cream, weight: 3, fillColor: '#140c0a', fillOpacity: 0.6, interactive: false });
    const siteMarker = L.marker([0, 0], {
      icon: L.divIcon({ className: 'mapview__site', html: '<span>★</span>', iconSize: [36, 36], iconAnchor: [18, 18] }),
      interactive: false,
      keyboard: false,
    });
    const samePlace = (a, b) => Boolean(a && b) && Math.abs(a.lat - b[0]) < 1e-6 && Math.abs(a.lon - b[1]) < 1e-6;

    function paintSite() {
      const site = store.get().mission.site;
      if (site) siteMarker.setLatLng([site.lat, site.lon]).bindTooltip(t('map.zone.siteTooltip'), { direction: 'top', offset: [0, -14] }).addTo(map);
      else map.removeLayer(siteMarker);
    }

    function paintSheet() {
      if (!ui.point) {
        sheet.hidden = true;
        map.removeLayer(pointMarker);
        return;
      }
      const [lat, lon] = ui.point;
      const { clock, mission } = store.get();
      const scroll = sheet.scrollTop;
      sheet.innerHTML = zoneHtml({
        lat,
        lon,
        sample: env.sample(lat, lon, clock),
        evaluation: env.evaluate(lat, lon, clock, 'habitat'),
        isSite: samePlace(mission.site, ui.point),
        t,
        num,
        coords,
        sourceLink,
      });
      sheet.hidden = false;
      sheet.scrollTop = scroll;
      pointMarker.setLatLng([lat, lon]).addTo(map);
    }

    function setSheetMin(min) {
      ui.sheetMin = min;
      sheet.classList.toggle('is-min', min);
    }

    function showPoint(lat, lon) {
      ui.point = [lat, lon];
      sheet.scrollTop = 0;
      setSheetMin(false);
      paintSheet();
    }
    // Al explorar el mapa la ficha se encoge sola para no estorbar; un toque la vuelve a abrir.
    map.on('dragstart zoomstart', () => {
      if (ui.point && !sheet.hidden) setSheetMin(true);
    });
    setSheetMin(Boolean(ui.sheetMin));

    sheet.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if ('zoneMin' in button.dataset) {
        setSheetMin(true);
      } else if ('zoneMax' in button.dataset) {
        setSheetMin(false);
      } else if ('zoneClose' in button.dataset) {
        ui.point = null;
        paintSheet();
      } else if ('zoneChoose' in button.dataset && ui.point) {
        store.set('mission.site', { lat: ui.point[0], lon: ui.point[1] });
      } else if ('zoneClear' in button.dataset) {
        store.set('mission.site', null);
      } else if ('zoneNext' in button.dataset) {
        ctx.navigate('transit');
      }
    });
    map.on('click', (e) => showPoint(e.latlng.lat, e.latlng.lng));

    // Mejores zonas para el instante del reloj, entre las que cumplen las restricciones de aterrizaje.
    const bestGroup = L.layerGroup().addTo(map);
    const bestNote = el.querySelector('[data-best-note]');
    function drawBest() {
      bestGroup.clearLayers();
      const zones = bestZones(env, store.get().clock);
      zones.forEach((zone, index) => {
        L.marker([zone.lat, zone.lon], {
          icon: L.divIcon({ className: `mapview__best is-${zone.verdict}`, html: `<span>${index + 1}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
          bubblingMouseEvents: false,
        })
          .bindTooltip(t('map.best.tooltip', { n: index + 1, score: zone.score }), { direction: 'top', offset: [0, -14] })
          .on('click', () => showPoint(zone.lat, zone.lon))
          .addTo(bestGroup);
      });
      const { clock } = store.get();
      bestNote.textContent = zones.length
        ? t('map.best.note', { n: zones.length, sol: clock.sol, hour: formatHour(clock.localHour), ls: Math.round(clock.ls) })
        : t('map.best.none');
      ui.best = true;
    }
    el.querySelector('[data-best]').addEventListener('click', drawBest);
    el.querySelector('[data-best-clear]').addEventListener('click', () => {
      bestGroup.clearLayers();
      bestNote.textContent = '';
      ui.best = false;
    });
    if (ui.best) drawBest();

    // Simbología dentro del mapa, junto a los controles de navegación.
    const legend = L.control({ position: 'topleft' });
    legend.onAdd = () => {
      const box = L.DomUtil.create('details', 'mapview__legend');
      box.open = ui.legendOpen ?? window.innerWidth > 900;
      box.addEventListener('toggle', () => {
        ui.legendOpen = box.open;
      });
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      box.innerHTML = `
        <summary>${t('map.legend.title')}</summary>
        <ul>
          <li><span class="mapview__lg mapview__lg--site">★</span>${t('map.legend.site')}</li>
          <li><span class="mapview__lg mapview__lg--point"></span>${t('map.legend.point')}</li>
          <li><span class="mapview__lg mapview__lg--mission"></span>${t('map.legend.missions')}</li>
          <li><span class="mapview__lg mapview__lg--best"><i class="is-viable"></i><i class="is-marginal"></i><i class="is-not_viable"></i></span>${t('map.legend.best')}</li>
          <li><span class="mapview__lg mapview__lg--crater"></span>${t('map.legend.craters')}</li>
          <li><span class="mapview__lg mapview__lg--track" style="--c1:${ROVERS.perseverance.color};--c2:${ROVERS.curiosity.color}"></span>${t('map.legend.tracks')}</li>
        </ul>`;
      return box;
    };
    legend.addTo(map);

    paintSite();
    paintSheet();

    // Al mover el reloj se repintan las capas que dependen de él y la ficha del punto abierto.
    let frame = 0;
    const unsubscribe = store.subscribe((state, path) => {
      if (path === 'mission' || path.startsWith('mission.site')) {
        paintSite();
        paintSheet();
      }
      if (path !== 'clock' && !path.startsWith('clock.') && path !== 'mission') return;
      clearTimeout(frame);
      frame = setTimeout(() => {
        for (const def of ENV_LAYERS) {
          if (def.clock && ui.env[def.id]) envOverlays[def.id].redraw(state.clock);
        }
        paintSheet();
      }, 30);
    });

    return () => {
      alive = false;
      clearTimeout(frame);
      unsubscribe();
      unmountClock();
      mars.destroy();
    };
  },
};

export default mod;
