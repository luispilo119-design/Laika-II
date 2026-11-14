/**
 * Entorno marciano: única puerta de entrada a los datos ambientales. Dueño: Parte A.
 *
 * ESTADO ACTUAL: IMPLEMENTACIÓN DE RELLENO (env.isMock === true).
 * Los números de abajo NO son datos reales: son funciones suaves inventadas para que los módulos
 * que dependen del entorno (rutas, primera persona, hubs) se puedan construir y probar ya.
 * La tarea A3 reemplaza el interior con rejillas de NASA/USGS SIN cambiar las firmas.
 * Mientras isMock sea true, la interfaz muestra la insignia "Datos simulados".
 *
 * Firmas y unidades: ver types.js y docs/CONTRATOS.md.
 */

const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function mockElevation(lat, lon) {
  return (
    2500 * Math.sin(rad(lon * 2)) * Math.cos(rad(lat * 3)) +
    1500 * Math.sin(rad(lon * 7 + lat * 5)) -
    1200 * Math.sin(rad(lat))
  );
}

function mockSlope(lat, lon) {
  const d = 0.25;
  const dz = Math.hypot(
    mockElevation(lat + d, lon) - mockElevation(lat - d, lon),
    mockElevation(lat, lon + d) - mockElevation(lat, lon - d),
  );
  return clamp(dz / 600, 0, 35);
}

/** Perfiles de evaluación. Los pesos de cada perfil suman 1. A3/A5 los ajusta y los documenta. */
export const PROFILES = {
  habitat: { water: 0.25, temperature: 0.15, energy: 0.15, radiation: 0.15, terrain: 0.15, pressure: 0.05, dust: 0.1 },
  greenhouse: { water: 0.3, temperature: 0.2, energy: 0.25, radiation: 0.05, terrain: 0.1, pressure: 0.05, dust: 0.05 },
  solar: { water: 0, temperature: 0.05, energy: 0.5, radiation: 0, terrain: 0.2, pressure: 0, dust: 0.25 },
  ice_mine: { water: 0.6, temperature: 0.05, energy: 0.1, radiation: 0, terrain: 0.2, pressure: 0, dust: 0.05 },
  landing_pad: { water: 0, temperature: 0.05, energy: 0.05, radiation: 0, terrain: 0.5, pressure: 0.3, dust: 0.1 },
};

export const VERDICT_THRESHOLDS = { viable: 65, marginal: 40 };

export const env = {
  /** true mientras los datos sean de relleno. */
  isMock: true,

  /** Carga las rejillas. Los módulos deben esperar esto antes de muestrear. */
  async ready() {},

  /**
   * @param {number} lat
   * @param {number} lon
   * @param {import('./types.js').Clock} clock
   * @returns {import('./types.js').EnvSample}
   */
  sample(lat, lon, clock) {
    const elevationM = mockElevation(lat, lon);
    const seasonal = 15 * Math.sin(rad(clock.ls)) * Math.sin(rad(lat));
    const mean = -63 + 35 * Math.cos(rad(lat)) - 30 + seasonal;
    const swing = 35 * Math.cos(rad(lat) * 0.8);
    const diurnal = Math.cos(((clock.localHour - 14) / 24) * 2 * Math.PI);
    const dustOpacity = 0.4 + 0.5 * clamp(Math.sin(rad(clock.ls - 180)), 0, 1);
    return {
      elevationM,
      slopeDeg: mockSlope(lat, lon),
      temperatureC: mean + swing * diurnal,
      temperatureMinC: mean - swing,
      temperatureMaxC: mean + swing,
      pressurePa: 610 * Math.exp(-elevationM / 11100),
      iceIndex: Math.abs(lat) > 30 ? clamp((Math.abs(lat) - 30) / 30, 0, 1) : 0,
      radiationMSvDay: clamp(0.67 * (1 + elevationM / 20000), 0.3, 1.2),
      dustOpacity,
      solarWm2: clamp(150 * Math.cos(rad(lat)) * Math.exp(-dustOpacity * 0.5), 0, 200),
      mock: true,
      modeled: [],
    };
  },

  /**
   * @param {number} lat
   * @param {number} lon
   * @param {import('./types.js').Clock} clock
   * @param {keyof typeof PROFILES} [profile]
   * @returns {import('./types.js').Evaluation}
   */
  evaluate(lat, lon, clock, profile = 'habitat') {
    const s = this.sample(lat, lon, clock);
    const weights = PROFILES[profile] ?? PROFILES.habitat;
    const scores = {
      water: s.iceIndex == null ? 0 : s.iceIndex * 100,
      temperature: clamp(((s.temperatureMinC + 120) / 80) * 100, 0, 100),
      energy: clamp((s.solarWm2 / 150) * 100, 0, 100),
      radiation: clamp((1 - (s.radiationMSvDay - 0.3) / 0.9) * 100, 0, 100),
      terrain: clamp((1 - s.slopeDeg / 20) * 100, 0, 100),
      pressure: clamp(((s.pressurePa - 300) / 600) * 100, 0, 100),
      dust: clamp((1 - s.dustOpacity / 1.5) * 100, 0, 100),
    };
    const values = {
      water: [s.iceIndex, ''],
      temperature: [s.temperatureMinC, '°C'],
      energy: [s.solarWm2, 'W/m²'],
      radiation: [s.radiationMSvDay, 'mSv/d'],
      terrain: [s.slopeDeg, '°'],
      pressure: [s.pressurePa, 'Pa'],
      dust: [s.dustOpacity, 'τ'],
    };
    const factors = Object.keys(weights).map((id) => ({
      id,
      score: Math.round(scores[id]),
      weight: weights[id],
      value: values[id][0],
      unit: values[id][1],
      refId: 'mock',
    }));
    const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));
    const verdict =
      score >= VERDICT_THRESHOLDS.viable ? 'viable' : score >= VERDICT_THRESHOLDS.marginal ? 'marginal' : 'not_viable';
    return { score, verdict, factors, mock: true };
  },

  /**
   * Cráteres dentro de un recuadro.
   * @param {import('./types.js').BBox} bbox
   * @param {number} [minDiameterKm]
   * @returns {Promise<{lat: number, lon: number, diameterKm: number}[]>}
   */
  async craters(bbox, minDiameterKm = 10) {
    // Relleno determinista: una malla dispersa de cráteres para poder probar el trazado de rutas.
    const out = [];
    for (let lat = Math.ceil(bbox.south / 4) * 4; lat <= bbox.north; lat += 4) {
      for (let lon = Math.ceil(bbox.west / 4) * 4; lon <= bbox.east; lon += 4) {
        const diameterKm = 5 + (Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453) % 1) * 60;
        if (diameterKm >= minDiameterKm) out.push({ lat: lat + 1.3, lon: lon + 0.7, diameterKm });
      }
    }
    return out;
  },

  /**
   * Rejilla de elevación para rutas y primera persona.
   * @param {import('./types.js').BBox} bbox
   * @param {number} [size] celdas por lado
   * @returns {Promise<import('./types.js').ElevationGrid>}
   */
  async elevationGrid(bbox, size = 64) {
    const data = new Float32Array(size * size);
    for (let row = 0; row < size; row++) {
      const lat = bbox.north - ((bbox.north - bbox.south) * row) / (size - 1);
      for (let col = 0; col < size; col++) {
        const lon = bbox.west + ((bbox.east - bbox.west) * col) / (size - 1);
        data[row * size + col] = mockElevation(lat, lon);
      }
    }
    return { width: size, height: size, data, bbox, mock: true };
  },
};
