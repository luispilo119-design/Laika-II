/**
 * Geometría de la superficie de Marte compartida por los módulos (hubs, rutas, mapa, descenso).
 * Dueño: Parte A.
 */

/** Radio medio volumétrico de Marte en km (NASA GSFC, Mars Fact Sheet). */
export const MARS_RADIUS_KM = 3389.5;

/** Kilómetros que mide un grado de latitud (o de longitud en el ecuador). */
export const KM_PER_DEG = (Math.PI * MARS_RADIUS_KM) / 180;

const RAD = Math.PI / 180;

/** Distancia sobre la superficie entre dos puntos, en km (fórmula del haversine). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
