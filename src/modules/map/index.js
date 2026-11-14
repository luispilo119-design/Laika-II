/**
 * Módulo "map": mapa con capas y elección del sitio de aterrizaje.
 * Dueño: Parte A — tareas A2 (capas), A3 (datos y reloj) y A4 (ficha de zona).
 * Estado actual: solo el mapa base con dos mosaicos de Mars Trek.
 */
import L from 'leaflet';
import messages from './i18n.js';
import { createMarsMap, BASEMAPS } from '../../core/marsmap.js';

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'map',
  phase: 1,
  owner: 'A',
  task: 'A2',
  messages,
  references: [
    {
      id: 'trek',
      title: 'Mars Trek',
      org: 'NASA/JPL',
      url: 'https://trek.nasa.gov/mars/',
      verified: false,
    },
  ],
  mount(el, ctx) {
    const { t } = ctx;
    el.innerHTML = `
      <div class="mapview">
        <div class="mapview__bar">
          <div class="mapview__layers" role="group"></div>
          <p class="mapview__hint">${t('map.hint')}</p>
        </div>
        <div class="mapview__map"></div>
      </div>
    `;
    const mars = createMarsMap(el.querySelector('.mapview__map'), { basemap: 'mola' });

    const layerBox = el.querySelector('.mapview__layers');
    const buttons = {};
    for (const id of Object.keys(BASEMAPS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--ghost';
      btn.textContent = t(BASEMAPS[id].labelKey);
      btn.addEventListener('click', () => select(id));
      buttons[id] = btn;
      layerBox.append(btn);
    }
    function select(id) {
      mars.setBasemap(id);
      for (const [key, btn] of Object.entries(buttons)) btn.classList.toggle('is-active', key === id);
    }
    select('mola');

    mars.map.on('click', (e) => {
      L.popup()
        .setLatLng(e.latlng)
        .setContent(t('map.coords', { lat: e.latlng.lat.toFixed(2), lon: e.latlng.lng.toFixed(2) }))
        .openOn(mars.map);
    });

    return () => mars.destroy();
  },
};

export default mod;
