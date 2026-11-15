// Sincronización con Supabase y puntuaciones (Parte B, tarea B2), probadas con dobles:
// un cliente falso en memoria en vez de Supabase y un store mínimo con el mismo contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMissionSync, missionHash, isEmptyMission } from '../src/services/sync.js';
import { createScores, cleanAlias } from '../src/services/scores.js';
import { memoryStorage } from '../src/services/storage.js';
import { isServerKey } from '../src/services/supabase.js';

const emptyMission = () => ({
  name: '',
  departure: null,
  arrival: null,
  arrivalLs: null,
  site: null,
  hubs: [],
  routes: [],
});

/** Store con el contrato de src/core/store.js (get, set por ruta, replaceMission, subscribe). */
function fakeStore(mission = emptyMission()) {
  let state = { lang: 'es', clock: { sol: 0, localHour: 12, ls: 0 }, mission };
  const listeners = new Set();
  const notify = (path) => listeners.forEach((fn) => fn(state, path));
  return {
    get: () => state,
    set(path, value) {
      const [head, key] = path.split('.');
      state = key ? { ...state, [head]: { ...state[head], [key]: value } } : { ...state, [head]: value };
      notify(path);
    },
    replaceMission(next, clock) {
      state = { ...state, mission: { ...emptyMission(), ...next }, clock: { ...state.clock, ...clock } };
      notify('mission');
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Cliente con la parte de la API de Supabase que usan los servicios. */
function fakeClient({ missions = [] } = {}) {
  const db = { missions: missions.map((row) => ({ ...row })), scores: [] };
  const stats = { signIns: 0, writes: 0 };
  let session = null;
  let failing = false;
  let rejectUpsert = false;
  let nextId = 1;
  let tick = 0;

  function run(q) {
    if (failing) return { data: null, error: new Error('sin red') };
    const table = db[q.table];
    if (q.op === 'insert' || q.op === 'upsert') {
      if (!session) return { data: null, error: new Error('sin sesión') };
      if (q.op === 'upsert' && rejectUpsert) return { data: null, error: new Error('RLS') };
      stats.writes++;
      let row = q.op === 'upsert' ? table.find((r) => r.id === q.payload.id) : null;
      if (row) Object.assign(row, q.payload);
      else {
        row = { id: q.payload.id ?? `m${nextId++}`, created_at: `2026-11-14T00:00:${String(tick++).padStart(2, '0')}Z`, ...q.payload };
        table.push(row);
      }
      return { data: q.single ? { id: row.id } : [row], error: null };
    }
    let rows = table.filter((r) => q.filters.every(([col, val]) => r[col] === val));
    if (q.order) {
      const [col, asc] = q.order;
      rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
    }
    if (q.limit != null) rows = rows.slice(0, q.limit);
    return { data: rows, error: null };
  }

  function from(tableName) {
    const q = { table: tableName, op: 'select', filters: [], order: null, limit: null, single: false, payload: null };
    const api = {
      select: () => api,
      insert: (payload) => ((q.op = 'insert'), (q.payload = payload), api),
      upsert: (payload) => ((q.op = 'upsert'), (q.payload = payload), api),
      eq: (col, val) => (q.filters.push([col, val]), api),
      order: (col, opts) => ((q.order = [col, opts?.ascending !== false]), api),
      limit: (n) => ((q.limit = n), api),
      single: () => ((q.single = true), api),
      then: (resolve, reject) => Promise.resolve(run(q)).then(resolve, reject),
    };
    return api;
  }

  return {
    from,
    auth: {
      getSession: async () => (failing ? { data: { session: null }, error: new Error('sin red') } : { data: { session }, error: null }),
      signInAnonymously: async () => {
        stats.signIns++;
        session = { user: { id: 'u1' } };
        return { data: { session }, error: null };
      },
    },
    db,
    stats,
    setFailing: (value) => (failing = value),
    setRejectUpsert: (value) => (rejectUpsert = value),
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SITE = { lat: 4.5, lon: 137.4, name: 'Gale' };

function setup({ client = fakeClient(), store = fakeStore(), storage = memoryStorage(), delayMs = 5 } = {}) {
  const statuses = [];
  const sync = createMissionSync({ client, store, storage, delayMs, onStatus: (s) => statuses.push(s) });
  return { client, store, storage, sync, statuses };
}

test('primer arranque sin nada: abre sesión anónima y no crea filas vacías', async () => {
  const { client, sync, statuses } = setup();
  assert.equal(await sync.start(), true);
  assert.equal(client.stats.signIns, 1);
  assert.equal(client.db.missions.length, 0);
  assert.equal(statuses.at(-1), 'synced');
  sync.stop();
});

test('un cambio de misión se guarda con retardo y siempre en la misma fila', async () => {
  const { client, store, sync } = setup();
  await sync.start();
  store.set('mission.site', SITE);
  assert.equal(client.db.missions.length, 0, 'no guarda en el mismo instante');
  await wait(40);
  assert.equal(client.db.missions.length, 1);
  assert.deepEqual(client.db.missions[0].data.mission.site, SITE);
  assert.deepEqual(client.db.missions[0].data.clock, store.get().clock);

  store.set('mission.name', 'Ares');
  await wait(40);
  assert.equal(client.db.missions.length, 1, 'actualiza la fila, no crea otra');
  assert.equal(client.db.missions[0].name, 'Ares');
  sync.stop();
});

test('varios cambios seguidos producen un solo guardado', async () => {
  const { client, store, sync } = setup({ delayMs: 20 });
  await sync.start();
  store.set('mission.name', 'A');
  store.set('mission.name', 'AB');
  store.set('mission.site', SITE);
  await wait(80);
  assert.equal(client.stats.writes, 1);
  sync.stop();
});

test('cambiar el idioma o el reloj no dispara un guardado', async () => {
  const { client, store, sync } = setup();
  await sync.start();
  store.set('lang', 'en');
  store.set('clock.sol', 3);
  await wait(40);
  assert.equal(client.stats.writes, 0);
  sync.stop();
});

test('al recargar, la misión viene de Supabase', async () => {
  const first = setup();
  await first.sync.start();
  first.store.set('mission.site', SITE);
  await first.sync.flush();
  first.sync.stop();

  // La fila cambia en la nube; el navegador conserva lo que tenía al cerrar.
  first.client.db.missions[0].data.mission.name = 'Desde la nube';
  const reload = setup({
    client: first.client,
    storage: first.storage,
    store: fakeStore({ ...emptyMission(), site: SITE }),
  });
  await reload.sync.start();
  assert.equal(reload.store.get().mission.name, 'Desde la nube');
  assert.deepEqual(reload.store.get().mission.site, SITE);
  await wait(40);
  assert.equal(first.client.stats.writes, 1, 'aplicar lo remoto no vuelve a guardar');
  reload.sync.stop();
});

test('navegador nuevo y vacío con misión en la nube: se carga la de la nube', async () => {
  const client = fakeClient({
    missions: [{ id: 'm-old', name: 'Vieja', updated_at: '2026-11-13T10:00:00Z', data: { mission: { ...emptyMission(), name: 'Vieja' }, clock: { sol: 2 } } }],
  });
  const { store, sync } = setup({ client });
  await sync.start();
  assert.equal(store.get().mission.name, 'Vieja');
  assert.equal(store.get().clock.sol, 2);
  sync.stop();
});

test('sin red: no lanza, queda en "offline" y al volver la red sube lo local', async () => {
  const client = fakeClient({
    missions: [{ id: 'm1', name: 'Nube', updated_at: '2026-11-13T10:00:00Z', data: { mission: { ...emptyMission(), name: 'Nube' }, clock: {} } }],
  });
  client.setFailing(true);
  const { store, sync, statuses } = setup({ client });
  assert.equal(await sync.start(), false);
  assert.equal(statuses.at(-1), 'offline');

  store.set('mission.site', SITE); // se trabaja sin red
  await wait(40);
  assert.deepEqual(store.get().mission.site, SITE, 'lo local sigue intacto');
  assert.equal(client.stats.writes, 0);

  client.setFailing(false);
  assert.equal(await sync.flush(), true);
  assert.equal(statuses.at(-1), 'synced');
  assert.deepEqual(store.get().mission.site, SITE, 'gana lo local, no lo de la nube');
  assert.ok(client.db.missions.some((row) => row.data.mission.site?.name === 'Gale'));
  sync.stop();
});

test('si la fila guardada ya no es de esta sesión, crea una nueva', async () => {
  const { client, store, sync } = setup();
  await sync.start();
  store.set('mission.site', SITE);
  await sync.flush();
  client.setRejectUpsert(true);
  store.set('mission.name', 'Otra sesión');
  assert.equal(await sync.flush(), true);
  assert.equal(client.db.missions.length, 2);
  sync.stop();
});

test('huella y misión vacía', () => {
  assert.equal(missionHash(emptyMission()), missionHash(emptyMission()));
  assert.notEqual(missionHash(emptyMission()), missionHash({ ...emptyMission(), site: SITE }));
  assert.equal(isEmptyMission(emptyMission()), true);
  assert.equal(isEmptyMission({ ...emptyMission(), hubs: [{ id: 'h1' }] }), false);
  assert.equal(isEmptyMission({ ...emptyMission(), journal: { day: 1, days: { 1: { water: 0.5 } } } }), false);
});

test('puntuaciones sin Supabase: se guardan y se leen en local, ordenadas', async () => {
  const scores = createScores({ getClient: async () => null, storage: memoryStorage() });
  await scores.submit('memoria', 'Ana', 30);
  const saved = await scores.submit('memoria', '  Un alias demasiado largo para la tabla  ', 80.4);
  await scores.submit('otro', 'Luis', 999);
  assert.equal(saved.cloud, false);
  assert.equal(saved.alias.length, 16);
  assert.equal(saved.points, 80);
  const top = await scores.top('memoria');
  assert.equal(top.source, 'local');
  assert.deepEqual(top.rows.map((r) => r.points), [80, 30]);
});

test('puntuaciones con Supabase: se insertan y se leen de la nube; si falla, responde lo local', async () => {
  const client = fakeClient();
  const scores = createScores({ getClient: async () => client, storage: memoryStorage() });
  const saved = await scores.submit('memoria', 'Ana', 50);
  assert.equal(saved.cloud, true);
  assert.equal(client.db.scores.length, 1);
  assert.equal((await scores.top('memoria')).source, 'cloud');

  client.setFailing(true);
  const offline = await scores.submit('memoria', 'Ana', 70);
  assert.equal(offline.cloud, false);
  const top = await scores.top('memoria');
  assert.equal(top.source, 'local');
  assert.deepEqual(top.rows.map((r) => r.points), [70, 50]);
});

test('alias vacío y puntos inválidos se normalizan', async () => {
  assert.equal(cleanAlias('   '), 'LAIKA');
  assert.equal(cleanAlias('a   b'), 'a b');
  const scores = createScores({ getClient: async () => null, storage: memoryStorage() });
  assert.equal((await scores.submit('x', null, -5)).points, 0);
  assert.equal((await scores.submit('x', null, 'abc')).points, 0);
});

test('una llave de servidor nunca se acepta en el navegador', () => {
  const jwt = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;
  assert.equal(isServerKey(jwt({ role: 'service_role' })), true);
  assert.equal(isServerKey('sb_secret_abc'), true);
  assert.equal(isServerKey(jwt({ role: 'anon' })), false);
  assert.equal(isServerKey('sb_publishable_abc'), false);
});

test('login anónimo desactivado en Supabase: avisa una vez y no reintenta en cada cambio', async () => {
  let signIns = 0;
  const err = Object.assign(new Error('Anonymous sign-ins are disabled'), { code: 'anonymous_provider_disabled', status: 422 });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => {
        signIns++;
        return { data: null, error: err };
      },
    },
  };
  const warn = console.warn;
  const warnings = [];
  console.warn = (msg) => warnings.push(String(msg));
  try {
    const { store, sync, statuses } = setup({ client });
    assert.equal(await sync.start(), false);
    store.set('mission.site', SITE);
    store.set('mission.name', 'Prueba');
    await wait(40);
    assert.equal(await sync.flush(), false);
    assert.equal(signIns, 1, 'un solo intento');
    assert.equal(statuses.at(-1), 'offline');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /anonymous/i);
  } finally {
    console.warn = warn;
  }
});
