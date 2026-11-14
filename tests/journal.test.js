import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readJournal,
  updateDay,
  dayOf,
  evaluateDay,
  cruiseDays,
  doseSummary,
  journalStats,
  CAREER_LIMIT_MSV,
} from '../src/core/journal.js';

const VALUES = { water: 2, food: 1.51 };

test('diario: lo guardado dañado vuelve a un diario vacío en el sol 1', () => {
  assert.deepEqual(readJournal(null), { day: 1, days: {} });
  const j = readJournal({ day: -4, days: { 0: { water: 1 }, abc: {}, 3: { water: 99, meals: 7, sleep: 'x' } } });
  assert.equal(j.day, 1);
  assert.deepEqual(Object.keys(j.days), ['3']);
  assert.equal(j.days[3].water, 20, 'el agua se acota');
  assert.equal(j.days[3].meals, 3, 'las comidas se acotan a tres');
});

test('diario: updateDay no muta y crea el día si no existía', () => {
  const j = readJournal({});
  const next = updateDay(j, 2, { water: 1.5 });
  assert.deepEqual(j.days, {});
  assert.equal(dayOf(next, 2).water, 1.5);
  assert.equal(dayOf(next, 2).meals, 0);
});

test('diario: un día completo es "good" y uno vacío "poor"', () => {
  const full = evaluateDay({ water: 2, meals: 3, sleep: 8, exercise: 2, eva: 0, checks: {} }, VALUES);
  assert.equal(full.score, 1);
  assert.equal(full.status, 'good');
  assert.equal(full.foodKg, 1.51);
  const empty = evaluateDay({ water: 0, meals: 0, sleep: null, exercise: 0, eva: 0, checks: {} }, VALUES);
  assert.equal(empty.score, 0);
  assert.equal(empty.status, 'poor');
  assert.equal(empty.waterMissing, 2);
});

test('diario: dormir de más también baja la puntuación', () => {
  const ok = evaluateDay({ water: 0, meals: 0, sleep: 9, exercise: 0, eva: 0, checks: {} }, VALUES);
  const over = evaluateDay({ water: 0, meals: 0, sleep: 13, exercise: 0, eva: 0, checks: {} }, VALUES);
  assert.equal(ok.sleep, 1);
  assert.ok(over.sleep < 1);
});

test('dosis: viaje con RAD más soles en superficie, contra el límite de carrera', () => {
  assert.equal(cruiseDays({ departure: '2026-11-04T00:00:00Z', arrival: '2027-07-21T00:00:00Z' }), 259);
  assert.equal(cruiseDays({ departure: null, arrival: null }), 0);
  const d = doseSummary({ cruiseDays: 100, sols: 10, surfaceMSvDay: 0.7 });
  assert.equal(d.cruise, 180);
  assert.ok(Math.abs(d.surface - 7) < 1e-9);
  assert.ok(Math.abs(d.share - 187 / CAREER_LIMIT_MSV) < 1e-9);
  assert.equal(doseSummary({ cruiseDays: 0, sols: 5, surfaceMSvDay: null }).surface, 0, 'sin sitio no se inventa dosis');
});

test('diario: la racha cuenta días buenos seguidos hasta hoy', () => {
  let j = readJournal({ day: 3 });
  const good = { water: 2, meals: 3, sleep: 8, exercise: 2 };
  j = updateDay(updateDay(updateDay(j, 1, { water: 0 }), 2, good), 3, good);
  const s = journalStats(j, VALUES);
  assert.equal(s.streak, 2);
  assert.equal(s.goodDays, 2);
  assert.equal(s.totalWater, 4);
});
