/**
 * Sincronización de la misión con Supabase. Dueño: Parte B — tarea B2.
 *
 * El store ya guarda todo en localStorage; esto solo añade una copia en la nube:
 *  - al arrancar abre una sesión anónima y trae la misión guardada;
 *  - después guarda cada cambio de `mission`, con retardo para no escribir en cada tecla.
 *
 * Quién gana al arrancar: si en este navegador hay cambios que nunca llegaron a la nube
 * (por ejemplo, se trabajó sin red), gana lo local y se sube. Si no, gana lo de la nube.
 *
 * No depende del navegador ni de Supabase directamente: recibe el cliente, el store y el
 * almacenamiento, para poder probarse con dobles (tests/services.test.js).
 */

const META_KEY = 'laika2.sync.v1'; // { missionId, syncedHash }
const ROW_FIELDS = 'id, name, data, updated_at';

/** Huella corta del contenido de la misión, para saber si cambió desde el último guardado. */
export function missionHash(mission) {
  const text = JSON.stringify(mission ?? null);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${h.toString(36)}`;
}

/** true si la misión está como recién creada (nada elegido todavía). */
export function isEmptyMission(mission) {
  const m = mission ?? {};
  return (
    !m.name && !m.departure && !m.arrival && m.arrivalLs == null && !m.site && !m.hubs?.length && !m.routes?.length
  );
}

const CONFIG_HINT =
  'Revisa en el panel de Supabase: Authentication → Sign In / Providers → "Allow anonymous sign-ins".';

/** true si el error es de configuración del proyecto (no de red): reintentar no lo arregla. */
export function isConfigError(err) {
  const code = err?.code ?? err?.error_code;
  if (code === 'anonymous_provider_disabled' || code === 'signup_disabled') return true;
  return [400, 401, 403, 422].includes(err?.status);
}

/** Abre la sesión anónima si todavía no hay una. Lanza si no se pudo. */
export async function ensureSession(client) {
  const current = await client.auth.getSession();
  if (current.error) throw current.error;
  if (current.data?.session) return;
  const created = await client.auth.signInAnonymously();
  if (created.error) throw created.error;
}

/**
 * @param {object} deps
 * @param {any} deps.client     Cliente de Supabase.
 * @param {typeof import('../core/store.js').store} deps.store
 * @param {{ read: Function, write: Function }} deps.storage
 * @param {number} [deps.delayMs]   Retardo antes de guardar tras un cambio.
 * @param {(status: 'connecting'|'saving'|'synced'|'offline') => void} [deps.onStatus]
 * @param {() => boolean} [deps.isOnline]
 */
export function createMissionSync({ client, store, storage, delayMs = 1500, onStatus = () => {}, isOnline = () => true }) {
  let meta = storage.read(META_KEY, {}) ?? {};
  let timer = null;
  let applying = false; // true mientras se vuelca al store algo que vino de la nube
  let ready = false; // true cuando ya hay sesión y se resolvió quién gana
  let connecting = null;
  let saving = null;
  let queued = false;
  let unsubscribe = null;
  let blocked = null; // error de configuración del proyecto: no se reintenta hasta recargar

  const localHash = () => missionHash(store.get().mission);
  const isDirty = () => meta.syncedHash !== localHash();

  function setMeta(next) {
    meta = next;
    storage.write(META_KEY, meta);
  }

  function apply(row) {
    applying = true;
    try {
      store.replaceMission(row.data?.mission ?? {}, row.data?.clock ?? {});
    } finally {
      applying = false;
    }
    setMeta({ missionId: row.id, syncedHash: localHash() });
  }

  /** La misión con la que se trabajó la última vez; si ya no existe, la más reciente. */
  async function fetchSaved() {
    if (meta.missionId) {
      const own = await client.from('missions').select(ROW_FIELDS).eq('id', meta.missionId).limit(1);
      if (own.error) throw own.error;
      if (own.data?.[0]) return own.data[0];
    }
    const latest = await client.from('missions').select(ROW_FIELDS).order('updated_at', { ascending: false }).limit(1);
    if (latest.error) throw latest.error;
    return latest.data?.[0] ?? null;
  }

  async function writeRow() {
    const state = store.get();
    const hash = missionHash(state.mission);
    const payload = {
      name: state.mission.name ?? '',
      data: { mission: state.mission, clock: state.clock },
      updated_at: new Date().toISOString(),
    };
    let res = meta.missionId
      ? await client.from('missions').upsert({ id: meta.missionId, ...payload }).select('id').single()
      : await client.from('missions').insert(payload).select('id').single();
    if (res.error && meta.missionId) {
      // La fila ya no pertenece a esta sesión (sesión anónima nueva): se crea otra.
      res = await client.from('missions').insert(payload).select('id').single();
    }
    if (res.error) throw res.error;
    setMeta({ missionId: res.data.id, syncedHash: hash });
  }

  /** Guarda ahora. Si ya hay un guardado en curso, deja otro encadenado para el final. */
  function push() {
    if (saving) {
      queued = true;
      return saving;
    }
    saving = (async () => {
      try {
        do {
          queued = false;
          if (!isOnline()) throw new Error('sin red');
          onStatus('saving');
          await writeRow();
        } while (queued);
        onStatus('synced');
        return true;
      } catch {
        onStatus('offline');
        return false;
      } finally {
        saving = null;
      }
    })();
    return saving;
  }

  function connect() {
    if (connecting) return connecting;
    connecting = (async () => {
      if (blocked) return false;
      if (!isOnline()) {
        onStatus('offline');
        return false;
      }
      onStatus('connecting');
      try {
        await ensureSession(client);
        const row = await fetchSaved();
        ready = true;
        const neverSynced = meta.syncedHash === undefined;
        const empty = isEmptyMission(store.get().mission);
        if (row && (!isDirty() || (neverSynced && empty))) {
          apply(row);
        } else if (isDirty() && !(neverSynced && empty)) {
          return await push();
        }
        onStatus('synced');
        return true;
      } catch (err) {
        if (isConfigError(err)) {
          blocked = err;
          console.warn(`[sync] Supabase rechazó la sesión (${err.code ?? err.status}): ${err.message}. ${CONFIG_HINT}`);
        }
        onStatus('offline');
        return false;
      } finally {
        connecting = null;
      }
    })();
    return connecting;
  }

  /** Guarda lo pendiente sin esperar el retardo. Devuelve true si la nube quedó al día. */
  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!ready) return connect();
    if (!isDirty()) return Promise.resolve(true);
    return push();
  }

  function onChange(_state, path) {
    if (applying) return;
    if (path !== 'mission' && !path.startsWith('mission.')) return;
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  return {
    /** Se suscribe al store y hace la primera sincronización. Nunca lanza. */
    start() {
      unsubscribe ??= store.subscribe(onChange);
      return connect();
    },

    flush,

    /** Guarda ahora; con asNew crea una misión aparte en vez de actualizar la actual. */
    async save({ asNew = false } = {}) {
      if (asNew) setMeta({});
      else if (ready && !isDirty() && meta.missionId) return true;
      clearTimeout(timer);
      timer = null;
      if (!ready && !(await connect())) return false;
      if (!isDirty() && meta.missionId) return true;
      return push();
    },

    /** @returns {Promise<{ id: string, name: string, updatedAt: string, current: boolean }[]>} */
    async list() {
      if (!ready && !(await connect())) return [];
      const res = await client
        .from('missions')
        .select('id, name, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (res.error) return [];
      return res.data.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        current: row.id === meta.missionId,
      }));
    },

    /** Carga una misión guardada en el store. Antes guarda lo pendiente de la actual. */
    async load(id) {
      if (!(await flush())) return false;
      const res = await client.from('missions').select(ROW_FIELDS).eq('id', id).limit(1);
      if (res.error || !res.data?.[0]) return false;
      apply(res.data[0]);
      onStatus('synced');
      return true;
    },

    stop() {
      clearTimeout(timer);
      timer = null;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
