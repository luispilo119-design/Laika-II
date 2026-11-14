/**
 * Geometría del terreno, sol y polvo para la primera persona (sin Three.js ni DOM, para
 * poder probarlo). Parte B — tarea B5.
 *
 * Ejes de la escena (los de Three.js): x = este, y = arriba, z = sur. 1 unidad = 1 metro.
 */

// Radio medio volumétrico de Marte, km. Ref: nssdca-mars-fact.
export const MARS_RADIUS_KM = 3389.5;
const M_PER_DEG = ((Math.PI * MARS_RADIUS_KM) / 180) * 1000;
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const AREA_M = 6000; // lado del terreno que se recorre
export const GRID = 128; // celdas por lado que se piden a env.elevationGrid
export const EYE_M = 1.7; // altura de los ojos sobre el suelo
export const START_ALTITUDE_M = 2600; // altura de la cámara antes de bajar

/** Recuadro (en grados) de un cuadrado de `areaM` metros de lado centrado en el sitio. */
export function areaBBox(site, areaM = AREA_M) {
  const dLat = areaM / 2 / M_PER_DEG;
  const dLon = areaM / 2 / (M_PER_DEG * Math.max(0.05, Math.cos(rad(site.lat))));
  return { south: site.lat - dLat, north: site.lat + dLat, west: site.lon - dLon, east: site.lon + dLon };
}

/** Latitud y longitud de un punto de la escena. */
export function toLatLon(site, x, z) {
  const lat = site.lat - z / M_PER_DEG;
  return { lat, lon: site.lon + x / (M_PER_DEG * Math.max(0.05, Math.cos(rad(site.lat)))) };
}

/**
 * Relieve fino decorativo, en metros (±0.6). NO es un dato: la rejilla de elevación no ve
 * detalles de este tamaño, y sin ellos el suelo sería un plano liso. La pantalla lo avisa.
 */
export function microRelief(x, z) {
  return (
    0.35 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 - 0.7) +
    0.18 * Math.sin(x * 0.11 - z * 0.09 + 2.1) +
    0.07 * Math.sin(x * 0.31 + 0.4) * Math.sin(z * 0.27 + 1.9)
  );
}

/**
 * Campo de alturas listo para dibujar y para saber dónde pisa la persona.
 * @param {import('../../core/types.js').ElevationGrid} elevation  fila 0 = norte, columna 0 = oeste
 */
export function makeHeightField(elevation, areaM = AREA_M) {
  const { width, height, data } = elevation;
  const at = (row, col) => data[row * width + col];
  const sample = (x, z) => {
    const col = clamp(((x + areaM / 2) / areaM) * (width - 1), 0, width - 1);
    const row = clamp(((z + areaM / 2) / areaM) * (height - 1), 0, height - 1);
    const c0 = Math.min(width - 2, Math.floor(col));
    const r0 = Math.min(height - 2, Math.floor(row));
    const fc = col - c0;
    const fr = row - r0;
    return (
      at(r0, c0) * (1 - fr) * (1 - fc) + at(r0, c0 + 1) * (1 - fr) * fc + at(r0 + 1, c0) * fr * (1 - fc) + at(r0 + 1, c0 + 1) * fr * fc
    );
  };
  const base = sample(0, 0); // elevación real del sitio: en la escena queda en y = 0
  return {
    width,
    height,
    areaM,
    base,
    /** Altura del suelo en la escena (0 en el sitio), con el relieve fino decorativo. */
    heightAt: (x, z) => sample(x, z) - base + microRelief(x, z),
    /** Elevación real del terreno según la rejilla, en metros sobre el areoide. */
    elevationAt: (x, z) => sample(x, z),
    /** Mantiene a la persona dentro del terreno. */
    clampToArea: (v) => clamp(v, -areaM / 2 + 40, areaM / 2 - 40),
  };
}

/**
 * Posición aproximada del Sol según la hora solar local: sale por el este a las 6, culmina a
 * las 12 y se pone por el oeste a las 18. Es una aproximación: no usa la latitud ni la estación.
 * @returns {{ dir: [number, number, number], daylight: number }}  dir = vector unitario hacia el Sol;
 *   daylight = 0 de noche … 1 de día
 */
export function sunState(hour) {
  const angle = ((hour - 6) / 12) * Math.PI;
  const v = [Math.cos(angle), Math.sin(angle), 0.22];
  const len = Math.hypot(...v);
  const dir = [v[0] / len, v[1] / len, v[2] / len];
  const t = clamp((dir[1] + 0.12) / 0.4, 0, 1); // el crepúsculo empieza un poco antes de que salga el Sol
  return { dir, daylight: t * t * (3 - 2 * t) };
}

/** Densidad de la niebla de polvo a partir de la opacidad óptica τ (más polvo, se ve menos lejos). */
export function dustFogDensity(tau) {
  return 0.00012 + 0.0003 * clamp(tau, 0, 3);
}

/** Avance suave 0→1 para la secuencia de bajada. */
export function easeInOut(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}
