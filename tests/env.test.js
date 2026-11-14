// Comprueba el entorno con datos reales (tarea A3) contra hechos conocidos de Marte.
// Lee las rejillas de public/data/ directamente del disco.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, setDataLoader, PROFILES, radiationFromPressure, RADIATION_MODEL } from '../src/core/env.js';
import { HUMAN_NEEDS, HUMAN_REFERENCES, solsToCareerLimit } from '../src/core/human-needs.js';
import { checkLanding, bestZones } from '../src/modules/map/zone.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

setDataLoader(async (name) => {
  const buffer = await readFile(join(dataDir, name));
  if (name.endsWith('.json')) return JSON.parse(buffer.toString('utf8'));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

const noon = { sol: 0, localHour: 12, ls: 0 };
const GALE = [-4.59, 137.44]; // aterrizaje de Curiosity
const OLYMPUS = [17.375, -132.875]; // punto más alto de la rejilla, en el borde de la caldera
const VIKING1 = [22.27, -47.95]; // llanura de Chryse
const HELLAS = [-42.4, 70.5];

before(() => env.ready());

test('ya no son datos de relleno', () => {
  assert.equal(env.isMock, false);
  assert.equal(env.sample(0, 0, noon).mock, false);
  assert.equal(env.evaluate(0, 0, noon).mock, false);
});

test('elevación MOLA: Olympus Mons, Hellas y Gale', () => {
  assert.ok(env.sample(...OLYMPUS, noon).elevationM > 20000, 'la cima de Olympus Mons supera los 20 km');
  assert.ok(env.sample(...HELLAS, noon).elevationM < -5500, 'el fondo de Hellas está por debajo de -5.5 km');
  const gale = env.sample(...GALE, noon).elevationM;
  assert.ok(gale > -5000 && gale < -3000, `Gale ronda los -4.4 km (salió ${gale.toFixed(0)})`);
});

test('la presión baja con la altura y Gale queda en el rango que midió Curiosity', () => {
  const top = env.sample(...OLYMPUS, noon).pressurePa;
  const gale = env.sample(...GALE, noon).pressurePa;
  const hellas = env.sample(...HELLAS, noon).pressurePa;
  assert.ok(top < 150, `cima de Olympus: ${top.toFixed(0)} Pa`);
  assert.ok(gale > 650 && gale < 1050, `Gale: ${gale.toFixed(0)} Pa (REMS mide entre unos 700 y 1000 Pa)`);
  assert.ok(hellas > gale, 'Hellas, más profundo, tiene más presión que Gale');
});

test('temperatura: ciclo diario, mínimas y máximas coherentes', () => {
  const day = env.sample(...GALE, { ...noon, localHour: 14 });
  const night = env.sample(...GALE, { ...noon, localHour: 4 });
  assert.ok(day.temperatureC > night.temperatureC + 30, 'la tarde es mucho más cálida que la madrugada');
  assert.ok(day.temperatureMinC <= night.temperatureC + 0.01 && day.temperatureMaxC >= day.temperatureC - 0.01);
  assert.ok(day.temperatureMaxC > -40 && day.temperatureMaxC < 25, `máxima en Gale: ${day.temperatureMaxC.toFixed(0)} °C`);
  assert.ok(day.temperatureMinC > -110 && day.temperatureMinC < -55, `mínima en Gale: ${day.temperatureMinC.toFixed(0)} °C`);
});

test('las estaciones cambian la temperatura en latitudes altas', () => {
  const summer = env.sample(65, 0, { ...noon, ls: 90 });
  const winter = env.sample(65, 0, { ...noon, ls: 270 });
  assert.ok(summer.temperatureMaxC > winter.temperatureMaxC + 30);
  assert.ok(summer.solarWm2 > winter.solarWm2 + 50, 'en invierno polar casi no llega sol');
});

test('el polvo sube en la primavera y verano australes', () => {
  const clear = env.sample(0, 0, { ...noon, ls: 90 }).dustOpacity;
  const dusty = env.sample(0, 0, { ...noon, ls: 240 }).dustOpacity;
  assert.ok(dusty > clear, `tau ${dusty.toFixed(2)} (Ls 240) frente a ${clear.toFixed(2)} (Ls 90)`);
});

test('hielo SWIM: alto en Arcadia, bajo en el ecuador, sin datos más allá de 60°', () => {
  assert.ok(env.sample(45, -150, noon).iceIndex > 0.4);
  assert.ok(env.sample(...GALE, noon).iceIndex < 0.2);
  assert.equal(env.sample(75, 0, noon).iceIndex, null);
  assert.equal(env.sample(-75, 0, noon).iceIndex, null);
});

test('radiación: el punto de calibración y los límites del modelo', () => {
  assert.equal(radiationFromPressure(RADIATION_MODEL.refPressurePa), RADIATION_MODEL.doseAtRefMSvDay);
  assert.ok(radiationFromPressure(700) > radiationFromPressure(970));
  assert.ok(Math.abs(radiationFromPressure(700) - radiationFromPressure(970) - 0.1) < 1e-9);
  assert.ok(env.sample(...OLYMPUS, noon).radiationMSvDay > env.sample(...HELLAS, noon).radiationMSvDay);
});

test('evaluación: pesos que suman 1, factores con referencia y hielo sin datos fuera de la cobertura', () => {
  for (const profile of Object.keys(PROFILES)) {
    const result = env.evaluate(40, -150, noon, profile);
    const total = result.factors.reduce((sum, f) => sum + f.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `perfil ${profile}`);
    assert.ok(result.score >= 0 && result.score <= 100);
    for (const factor of result.factors) assert.ok(factor.refId && factor.refId !== 'mock');
  }
  const polar = env.evaluate(75, 0, noon, 'habitat');
  const water = polar.factors.find((f) => f.id === 'water');
  assert.equal(water.value, null);
  assert.equal(water.weight, 0);
  assert.ok(Math.abs(polar.factors.reduce((sum, f) => sum + f.weight, 0) - 1) < 1e-9);
});

test('cráteres: Gale está en la base y el filtro por diámetro funciona', async () => {
  const near = await env.craters({ south: -8, west: 135, north: -3, east: 140 }, 100);
  assert.ok(near.some((c) => c.diameterKm > 140 && c.diameterKm < 165), 'Gale mide unos 154 km');
  const all = await env.craters({ south: -90, west: -180, north: 90, east: 180 }, 5);
  assert.ok(all.length > 40000);
  assert.ok(all.every((c) => c.diameterKm >= 5));
  const big = await env.craters({ south: -90, west: -180, north: 90, east: 180 }, 300);
  assert.ok(big.length > 3 && big.length < 100);
});

test('rejilla de elevación: forma, orientación y valores', async () => {
  const bbox = { south: 13, west: -139, north: 24, east: -128 };
  const grid = await env.elevationGrid(bbox, 32);
  assert.equal(grid.data.length, 32 * 32);
  assert.equal(grid.mock, false);
  assert.ok(Math.max(...grid.data) > 20000, 'Olympus Mons cabe en el recuadro');
  assert.ok(Math.abs(grid.data[0] - env.sample(24, -139, noon).elevationM) < 1, 'la fila 0 es el borde norte');
});

test('restricciones de aterrizaje: la llanura de Viking 1 cumple, Olympus Mons y los polos no', () => {
  assert.ok(checkLanding(VIKING1[0], env.sample(...VIKING1, noon)).every((c) => c.ok));
  const olympus = checkLanding(OLYMPUS[0], env.sample(...OLYMPUS, noon));
  assert.equal(olympus.find((c) => c.id === 'elevation').ok, false);
  const polar = checkLanding(80, env.sample(80, 0, noon));
  assert.equal(polar.find((c) => c.id === 'latitude').ok, false);
});

test('mejores zonas: cumplen las restricciones, van de mayor a menor y están separadas', () => {
  const zones = bestZones(env, noon, { count: 6 });
  assert.equal(zones.length, 6);
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    assert.ok(checkLanding(z.lat, env.sample(z.lat, z.lon, noon)).every((c) => c.ok));
    assert.equal(z.score, env.evaluate(z.lat, z.lon, noon, 'habitat').score);
    if (i > 0) assert.ok(z.score <= zones[i - 1].score);
  }
  assert.ok(zones[0].score > env.evaluate(...GALE, noon).score, 'hay zonas mejores que Gale para un hábitat');
});

test('necesidades humanas: valores con referencia', () => {
  const ids = new Set(HUMAN_REFERENCES.map((r) => r.id));
  for (const need of Object.values(HUMAN_NEEDS)) assert.ok(ids.has(need.refId), need.id);
  assert.equal(HUMAN_NEEDS.potableWater.value, HUMAN_NEEDS.drinkingWater.value + HUMAN_NEEDS.foodWater.value);
  const sols = solsToCareerLimit(0.7);
  assert.ok(sols > 800 && sols < 870, `a 0.7 mSv/día el límite de 600 mSv se alcanza en unos ${sols.toFixed(0)} soles`);
});
