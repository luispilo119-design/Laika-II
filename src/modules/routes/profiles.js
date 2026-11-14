/**
 * Perfiles de vehículo y fuentes del módulo "routes". Parte B — tarea B4.
 *
 * Qué está respaldado y qué es supuesto:
 *  - Las velocidades del rover presurizado y del rover ligero salen de fuentes de la NASA.
 *  - La velocidad a pie, las pendientes máximas y el tamaño de cráter que se evita son
 *    SUPUESTOS DEL EQUIPO: no encontramos una fuente que los fije. La interfaz lo dice.
 * Las claves coinciden con `Route.profile` en src/core/types.js.
 */

/** @type {import('../../core/types.js').Reference[]} */
export const REFERENCES = [
  {
    // "drive about 10 kilometers per hour in any direction"; dos astronautas hasta 14 días.
    id: 'nasa-sev',
    title: 'Space Exploration Vehicle',
    org: 'NASA Science',
    url: 'https://science.nasa.gov/3d-resources/space-exploration-vehicle/',
    verified: true,
  },
  {
    // Apollo 15: 27.8 km en 3 h 02 min; Apollo 16: 26.7 km en 3 h 26 min; Apollo 17: 35.9 km en 4 h 26 min.
    id: 'nssdca-lrv',
    title: 'The Apollo Lunar Roving Vehicle',
    org: 'NASA GSFC · NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html',
    verified: true,
  },
  {
    // Velocidad máxima de 152 m por hora; los conductores evitan inclinaciones de más de 30°.
    id: 'nasa-perseverance-components',
    title: 'Perseverance Rover Components',
    org: 'NASA Science',
    url: 'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/',
    verified: true,
  },
  {
    // Radio medio volumétrico de Marte: 3389.5 km (para medir distancias).
    id: 'nssdca-mars-fact',
    title: 'Mars Fact Sheet',
    org: 'NASA GSFC · NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    verified: true,
  },
];

const byId = new Map(REFERENCES.map((ref) => [ref.id, ref]));
export const refOf = (id) => byId.get(id);

/**
 * `speedRef` es la referencia que respalda la velocidad; null = supuesto del equipo.
 * El rover ligero usa el promedio real de conducción del rover lunar de Apollo:
 * 90.4 km en 10 h 54 min ≈ 8 km/h.
 */
export const PROFILES = {
  pressurized_rover: { speedKmh: 10, maxSlopeDeg: 20, avoidCraterKm: 5, speedRef: 'nasa-sev' },
  light_rover: { speedKmh: 8, maxSlopeDeg: 15, avoidCraterKm: 10, speedRef: 'nssdca-lrv' },
  on_foot: { speedKmh: 3, maxSlopeDeg: 25, avoidCraterKm: 30, speedRef: null },
};

export const PROFILE_IDS = Object.keys(PROFILES);
