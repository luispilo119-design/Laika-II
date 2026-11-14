/**
 * Tipos de hub y reglas entre hubs (tarea A5). Lógica pura, con pruebas en tests/hubs.test.js.
 * Para agregar un tipo: añade una entrada a HUB_TYPES, su perfil de pesos en PROFILES
 * (src/core/env.js), sus textos en i18n.js bajo `type.<id>` y la clave en types.js (Hub.type).
 */

/** Radio medio de Marte en km (NASA Mars Fact Sheet). */
export const MARS_RADIUS_KM = 3389.5;

/**
 * Alcance de un recorrido de superficie desde la base: unos 100 km en línea recta (rover presurizado,
 * dos semanas sin reabastecer). Es también el radio de una zona de exploración de la NASA.
 * Bussey y Hoffman (2016), ref. bussey2016.
 */
export const MAX_KM_FROM_HABITAT = 100;

/** @type {import('../../core/types.js').Reference[]} */
export const HUB_REFERENCES = [
  {
    id: 'bussey2016',
    title: 'Bussey y Hoffman (2016): Human Mars Landing Site and Impacts on Mars Surface Operations',
    org: 'NASA Headquarters',
    url: 'https://ntrs.nasa.gov/citations/20160002370',
    year: 2016,
    verified: true,
  },
];

/** El id de cada tipo es también el perfil de pesos de env.evaluate. `glyph` es el símbolo del marcador. */
export const HUB_TYPES = [
  { id: 'habitat', glyph: '⌂' },
  { id: 'greenhouse', glyph: '❀' },
  { id: 'solar', glyph: '☀' },
  { id: 'ice_mine', glyph: '❄' },
  { id: 'landing_pad', glyph: '✈' },
];

export const hubType = (id) => HUB_TYPES.find((type) => type.id === id) ?? HUB_TYPES[0];

/** Distancia sobre la superficie entre dos puntos, en km (fórmula del haversine). */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Regla de cercanía: todo hub que no sea hábitat debe quedar dentro del alcance de un hábitat.
 * @param {{ id?: string, type: string, lat: number, lon: number }} hub
 * @param {import('../../core/types.js').Hub[]} hubs
 * @returns {{ status: 'not_applicable' | 'no_habitat' | 'ok' | 'too_far', km: number | null }}
 */
export function habitatRule(hub, hubs) {
  if (hub.type === 'habitat') return { status: 'not_applicable', km: null };
  const habitats = hubs.filter((h) => h.type === 'habitat' && h.id !== hub.id);
  if (habitats.length === 0) return { status: 'no_habitat', km: null };
  const km = Math.min(...habitats.map((h) => distanceKm(hub, h)));
  return { status: km <= MAX_KM_FROM_HABITAT ? 'ok' : 'too_far', km };
}

export function newHubId() {
  return globalThis.crypto?.randomUUID?.() ?? `hub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
