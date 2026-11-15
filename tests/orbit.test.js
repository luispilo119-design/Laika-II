// Pruebas del cálculo orbital contra valores publicados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hohmannIdeal,
  dvFromLowEarthOrbit,
  planetPosition,
  planTransfer,
  findWindows,
  transferPosition,
  marsLs,
  northernSeason,
  isDustSeason,
  wrap180,
  transferBreakdown,
} from '../src/modules/hohmann/orbit.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} no está a ±${tolerance} de ${expected}`);
const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const daysBetween = (a, b) => Math.abs(a.getTime() - b.getTime()) / 86400000;

test('Hohmann ideal Tierra–Marte da los valores de libro', () => {
  const h = hohmannIdeal();
  near(h.transferDays, 258.9, 0.5, 'días de viaje');
  near(h.dvDepartureKmS, 2.94, 0.02, 'Δv de salida');
  near(h.dvArrivalKmS, 2.65, 0.02, 'Δv de llegada');
  near(h.phaseAngleDeg, 44.3, 0.5, 'ángulo de fase');
  near(h.synodicDays, 779.9, 0.5, 'periodo sinódico');
  near(h.earthPeriodDays, 365.26, 0.05, 'año terrestre');
  near(h.marsPeriodDays, 686.98, 0.05, 'año marciano');
  near(dvFromLowEarthOrbit(h.dvDepartureKmS), 3.6, 0.05, 'Δv desde órbita baja');
});

test('Ls reproduce los dos ejemplos resueltos de Mars24 (NASA GISS)', () => {
  near(marsLs(new Date(Date.UTC(2000, 0, 6, 0, 0, 0))), 277.18758, 0.0001, 'ejemplo 1');
  near(marsLs(new Date(Date.UTC(2004, 0, 3, 13, 46, 31))), 327.32416, 0.0001, 'ejemplo 2');
});

test('en las oposiciones de Marte, la Tierra y Marte comparten longitud heliocéntrica', () => {
  for (const day of ['2003-08-28', '2018-07-27', '2020-10-13', '2022-12-08', '2025-01-16']) {
    const date = new Date(`${day}T12:00:00Z`);
    const diff = wrap180(planetPosition('mars', date).lon - planetPosition('earth', date).lon);
    near(diff, 0, 0.6, `oposición ${day}`);
  }
});

test('las distancias al Sol quedan dentro de los límites de cada órbita', () => {
  for (let year = 1990; year <= 2045; year += 1) {
    const date = utc(`${year}-03-15`);
    const earth = planetPosition('earth', date).r;
    const mars = planetPosition('mars', date).r;
    assert.ok(earth > 0.98 && earth < 1.02, `Tierra ${year}: ${earth}`);
    assert.ok(mars > 1.38 && mars < 1.67, `Marte ${year}: ${mars}`);
  }
});

test('las ventanas calculadas caen cerca de lanzamientos reales a Marte', () => {
  const windows = findWindows(utc('2003-01-01'), 9);
  const launches = ['2003-06-10', '2005-08-12', '2011-11-26', '2018-05-05', '2020-07-30'];
  for (const launch of launches) {
    const closest = Math.min(...windows.map((w) => daysBetween(w.departure, utc(launch))));
    assert.ok(closest <= 20, `lanzamiento ${launch}: la ventana más cercana está a ${closest.toFixed(0)} días`);
  }
});

test('las ventanas se repiten cada periodo sinódico y cierran el encuentro', () => {
  const windows = findWindows(utc('2026-11-14'), 4);
  assert.equal(windows.length, 4);
  for (const w of windows) {
    near(w.missDeg, 0, 0.01, 'fallo del encuentro');
    assert.ok(w.transferDays > 230 && w.transferDays < 290, `días de viaje ${w.transferDays}`);
    assert.ok(w.arrivalLs >= 0 && w.arrivalLs < 360);
  }
  // La órbita de Marte es excéntrica: la separación entre ventanas oscila alrededor del periodo sinódico.
  for (let i = 1; i < windows.length; i++) {
    const gap = daysBetween(windows[i].departure, windows[i - 1].departure);
    assert.ok(gap > 730 && gap < 850, `separación entre ventanas ${gap}`);
  }
});

test('en promedio, las ventanas se separan un periodo sinódico', () => {
  // 37 intervalos ≈ 79 años ≈ 42 años marcianos: el ciclo en que la geometría casi se repite.
  const windows = findWindows(utc('1960-01-01'), 38);
  const span = daysBetween(windows.at(-1).departure, windows[0].departure);
  near(span / (windows.length - 1), hohmannIdeal().synodicDays, 3, 'separación media');
});

test('la nave sale de la posición de la Tierra y llega a la de Marte', () => {
  const [plan] = findWindows(utc('2028-01-01'), 1);
  const start = transferPosition(plan, 0);
  const end = transferPosition(plan, 1);
  near(start.x, plan.earthAtDeparture.x, 0.001, 'x de salida');
  near(start.y, plan.earthAtDeparture.y, 0.001, 'y de salida');
  near(end.r, Math.hypot(plan.marsAtArrival.x, plan.marsAtArrival.y), 0.002, 'distancia al Sol al llegar');
  near(wrap180(end.lon - plan.marsAtArrival.lon), 0, 0.05, 'longitud al llegar');
  const middle = transferPosition(plan, 0.5);
  assert.ok(middle.r > start.r && middle.r < end.r);
});

test('planTransfer fuera de ventana reporta que el encuentro falla', () => {
  const plan = planTransfer(utc('2027-11-01'));
  assert.ok(Math.abs(plan.missDeg) > 20);
});

test('las cifras del diálogo de ecuaciones cuadran con el plan', () => {
  const [plan] = findWindows(utc('2026-11-14'), 1);
  const b = transferBreakdown(plan);
  const r1 = plan.earthAtDeparture.r;
  const r2 = plan.marsAtArrival.r;
  // Media elipse: a = (r1 + r2) / 2 y e = (r2 − r1) / (r2 + r1), con las distancias que se muestran.
  near(plan.aTransferAu, (r1 + r2) / 2, 1e-5, 'semieje de la transferencia');
  near(plan.eccentricity, (r2 - r1) / (r2 + r1), 1e-5, 'excentricidad de la transferencia');
  // Los impulsos son la resta de las velocidades vis-viva que se muestran.
  near(plan.dvDepartureKmS, b.vTransferDepartureKmS - b.vEarthKmS, 1e-9, 'Δv de salida');
  near(plan.dvArrivalKmS, b.vMarsKmS - b.vTransferArrivalKmS, 1e-3, 'Δv de llegada');
  // La ventana queda entre un δ positivo antes y uno negativo después.
  assert.ok(b.missBeforeDeg > 0, `δ antes ${b.missBeforeDeg}`);
  assert.ok(b.missAfterDeg < 0, `δ después ${b.missAfterDeg}`);
  near(b.departureCenturies * 36525, b.departureDaysJ2000, 1e-9, 'siglos y días desde J2000');
});

test('estaciones y temporada de polvo a partir de Ls', () => {
  assert.equal(northernSeason(0), 'spring');
  assert.equal(northernSeason(89.9), 'spring');
  assert.equal(northernSeason(90), 'summer');
  assert.equal(northernSeason(200), 'autumn');
  assert.equal(northernSeason(359), 'winter');
  assert.equal(isDustSeason(179), false);
  assert.equal(isDustSeason(220), true);
  assert.equal(isDustSeason(270), false);
});
