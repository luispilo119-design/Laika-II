/**
 * Geometría del terreno, sol y polvo para la primera persona (sin Three.js ni DOM, para
 * poder probarlo). Parte B — tarea B5.
 *
 * Ejes de la escena (los de Three.js): x = este, y = arriba, z = sur. 1 unidad = 1 metro.
 */

import { KM_PER_DEG } from '../../core/geo.js';

const M_PER_DEG = KM_PER_DEG * 1000;
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const AREA_M = 16000; // lado del terreno que se recorre (cabe la ruta completa de un rover)
export const GRID = 128; // celdas por lado que se piden a env.elevationGrid
export const MESH_SEGMENTS = 400; // segmentos por lado de la malla: un vértice cada 40 m
export const EYE_M = 1.7; // altura de los ojos sobre el suelo
export const EDGE_M = 40; // margen que no se pisa en el borde del terreno

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

/** Punto de la escena (metros) de una latitud y longitud: lo inverso de `toLatLon`. */
export function toLocal(site, lat, lon) {
  let dLon = lon - site.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  return { x: dLon * M_PER_DEG * Math.max(0.05, Math.cos(rad(site.lat))), z: (site.lat - lat) * M_PER_DEG };
}

/** ¿El punto (x, z) cae dentro del terreno, dejando `margin` metros de borde? */
export function insideArea(x, z, margin = EDGE_M, areaM = AREA_M) {
  const half = areaM / 2 - margin;
  return Math.abs(x) <= half && Math.abs(z) <= half;
}

/**
 * Alturas de los vértices de la malla del terreno. La persona y los vehículos pisan esta misma
 * superficie (`gridHeightAt`), no la función original: así nunca se hunden ni flotan sobre la malla.
 * @param {(x: number, z: number) => number} heightAt
 * @returns {{ n: number, areaM: number, step: number, heights: Float32Array }}
 */
export function makeTerrainGrid(heightAt, segments = MESH_SEGMENTS, areaM = AREA_M) {
  const n = segments;
  const step = areaM / n;
  const heights = new Float32Array((n + 1) * (n + 1));
  for (let iy = 0; iy <= n; iy++) {
    const z = -areaM / 2 + iy * step;
    for (let ix = 0; ix <= n; ix++) heights[iy * (n + 1) + ix] = heightAt(-areaM / 2 + ix * step, z);
  }
  return { n, areaM, step, heights };
}

/**
 * Altura de la malla en (x, z), con los mismos dos triángulos por celda que PlaneGeometry de
 * Three.js (diagonal del vértice suroeste al noreste de cada celda).
 */
export function gridHeightAt(grid, x, z) {
  const { n, areaM, step, heights } = grid;
  const gx = clamp((x + areaM / 2) / step, 0, n);
  const gz = clamp((z + areaM / 2) / step, 0, n);
  const ix = Math.min(n - 1, Math.floor(gx));
  const iy = Math.min(n - 1, Math.floor(gz));
  const u = gx - ix;
  const v = gz - iy;
  const row = n + 1;
  const ha = heights[iy * row + ix]; // noroeste
  const hb = heights[(iy + 1) * row + ix]; // suroeste
  const hc = heights[(iy + 1) * row + ix + 1]; // sureste
  const hd = heights[iy * row + ix + 1]; // noreste
  if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
  return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
}

/**
 * Dónde choca con el suelo un rayo que sale de `origin` en la dirección `dir` (normalizada).
 * Avanza a pasos y afina por bisección. null = no toca el terreno antes de `maxDist`.
 * @returns {{ x: number, y: number, z: number, dist: number } | null}
 */
export function rayGround(origin, dir, heightAt, maxDist = 60000, areaM = AREA_M) {
  const at = (t) => [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
  const above = (p) => p[1] - heightAt(p[0], p[2]);
  let prev = 0;
  if (above(at(0)) <= 0) return null;
  const stepM = Math.max(5, Math.min(200, above(at(0)) / 20));
  for (let t = stepM; t <= maxDist; t += stepM) {
    const p = at(t);
    if (Math.abs(p[0]) > areaM || Math.abs(p[2]) > areaM) break; // ya salió del terreno
    if (above(p) <= 0) {
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (above(at(mid)) > 0) lo = mid;
        else hi = mid;
      }
      const q = at(hi);
      return { x: q[0], y: q[1], z: q[2], dist: hi };
    }
    prev = t;
  }
  return null;
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
    clampToArea: (v) => clamp(v, -areaM / 2 + EDGE_M, areaM / 2 - EDGE_M),
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

/**
 * Densidad de la niebla de polvo a partir de la opacidad óptica τ (más polvo, se ve menos lejos).
 * Desde lo alto la niebla se adelgaza (`altitudeM` sobre el suelo), para ver el terreno completo:
 * es un ajuste de la vista, no un modelo de la atmósfera.
 */
export function dustFogDensity(tau, altitudeM = 0) {
  const ground = 0.00012 + 0.0003 * clamp(tau, 0, 3);
  return ground / (1 + Math.max(0, altitudeM) / 600);
}

/** Avance suave 0→1 para la secuencia de bajada. */
export function easeInOut(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}
