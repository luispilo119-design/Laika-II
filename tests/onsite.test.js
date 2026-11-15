// «En sitio» 3D (descent): lógica pura de vehículos, paradas de rovers y datos compartidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROVER, makeVehicle, stepVehicle } from '../src/modules/descent/vehicles.js';
import { stopsOf, ROVER_IDS } from '../src/core/rovers.js';

const flat = { heightAt: () => 0, clampToArea: (v) => Math.max(-7960, Math.min(7960, v)), obstacles: [], daylight: 1 };
const rovers = JSON.parse(readFileSync(new URL('../public/data/rovers.json', import.meta.url), 'utf8'));

test('el rover acelera hacia su frente y gasta batería', () => {
  const v = makeVehicle(0, 0, 0); // rumbo 0 = este
  for (let i = 0; i < 100; i++) stepVehicle(v, ROVER, 0.05, { forward: 1, strafe: 0, turn: 0, run: false }, flat);
  assert.ok(v.x > 10, `avanzó al este: ${v.x}`);
  assert.ok(Math.abs(v.z) < 1e-9);
  assert.ok(v.speed <= ROVER.maxSpeed + 1e-9);
  assert.ok(v.battery < 1);
  assert.ok(v.odometer > 10);
});

test('un choque rápido contra una roca hace daño y no la atraviesa', () => {
  const v = makeVehicle(0, 0, 0);
  v.speed = ROVER.maxSpeed;
  const rock = { x: 3.5, z: 0, r: 1 }; // queda a menos de r + 0.8·radio del rover
  stepVehicle(v, ROVER, 0.05, { forward: 1, strafe: 0, turn: 0, run: false }, { ...flat, obstacles: [rock] });
  assert.equal(v.warn, 'crash');
  assert.ok(v.damage > 0);
  assert.ok(Math.hypot(v.x - rock.x, v.z - rock.z) >= rock.r + ROVER.radius * 0.8 - 1e-9);
});

test('en una ladera fuerte el rover se inclina y avisa', () => {
  const v = makeVehicle(0, 0, Math.PI / 2); // mirando al norte, ladera que sube hacia el este
  stepVehicle(v, ROVER, 0.05, { forward: 0, strafe: 0, turn: 0, run: false }, { ...flat, heightAt: (x) => x * 0.8 });
  assert.ok(v.tilt > ROVER.maxTiltDeg, `${v.tilt}°`);
  assert.equal(v.warn, 'tilt');
});

test('rovers.json trae las paradas de los dos rovers, en orden de sol', () => {
  for (const id of ROVER_IDS) {
    const rover = rovers.rovers[id];
    const stops = stopsOf(rover);
    assert.ok(stops.length > 100, `${id}: ${stops.length} paradas`);
    for (let i = 1; i < stops.length; i++) assert.ok(stops[i].sol >= stops[i - 1].sol, `${id} parada ${i}`);
    const first = stops[0];
    assert.deepEqual([first.lat, first.lon], rover.landing, 'la primera parada es el aterrizaje');
    const last = stops.at(-1);
    assert.equal(last.sol, rover.lastSol);
    assert.ok(Math.abs(last.distM / 1000 - rover.distanceKm) < 0.01);
    assert.ok(stops.every((s) => s.elevM === null || (s.elevM > -9000 && s.elevM < 22000)), 'sin -9999 como dato');
  }
});
