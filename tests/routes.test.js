// Rutas de conducción (Parte B, tarea B4): geometría, A*, rodeo de cráteres y guía por tramos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm,
  bearingDeg,
  compass8,
  compass4,
  routeBBox,
  expandBBox,
  makeGrid,
  craterMask,
  findPath,
  planRoute,
  speedOnSlope,
  segmentTime,
  smoothPath,
  joinLegs,
} from '../src/modules/routes/routing.js';
import { PROFILES, PROFILE_IDS, REFERENCES, refOf } from '../src/modules/routes/profiles.js';

/** Rejilla de prueba: `elev(lat, lon)` en metros sobre un recuadro. */
function elevation(bbox, size, elev = () => 0) {
  const data = new Float32Array(size * size);
  for (let row = 0; row < size; row++) {
    const lat = bbox.north - ((bbox.north - bbox.south) * row) / (size - 1);
    for (let col = 0; col < size; col++) {
      const lon = bbox.west + ((bbox.east - bbox.west) * col) / (size - 1);
      data[row * size + col] = elev(lat, lon);
    }
  }
  return { width: size, height: size, data, bbox, mock: true };
}

const BOX = { south: -2, north: 2, west: -2, east: 2 };
const A = [0, -1.5];
const B = [0, 1.5];
const rover = PROFILES.pressurized_rover;

test('distancia y rumbo sobre Marte', () => {
  assert.ok(Math.abs(distanceKm([0, 0], [0, 1]) - 59.16) < 0.01, 'un grado en el ecuador ≈ 59.16 km');
  assert.ok(Math.abs(distanceKm([0, 0], [1, 0]) - 59.16) < 0.01);
  assert.ok(distanceKm([60, 0], [60, 1]) < 30, 'los meridianos se juntan hacia los polos');
  assert.equal(compass8(bearingDeg([0, 0], [1, 0])), 'n');
  assert.equal(compass8(bearingDeg([0, 0], [0, 1])), 'e');
  assert.equal(compass8(bearingDeg([0, 0], [-1, -1])), 'sw');
  assert.equal(compass4(bearingDeg([0, 0], [0, -1])), 'w');
});

test('el recuadro de trabajo contiene los dos puntos con margen', () => {
  const box = routeBBox(A, B);
  assert.ok(box.south < 0 && box.north > 0 && box.west < -1.5 && box.east > 1.5);
  assert.ok(box.north - box.south > 1, 'una ruta este-oeste también tiene espacio al norte y al sur');
});

test('los cráteres se piden en un recuadro más amplio que el de trabajo', () => {
  const wide = expandBBox({ south: 0, north: 2, west: 3, east: 5 }, 2);
  assert.deepEqual([wide.south, wide.north], [-2, 4]);
  assert.ok(wide.west < 1.01 && wide.east > 6.99);
  const polar = expandBBox({ south: 60, north: 62, west: 0, east: 2 }, 2);
  assert.ok(polar.east - polar.west > wide.east - wide.west, 'cerca del polo hacen falta más grados de longitud');
});

test('un cráter con el centro fuera del recuadro también bloquea su borde', () => {
  const crater = { lat: 0, lon: -2.3, diameterKm: 60 }; // centro al oeste del recuadro (west = -2)
  const mask = craterMask(makeGrid(elevation(BOX, 65)), [crater]);
  const blockedCells = mask.blocked.reduce((sum, v) => sum + v, 0);
  assert.ok(blockedCells > 0, 'la parte del cráter que entra al recuadro queda prohibida');
  // Un origen dentro de ese cráter no queda atrapado: el cráter pasa a "inside".
  const route = planRoute({ origin: [0, -1.9], destination: B, profile: rover, elevation: elevation(BOX, 65), craters: [crater] });
  assert.equal(route.ok, true);
  assert.deepEqual(route.inside.origin, [crater]);
});

test('terreno plano y sin cráteres: ruta casi recta', () => {
  const route = planRoute({ origin: A, destination: B, profile: rover, elevation: elevation(BOX, 65), craters: [] });
  assert.equal(route.ok, true);
  const straight = distanceKm(A, B);
  assert.ok(route.distanceKm >= straight - 0.01 && route.distanceKm < straight * 1.01, `${route.distanceKm} vs ${straight}`);
  assert.ok(Math.abs(route.durationH - straight / rover.speedKmh) < 0.5);
  assert.deepEqual(route.steps.map((s) => s.type), ['depart', 'arrive']);
  assert.equal(route.steps[0].dir, 'e');
  assert.deepEqual(route.points[0], A);
  assert.deepEqual(route.points.at(-1), B);
});

test('un cráter grande en medio se rodea y aparece en la guía', () => {
  const crater = { lat: 0.1, lon: 0, diameterKm: 60 };
  const route = planRoute({ origin: A, destination: B, profile: rover, elevation: elevation(BOX, 65), craters: [crater] });
  assert.equal(route.ok, true);
  assert.ok(route.distanceKm > distanceKm(A, B) * 1.02, 'el rodeo alarga la ruta');
  for (const sample of route.samples) {
    assert.ok(distanceKm([crater.lat, crater.lon], sample.point) > 30, 'ningún punto de la ruta entra al cráter');
  }
  const step = route.steps.find((s) => s.type === 'crater');
  assert.ok(step, 'la guía menciona el cráter');
  assert.equal(step.side, 's', 'el centro está algo al norte: se rodea por el sur');
  assert.equal(step.diameterKm, 60);
});

test('cada perfil evita cráteres desde su propio tamaño', () => {
  const crater = { lat: 0, lon: 0, diameterKm: 20 };
  const input = { origin: A, destination: B, elevation: elevation(BOX, 65), craters: [crater] };
  const driving = planRoute({ ...input, profile: PROFILES.pressurized_rover });
  const walking = planRoute({ ...input, profile: PROFILES.on_foot });
  assert.equal(driving.avoided.length, 1);
  assert.equal(walking.avoided.length, 0, 'a pie no se evita un cráter de 20 km');
  assert.ok(driving.distanceKm > walking.distanceKm);
  assert.ok(walking.durationH > driving.durationH, 'a pie es más corto pero más lento');
});

test('si no hay paso, lo dice en vez de inventar una ruta', () => {
  // Una pared de cráteres de norte a sur.
  const wall = [];
  for (let lat = -2.5; lat <= 2.5; lat += 0.4) wall.push({ lat, lon: 0, diameterKm: 40 });
  const blocked = planRoute({ origin: A, destination: B, profile: rover, elevation: elevation(BOX, 65), craters: wall });
  assert.deepEqual([blocked.ok, blocked.reason], [false, 'no_path']);
  assert.equal(blocked.avoided.length, wall.length, 'aun sin ruta, dice qué cráteres cierran el paso');

});

test('un sitio dentro de un cráter (como Jezero) no queda atrapado: la ruta sale y lo avisa', () => {
  const home = { lat: 0, lon: -1.5, diameterKm: 50 }; // el origen A está en su centro
  const other = { lat: 0.1, lon: 0.3, diameterKm: 40 }; // este sí se rodea
  const route = planRoute({ origin: A, destination: B, profile: rover, elevation: elevation(BOX, 65), craters: [home, other] });
  assert.equal(route.ok, true);
  assert.deepEqual(route.inside.origin, [home]);
  assert.deepEqual(route.avoided, [other], 'el cráter del origen no cuenta como obstáculo');
  assert.deepEqual(route.steps.map((s) => s.type), ['depart', 'exit', 'crater', 'arrive']);
  assert.equal(route.steps[1].diameterKm, 50);

  const into = planRoute({ origin: B, destination: A, profile: rover, elevation: elevation(BOX, 65), craters: [home] });
  assert.equal(into.ok, true);
  assert.deepEqual(into.steps.map((s) => s.type), ['depart', 'enter', 'arrive']);
});

test('una pendiente mayor que el límite del vehículo no se cruza', () => {
  // Escarpe de norte a sur en lon = 0: 3 km de desnivel en un tramo corto.
  const cliff = elevation(BOX, 65, (_lat, lon) => (lon > 0 ? 3000 : 0));
  const route = planRoute({ origin: A, destination: B, profile: rover, elevation: cliff, craters: [] });
  assert.deepEqual([route.ok, route.reason], [false, 'no_path']);

  // Una rampa suave sí se sube, y la guía dice dónde está la pendiente máxima.
  const ramp = elevation(BOX, 65, (_lat, lon) => (lon + 2) * 1500);
  const up = planRoute({ origin: A, destination: B, profile: rover, elevation: ramp, craters: [] });
  assert.equal(up.ok, true);
  assert.ok(up.maxSlope.deg > 1 && up.maxSlope.deg < rover.maxSlopeDeg);
  assert.ok(up.steps.some((s) => s.type === 'slope'));
  assert.ok(up.durationH > distanceKm(A, B) / rover.speedKmh, 'la pendiente frena');
});

test('la pendiente frena de forma gradual hasta el límite', () => {
  assert.equal(speedOnSlope(rover, 0), rover.speedKmh);
  assert.ok(Math.abs(speedOnSlope(rover, rover.maxSlopeDeg) - rover.speedKmh * 0.4) < 1e-9);
  assert.ok(speedOnSlope(rover, 5) > speedOnSlope(rover, 10));
});

test('A* no corta la esquina de una celda prohibida', () => {
  const grid = makeGrid(elevation(BOX, 9));
  const mask = craterMask(grid, []);
  // Dos celdas prohibidas en diagonal: no se pasa entre ellas.
  mask.blocked[4 * 9 + 4] = 1;
  mask.blocked[3 * 9 + 5] = 1;
  const cells = findPath(grid, mask, rover, [4, 5], [3, 4]);
  assert.ok(cells.length > 2, 'da la vuelta en vez de cruzar en diagonal');
});

test('perfiles: claves del contrato y fuentes registradas', () => {
  assert.deepEqual(PROFILE_IDS, ['pressurized_rover', 'light_rover', 'on_foot']);
  for (const id of PROFILE_IDS) {
    const p = PROFILES[id];
    assert.ok(p.speedKmh > 0 && p.maxSlopeDeg > 0 && p.avoidCraterKm > 0);
    if (p.speedRef) assert.ok(refOf(p.speedRef), `referencia desconocida: ${p.speedRef}`);
  }
  assert.equal(new Set(REFERENCES.map((r) => r.id)).size, REFERENCES.length);
});

test('terreno plano: una ruta oblicua también sale casi recta (sin escalones de 45°)', () => {
  const from = [-1.2, -1.5];
  const to = [0.6, 1.5];
  const route = planRoute({ origin: from, destination: to, profile: rover, elevation: elevation(BOX, 65), craters: [] });
  assert.equal(route.ok, true);
  assert.ok(route.distanceKm < distanceKm(from, to) * 1.01, `${route.distanceKm} vs ${distanceKm(from, to)}`);
});

test('el suavizado nunca deja la ruta más lenta que el tramo de rejilla que reemplaza', () => {
  // Una loma suave en medio: la recta la cruza (se puede, pero frena); rodearla es más rápido.
  const hill = elevation(BOX, 65, (lat, lon) => 2600 * Math.exp(-((lat * lat + lon * lon) / 0.35)));
  const grid = makeGrid(hill);
  const mask = craterMask(grid, []);
  const start = grid.toCell(A);
  const goal = grid.toCell(B);
  const cells = findPath(grid, mask, rover, start, goal);
  assert.ok(cells);
  const timeOf = (pts) => pts.slice(1).reduce((sum, p, k) => sum + segmentTime(grid, mask, rover, pts[k], p), 0);
  const smooth = smoothPath(grid, mask, rover, cells);
  assert.ok(timeOf(smooth) <= timeOf(cells) + 1e-6, `${timeOf(smooth)} > ${timeOf(cells)}`);
  const straight = segmentTime(grid, mask, rover, start, goal);
  assert.ok(timeOf(smooth) <= straight + 1e-6, 'no es más lenta que la recta');
});

test('paradas intermedias: los tramos se unen en una sola ruta con distancias acumuladas', () => {
  const flat = elevation(BOX, 65);
  const stop = [0.8, 0];
  const leg1 = planRoute({ origin: A, destination: stop, profile: rover, elevation: flat, craters: [] });
  const leg2 = planRoute({ origin: stop, destination: B, profile: rover, elevation: flat, craters: [] });
  const joined = joinLegs([leg1, leg2]);
  assert.equal(joined.ok, true);
  assert.ok(Math.abs(joined.distanceKm - (leg1.distanceKm + leg2.distanceKm)) < 1e-9);
  assert.ok(Math.abs(joined.durationH - (leg1.durationH + leg2.durationH)) < 1e-9);
  assert.deepEqual(joined.points[0], A);
  assert.deepEqual(joined.points.at(-1), B);
  assert.ok(joined.points.some((p) => p[0] === stop[0] && p[1] === stop[1]), 'pasa por la parada');
  const types = joined.steps.map((s) => s.type);
  assert.equal(types[0], 'depart');
  assert.equal(types.at(-1), 'arrive');
  assert.equal(types.filter((x) => x === 'stop').length, 1);
  assert.equal(types.filter((x) => x === 'arrive').length, 1);
  assert.ok(joined.samples.every((s, i) => i === 0 || s.km >= joined.samples[i - 1].km), 'km crecientes');
});
