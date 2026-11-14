/**
 * Capas del mapa que se pintan con los datos de `ctx.env` (tarea A3), a diferencia de las de
 * layers.js, que son mosaicos ya coloreados de Mars Trek. Aquí sí hay escala numérica.
 *
 * Para agregar una capa: añade una entrada a ENV_LAYERS y sus textos en i18n.js bajo `env.<id>`
 * (name, why). `value(sample)` devuelve el número a pintar o null si no hay dato.
 */
import L from 'leaflet';

const WORLD = [
  [-90, -180],
  [90, 180],
];

/** Rampas: lista de [posición 0..1, [r, g, b]]. */
const RAMPS = {
  thermal: [
    [0, [38, 18, 90]],
    [0.25, [36, 84, 200]],
    [0.5, [40, 180, 190]],
    [0.7, [240, 220, 70]],
    [0.85, [240, 130, 40]],
    [1, [200, 40, 30]],
  ],
  ice: [
    [0, [70, 40, 30]],
    [0.5, [80, 140, 190]],
    [1, [235, 250, 255]],
  ],
  dose: [
    [0, [60, 160, 90]],
    [0.5, [235, 200, 70]],
    [1, [215, 60, 50]],
  ],
};

function colorAt(ramp, f) {
  const stops = RAMPS[ramp];
  const x = Math.min(1, Math.max(0, f));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const k = (x - p0) / (p1 - p0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}

export function rampCss(ramp) {
  return `linear-gradient(90deg, ${RAMPS[ramp].map(([p, c]) => `rgb(${c.join(',')}) ${p * 100}%`).join(', ')})`;
}

/**
 * @typedef {Object} EnvLayer
 * @property {string} id
 * @property {keyof typeof RAMPS} ramp
 * @property {number} min        valor del extremo izquierdo de la escala
 * @property {number} max        valor del extremo derecho
 * @property {string} unit
 * @property {number} digits     decimales de la leyenda
 * @property {number} cellDeg    tamaño de celda al pintar, en grados
 * @property {number} opacity
 * @property {boolean} clock     true = cambia con el reloj marciano
 * @property {boolean} modeled   true = sale de un modelo, no de una medición
 * @property {boolean} [noData]  true = puede haber zonas sin datos (se dejan transparentes)
 * @property {string} refId      id en ENV_REFERENCES (src/core/env.js)
 * @property {(s: import('../../core/types.js').EnvSample) => number | null} value
 */

/** @type {EnvLayer[]} */
export const ENV_LAYERS = [
  {
    id: 'temperature',
    ramp: 'thermal',
    min: -130,
    max: 20,
    unit: '°C',
    digits: 0,
    cellDeg: 2,
    opacity: 0.75,
    clock: true,
    modeled: true,
    refId: 'mcd',
    value: (s) => s.temperatureC,
  },
  {
    id: 'ice',
    ramp: 'ice',
    min: 0,
    max: 1,
    unit: '',
    digits: 1,
    cellDeg: 1,
    opacity: 0.8,
    clock: false,
    modeled: false,
    noData: true,
    refId: 'swim',
    value: (s) => s.iceIndex,
  },
  {
    id: 'radiation',
    ramp: 'dose',
    min: 0.35,
    max: 1.15,
    unit: 'mSv/d',
    digits: 2,
    cellDeg: 2,
    opacity: 0.75,
    clock: true,
    modeled: true,
    refId: 'guo2015',
    value: (s) => s.radiationMSvDay,
  },
];

/**
 * Crea la capa de imagen de una EnvLayer. `redraw(clock)` la vuelve a pintar.
 * @param {EnvLayer} def
 * @param {import('../../core/types.js').Ctx['env']} env
 */
export function createEnvOverlay(def, env, opacity) {
  const width = Math.round(360 / def.cellDeg);
  const height = Math.round(180 / def.cellDeg);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const image = g.createImageData(width, height);
  const overlay = L.imageOverlay(canvas.toDataURL(), WORLD, { opacity, interactive: false, zIndex: 20 });

  function redraw(clock) {
    const px = image.data;
    for (let row = 0; row < height; row++) {
      const lat = 90 - (row + 0.5) * def.cellDeg;
      for (let col = 0; col < width; col++) {
        const lon = -180 + (col + 0.5) * def.cellDeg;
        const v = def.value(env.sample(lat, lon, clock));
        const i = (row * width + col) * 4;
        if (v == null) {
          px[i + 3] = 0;
          continue;
        }
        const [r, gg, b] = colorAt(def.ramp, (v - def.min) / (def.max - def.min));
        px[i] = r;
        px[i + 1] = gg;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    }
    g.putImageData(image, 0, 0);
    overlay.setUrl(canvas.toDataURL());
  }

  return { overlay, redraw };
}

/** Diámetro mínimo de cráter que se dibuja según el zoom, para no saturar el mapa. */
export function craterMinDiameterKm(zoom) {
  if (zoom <= 2) return 150;
  if (zoom === 3) return 80;
  if (zoom === 4) return 40;
  if (zoom === 5) return 20;
  if (zoom === 6) return 10;
  return 5;
}

/** Kilómetros por grado de latitud en Marte (radio medio 3389.5 km, NASA Mars Fact Sheet). */
export const KM_PER_DEG = (Math.PI * 3389.5) / 180;
