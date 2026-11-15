/**
 * Fotos crudas de Perseverance y Curiosity, desde las API públicas de mars.nasa.gov (responden con
 * CORS abierto; comprobado el 2026-11-15). Parte B — tarea B5.
 *
 * - Perseverance: cada foto trae `site` y `drive`, el mismo par que las paradas de rovers.json, así
 *   que se sabe en qué parada exacta se tomó.
 * - Curiosity: las fotos no traen ese par; se ubican por sol (aproximado). Ver traverse.photoSols.
 * Las imágenes se muestran en <img> (no tienen CORS para usarse como textura 3D, no hace falta).
 * La API antigua api.nasa.gov/mars-photos ya no existe; no se usa.
 */
import { photoSols } from './traverse.js';

/** @type {import('../../core/types.js').Reference[]} */
export const PHOTO_REFERENCES = [
  {
    id: 'nasa-m20-raw',
    title: 'Images from the Mars Perseverance Rover (imágenes crudas)',
    org: 'NASA/JPL-Caltech',
    url: 'https://mars.nasa.gov/mars2020/multimedia/raw-images/',
    verified: true,
  },
  {
    id: 'nasa-msl-raw',
    title: 'Curiosity Raw Images',
    org: 'NASA/JPL-Caltech/MSSS',
    url: 'https://mars.nasa.gov/msl/multimedia/raw-images/',
    verified: true,
  },
];

export const EXACT_PAIRS = { perseverance: true, curiosity: false };

export function solUrl(rover, sol) {
  if (rover === 'perseverance') {
    return `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&sol=${sol}`;
  }
  return (
    'https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc,instrument_sort%20asc,sample_type_sort%20asc,%20date_taken%20desc' +
    `&per_page=100&page=0&condition_1=msl:mission&condition_2=${sol}:sol:eq&extended=thumbnail::sample_type::noteq`
  );
}

/** Familia de cámara a partir del nombre del instrumento (para filtrar). */
export function cameraFamily(instrument = '') {
  const s = instrument.toUpperCase();
  if (s.includes('NAV')) return 'navcam';
  if (s.includes('HAZ')) return 'hazcam';
  if (s.startsWith('MCZ') || s.startsWith('MAST')) return 'mastcam';
  if (s.includes('WATSON') || s.includes('MAHLI') || s.includes('SHERLOC') || s.includes('PIXL')) return 'arm';
  if (s.includes('RMI') || s.includes('SUPERCAM') || s.includes('CHEMCAM')) return 'laser';
  if (s.includes('HELI')) return 'heli';
  if (s.includes('SKY') || s.includes('EDL') || s.includes('LCAM') || s.includes('MARDI')) return 'other';
  return 'other';
}

export const FAMILIES = ['navcam', 'mastcam', 'hazcam', 'arm', 'laser', 'heli', 'other'];

const httpsOf = (url) => (url ? url.replace(/^http:\/\//, 'https://') : null);

/**
 * @typedef {Object} Photo
 * @property {string} id
 * @property {number} sol
 * @property {string} instrument
 * @property {string} family
 * @property {string} thumb   imagen pequeña para la cuadrícula
 * @property {string} large   imagen grande para el visor
 * @property {string} link    página de la foto en mars.nasa.gov
 * @property {string} credit
 * @property {string|null} date  fecha de la Tierra (UTC) en que se tomó
 * @property {number|null} site
 * @property {number|null} drive
 */

/** Fotos de la respuesta de la API de Perseverance. */
export function normalizeM20(json) {
  return (json?.images ?? [])
    .filter((im) => im.sample_type !== 'Thumbnail')
    .map((im) => ({
      id: im.imageid,
      sol: Number(im.sol),
      instrument: im.camera?.instrument ?? '',
      family: cameraFamily(im.camera?.instrument),
      thumb: httpsOf(im.image_files?.small ?? im.image_files?.medium ?? im.image_files?.large),
      large: httpsOf(im.image_files?.large ?? im.image_files?.medium ?? im.image_files?.full_res),
      link: httpsOf(im.link),
      credit: im.credit || 'NASA/JPL-Caltech',
      date: im.date_taken_utc ?? null,
      site: im.site === undefined || im.site === null ? null : Number(im.site),
      drive: im.drive === undefined || im.drive === null ? null : Number(im.drive),
    }))
    .filter((p) => p.thumb && p.large);
}

/** Fotos de la respuesta de la API de Curiosity. */
export function normalizeMSL(json) {
  return (json?.items ?? [])
    .filter((it) => !it.is_thumbnail)
    .map((it) => {
      const url = httpsOf(it.https_url ?? it.url);
      return {
        id: it.imageid,
        sol: Number(it.sol),
        instrument: it.instrument ?? '',
        family: cameraFamily(it.instrument),
        thumb: url,
        large: url,
        link: it.link ? new URL(it.link, 'https://mars.nasa.gov').href : 'https://mars.nasa.gov/msl/multimedia/raw-images/',
        credit: it.image_credit || 'NASA/JPL-Caltech',
        date: it.date_taken ?? null,
        site: it.site === undefined || it.site === null ? null : Number(it.site),
        drive: it.drive === undefined || it.drive === null ? null : Number(it.drive),
      };
    })
    .filter((p) => p.thumb);
}

const cache = new Map();

/** Fotos de un sol (con caché por sesión). */
export async function fetchSol(rover, sol, { signal, fetchFn = fetch } = {}) {
  const key = `${rover}:${sol}`;
  if (cache.has(key)) return cache.get(key);
  const response = await fetchFn(solUrl(rover, sol), { signal });
  if (!response.ok) throw new Error(`raw images ${response.status}`);
  const json = await response.json();
  const photos = rover === 'perseverance' ? normalizeM20(json) : normalizeMSL(json);
  // La API de Curiosity devuelve una página (100 fotos): `capped` avisa que el sol tiene más.
  photos.capped = rover === 'curiosity' && Number(json.total) > (json.items?.length ?? 0);
  cache.set(key, photos);
  return photos;
}

/**
 * Fotos tomadas en una parada.
 * @param {'perseverance'|'curiosity'} rover
 * @param {import('../../core/rovers.js').RoverStop[]} stops
 * @returns {Promise<{ photos: Photo[], sols: number[], exact: boolean, truncated: boolean, capped: boolean }>}
 */
export async function photosForStop(rover, stops, index, opts = {}) {
  const exactPairs = EXACT_PAIRS[rover];
  const { sols, exact, truncated } = photoSols(stops, index, exactPairs);
  const stop = stops[index];
  const lists = await Promise.all(sols.map((sol) => fetchSol(rover, sol, opts)));
  const capped = lists.some((list) => list.capped);
  let photos = lists.flat();
  if (exact) photos = photos.filter((p) => p.site === stop.site && p.drive === stop.drive);
  const seen = new Set();
  photos = photos.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  return { photos, sols, exact, truncated, capped };
}
