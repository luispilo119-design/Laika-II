/**
 * Contenido del módulo "transit": referencias y a qué texto respalda cada una. Parte B — B3.
 * Los textos viven en i18n.js; aquí solo va la estructura y las fuentes.
 *
 * Todas las referencias se abrieron el 2026-11-14 y se comprobó que respaldan lo que se
 * muestra. Las cifras están en trip.js (constantes) y en i18n.js (dentro de las frases).
 */

/** @type {import('../../core/types.js').Reference[]} */
export const REFERENCES = [
  {
    id: 'hrp-hazards',
    title: '5 Hazards of Human Spaceflight',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazards/',
    verified: true,
  },
  {
    // RIDGE, efectos de cada peligro y contramedidas ("The Key").
    id: 'hrp-body',
    title: 'The Human Body in Space',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/',
    year: 2021,
    verified: true,
  },
  {
    id: 'hrp-radiation',
    title: 'Hazard: Space Radiation',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-space-radiation/',
    verified: true,
  },
  {
    id: 'hrp-isolation',
    title: 'Hazard: Isolation and Confinement',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/',
    verified: true,
  },
  {
    // 140 millones de millas en promedio, hasta 20 min de retraso por trayecto, sin reabastecimiento.
    id: 'hrp-distance',
    title: 'Hazard: Distance From Earth',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/',
    verified: true,
  },
  {
    // 1 % a 1.5 % de densidad mineral ósea al mes; tres campos de gravedad; líquidos hacia la cabeza.
    id: 'hrp-gravity',
    title: 'Hazard: Gravity Fields',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/',
    verified: true,
  },
  {
    id: 'hrp-hostile',
    title: 'Hazard: Hostile/Closed Environments',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/',
    verified: true,
  },
  {
    // Las tripulaciones de la estación espacial hacen en promedio dos horas de ejercicio al día.
    id: 'nasa-bone-muscle',
    title: 'Counteracting Bone and Muscle Loss in Microgravity',
    org: 'NASA',
    url: 'https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/',
    verified: true,
  },
  {
    // RAD midió en promedio 1.8 mSv por día de rayos cósmicos dentro de la nave rumbo a Marte.
    id: 'jpl-rad-cruise',
    title: "Data From NASA Rover's Voyage to Mars Aids Planning",
    org: 'NASA/JPL',
    url: 'https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/',
    year: 2013,
    verified: true,
  },
  {
    // Un adulto promedio necesita 7–9 h de sueño; en el transbordador y la estación se duermen 6–6.5 h.
    id: 'nasa-sleep-brief',
    title: 'NASA-STD-3001 Technical Brief: Sleep Accommodations (OCHMO-TB-041)',
    org: 'NASA Office of the Chief Health and Medical Officer',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf',
    verified: true,
  },
  {
    // Semiejes mayores de la Tierra y Marte, para la duración por defecto del viaje.
    id: 'jpl-approx-pos',
    title: 'Approximate Positions of the Planets',
    org: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
    verified: true,
  },
];

const byId = new Map(REFERENCES.map((ref) => [ref.id, ref]));

/** @returns {import('../../core/types.js').Reference} */
export const refOf = (id) => byId.get(id);

/** Tramos del viaje (textos en transit.stage.<id>). */
export const STAGES = [
  { id: 'departure', refs: ['hrp-gravity'] },
  { id: 'cruise', refs: ['hrp-body'] },
  { id: 'arrival', refs: ['hrp-gravity', 'hrp-body'] },
];

/** Acumulados que cambian con el día del viaje (textos en transit.meter.<id>). */
export const METERS = [
  { id: 'bone', refs: ['hrp-gravity'] },
  { id: 'dose', refs: ['jpl-rad-cruise'] },
  { id: 'exercise', refs: ['nasa-bone-muscle'] },
];

/** Los cinco peligros, en el orden de la sigla RIDGE (textos en transit.hazard.<id>). */
export const HAZARDS = [
  { id: 'radiation', letter: 'R', refs: ['hrp-radiation', 'hrp-body'] },
  { id: 'isolation', letter: 'I', refs: ['hrp-isolation', 'hrp-body'] },
  { id: 'distance', letter: 'D', refs: ['hrp-distance', 'hrp-body'] },
  { id: 'gravity', letter: 'G', refs: ['hrp-gravity', 'nasa-bone-muscle'] },
  { id: 'hostile', letter: 'E', refs: ['hrp-hostile', 'hrp-body'] },
];
