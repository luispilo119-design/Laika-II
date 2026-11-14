/**
 * Módulo "map": mapa con capas y elección del sitio de aterrizaje.
 * Dueño: Parte A — tareas A2 (capas), A3 (datos y reloj) y A4 (ficha de zona).
 *
 * Estado actual (A2): mapas base de Mars Trek, capas de datos con opacidad y leyenda, sitios de
 * aterrizaje y recorridos reales de los rovers. Las capas se declaran en layers.js y sites.js.
 */
import L from 'leaflet';
import './map.css';
import messages from './i18n.js';
import { createMarsMap, BASEMAPS, trekLayer } from '../../core/marsmap.js';
import { DATA_LAYERS, RAMPS } from './layers.js';
import { LANDING_SITES, SITE_REFERENCES } from './sites.js';

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
  {
    id: 'nasa-track-perseverance',
    title: 'Perseverance: waypoints y recorrido (mapa "Where is Perseverance?")',
    org: 'NASA/JPL',
    url: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
    verified: true,
  },
  {
    id: 'nasa-track-curiosity',
    title: 'Curiosity: waypoints y recorrido (mapa "Where is Curiosity?")',
    org: 'NASA/JPL',
    url: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
    verified: true,
  },
  ...DATA_LAYERS.map((layer) => layer.reference),
  ...SITE_REFERENCES,
];
const refUrl = (id) => REFERENCES.find((r) => r.id === id)?.url ?? null;

/** Lo que la persona dejó encendido; sobrevive a los remontajes por cambio de idioma. */
const ui = {
  base: 'mola',
  data: {},
  opacity: {},
  sites: true,
  rovers: { perseverance: true, curiosity: true },
  panelOpen: null,
  center: [0, 0],
  zoom: 2,
};

let roversPromise = null;
function loadRovers() {
  roversPromise ??= fetch('./data/rovers.json')
    .then((response) => {
      if (!response.ok) throw new Error(`rovers.json ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      roversPromise = null;
      throw err;
    });
  return roversPromise;
}

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

          <h2>${t('map.panel.data')}</h2>
          <div data-data></div>
          <p class="mapview__note">${t('map.panel.pending')}</p>

          <h2>${t('map.panel.explore')}</h2>
          <div data-explore></div>
        </aside>
        <div class="mapview__stage">
          <div class="mapview__map"></div>
          <button type="button" class="btn mapview__toggle" data-toggle>${t('map.panel.toggle')}</button>
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
    for (const id of Object.keys(BASEMAPS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.setAttribute('role', 'radio');
      btn.textContent = t(BASEMAPS[id].labelKey);
      btn.addEventListener('click', () => selectBase(id));
      baseButtons[id] = btn;
      baseBox.append(btn);
    }
    selectBase(BASEMAPS[ui.base] ? ui.base : 'mola');

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

    /* ---------- Toque en el mapa ---------- */

    map.on('click', (e) => {
      L.popup().setLatLng(e.latlng).setContent(coords(e.latlng.lat, e.latlng.lng)).openOn(map);
    });

    return () => {
      alive = false;
      mars.destroy();
    };
  },
};

export default mod;
