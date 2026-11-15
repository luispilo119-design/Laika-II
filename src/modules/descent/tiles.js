/**
 * Fotos desde órbita para cubrir el terreno 3D: qué mosaico usar y qué teselas pedir. Sin DOM ni
 * Three.js, para poder probarlo. Parte B — tarea B5.
 *
 * Todos los mosaicos usan la misma rejilla geográfica (lat/lon, origen en 90° N, 180° O): en el
 * nivel L cada tesela mide 180 / 2^L grados por lado. Mars Trek sirve teselas de 256 px y el
 * servicio de Esri del mosaico CTX global, de 512 px. Los dos responden con CORS abierto
 * (comprobado el 2026-11-15), así que las imágenes se pueden usar como textura WebGL.
 */

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const trek = (label) => `${TREK}/${label}/1.0.0/default/default028mm/{z}/{y}/{x}.png`;
export const trekAbstract = (label) => `https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=${label}`;

/**
 * Mosaicos en orden de preferencia: el primero cuyo recuadro contiene todo el terreno se usa.
 * `controlled`: alineado con control geodésico (las rutas de los rovers caen donde deben). El CTX
 * global es un mosaico preliminar no controlado y puede quedar algo desplazado.
 */
export const IMAGERY = [
  {
    id: 'jezero',
    label: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0',
    url: trek('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'),
    tileSize: 256,
    maxLevel: 13,
    bbox: { west: 77.1604655, south: 18.2110274, east: 77.6991776, north: 18.7211945 },
    controlled: true,
    refId: 'trek-jezero-ctx',
  },
  {
    id: 'gale',
    label: 'Gale_CTX_BlockAdj_dd',
    url: trek('Gale_CTX_BlockAdj_dd'),
    tileSize: 256,
    maxLevel: 13,
    bbox: { west: 135.1842593, south: -6.5732988, east: 139.2413012, north: -2.8077809 },
    controlled: true,
    refId: 'trek-gale-ctx',
  },
  {
    id: 'global',
    label: 'CTX_beta01_uncontrolled_5m_Caltech',
    url: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}',
    tileSize: 512,
    maxLevel: 12,
    bbox: { west: -180, south: -88, east: 180, north: 88 },
    controlled: false,
    refId: 'ctx-beta01',
  },
];

/** @type {import('../../core/types.js').Reference[]} */
export const IMAGERY_REFERENCES = [
  {
    id: 'trek-jezero-ctx',
    title: 'Jezero: mosaico ortorrectificado CTX de 6 m (equipo de Mars 2020)',
    org: 'NASA/JPL Mars Trek',
    url: trekAbstract('JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0'),
    verified: false,
  },
  {
    id: 'trek-gale-ctx',
    title: 'Gale: mosaico CTX con ajuste de bloque',
    org: 'NASA/JPL Mars Trek',
    url: trekAbstract('Gale_CTX_BlockAdj_dd'),
    verified: false,
  },
  {
    id: 'ctx-beta01',
    title: 'CTX global mosaic beta01 (preliminar, no controlado), 5 m por píxel',
    org: 'NASA/JPL/MSSS · Caltech Murray Lab · Esri',
    url: 'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer',
    verified: true,
  },
];

const contains = (outer, inner) =>
  inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;

/** El mosaico que cubre todo el recuadro (si ninguno regional lo cubre, el global). */
export function chooseImagery(bbox) {
  return IMAGERY.find((layer) => contains(layer.bbox, bbox)) ?? IMAGERY[IMAGERY.length - 1];
}

/** Grados por lado de una tesela en el nivel `level`. */
export const tileDeg = (level) => 180 / 2 ** level;

/**
 * Nivel más detallado cuyo mosaico cubre el recuadro sin pasar de `maxPx` píxeles de ancho.
 */
export function pickLevel(bbox, layer, maxPx = 2048) {
  const span = Math.max(bbox.east - bbox.west, bbox.north - bbox.south);
  const level = Math.floor(Math.log2((maxPx * 180) / (layer.tileSize * span)));
  return Math.max(0, Math.min(layer.maxLevel, level));
}

/**
 * Teselas que cubren el recuadro en un nivel, y el recuadro (más grande) que cubren juntas.
 * @returns {{ level: number, col0: number, col1: number, row0: number, row1: number,
 *   cover: import('../../core/types.js').BBox }}
 */
export function tileCover(bbox, level) {
  const deg = tileDeg(level);
  const maxCol = 2 ** (level + 1) - 1;
  const maxRow = 2 ** level - 1;
  const col0 = Math.max(0, Math.floor((bbox.west + 180) / deg));
  const col1 = Math.min(maxCol, Math.floor((bbox.east + 180) / deg - 1e-9));
  const row0 = Math.max(0, Math.floor((90 - bbox.north) / deg));
  const row1 = Math.min(maxRow, Math.floor((90 - bbox.south) / deg - 1e-9));
  return {
    level,
    col0,
    col1,
    row0,
    row1,
    cover: { west: col0 * deg - 180, east: (col1 + 1) * deg - 180, north: 90 - row0 * deg, south: 90 - (row1 + 1) * deg },
  };
}

/** URL de una tesela. */
export function tileUrl(layer, level, row, col) {
  return layer.url.replace('{z}', String(level)).replace('{y}', String(row)).replace('{x}', String(col));
}

/**
 * Coordenadas de textura (u, v) de un punto, dentro del recuadro que cubre la imagen.
 * v = 0 abajo (sur) y 1 arriba (norte), como espera Three.js con flipY.
 */
export function uvOf(cover, lat, lon) {
  return [(lon - cover.west) / (cover.east - cover.west), (lat - cover.south) / (cover.north - cover.south)];
}
