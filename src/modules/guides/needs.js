/**
 * Lectura de las necesidades diarias del cuerpo humano (sin DOM, para poder probarla).
 * Parte B — tarea B6.
 *
 * Los valores los entrega la Parte A en `src/core/human-needs.js` (punto de integración I2).
 * Este módulo NO escribe cifras: si el archivo no existe o un valor falta, la pantalla muestra
 * "sin datos". Para no depender de la forma exacta en que llegue, se aceptan estas variantes:
 *
 *   export const HUMAN_NEEDS = [ { id: 'water', value: 3.5, unit: 'L', ref: {...} }, ... ]
 *   export const HUMAN_NEEDS = { water: { value: [2, 4], unit: 'L', refId: '...' }, ... }
 *   export default <cualquiera de las dos>
 *
 * Campos de cada necesidad:
 *   id          'water' | 'oxygen' | 'food' | 'pressure' | 'temperature' | 'radiation' | otro
 *   value       número, par [mínimo, máximo] o texto
 *   unit        texto de la unidad (opcional)
 *   note        aclaración corta (opcional; texto o { es, en })
 *   ref         { title, org, url } (opcional)   refId   id de una referencia registrada (opcional)
 */

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanValue(value) {
  if (isNumber(value)) return value;
  if (Array.isArray(value) && value.length === 2 && value.every(isNumber)) return [value[0], value[1]];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function cleanRef(ref) {
  if (!ref || typeof ref !== 'object' || !/^https?:\/\//i.test(String(ref.url ?? ''))) return null;
  return { title: String(ref.title ?? ref.url), org: String(ref.org ?? ''), url: String(ref.url) };
}

/**
 * @param {any} source  el módulo importado de src/core/human-needs.js, o undefined si no existe
 * @returns {Map<string, { id: string, value: number|[number, number]|string, unit: string,
 *   note: string|{es?: string, en?: string}|null, ref: {title: string, org: string, url: string}|null, refId: string|null }>}
 */
export function readNeeds(source) {
  const out = new Map();
  const raw = source?.HUMAN_NEEDS ?? source?.humanNeeds ?? source?.default ?? null;
  if (!raw || typeof raw !== 'object') return out;
  const entries = Array.isArray(raw) ? raw.map((item) => [item?.id, item]) : Object.entries(raw);
  for (const [id, item] of entries) {
    if (typeof id !== 'string' || !id || !item || typeof item !== 'object') continue;
    const value = cleanValue(item.value);
    if (value === null) continue; // sin valor utilizable: se queda como "sin datos"
    out.set(id, {
      id,
      value,
      unit: typeof item.unit === 'string' ? item.unit : '',
      note: typeof item.note === 'string' || (item.note && typeof item.note === 'object') ? item.note : null,
      ref: cleanRef(item.ref),
      refId: typeof item.refId === 'string' ? item.refId : null,
    });
  }
  return out;
}
