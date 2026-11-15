/**
 * Buscador de lugares de «En sitio»: sitios de aterrizaje de la NASA, sus regiones, el sitio y los
 * hubs de la misión, las rutas de los rovers, paradas por sol ("sol 500") y coordenadas escritas.
 * Sin DOM, para poder probarlo. Parte B — tarea B5.
 */
import { stopAtSol } from './traverse.js';

/** Minúsculas y sin acentos, para comparar. */
export const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Coordenadas escritas a mano: "18.4, 77.4", "18.4 77.4", "18.4N 77.4E", "4.6 S, 137.4 E",
 * "-4.6 137.4" o "22.5°N 312°E" (longitudes de 0 a 360 se pasan a −180..180).
 * @returns {{ lat: number, lon: number } | null}
 */
export function parseCoords(text) {
  const s = String(text ?? '')
    .toUpperCase()
    .replace(/°/g, ' ')
    .replace(/,/g, ' ')
    .trim();
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*([NS])?\s+([+-]?\d+(?:\.\d+)?)\s*([EOW])?$/);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2] === 'S') lat = -Math.abs(lat);
  if (m[4] === 'W' || m[4] === 'O') lon = -Math.abs(lon);
  if (lon > 180 && lon <= 360) lon -= 360;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * Lugares que se pueden buscar.
 * @param {{ sites: { id: string, name: string, lat: number, lon: number, region: string|null }[],
 *   landing?: { lat: number, lon: number, name?: string } | null,
 *   hubs?: { lat: number, lon: number, label: string }[],
 *   routes?: { id: string, name: string, lat: number, lon: number }[] }} sources
 * @returns {{ kind: string, label: string, lat: number, lon: number, rover?: string, keys: string }[]}
 */
export function buildIndex({ sites, landing = null, hubs = [], routes = [] }) {
  const index = [];
  if (landing) index.push({ kind: 'mine', label: landing.name || '', lat: landing.lat, lon: landing.lon, keys: fold(landing.name) });
  for (const h of hubs) index.push({ kind: 'hub', label: h.label, lat: h.lat, lon: h.lon, keys: fold(h.label) });
  for (const r of routes) index.push({ kind: 'route', label: r.name, lat: r.lat, lon: r.lon, rover: r.id, keys: fold(`${r.name} ${r.id}`) });
  const regions = new Set();
  for (const s of sites) {
    index.push({ kind: 'site', label: s.name, sub: s.region, lat: s.lat, lon: s.lon, keys: fold(`${s.name} ${s.region ?? ''}`) });
    if (s.region && !regions.has(s.region)) {
      regions.add(s.region);
      index.push({ kind: 'region', label: s.region, sub: s.name, lat: s.lat, lon: s.lon, keys: fold(s.region) });
    }
  }
  return index;
}

/**
 * Busca en el índice. "sol 500" (con o sin nombre de rover) devuelve la parada de cada rover en ese
 * sol; unas coordenadas devuelven ese punto.
 * @param {ReturnType<typeof buildIndex>} index
 * @param {string} query
 * @param {{ stopsByRover?: Record<string, import('../../core/rovers.js').RoverStop[]>, limit?: number }} [opts]
 */
export function searchPlaces(index, query, { stopsByRover = {}, limit = 12 } = {}) {
  const q = fold(query);
  if (!q) return index.filter((e) => e.kind === 'mine' || e.kind === 'route' || e.kind === 'site').slice(0, limit);
  const results = [];
  const coords = parseCoords(query);
  if (coords) results.push({ kind: 'coords', label: '', ...coords });
  const sol = q.match(/\bsol\s*(\d{1,5})\b/);
  if (sol) {
    const wanted = Number(sol[1]);
    for (const [rover, stops] of Object.entries(stopsByRover)) {
      if (!stops?.length || (q.includes('perse') && rover !== 'perseverance') || (q.includes('curi') && rover !== 'curiosity')) continue;
      const i = stopAtSol(stops, wanted);
      results.push({ kind: 'stop', label: rover, rover, stopIndex: i, sol: stops[i].sol, lat: stops[i].lat, lon: stops[i].lon });
    }
  }
  const scored = [];
  for (const entry of index) {
    if (!entry.keys) continue;
    const at = entry.keys.indexOf(q);
    if (at < 0) continue;
    const wordStart = at === 0 || entry.keys[at - 1] === ' ';
    scored.push({ entry, score: (at === 0 ? 0 : wordStart ? 1 : 2) + (entry.kind === 'region' ? 0.5 : 0) });
  }
  scored.sort((a, b) => a.score - b.score);
  for (const { entry } of scored) results.push(entry);
  return results.slice(0, limit);
}
