/**
 * Servicios opcionales (Supabase: guardar misión, puntuaciones). Dueño: Parte B — tarea B2.
 *
 * main.js llama a init(ctx) una sola vez al arrancar. Reglas del contrato:
 *  - Si faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, la app sigue funcionando con
 *    localStorage (el store ya persiste solo) y estas funciones responden con lo local.
 *  - Nunca bloquea el arranque ni lanza: sin red, el estado pasa a 'offline' y se reintenta.
 *  - Los módulos no hablan con Supabase: usan las funciones exportadas aquí.
 */
import { isConfigured, getClient } from './supabase.js';
import { browserStorage } from './storage.js';
import { createMissionSync } from './sync.js';
import { createScores } from './scores.js';

export { ALIAS_MAX } from './scores.js';

const LAST_MODULE_KEY = 'laika2.lastModule.v1';

const storage = browserStorage();
const isOnline = () => globalThis.navigator?.onLine !== false;
const scores = createScores({ getClient, storage, isOnline });

/** @typedef {'local'|'connecting'|'saving'|'synced'|'offline'} SyncStatus */

/** @type {SyncStatus} */
let status = 'local';
const statusListeners = new Set();
let sync = null;

function setStatus(next) {
  if (next === status) return;
  status = next;
  for (const fn of [...statusListeners]) fn(status);
}

/**
 * Dónde se está guardando la misión:
 * 'local' = solo en este navegador (sin Supabase); 'connecting' / 'saving' = en curso;
 * 'synced' = la nube está al día; 'offline' = hay Supabase pero no se pudo llegar a él.
 * @returns {SyncStatus}
 */
export function getStatus() {
  return status;
}

/**
 * Avisa cada vez que cambia el estado de guardado.
 * @param {(status: SyncStatus) => void} fn
 * @returns {() => void} función para dejar de escuchar
 */
export function onStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

/** Recuerda el último módulo visitado, para el botón CONTINUAR de la pantalla de inicio. */
function trackLastModule(ctx) {
  const ids = new Set(ctx.modules.map((m) => m.id));
  const note = () => {
    const id = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (id !== 'home' && ids.has(id)) storage.write(LAST_MODULE_KEY, id);
  };
  window.addEventListener('hashchange', note);
  note();
}

/** @returns {string|null} id del último módulo visitado (nunca 'home'). */
export function lastModule() {
  return storage.read(LAST_MODULE_KEY, null);
}

/** @param {import('../core/types.js').Ctx} ctx */
export async function init(ctx) {
  trackLastModule(ctx);
  if (!isConfigured) return;

  setStatus('connecting');
  const client = await getClient();
  if (!client) {
    setStatus('offline');
    return;
  }
  sync = createMissionSync({ client, store: ctx.store, storage, onStatus: setStatus, isOnline });
  window.addEventListener('online', () => sync.flush());
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sync.flush();
  });
  await sync.start();
}

/**
 * Guarda la misión ahora, sin esperar el retardo. Con `asNew` crea una misión aparte.
 * @returns {Promise<boolean>} true si quedó en Supabase; false si solo está en este navegador.
 */
export async function saveMission(options) {
  return sync ? sync.save(options) : false;
}

/**
 * Misiones guardadas en Supabase por esta persona, de la más reciente a la más antigua.
 * @returns {Promise<{ id: string, name: string, updatedAt: string, current: boolean }[]>}
 */
export async function listMissions() {
  return sync ? sync.list() : [];
}

/**
 * Carga una misión guardada y la pone como misión actual.
 * @returns {Promise<boolean>} false si no se pudo.
 */
export async function loadMission(id) {
  return sync ? sync.load(id) : false;
}

/**
 * Registra una puntuación. `alias` se recorta a 16 caracteres.
 * @returns {Promise<{ game: string, alias: string, points: number, at: string, cloud: boolean }>}
 */
export function submitScore(game, alias, points) {
  return scores.submit(game, alias, points);
}

/**
 * Mejores puntuaciones de un juego: las de Supabase si hay, o las de este navegador.
 * @returns {Promise<{ source: 'cloud'|'local', rows: { alias: string, points: number, at: string }[] }>}
 */
export function topScores(game, limit = 10) {
  return scores.top(game, limit);
}
