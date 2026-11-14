// Descenso en primera persona (Parte B, tarea B5): la parte que no necesita WebGL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_M,
  areaBBox,
  toLatLon,
  makeHeightField,
  microRelief,
  sunState,
  dustFogDensity,
  easeInOut,
} from '../src/modules/descent/terrain.js';

const SITE = { lat: 18.44, lon: 77.45 };

function elevation(size, elev) {
  const data = new Float32Array(size * size);
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) data[row * size + col] = elev(row, col);
  return { width: size, height: size, data, bbox: areaBBox(SITE), mock: true };
}

test('el recuadro del terreno mide lo pedido y queda centrado en el sitio', () => {
  const box = areaBBox(SITE);
  assert.ok(Math.abs((box.north + box.south) / 2 - SITE.lat) < 1e-9);
  assert.ok(Math.abs((box.east + box.west) / 2 - SITE.lon) < 1e-9);
  const northSouthM = (box.north - box.south) * ((Math.PI * 3389.5) / 180) * 1000;
  assert.ok(Math.abs(northSouthM - AREA_M) < 1, `${northSouthM} m`);
  assert.ok(box.east - box.west > box.north - box.south, 'lejos del ecuador hacen falta más grados de longitud');
});

test('la posición en la escena se convierte a latitud y longitud', () => {
  assert.deepEqual(toLatLon(SITE, 0, 0), SITE);
  assert.ok(toLatLon(SITE, 0, -1000).lat > SITE.lat, 'z negativo es norte');
  assert.ok(toLatLon(SITE, 1000, 0).lon > SITE.lon, 'x positivo es este');
  const corner = toLatLon(SITE, AREA_M / 2, AREA_M / 2);
  const box = areaBBox(SITE);
  assert.ok(Math.abs(corner.lat - box.south) < 1e-9 && Math.abs(corner.lon - box.east) < 1e-9);
});

test('el campo de alturas pone el sitio en cero y conserva la elevación real', () => {
  // Rampa que sube 100 m de norte (fila 0) a sur.
  const field = makeHeightField(elevation(65, (row) => 2000 + (row / 64) * 100));
  assert.equal(Math.round(field.base), 2050);
  assert.ok(Math.abs(field.heightAt(0, 0) - microRelief(0, 0)) < 1e-6, 'en el sitio solo queda el relieve fino');
  assert.ok(Math.abs(field.elevationAt(0, AREA_M / 2) - 2100) < 1e-3, 'borde sur');
  assert.ok(Math.abs(field.elevationAt(0, -AREA_M / 2) - 2000) < 1e-3, 'borde norte');
  assert.ok(field.heightAt(0, 2000) > field.heightAt(0, -2000), 'la rampa se nota en la escena');
  assert.equal(field.clampToArea(1e9), AREA_M / 2 - 40, 'no se sale del terreno');
});

test('el relieve fino decorativo es pequeño', () => {
  for (let x = -3000; x <= 3000; x += 137) {
    for (let z = -3000; z <= 3000; z += 211) assert.ok(Math.abs(microRelief(x, z)) <= 0.6);
  }
});

test('el Sol sale por el este, culmina al mediodía y se pone por el oeste', () => {
  const dawn = sunState(6);
  const noon = sunState(12);
  const dusk = sunState(18);
  const night = sunState(0);
  assert.ok(dawn.dir[0] > 0.9 && Math.abs(dawn.dir[1]) < 0.01, 'a las 6, en el horizonte este');
  assert.ok(noon.dir[1] > 0.95, 'a las 12, arriba');
  assert.ok(dusk.dir[0] < -0.9, 'a las 18, al oeste');
  assert.ok(night.dir[1] < -0.9 && night.daylight === 0, 'a medianoche, bajo el horizonte');
  assert.equal(noon.daylight, 1);
  assert.ok(dawn.daylight > 0 && dawn.daylight < 1, 'al amanecer hay media luz');
  for (const h of [0, 3, 6, 9, 12, 15, 18, 21, 24]) assert.ok(Math.abs(Math.hypot(...sunState(h).dir) - 1) < 1e-9);
});

test('más polvo, más niebla; la bajada avanza de 0 a 1 sin saltos', () => {
  assert.ok(dustFogDensity(1.5) > dustFogDensity(0.3));
  assert.equal(dustFogDensity(99), dustFogDensity(3), 'con tope');
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
  let prev = 0;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const v = easeInOut(t);
    assert.ok(v >= prev - 1e-12);
    prev = v;
  }
});
