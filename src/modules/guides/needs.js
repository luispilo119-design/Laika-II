/**
 * Lectura de las necesidades diarias del cuerpo humano (sin DOM, para poder probarla).
 * Parte B — tarea B6.
 *
 * Los valores los entrega la Parte A en `src/core/human-needs.js`:
 *
 *   export const HUMAN_NEEDS = {
 *     oxygen: { id: 'oxygen', value: 0.82, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 3-33' },
 *     cabinPressure: { id: 'cabinPressure', value: 101, min: 48.0, max: 102.7, unit: 'kPa', ... },
 *     careerRadiation: { id: 'careerRadiation', max: 600, unit: 'mSv', ... },
 *   };
 *   export const HUMAN_REFERENCES = [ { id: 'bvad2018', title, org, url, ... } ];
 *
 * Este módulo NO escribe cifras: si el archivo no existe o una necesidad no trae ningún número,
 * la pantalla muestra "sin datos". También se aceptan una lista en vez de un objeto, un
 * `export default`, un `value` como par [mínimo, máximo] y una referencia incrustada en `ref`.
 */

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const numberOrNull = (v) => (isNumber(v) ? v : null);

function cleanRef(ref) {
  if (!ref || typeof ref !== 'object' || !/^https?:\/\//i.test(String(ref.url ?? ''))) return null;
  return { title: String(ref.title ?? ref.url), org: String(ref.org ?? ''), url: String(ref.url) };
}

/**
 * @typedef {Object} Need
 * @property {string} id
 * @property {number|null} value  valor nominal
 * @property {number|null} min    límite inferior aceptable
 * @property {number|null} max    límite superior aceptable
 * @property {string} unit
 * @property {string} where       tabla o sección de donde sale el dato
 * @property {{ title: string, org: string, url: string }|null} ref
 */

/**
 * @param {any} source  el módulo importado de src/core/human-needs.js, o undefined si no existe
 * @returns {Map<string, Need>}
 */
export function readNeeds(source) {
  const out = new Map();
  const raw = source?.HUMAN_NEEDS ?? source?.humanNeeds ?? source?.default ?? null;
  if (!raw || typeof raw !== 'object') return out;

  const refs = new Map();
  for (const ref of Array.isArray(source?.HUMAN_REFERENCES) ? source.HUMAN_REFERENCES : []) {
    const clean = cleanRef(ref);
    if (clean && typeof ref.id === 'string') refs.set(ref.id, clean);
  }

  const entries = Array.isArray(raw) ? raw.map((item) => [item?.id, item]) : Object.entries(raw);
  for (const [id, item] of entries) {
    if (typeof id !== 'string' || !id || !item || typeof item !== 'object') continue;
    const pair = Array.isArray(item.value) && item.value.length === 2 && item.value.every(isNumber) ? item.value : null;
    const need = {
      id,
      value: pair ? null : numberOrNull(item.value),
      min: pair ? pair[0] : numberOrNull(item.min),
      max: pair ? pair[1] : numberOrNull(item.max),
      unit: typeof item.unit === 'string' ? item.unit : '',
      where: typeof item.where === 'string' ? item.where : '',
      ref: cleanRef(item.ref) ?? refs.get(item.refId) ?? null,
    };
    // Sin ningún número utilizable se queda como "sin datos".
    if (need.value === null && need.min === null && need.max === null) continue;
    out.set(id, need);
  }
  return out;
}
