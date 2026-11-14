/**
 * Mapa base de Marte compartido (Leaflet + mosaicos de NASA Mars Trek). Dueño: Parte A.
 * Cualquier módulo que necesite un mapa (sitio de aterrizaje, hubs, rutas) usa createMarsMap()
 * para que todos compartan proyección, mosaicos y atribución.
 *
 * Proyección: equirectangular (EPSG:4326). Leaflet usa [lat, lon] con lon este-positivo.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const WMTS = '1.0.0//default/default028mm/{z}/{y}/{x}';

/** Mosaicos base. La tarea A2 verifica cada URL y agrega las capas de datos. */
export const BASEMAPS = {
  viking: {
    labelKey: 'map.layer.viking',
    url: `${TREK}/Mars_Viking_MDIM21_ClrMosaic_global_232m/${WMTS}.jpg`,
    maxNativeZoom: 7,
    attribution: 'NASA/JPL/USGS · Viking MDIM 2.1 · NASA Mars Trek',
  },
  mola: {
    labelKey: 'map.layer.mola',
    url: `${TREK}/Mars_MGS_MOLA_ClrShade_merge_global_463m/${WMTS}.jpg`,
    maxNativeZoom: 6,
    attribution: 'NASA/JPL/GSFC · MGS MOLA · NASA Mars Trek',
  },
};

/**
 * @param {HTMLElement} container
 * @param {{ basemap?: keyof typeof BASEMAPS, center?: [number, number], zoom?: number }} [opts]
 * @returns {{ map: L.Map, layers: Record<string, L.TileLayer>, setBasemap: (id: string) => void, destroy: () => void }}
 */
export function createMarsMap(container, opts = {}) {
  const { basemap = 'mola', center = [0, 0], zoom = 2 } = opts;
  const map = L.map(container, {
    crs: L.CRS.EPSG4326,
    center,
    zoom,
    minZoom: 1,
    maxZoom: 9,
    maxBounds: [
      [-90, -180],
      [90, 180],
    ],
    maxBoundsViscosity: 1,
    worldCopyJump: false,
    attributionControl: true,
  });

  const layers = {};
  for (const [id, def] of Object.entries(BASEMAPS)) {
    layers[id] = L.tileLayer(def.url, {
      maxNativeZoom: def.maxNativeZoom,
      maxZoom: 9,
      noWrap: true,
      bounds: [
        [-90, -180],
        [90, 180],
      ],
      attribution: def.attribution,
    });
  }

  let current = null;
  function setBasemap(id) {
    if (!layers[id] || id === current) return;
    if (current) map.removeLayer(layers[current]);
    layers[id].addTo(map);
    current = id;
  }
  setBasemap(basemap);

  // Leaflet necesita recalcular el tamaño cuando el contenedor termina de maquetarse.
  const resizeObserver = new ResizeObserver(() => map.invalidateSize());
  resizeObserver.observe(container);

  return {
    map,
    layers,
    setBasemap,
    destroy() {
      resizeObserver.disconnect();
      map.remove();
    },
  };
}
