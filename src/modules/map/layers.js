/**
 * Registro de capas de datos del mapa. Para agregar una capa: añade una entrada aquí y sus textos
 * en i18n.js bajo `data.<id>` (name, why, low, high). No hace falta tocar index.js.
 *
 * Todas son mosaicos de NASA Mars Trek. `maxNativeZoom` sale del WMTSCapabilities de cada capa y la
 * descripción (`why`) resume el resumen oficial que publica Trek para ese producto
 * (https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=<trekId>), leído el 2026-11-14.
 *
 * Trek no publica la escala numérica de estos mosaicos: las leyendas son relativas (bajo → alto).
 */

const abstractUrl = (trekId) => `https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=${trekId}`;

/** Rampas de color para las leyendas (aproximan los colores del mosaico). */
export const RAMPS = {
  rainbow: 'linear-gradient(90deg, #5b2a9d, #2a4fd8, #19b5c9, #3fc24a, #f2e22b, #f28a1e, #d9261c)',
  gray: 'linear-gradient(90deg, #0a0a0a, #f5f5f5)',
};

/**
 * @typedef {Object} DataLayer
 * @property {string} id
 * @property {string} trekId        "Layer ID" en Mars Trek
 * @property {'png'|'jpg'} ext
 * @property {number} maxNativeZoom
 * @property {number} opacity       opacidad inicial
 * @property {[[number, number], [number, number]]} [bounds]
 * @property {keyof typeof RAMPS | null} ramp  null = leyenda solo de texto
 * @property {boolean} [noData]     true = el mosaico marca en gris las zonas sin datos
 * @property {string} credit        instrumento y artículo de origen, tal como lo cita Trek
 * @property {import('../../core/types.js').Reference} reference
 */

/** @type {DataLayer[]} */
export const DATA_LAYERS = [
  {
    id: 'thermal',
    trekId: 'TES_Thermal_Inertia',
    ext: 'png',
    maxNativeZoom: 1,
    opacity: 0.7,
    ramp: 'rainbow',
    credit: 'MGS TES · Putzig et al. (2005), Icarus 173',
  },
  {
    id: 'dust',
    trekId: 'tes_ruffdust',
    ext: 'png',
    maxNativeZoom: 2,
    opacity: 0.7,
    ramp: 'rainbow',
    noData: true,
    credit: 'MGS TES · Ruff y Christensen (2002), JGR 107',
  },
  {
    id: 'albedo',
    trekId: 'Mars_MGS_TES_Albedo_mosaic_global_7410m',
    ext: 'png',
    maxNativeZoom: 1,
    opacity: 0.7,
    ramp: 'gray',
    credit: 'MGS TES',
  },
  {
    id: 'roughness',
    trekId: 'mola_roughness',
    ext: 'png',
    maxNativeZoom: 1,
    opacity: 0.8,
    ramp: null,
    credit: 'MGS MOLA · Kreslavsky y Head (2000), JGR 105',
  },

].map((layer) => ({
  ...layer,
  reference: {
    id: `trek-${layer.id}`,
    title: `Mars Trek · ${layer.trekId}`,
    org: 'NASA/JPL Mars Trek',
    url: abstractUrl(layer.trekId),
    verified: true,
  },
}));
