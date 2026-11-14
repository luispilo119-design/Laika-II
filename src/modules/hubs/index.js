/**
 * Módulo "hubs": colocar hubs autónomos sobre el mapa con veredicto de viabilidad.
 * Dueño: Parte A — tarea A5 (docs/PARTE-A.md).
 *
 * Cada tipo de hub usa su perfil de pesos de env.evaluate. Los tipos y la regla de distancia al
 * hábitat están en rules.js. Escribe `mission.hubs`; lee `mission.site` y `clock`.
 */
import L from 'leaflet';
import './hubs.css';
import messages from './i18n.js';
import { createMarsMap } from '../../core/marsmap.js';
import { ENV_REFERENCES, SCORE_SCALES } from '../../core/env.js';
import { mountClockControl } from '../../core/clock.js';
import { HUB_TYPES, HUB_REFERENCES, MAX_KM_FROM_HABITAT, hubType, habitatRule, newHubId } from './rules.js';

const REFERENCES = [...HUB_REFERENCES, ...ENV_REFERENCES];
const refUrl = (id) => REFERENCES.find((r) => r.id === id)?.url ?? null;

const FACTOR_DIGITS = { water: 2, temperature: 0, energy: 0, radiation: 2, terrain: 1, pressure: 0, dust: 2 };
const VERDICT_COLOR = { viable: '#7fc98b', marginal: '#e8b04a', not_viable: '#e2664f' };

/** Lo que la persona dejó a medias; sobrevive a los remontajes por cambio de idioma. */
const ui = { tool: null, selectedId: null, movingId: null, panelOpen: null, center: null, zoom: null };

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'hubs',
  phase: 4,
  owner: 'A',
  task: 'A5',
  messages,
  references: REFERENCES,

  mount(el, ctx) {
    const { t, store, env } = ctx;
    const lang = store.get().lang;
    const num = (value, digits = 0) =>
      value.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    const coords = (lat, lon) => t('core.coords', { lat: num(lat, 2), lon: num(lon, 2) });
    const sourceLink = (refId) => {
      const url = refUrl(refId);
      return url ? `<a href="${url}" target="_blank" rel="noopener">${t('core.source')}</a>` : '';
    };
    const typeName = (id) => t(`hubs.type.${id}.name`);
    const hubs = () => store.get().mission.hubs;
    const evaluate = (hub) => env.evaluate(hub.lat, hub.lon, store.get().clock, hub.type);

    const site = store.get().mission.site;
    el.innerHTML = `
      <div class="hubs">
        <aside class="hubs__panel">
          <div class="hubs__panel-head">
            <h1>${t('hubs.title')}</h1>
            <button type="button" class="btn btn--ghost" data-close>${t('hubs.panel.close')}</button>
          </div>
          <p class="hubs__note">${t('hubs.hint')}</p>
          ${
            site
              ? ''
              : `<div class="hubs__warn"><p>${t('hubs.noSite')}</p>
                 <button type="button" class="btn" data-go-map>${t('hubs.goToMap')}</button></div>`
          }

          <h2>${t('hubs.palette')}</h2>
          <div class="hubs__palette"></div>

          <h2>${t('hubs.list')}</h2>
          <p class="hubs__note" data-count></p>
          <div class="hubs__list"></div>
          <button type="button" class="btn btn--ghost hubs__clear" data-clear-all hidden>${t('hubs.clearAll')}</button>

          <h2>${t('core.clock.title')}</h2>
          <div data-clock></div>
        </aside>
        <div class="hubs__stage">
          <div class="hubs__map"></div>
          <button type="button" class="btn hubs__toggle" data-toggle>${t('hubs.panel.toggle')}</button>
          <div class="hubs__status" data-status hidden></div>
          <section class="hubs__card" data-card hidden></section>
        </div>
      </div>
    `;

    const root = el.querySelector('.hubs');
    const mars = createMarsMap(el.querySelector('.hubs__map'), {
      basemap: 'hrsc',
      center: ui.center ?? (site ? [site.lat, site.lon] : [0, 0]),
      zoom: ui.zoom ?? (site ? 6 : 2),
    });
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
    el.querySelector('[data-go-map]')?.addEventListener('click', () => ctx.navigate('map'));
    setPanel(ui.panelOpen ?? window.innerWidth > 900);
    const unmountClock = mountClockControl(el.querySelector('[data-clock]'), ctx);

    if (site) {
      L.marker([site.lat, site.lon], {
        icon: L.divIcon({ className: 'hubs__site', html: '<span>★</span>', iconSize: [32, 32], iconAnchor: [16, 16] }),
        interactive: false,
        keyboard: false,
      })
        .bindTooltip(t('hubs.siteTooltip'), { direction: 'top', offset: [0, -14] })
        .addTo(map);
    }

    /* ---------- Paleta ---------- */

    const palette = el.querySelector('.hubs__palette');
    const paletteButtons = {};
    for (const type of HUB_TYPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn hubs__type';
      btn.innerHTML = `
        <span class="hubs__glyph">${type.glyph}</span>
        <span><strong>${typeName(type.id)}</strong><small>${t(`hubs.type.${type.id}.desc`)}</small></span>
      `;
      btn.addEventListener('click', () => {
        ui.movingId = null;
        ui.tool = ui.tool === type.id ? null : type.id;
        if (ui.tool && window.innerWidth <= 900) setPanel(false); // en tablet, deja ver el mapa para tocar
        paintMode();
      });
      paletteButtons[type.id] = btn;
      palette.append(btn);
    }

    /* ---------- Modo de colocación y vista previa ---------- */

    const status = el.querySelector('[data-status]');
    const ghost = L.circleMarker([0, 0], { radius: 18, weight: 3, fillOpacity: 0.35, interactive: false });
    const activeType = () => ui.tool ?? hubs().find((h) => h.id === ui.movingId)?.type ?? null;

    function paintMode() {
      const type = activeType();
      for (const [id, btn] of Object.entries(paletteButtons)) btn.classList.toggle('is-active', id === ui.tool);
      root.classList.toggle('is-placing', Boolean(type));
      if (!type) {
        status.hidden = true;
        map.removeLayer(ghost);
        return;
      }
      status.hidden = false;
      status.innerHTML = `
        <span data-status-text>${t(ui.movingId ? 'hubs.moving' : 'hubs.placing', { name: typeName(type) })}</span>
        <button type="button" class="btn" data-cancel>${t('hubs.cancel')}</button>
      `;
    }
    status.addEventListener('click', (e) => {
      if (!e.target.closest('[data-cancel]')) return;
      ui.tool = null;
      ui.movingId = null;
      paintMode();
    });

    map.on('mousemove', (e) => {
      const type = activeType();
      if (!type) return;
      const result = env.evaluate(e.latlng.lat, e.latlng.lng, store.get().clock, type);
      const color = VERDICT_COLOR[result.verdict];
      ghost.setLatLng(e.latlng).setStyle({ color, fillColor: color }).addTo(map);
      const text = status.querySelector('[data-status-text]');
      if (text) {
        text.textContent = t('hubs.preview', { name: typeName(type), score: result.score, verdict: t(`core.verdict.${result.verdict}`) });
      }
    });
    map.on('mouseout', () => map.removeLayer(ghost));

    map.on('click', (e) => {
      const { lat, lng: lon } = e.latlng;
      if (ui.movingId) {
        const hub = hubs().find((h) => h.id === ui.movingId);
        if (hub) {
          const result = env.evaluate(lat, lon, store.get().clock, hub.type);
          const moved = { ...hub, lat, lon, score: result.score, verdict: result.verdict };
          ui.selectedId = hub.id;
          ui.movingId = null;
          store.set('mission.hubs', hubs().map((h) => (h.id === hub.id ? moved : h)));
        } else {
          ui.movingId = null;
        }
        paintMode();
      } else if (ui.tool) {
        const result = env.evaluate(lat, lon, store.get().clock, ui.tool);
        const hub = { id: newHubId(), type: ui.tool, lat, lon, score: result.score, verdict: result.verdict };
        ui.selectedId = hub.id;
        ui.tool = null;
        store.set('mission.hubs', [...hubs(), hub]);
        paintMode();
      } else if (ui.selectedId) {
        ui.selectedId = null;
        paintAll();
      }
    });

    /* ---------- Marcadores, lista y tarjeta ---------- */

    const markers = L.layerGroup().addTo(map);
    const list = el.querySelector('.hubs__list');
    const count = el.querySelector('[data-count]');
    const clearAll = el.querySelector('[data-clear-all]');
    const card = el.querySelector('[data-card]');

    function select(id, pan) {
      ui.selectedId = id;
      ui.tool = null;
      ui.movingId = null;
      const hub = hubs().find((h) => h.id === id);
      if (hub && pan) map.panTo([hub.lat, hub.lon]);
      paintMode();
      paintAll();
    }

    function paintAll() {
      const all = hubs();
      const live = new Map(all.map((hub) => [hub.id, evaluate(hub)]));

      markers.clearLayers();
      for (const hub of all) {
        const verdict = live.get(hub.id).verdict;
        L.marker([hub.lat, hub.lon], {
          icon: L.divIcon({
            className: `hubs__marker is-${verdict}${hub.id === ui.selectedId ? ' is-selected' : ''}`,
            html: `<span>${hubType(hub.type).glyph}</span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
          bubblingMouseEvents: false,
          title: typeName(hub.type),
        })
          .on('click', () => select(hub.id, false))
          .addTo(markers);
      }

      list.replaceChildren();
      for (const hub of all) {
        const result = live.get(hub.id);
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `btn hubs__row${hub.id === ui.selectedId ? ' is-active' : ''}`;
        row.innerHTML = `
          <span class="hubs__glyph">${hubType(hub.type).glyph}</span>
          <span><strong>${typeName(hub.type)}</strong><small>${coords(hub.lat, hub.lon)}</small></span>
          <span class="hubs__badge is-${result.verdict}">${result.score}</span>
        `;
        row.addEventListener('click', () => select(hub.id, true));
        list.append(row);
      }
      const viable = all.filter((hub) => live.get(hub.id).verdict === 'viable').length;
      count.textContent = all.length ? t('hubs.count', { n: all.length, viable }) : t('hubs.empty');
      clearAll.hidden = all.length === 0;

      const hub = all.find((h) => h.id === ui.selectedId);
      if (!hub) {
        ui.selectedId = null;
        card.hidden = true;
        return;
      }
      const result = live.get(hub.id);
      const rule = habitatRule(hub, all);
      const model = `<abbr class="hubs__model" title="${t('core.modelHint')}">${t('core.modelTag')}</abbr>`;
      const scroll = card.scrollTop;
      card.innerHTML = `
        <div class="hubs__card-head">
          <div>
            <h2><span class="hubs__glyph">${hubType(hub.type).glyph}</span> ${typeName(hub.type)}</h2>
            <p class="hubs__coords">${coords(hub.lat, hub.lon)}</p>
          </div>
          <button type="button" class="btn btn--ghost" data-card-close>${t('hubs.card.close')}</button>
        </div>
        <div class="hubs__score is-${result.verdict}">
          <strong>${result.score}</strong>
          <div>
            <span class="hubs__verdict">${t(`core.verdict.${result.verdict}`)}</span>
            <span>${t('hubs.card.scoreNow', { placed: hub.score })}</span>
          </div>
        </div>
        ${
          rule.status === 'not_applicable'
            ? ''
            : `<div class="hubs__rule is-${rule.status}">
                 <strong>${t('hubs.rule.title')}</strong>
                 <p>${t(`hubs.rule.${rule.status}`, { km: rule.km == null ? '' : num(rule.km), max: MAX_KM_FROM_HABITAT })} ${sourceLink('bussey2016')}</p>
               </div>`
        }
        <h3>${t('hubs.card.weights')}</h3>
        ${result.factors
          .filter((f) => f.weight > 0 || f.noData)
          .map((f) => {
            const unit = SCORE_SCALES[f.id].unit ? ` ${SCORE_SCALES[f.id].unit}` : '';
            const value = f.noData ? t('core.noData') : `${num(f.value, FACTOR_DIGITS[f.id])}${unit}`;
            return `
              <div class="hubs__factor${f.noData ? ' is-nodata' : ''}">
                <div class="hubs__factor-head">
                  <span>${t(`core.factor.${f.id}`)}${f.modeled ? ` ${model}` : ''}</span>
                  <strong>${f.noData ? '—' : `${f.score} %`}</strong>
                </div>
                <div class="hubs__bar"><i style="width:${f.noData ? 0 : f.score}%"></i></div>
                <p>${f.noData ? t('hubs.card.noData') : t('hubs.card.factorLine', { value, weight: num(f.weight * 100) })} · ${sourceLink(f.refId)}</p>
              </div>`;
          })
          .join('')}
        <p class="hubs__note">${t('hubs.card.formula')}</p>
        <div class="hubs__actions">
          <button type="button" class="btn" data-card-move>${t('hubs.card.move')}</button>
          <button type="button" class="btn" data-card-remove>${t('hubs.card.remove')}</button>
        </div>
      `;
      card.hidden = false;
      card.scrollTop = scroll;
    }

    card.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if ('cardClose' in button.dataset) {
        ui.selectedId = null;
        paintAll();
      } else if ('cardMove' in button.dataset) {
        ui.movingId = ui.selectedId;
        ui.tool = null;
        card.hidden = true;
        paintMode();
      } else if ('cardRemove' in button.dataset) {
        const id = ui.selectedId;
        ui.selectedId = null;
        store.set('mission.hubs', hubs().filter((h) => h.id !== id));
      }
    });
    clearAll.addEventListener('click', () => {
      ui.selectedId = null;
      ui.movingId = null;
      store.set('mission.hubs', []);
      paintMode();
    });

    let timer = 0;
    const unsubscribe = store.subscribe((_state, path) => {
      if (path === 'mission' || path.startsWith('mission.hubs')) paintAll();
      if (path === 'clock' || path.startsWith('clock.')) {
        clearTimeout(timer);
        timer = setTimeout(paintAll, 30);
      }
    });

    paintMode();
    paintAll();

    return () => {
      clearTimeout(timer);
      unsubscribe();
      unmountClock();
      mars.destroy();
    };
  },
};

export default mod;
