/**
 * Rutas reales de los rovers dentro de «En sitio»: centro del terreno, paradas en metros locales,
 * qué fotos corresponden a cada parada y la repetición del recorrido. Sin DOM ni Three.js, para
 * poder probarlo. Parte B — tarea B5. Los datos vienen de core/rovers.js (rovers.json).
 */
import { toLocal } from './terrain.js';

/** Centro del recuadro que ocupa el recorrido completo de un rover. */
export function routeCenter(rover) {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const path of rover.paths) {
    for (const [lat, lon] of path) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lon);
      east = Math.max(east, lon);
    }
  }
  return { lat: (south + north) / 2, lon: (west + east) / 2, bbox: { south, north, west, east } };
}

/** Los tramos del recorrido en metros de la escena: [[x, z]…][]. */
export function localPaths(rover, site) {
  return rover.paths.map((path) => path.map(([lat, lon]) => {
    const p = toLocal(site, lat, lon);
    return [p.x, p.z];
  }));
}

/** Las paradas con su posición en la escena (x, z) añadida. */
export function localStops(stops, site) {
  return stops.map((stop) => ({ ...stop, ...toLocal(site, stop.lat, stop.lon) }));
}

/** La última parada con sol ≤ `sol` (búsqueda binaria; las paradas van en orden de sol). */
export function stopAtSol(stops, sol) {
  let lo = 0;
  let hi = stops.length - 1;
  if (!stops.length || sol < stops[0].sol) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (stops[mid].sol <= sol) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** La parada más cercana a (x, z), si está a menos de `maxDist` metros; si no, -1. */
export function nearestStop(stops, x, z, maxDist) {
  let best = -1;
  let bestD = maxDist;
  stops.forEach((stop, i) => {
    const d = Math.hypot(stop.x - x, stop.z - z);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export const MAX_PHOTO_SOLS = 4;

/**
 * Soles cuyas fotos pueden haberse tomado en la parada `index`.
 *
 * El rover llega a la parada en su sol y se va en el sol de la siguiente parada. Con Perseverance
 * cada foto trae `site` y `drive`, así que se piden los soles [llegada … salida] y luego se filtran
 * por ese par: la ubicación es exacta. Las fotos de Curiosity no traen ese par: se toman las de los
 * soles [llegada … salida − 1] y la ubicación es aproximada (si en un sol hubo varios manejos, las
 * fotos de ese sol quedan en la última parada del sol).
 * @returns {{ sols: number[], exact: boolean, truncated: boolean }}
 */
export function photoSols(stops, index, exactPairs) {
  const stop = stops[index];
  const next = stops[index + 1];
  if (!stop) return { sols: [], exact: false, truncated: false };
  if (!exactPairs && next && next.sol === stop.sol) return { sols: [], exact: false, truncated: false };
  const until = next ? (exactPairs ? next.sol : Math.max(stop.sol, next.sol - 1)) : stop.sol;
  const sols = [];
  for (let sol = stop.sol; sol <= until && sols.length < MAX_PHOTO_SOLS; sol++) sols.push(sol);
  return { sols, exact: exactPairs, truncated: until - stop.sol + 1 > sols.length };
}

/**
 * Posición a lo largo del recorrido a `distM` metros del aterrizaje, interpolando entre paradas.
 * @returns {{ x: number, z: number, index: number }}  index = última parada ya pasada
 */
export function pointAtDistance(stops, distM) {
  if (!stops.length) return { x: 0, z: 0, index: 0 };
  if (distM <= stops[0].distM) return { x: stops[0].x, z: stops[0].z, index: 0 };
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (distM <= b.distM) {
      const f = b.distM > a.distM ? (distM - a.distM) / (b.distM - a.distM) : 1;
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, index: i - 1 };
    }
  }
  const last = stops[stops.length - 1];
  return { x: last.x, z: last.z, index: stops.length - 1 };
}

/** Puntos del perfil de elevación medido por el rover: [km recorridos, m]; omite paradas sin dato. */
export function elevationProfile(stops) {
  return stops.filter((s) => s.elevM !== null).map((s) => [s.distM / 1000, s.elevM]);
}
