/**
 * Mapa base de Marte compartido (Leaflet + mosaicos de NASA Mars Trek). Dueño: Parte A.
 * Cualquier módulo que necesite un mapa (sitio de aterrizaje, hubs, rutas) usa createMarsMap()
 * para que todos compartan proyección, mosaicos y atribución.
 *
 * Proyección: equirectangular (EPSG:4326). Leaflet usa [lat, lon] con lon este-positivo.
 * Catálogo de capas de Mars Trek: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const WMTS = '1.0.0//default/default028mm/{z}/{y}/{x}';
const WORLD = [
  [-90, -180],
  [90, 180],
];
export const MAX_ZOOM = 10; // un nivel por encima del mosaico más detallado (THEMIS, nivel 9)

/** URL de mosaicos WMTS de una capa de Mars Trek. `ext` es 'jpg' o 'png' según la capa. */
export function trekTileUrl(trekId, ext = 'png') {
  return `${TREK}/${trekId}/${WMTS}.${ext}`;
}

/**
 * Capa de mosaicos de Mars Trek lista para añadir a un mapa creado con createMarsMap().
 * @param {string} trekId  "Layer ID" del catálogo de Mars Trek
 * @param {{ ext?: 'jpg'|'png', maxNativeZoom?: number, opacity?: number, bounds?: [[number, number], [number, number]], attribution?: string, zIndex?: number }} [opts]
 */
export function trekLayer(trekId, opts = {}) {
  const { ext = 'png', maxNativeZoom = 7, opacity = 1, bounds = WORLD, attribution = 'NASA Mars Trek', zIndex = 1 } = opts;
  return L.tileLayer(trekTileUrl(trekId, ext), {
    maxNativeZoom,
    maxZoom: MAX_ZOOM,
    noWrap: true,
    bounds,
    opacity,
    attribution,
    zIndex,
  });
}

/**
 * Mosaicos base. `maxNativeZoom` sale del WMTSCapabilities de cada capa (comprobado 2026-11-14).
 * labelKey apunta a los textos del módulo "map".
 */
export const BASEMAPS = {
  mola: {
    labelKey: 'map.layer.mola',
    trekId: 'Mars_MGS_MOLA_ClrShade_merge_global_463m',
    ext: 'jpg',
    maxNativeZoom: 7,
    attribution: 'NASA/JPL/GSFC · MGS MOLA · NASA Mars Trek',
  },
  viking: {
    labelKey: 'map.layer.viking',
    trekId: 'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    ext: 'jpg',
    maxNativeZoom: 7,
    attribution: 'NASA/JPL/USGS · Viking MDIM 2.1 · NASA Mars Trek',
  },
  hrsc: {
    labelKey: 'map.layer.hrsc',
    trekId: 'Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw',
    ext: 'jpg',
    maxNativeZoom: 8,
    attribution: 'NASA MGS MOLA · ESA Mars Express HRSC · USGS · NASA Mars Trek',
  },
  themis: {
    labelKey: 'map.layer.themis',
    trekId: 'THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018',
    ext: 'png',
    maxNativeZoom: 9,
    bounds: [
      [-65, -180],
      [65, 180],
    ],
    attribution: 'NASA/JPL/ASU · Mars Odyssey THEMIS · NASA Mars Trek',
  },
};
for (const def of Object.values(BASEMAPS)) def.url = trekTileUrl(def.trekId, def.ext);

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
    maxZoom: MAX_ZOOM,
    maxBounds: WORLD,
    maxBoundsViscosity: 1,
    worldCopyJump: false,
    attributionControl: true,
  });

  const layers = {};
  for (const [id, def] of Object.entries(BASEMAPS)) {
    layers[id] = trekLayer(def.trekId, { ...def, zIndex: 1 });
  }

  let current = null;
  function setBasemap(id) {
    if (!layers[id] || id === current) return;
    if (current) map.removeLayer(layers[current]);
    layers[id].addTo(map);
    current = id;
  }
  setBasemap(layers[basemap] ? basemap : 'mola');

  // Leaflet necesita recalcular el tamaño cuando el contenedor termina de maquetarse.
  const resizeObserver = new ResizeObserver(() => map.invalidateSize());
  resizeObserver.observe(container);

  return {
    map,
    layers,
    setBasemap,
    destroy() {
      resizeObserver.disconnect();
      map.off(); // sin esto, los eventos que dispara remove() llegan a listeners de un mapa ya desmontado
      map.remove();
    },
  };
}
