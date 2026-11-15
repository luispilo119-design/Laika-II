/**
 * Entorno marciano: única puerta de entrada a los datos ambientales. Dueño: Parte A.
 *
 * Datos reales (tarea A3). Cada número sale de una rejilla en public/data/ generada por un script
 * de tools/ (ver tools/README.md) y tiene una referencia en ENV_REFERENCES:
 *
 *   elevación, pendiente   MOLA MEGDR (medición)                          -> elevation.bin, slope.bin
 *   índice de hielo        SWIM4MIM, consistencia de hielo 0-5 m          -> ice.bin
 *   cráteres               Robbins y Hynek (2012), de 5 km o más          -> craters.bin
 *   temperatura, polvo,    Mars Climate Database v6.2 (MODELO)            -> climate.bin
 *   irradiancia, presión
 *   radiación              medición de RAD en Gale ajustada por presión (MODELO, ver radiationFromPressure)
 *
 * Lo que viene de un modelo se lista en `modeled` de cada muestra para que la interfaz lo diga.
 * Firmas y unidades: ver types.js y docs/CONTRACTS.md. Las firmas no cambiaron respecto al relleno.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

/* ---------- Constantes físicas y de modelo (con su fuente) ---------- */

/** Gravedad en superficie y masa molar media de la atmósfera: NASA Mars Fact Sheet (ref. mars-fact-sheet). */
export const MARS_GRAVITY = 3.73; // m/s², gravedad media en superficie
export const MARS_AIR_MOLAR_MASS = 0.04349; // kg/mol
const GAS_CONSTANT = 8.314462618; // J/(mol·K)

/**
 * Radiación en superficie. RAD (Curiosity) midió en el cráter Gale una dosis equivalente de unos
 * 0.7 mSv/día con una presión de referencia de 840 Pa; el cambio estacional de presión entre 700 y
 * 970 Pa la mueve unos 0.1 mSv/día (más presión = más atmósfera encima = menos dosis), y según la
 * actividad solar va de unos 0.35 a 1.15 mSv/día. Guo et al. (2015), ref. guo2015.
 * Aquí se extiende esa relación lineal a la presión de cada lugar: es una extrapolación (modelo).
 */
export const RADIATION_MODEL = {
  doseAtRefMSvDay: 0.7,
  refPressurePa: 840,
  slopeMSvDayPerPa: -0.1 / (970 - 700),
  minMSvDay: 0.35,
  maxMSvDay: 1.15,
};

export function radiationFromPressure(pressurePa) {
  const m = RADIATION_MODEL;
  return clamp(m.doseAtRefMSvDay + m.slopeMSvDayPerPa * (pressurePa - m.refPressurePa), m.minMSvDay, m.maxMSvDay);
}

/** Referencias que respaldan cada dato del entorno. El módulo "map" las publica en la pantalla de Referencias. */
/** @type {import('./types.js').Reference[]} */
export const ENV_REFERENCES = [
  {
    id: 'mola',
    title: 'MGS MOLA Mission Experiment Gridded Data Record (MEGDR), topografía a 16 píxeles por grado',
    org: 'NASA PDS Geosciences Node',
    url: 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/',
    year: 2003,
    verified: true,
  },
  {
    id: 'swim',
    title: 'SWIM4MIM: mapas de consistencia de hielo subterráneo (0–1 m y 1–5 m)',
    org: 'Planetary Science Institute / NASA',
    url: 'https://swim.psi.edu/SWIM4MIMProducts.php',
    year: 2025,
    verified: true,
  },
  {
    id: 'robbins2012',
    title: 'Robbins y Hynek (2012): base global de cráteres de impacto de Marte ≥ 1 km',
    org: 'USGS Astrogeology',
    url: 'https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1',
    year: 2012,
    verified: true,
  },
  {
    id: 'mcd',
    title: 'Mars Climate Database v6.2 — interfaz web (modelo de circulación general)',
    org: 'LMD / OU / IAA / ESA / CNES',
    url: 'https://www-mars.lmd.jussieu.fr/mcd_python/',
    year: 2022,
    verified: true,
  },
  {
    id: 'guo2015',
    title: 'Guo et al. (2015): Modeling the variations of dose rate measured by RAD during the first MSL Martian year',
    org: 'The Astrophysical Journal (equipo de MSL/RAD)',
    url: 'https://arxiv.org/abs/1507.03473',
    year: 2015,
    verified: true,
  },
  {
    id: 'hassler2014',
    title: 'Hassler et al. (2014): Mars’ surface radiation environment measured with MSL’s Curiosity rover',
    org: 'Science',
    url: 'https://doi.org/10.1126/science.1244797',
    year: 2014,
    verified: false,
  },
  {
    id: 'mars-fact-sheet',
    title: 'Mars Fact Sheet (gravedad en superficie y masa molar media de la atmósfera)',
    org: 'NASA NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    verified: true,
  },
];

/** Referencia de cada factor de la evaluación. */
export const FACTOR_REFS = {
  water: 'swim',
  temperature: 'mcd',
  energy: 'mcd',
  radiation: 'guo2015',
  terrain: 'mola',
  pressure: 'mcd',
  dust: 'mcd',
};

/** Campos de EnvSample que salen de un modelo y no de una medición directa. */
export const MODELED_FIELDS = [
  'temperatureC',
  'temperatureMinC',
  'temperatureMaxC',
  'pressurePa',
  'dustOpacity',
  'solarWm2',
  'radiationMSvDay',
];

/** Perfiles de evaluación. Los pesos de cada perfil suman 1. A5 los ajusta y los documenta. */
export const PROFILES = {
  habitat: { water: 0.25, temperature: 0.15, energy: 0.15, radiation: 0.15, terrain: 0.15, pressure: 0.05, dust: 0.1 },
  greenhouse: { water: 0.3, temperature: 0.2, energy: 0.25, radiation: 0.05, terrain: 0.1, pressure: 0.05, dust: 0.05 },
  solar: { water: 0, temperature: 0.05, energy: 0.5, radiation: 0, terrain: 0.2, pressure: 0, dust: 0.25 },
  ice_mine: { water: 0.6, temperature: 0.05, energy: 0.1, radiation: 0, terrain: 0.2, pressure: 0, dust: 0.05 },
  landing_pad: { water: 0, temperature: 0.05, energy: 0.05, radiation: 0, terrain: 0.5, pressure: 0.3, dust: 0.1 },
};

export const VERDICT_THRESHOLDS = { viable: 65, marginal: 40 };

/**
 * Escalas de puntaje: el valor `worst` da 0 puntos, `best` da 100, lineal entre ambos.
 * Son criterios de diseño de la app (no datos de la NASA) y se muestran en la ficha de zona.
 */
export const SCORE_SCALES = {
  water: { field: 'iceIndex', unit: '', worst: 0, best: 1 },
  temperature: { field: 'temperatureMinC', unit: '°C', worst: -120, best: -40 },
  energy: { field: 'solarWm2', unit: 'W/m²', worst: 0, best: 150 },
  radiation: { field: 'radiationMSvDay', unit: 'mSv/d', worst: RADIATION_MODEL.maxMSvDay, best: RADIATION_MODEL.minMSvDay },
  terrain: { field: 'slopeDeg', unit: '°', worst: 15, best: 0 },
  pressure: { field: 'pressurePa', unit: 'Pa', worst: 300, best: 900 },
  dust: { field: 'dustOpacity', unit: 'τ', worst: 1.5, best: 0 },
};

/* ---------- Carga de rejillas ---------- */

const FILES = {
  terrain: 'terrain.json',
  elevation: 'elevation.bin',
  slope: 'slope.bin',
  iceMeta: 'ice.json',
  ice: 'ice.bin',
  climateMeta: 'climate.json',
  climate: 'climate.bin',
};

/** Cómo se lee un archivo de public/data/. Las pruebas lo cambian para leer del disco. */
let loader = async (name) => {
  const response = await fetch(`./data/${name}`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return name.endsWith('.json') ? response.json() : response.arrayBuffer();
};

/** @param {(name: string) => Promise<ArrayBuffer | object>} fn */
export function setDataLoader(fn) {
  loader = fn;
  readyPromise = null;
  cratersPromise = null;
  grids = null;
}

/** @type {null | { elev: any, slope: any, ice: any, clim: any }} */
let grids = null;
let readyPromise = null;
let cratersPromise = null;

async function loadGrids() {
  const names = Object.keys(FILES);
  const loaded = await Promise.all(names.map((key) => loader(FILES[key])));
  const f = Object.fromEntries(names.map((key, i) => [key, loaded[i]]));

  const section = (name, Type) => {
    const s = f.climateMeta.sections[name];
    return new Type(f.climate, s.offset, s.length / Type.BYTES_PER_ELEMENT);
  };
  const g = f.climateMeta.grid;
  grids = {
    elev: { ...f.terrain.elevation, data: new Int16Array(f.elevation) },
    slope: { ...f.terrain.slope, data: new Uint8Array(f.slope) },
    ice: { ...f.iceMeta, data: new Uint8Array(f.ice) },
    clim: {
      nLat: g.nLat,
      nLon: g.nLon,
      latStep: g.latStep,
      lonStep: g.lonStep,
      cells: g.nLat * g.nLon,
      nLs: f.climateMeta.ls.length,
      lsStep: 360 / f.climateMeta.ls.length,
      nHours: f.climateMeta.hours.length,
      hourStep: 24 / f.climateMeta.hours.length,
      temperature: section('temperature', Uint8Array),
      solar: section('solar', Uint16Array),
      pressure: section('pressure', Uint16Array),
      dust: section('dust', Uint16Array),
      orography: section('orography', Int16Array),
    },
  };
}

function need() {
  if (!grids) throw new Error('[env] los datos aún no están cargados: espera a env.ready() antes de muestrear');
  return grids;
}

/* ---------- Interpolación ---------- */

/** Rejillas de celdas (elevación, pendiente, hielo): el valor está en el centro de cada celda. */
function cellBilinear(grid, lat, lon) {
  const { data, nLat, nLon, step } = grid;
  const y = clamp((90 - lat) / step - 0.5, 0, nLat - 1);
  const x = (lon + 180) / step - 0.5;
  const y0 = Math.floor(y);
  const y1 = Math.min(nLat - 1, y0 + 1);
  const x0 = Math.floor(x);
  const fy = y - y0;
  const fx = x - x0;
  const c0 = ((x0 % nLon) + nLon) % nLon;
  const c1 = (c0 + 1) % nLon;
  return (
    (data[y0 * nLon + c0] * (1 - fx) + data[y0 * nLon + c1] * fx) * (1 - fy) +
    (data[y1 * nLon + c0] * (1 - fx) + data[y1 * nLon + c1] * fx) * fy
  );
}

function cellNearest(grid, lat, lon) {
  const { data, nLat, nLon, step } = grid;
  const row = clamp(Math.floor((90 - lat) / step), 0, nLat - 1);
  const col = clamp(Math.floor((lon + 180) / step), 0, nLon - 1);
  return data[row * nLon + col];
}

/** Rejilla del clima: nodos de 90° N a 90° S y de 180° O a 180° E (ambos extremos incluidos). */
function climateWeights(lat, lon) {
  const c = need().clim;
  const y = clamp((90 - lat) / c.latStep, 0, c.nLat - 1);
  const x = clamp((lon + 180) / c.lonStep, 0, c.nLon - 1);
  const y0 = Math.min(c.nLat - 2, Math.floor(y));
  const x0 = Math.min(c.nLon - 2, Math.floor(x));
  const fy = y - y0;
  const fx = x - x0;
  const i = y0 * c.nLon + x0;
  return {
    idx: [i, i + 1, i + c.nLon, i + c.nLon + 1],
    w: [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy],
  };
}

function seasonWeights(ls) {
  const c = need().clim;
  const s = ((((ls % 360) + 360) % 360) / c.lsStep) % c.nLs;
  const s0 = Math.floor(s);
  return { s0, s1: (s0 + 1) % c.nLs, fs: s - s0 };
}

/** Campo por estación [ls, lat, lon] interpolado en espacio y en Ls. */
function seasonalField(array, cw, sw, cells) {
  let a = 0;
  let b = 0;
  for (let k = 0; k < 4; k++) {
    a += array[sw.s0 * cells + cw.idx[k]] * cw.w[k];
    b += array[sw.s1 * cells + cw.idx[k]] * cw.w[k];
  }
  return a * (1 - sw.fs) + b * sw.fs;
}

/** Temperatura del aire (K) en cada hora guardada, interpolada en espacio y en Ls. */
function temperatureByHour(cw, sw) {
  const c = need().clim;
  const out = new Array(c.nHours);
  for (let h = 0; h < c.nHours; h++) {
    let a = 0;
    let b = 0;
    const baseA = (sw.s0 * c.nHours + h) * c.cells;
    const baseB = (sw.s1 * c.nHours + h) * c.cells;
    for (let k = 0; k < 4; k++) {
      a += c.temperature[baseA + cw.idx[k]] * cw.w[k];
      b += c.temperature[baseB + cw.idx[k]] * cw.w[k];
    }
    out[h] = a * (1 - sw.fs) + b * sw.fs + 100;
  }
  return out;
}

function scoreOf(scale, value) {
  return clamp(((value - scale.worst) / (scale.best - scale.worst)) * 100, 0, 100);
}

export const env = {
  /** true mientras los datos sean de relleno. Desde A3 son datos reales. */
  isMock: false,

  /** Carga las rejillas. Los módulos deben esperar esto antes de muestrear. */
  ready() {
    readyPromise ??= loadGrids().catch((err) => {
      readyPromise = null;
      throw err;
    });
    return readyPromise;
  },

  /**
   * @param {number} lat
   * @param {number} lon
   * @param {import('./types.js').Clock} clock
   * @returns {import('./types.js').EnvSample}
   */
  sample(lat, lon, clock) {
    const g = need();
    const c = g.clim;
    lat = clamp(lat, -90, 90);
    lon = wrapLon(lon);

    const elevationM = cellBilinear(g.elev, lat, lon);
    const slopeDeg = cellBilinear(g.slope, lat, lon) / 5;

    const iceRaw = cellNearest(g.ice, lat, lon);
    const iceIndex = iceRaw === 255 ? null : clamp((iceRaw - 100) / 100, 0, 1);

    const cw = climateWeights(lat, lon);
    const sw = seasonWeights(clock?.ls ?? 0);

    const hourly = temperatureByHour(cw, sw);
    const h = ((((clock?.localHour ?? 12) % 24) + 24) % 24) / c.hourStep;
    const h0 = Math.floor(h) % c.nHours;
    const temperatureK = hourly[h0] * (1 - (h - Math.floor(h))) + hourly[(h0 + 1) % c.nHours] * (h - Math.floor(h));
    const minK = Math.min(...hourly);
    const maxK = Math.max(...hourly);
    const meanK = hourly.reduce((sum, v) => sum + v, 0) / hourly.length;

    // Presión: la del modelo en cada nodo, llevada a la elevación MOLA del punto con la ecuación
    // hipsométrica, p = p_nodo · exp(-(z - z_nodo) / H), con H = R·T / (M·g) y T la media del sol.
    const scaleHeightM = (GAS_CONSTANT * meanK) / (MARS_AIR_MOLAR_MASS * MARS_GRAVITY);
    let pressurePa = 0;
    for (let k = 0; k < 4; k++) {
      const i = cw.idx[k];
      const p = c.pressure[sw.s0 * c.cells + i] * (1 - sw.fs) + c.pressure[sw.s1 * c.cells + i] * sw.fs;
      pressurePa += p * Math.exp(-(elevationM - c.orography[i]) / scaleHeightM) * cw.w[k];
    }

    return {
      elevationM,
      slopeDeg,
      temperatureC: temperatureK - 273.15,
      temperatureMinC: minK - 273.15,
      temperatureMaxC: maxK - 273.15,
      pressurePa,
      iceIndex,
      radiationMSvDay: radiationFromPressure(pressurePa),
      dustOpacity: seasonalField(c.dust, cw, sw, c.cells) / 1000,
      solarWm2: seasonalField(c.solar, cw, sw, c.cells) / 10,
      mock: false,
      modeled: MODELED_FIELDS,
    };
  },

  /**
   * Los factores sin dato (por ejemplo hielo fuera de la cobertura de SWIM) quedan con
   * `value: null`, `noData: true` y peso 0; su peso se reparte entre los demás factores.
   * @param {number} lat
   * @param {number} lon
   * @param {import('./types.js').Clock} clock
   * @param {keyof typeof PROFILES} [profile]
   * @returns {import('./types.js').Evaluation}
   */
  evaluate(lat, lon, clock, profile = 'habitat') {
    const s = this.sample(lat, lon, clock);
    const weights = PROFILES[profile] ?? PROFILES.habitat;
    const ids = Object.keys(weights);
    const available = ids.filter((id) => s[SCORE_SCALES[id].field] != null);
    const totalWeight = available.reduce((sum, id) => sum + weights[id], 0);

    const factors = ids.map((id) => {
      const scale = SCORE_SCALES[id];
      const value = s[scale.field];
      const noData = value == null;
      return {
        id,
        score: noData ? 0 : Math.round(scoreOf(scale, value)),
        weight: noData || totalWeight === 0 ? 0 : weights[id] / totalWeight,
        value,
        unit: scale.unit,
        refId: FACTOR_REFS[id],
        noData,
        modeled: MODELED_FIELDS.includes(scale.field),
      };
    });
    const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
    const verdict =
      score >= VERDICT_THRESHOLDS.viable ? 'viable' : score >= VERDICT_THRESHOLDS.marginal ? 'marginal' : 'not_viable';
    return { score, verdict, factors, mock: false };
  },

  /**
   * Cráteres dentro de un recuadro (base de Robbins y Hynek; solo hay de 5 km o más).
   * @param {import('./types.js').BBox} bbox
   * @param {number} [minDiameterKm]
   * @returns {Promise<{lat: number, lon: number, diameterKm: number}[]>} de mayor a menor
   */
  async craters(bbox, minDiameterKm = 10) {
    cratersPromise ??= loader('craters.bin').catch((err) => {
      cratersPromise = null;
      throw err;
    });
    const view = new DataView(await cratersPromise);
    const out = [];
    for (let offset = 0; offset + 6 <= view.byteLength; offset += 6) {
      const diameterKm = view.getUint16(offset + 4, true) / 10;
      if (diameterKm < minDiameterKm) break; // el archivo va de mayor a menor
      const lat = view.getInt16(offset, true) / 100;
      const lon = view.getInt16(offset + 2, true) / 100;
      if (lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east) {
        out.push({ lat, lon, diameterKm });
      }
    }
    return out;
  },

  /**
   * Rejilla de elevación para rutas y primera persona. La fuente tiene 0.25° por celda (unos 15 km
   * en el ecuador): un recuadro más pequeño que eso sale interpolado, sin detalle nuevo.
   * @param {import('./types.js').BBox} bbox
   * @param {number} [size] celdas por lado
   * @returns {Promise<import('./types.js').ElevationGrid>}
   */
  async elevationGrid(bbox, size = 64) {
    await this.ready();
    const g = need();
    const data = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
      const lat = clamp(bbox.north - ((bbox.north - bbox.south) * row) / (size - 1), -90, 90);
      for (let col = 0; col < size; col++) {
        const lon = wrapLon(bbox.west + ((bbox.east - bbox.west) * col) / (size - 1));
        data[row * size + col] = cellBilinear(g.elev, lat, lon);
      }
    }
    return { width: size, height: size, data, bbox, mock: false };
  },
};
