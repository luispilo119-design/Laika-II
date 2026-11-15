/**
 * Estado compartido de la app. Dueño: Parte A.
 * Forma del estado: ver AppState en types.js y docs/CONTRACTS.md.
 * Se guarda en localStorage; la sincronización con Supabase (Parte B) se suscribe aquí.
 */

const STORAGE_KEY = 'laika2.state.v1';

/** @returns {import('./types.js').AppState} */
export function initialState() {
  return {
    lang: 'en',
    clock: { sol: 0, localHour: 12, ls: 0 },
    mission: {
      name: '',
      departure: null,
      arrival: null,
      arrivalLs: null,
      site: null,
      hubs: [],
      routes: [],
    },
  };
}

function load() {
  const base = initialState();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {
      ...base,
      ...saved,
      clock: { ...base.clock, ...saved.clock },
      mission: { ...base.mission, ...saved.mission },
    };
  } catch {
    return base;
  }
}

function persist() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* almacenamiento no disponible: se sigue en memoria */
  }
}

function setPath(obj, keys, value) {
  if (keys.length === 0) return value;
  const [head, ...rest] = keys;
  const current = obj && typeof obj === 'object' ? obj : {};
  return { ...current, [head]: setPath(current[head], rest, value) };
}

let state = load();
const listeners = new Set();

function notify(path) {
  for (const fn of [...listeners]) {
    try {
      fn(state, path);
    } catch (err) {
      console.error('[store] error en suscriptor', err);
    }
  }
}

export const store = {
  /** @returns {import('./types.js').AppState} Estado actual. No lo mutes: usa set(). */
  get() {
    return state;
  },

  /**
   * Cambia un valor por ruta con puntos: store.set('mission.site', { lat, lon }).
   * Los arreglos se reemplazan completos: store.set('mission.hubs', [...hubs, nuevo]).
   */
  set(path, value) {
    state = setPath(state, path.split('.'), value);
    persist();
    notify(path);
  },

  /** Reemplaza la misión completa (por ejemplo al cargarla desde Supabase). */
  replaceMission(mission, clock) {
    state = {
      ...state,
      mission: { ...initialState().mission, ...mission },
      clock: { ...state.clock, ...clock },
    };
    persist();
    notify('mission');
  },

  resetMission() {
    const base = initialState();
    state = { ...state, mission: base.mission, clock: base.clock };
    persist();
    notify('mission');
  },

  /**
   * @param {(state: import('./types.js').AppState, path: string) => void} fn
   * @returns {() => void} función para cancelar la suscripción
   */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
