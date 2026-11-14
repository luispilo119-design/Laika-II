// Tránsito y confinamiento (Parte B, tarea B3): cálculos del viaje, rutina y reglas del minijuego.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hohmannDays,
  DEFAULT_TRIP_DAYS,
  tripInfo,
  estimates,
  stageOf,
  DEFAULT_PLAN,
  planTotal,
  sanitizePlan,
  adjustPlan,
  planChecks,
} from '../src/modules/transit/trip.js';
import { TILES, roundSpec, makeSequence, expectedInput, roundPoints } from '../src/modules/transit/game.js';
import { REFERENCES, refOf, STAGES, METERS, HAZARDS, SOLO_CHANGES, SOLO_TIPS, ANALOGS, ACTIVITIES } from '../src/modules/transit/data.js';
import messages from '../src/modules/transit/i18n.js';

test('la duración por defecto es la transferencia de Hohmann: 259 días', () => {
  assert.equal(hohmannDays(), 259);
  assert.equal(DEFAULT_TRIP_DAYS, 259);
});

test('la duración sale de la misión; sin plan o con fechas inválidas usa la de por defecto', () => {
  const planned = tripInfo({ departure: '2028-11-20T00:00:00Z', arrival: '2029-08-05T00:00:00Z' });
  assert.deepEqual([planned.days, planned.isDefault], [258, false]);
  for (const mission of [undefined, {}, { departure: null, arrival: null }, { departure: 'x', arrival: 'y' }]) {
    assert.deepEqual([tripInfo(mission).days, tripInfo(mission).isDefault], [259, true]);
  }
  const backwards = tripInfo({ departure: '2029-08-05T00:00:00Z', arrival: '2028-11-20T00:00:00Z' });
  assert.equal(backwards.isDefault, true, 'una llegada anterior a la salida no vale');
});

test('los acumulados crecen de forma lineal con los días', () => {
  assert.deepEqual(estimates(0), { boneLossPct: [0, 0], doseMSv: 0, exerciseH: 0 });
  const day100 = estimates(100);
  assert.equal(day100.doseMSv, 180);
  assert.equal(day100.exerciseH, 200);
  const month = estimates(365.25 / 12);
  assert.ok(Math.abs(month.boneLossPct[0] - 1) < 1e-9 && Math.abs(month.boneLossPct[1] - 1.5) < 1e-9);
});

test('el tramo del viaje: salida, en ruta y llegada', () => {
  assert.equal(stageOf(0, 259), 'departure');
  assert.equal(stageOf(130, 259), 'cruise');
  assert.equal(stageOf(259, 259), 'arrival');
});

test('la rutina nunca pasa de 24 horas ni baja de cero', () => {
  assert.ok(planTotal(DEFAULT_PLAN) <= 24);
  const full = { sleep: 8, exercise: 2, work: 10, leisure: 4 };
  assert.equal(adjustPlan(full, 'sleep', 0.5), full, 'no cabe media hora más');
  assert.equal(adjustPlan(full, 'sleep', -0.5).sleep, 7.5);
  const none = { ...DEFAULT_PLAN, leisure: 0 };
  assert.equal(adjustPlan(none, 'leisure', -0.5), none);
});

test('un plan guardado dañado vuelve al de por defecto', () => {
  assert.deepEqual(sanitizePlan(undefined), DEFAULT_PLAN);
  assert.deepEqual(sanitizePlan({ sleep: 20, exercise: 20, work: 1, leisure: 1 }), DEFAULT_PLAN);
  assert.deepEqual(sanitizePlan({ sleep: 7.3, exercise: 1, work: 'x', leisure: -2 }), { sleep: 7.5, exercise: 1, work: 8, leisure: 0 });
});

test('el plan se compara con las cifras de referencia', () => {
  assert.deepEqual(planChecks({ ...DEFAULT_PLAN, sleep: 6.5, exercise: 1 }), { sleep: 'low', exercise: 'low' });
  assert.deepEqual(planChecks({ ...DEFAULT_PLAN, sleep: 7, exercise: 2 }), { sleep: 'ok', exercise: 'ok' });
  assert.deepEqual(planChecks({ ...DEFAULT_PLAN, sleep: 9.5, exercise: 3 }), { sleep: 'high', exercise: 'ok' });
});

test('minijuego: las rondas crecen y el orden inverso aparece desde la cuarta', () => {
  assert.deepEqual(roundSpec(1, () => 0), { length: 3, reversed: false });
  assert.deepEqual(roundSpec(3, () => 0), { length: 5, reversed: false });
  assert.deepEqual(roundSpec(4, () => 0), { length: 6, reversed: true });
  assert.deepEqual(roundSpec(4, () => 0.9), { length: 6, reversed: false });
  assert.equal(roundSpec(50, () => 0.9).length, 12, 'la longitud tiene tope');
});

test('minijuego: la secuencia usa sistemas válidos y no repite el mismo dos veces seguidas', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const seq = makeSequence(200, rand);
  assert.equal(seq.length, 200);
  seq.forEach((tile, i) => {
    assert.ok(tile >= 0 && tile < TILES.length);
    if (i > 0) assert.notEqual(tile, seq[i - 1]);
  });
  assert.equal(makeSequence(1, () => 1)[0], TILES.length - 1, 'rand() = 1 no se sale de la consola');
});

test('minijuego: entrada esperada y puntos', () => {
  assert.deepEqual(expectedInput([1, 2, 3], false), [1, 2, 3]);
  assert.deepEqual(expectedInput([1, 2, 3], true), [3, 2, 1]);
  assert.equal(roundPoints(4, false), 40);
  assert.equal(roundPoints(4, true), 60);
});

test('todo bloque de contenido apunta a referencias registradas y tiene texto en ambos idiomas', () => {
  const ids = new Set(REFERENCES.map((ref) => ref.id));
  assert.equal(ids.size, REFERENCES.length, 'ids de referencia sin repetir');
  for (const ref of REFERENCES) assert.match(ref.url, /^https:\/\//);
  const groups = { stage: STAGES, meter: METERS, hazard: HAZARDS, analog: ANALOGS, activity: ACTIVITIES };
  for (const [key, items] of Object.entries(groups)) {
    for (const item of items) {
      assert.ok(item.refs.length > 0, `${key}.${item.id} sin fuente`);
      for (const id of item.refs) assert.ok(refOf(id), `referencia desconocida: ${id}`);
      for (const lang of ['es', 'en']) assert.ok(messages[lang][key][item.id], `falta texto ${lang} de ${key}.${item.id}`);
    }
  }
  for (const [key, items] of [['change', SOLO_CHANGES], ['tip', SOLO_TIPS]]) {
    for (const item of items) {
      for (const id of item.refs) assert.ok(refOf(id));
      for (const lang of ['es', 'en']) assert.ok(messages[lang].solo[key][item.id]);
    }
  }
  for (const tile of TILES) for (const lang of ['es', 'en']) assert.ok(messages[lang].tile[tile.id]);
});
