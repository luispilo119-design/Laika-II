/**
 * Sitios de aterrizaje de misiones de la NASA en Marte.
 *
 * Coordenadas tal como las publica el catálogo NSSDCA de la NASA (leído el 2026-11-14), pasadas a
 * lon este-positivo −180..180. Excepciones:
 *  - Curiosity y Perseverance: primer punto registrado del rover en los datos de recorrido de la NASA
 *    (public/data/rovers.json).
 *  - InSight: NSSDCA no da coordenadas; se usa el centro del área de aterrizaje que marca Mars Trek,
 *    por eso lleva `approx: true`.
 * `date` solo aparece cuando una fuente de la NASA da la fecha completa de aterrizaje (NSSDCA; para
 * Curiosity, la ficha de Mars Trek; para Perseverance, la página de la misión Mars 2020).
 */

const nssdca = (id) => `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${id}`;

export const LANDING_SITES = [
  { id: 'viking1', name: 'Viking 1', lat: 22.27, lon: -47.95, region: 'Chryse Planitia', date: null, refId: 'nssdca-viking1' },
  { id: 'viking2', name: 'Viking 2', lat: 47.6673, lon: 134.2809, region: 'Utopia Planitia', date: null, refId: 'nssdca-viking2' },
  { id: 'pathfinder', name: 'Mars Pathfinder', lat: 19.33, lon: -33.55, region: 'Ares Vallis', date: '1997-07-04', refId: 'nssdca-pathfinder' },
  { id: 'spirit', name: 'Spirit', lat: -14.572, lon: 175.478, region: 'Gusev', date: '2004-01-04', refId: 'nssdca-spirit' },
  { id: 'opportunity', name: 'Opportunity', lat: -1.946, lon: -5.527, region: 'Terra Meridiani', date: '2004-01-25', refId: 'nssdca-opportunity' },
  { id: 'phoenix', name: 'Phoenix', lat: 68.15, lon: -125.9, region: null, date: '2008-05-25', refId: 'nssdca-phoenix' },
  { id: 'curiosity', name: 'Curiosity', lat: -4.589467, lon: 137.441633, region: 'Gale', date: '2012-08-06', refId: 'nasa-track-curiosity' },
  { id: 'insight', name: 'InSight', lat: 4.5366, lon: 135.849, region: 'Elysium Planitia', date: '2018-11-26', approx: true, refId: 'nssdca-insight' },
  { id: 'perseverance', name: 'Perseverance', lat: 18.444627, lon: 77.450886, region: 'Jezero', date: '2021-02-18', refId: 'nasa-track-perseverance' },
];

/** @type {import('../../core/types.js').Reference[]} */
export const SITE_REFERENCES = [
  ['nssdca-viking1', 'Viking 1 Lander', '1975-075C'],
  ['nssdca-viking2', 'Viking 2 Lander', '1975-083C'],
  ['nssdca-pathfinder', 'Mars Pathfinder', '1996-068A'],
  ['nssdca-spirit', 'Spirit (MER-A)', '2003-027A'],
  ['nssdca-opportunity', 'Opportunity (MER-B)', '2003-032A'],
  ['nssdca-phoenix', 'Phoenix Mars Lander', '2007-034A'],
  ['nssdca-insight', 'InSight', '2018-042A'],
].map(([id, title, catalogId]) => ({
  id,
  title: `NSSDCA Master Catalog · ${title}`,
  org: 'NASA GSFC',
  url: nssdca(catalogId),
  verified: true,
}));
