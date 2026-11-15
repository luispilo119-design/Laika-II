/**
 * Recorridos reales de Perseverance y Curiosity (public/data/rovers.json, generado por
 * tools/build_rovers.py). Dueño: Parte A. Lo usan el mapa (map) y la primera persona (descent);
 * antes la carga vivía dentro de modules/map/index.js.
 *
 * Forma del archivo: { generated, note, rovers: { perseverance, curiosity } }, y cada rover trae
 * name, mission, sources, firstSol, lastSol, distanceKm, landing [lat, lon], current [lat, lon],
 * paths [[lat, lon]…][] y stops (ver `stopsOf`).
 */

/** @type {import('./types.js').Reference[]} */
export const ROVER_REFERENCES = [
  {
    id: 'nasa-track-perseverance',
    title: 'Perseverance: waypoints y recorrido (mapa "Where is Perseverance?")',
    org: 'NASA/JPL',
    url: 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json',
    verified: true,
  },
  {
    id: 'nasa-track-curiosity',
    title: 'Curiosity: waypoints y recorrido (mapa "Where is Curiosity?")',
    org: 'NASA/JPL',
    url: 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json',
    verified: true,
  },
];

export const ROVER_IDS = ['perseverance', 'curiosity'];

let roversPromise = null;

/** Carga rovers.json una sola vez por sesión; si falla, el siguiente intento vuelve a pedirlo. */
export function loadRovers() {
  roversPromise ??= fetch('./data/rovers.json')
    .then((response) => {
      if (!response.ok) throw new Error(`rovers.json ${response.status}`);
      return response.json();
    })
    .catch((err) => {
      roversPromise = null;
      throw err;
    });
  return roversPromise;
}

/**
 * @typedef {Object} RoverStop  Una parada del rover: dónde quedó al final de un manejo.
 * @property {number} index
 * @property {number} lat
 * @property {number} lon
 * @property {number} sol     Sol en que llegó.
 * @property {number} site    Junto con `drive`, el mismo par que traen las fotos crudas de la NASA.
 * @property {number} drive
 * @property {number} distM   Metros recorridos desde el aterrizaje.
 * @property {number|null} elevM  Elevación sobre el geoide; null = sin dato.
 */

/**
 * Paradas de un rover como objetos, en orden de sol.
 * @param {object} rover  una entrada de `rovers` en rovers.json
 * @returns {RoverStop[]}
 */
export function stopsOf(rover) {
  const fields = rover.stopFields ?? ['lat', 'lon', 'sol', 'site', 'drive', 'distM', 'elevM'];
  return (rover.stops ?? []).map((row, index) => {
    const stop = { index };
    fields.forEach((name, i) => {
      stop[name] = row[i];
    });
    if (!Number.isFinite(stop.elevM)) stop.elevM = null;
    return stop;
  });
}
