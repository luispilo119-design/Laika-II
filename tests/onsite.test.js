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
    for (let i = 1; i < stops.length; i++) assert.ok(stops[i].distM >= stops[i - 1].distM, `${id}: la distancia no baja (parada ${i})`);
  }
});

// ---------- Terreno de 16 km, foto orbital y vista aérea ----------
import { AREA_M, toLatLon, toLocal, insideArea, makeTerrainGrid, gridHeightAt, rayGround, dustFogDensity } from '../src/modules/descent/terrain.js';
import { IMAGERY, chooseImagery, pickLevel, tileCover, tileDeg, tileUrl, uvOf } from '../src/modules/descent/tiles.js';

const JEZERO = { lat: 18.46, lon: 77.34 };

test('toLocal es lo inverso de toLatLon', () => {
  for (const [x, z] of [[0, 0], [5000, -3000], [-7900, 7900], [123.4, -987.6]]) {
    const { lat, lon } = toLatLon(JEZERO, x, z);
    const back = toLocal(JEZERO, lat, lon);
    assert.ok(Math.abs(back.x - x) < 1e-6 && Math.abs(back.z - z) < 1e-6, `${x}, ${z}`);
  }
  assert.ok(insideArea(0, 0));
  assert.ok(!insideArea(AREA_M / 2, 0));
  assert.ok(!insideArea(0, AREA_M / 2 - 100, 1500), 'cerca del borde');
});

test('la altura del suelo coincide con la malla en los vértices y en medio de las celdas', () => {
  const slope = (x, z) => 0.01 * x - 0.02 * z + 100 * Math.sin(x / 900);
  const grid = makeTerrainGrid(slope, 40, 4000);
  // En los vértices, la altura es exactamente la de la función.
  for (const [x, z] of [[-2000, -2000], [0, 0], [1900, -1100], [2000, 2000]]) {
    assert.ok(Math.abs(gridHeightAt(grid, x, z) - slope(x, z)) < 1e-3, `${x}, ${z}`);
  }
  // Un plano se reproduce exacto en cualquier punto (los dos triángulos de cada celda son el mismo plano).
  const plane = makeTerrainGrid((x, z) => 3 * x - 2 * z + 7, 10, 1000);
  for (const [x, z] of [[13.7, -401.2], [-250, 333.3], [499, -499]]) {
    assert.ok(Math.abs(gridHeightAt(plane, x, z) - (3 * x - 2 * z + 7)) < 1e-6);
  }
});

test('un rayo desde arriba toca el suelo donde apunta', () => {
  const grid = makeTerrainGrid((x) => x * 0.05, 64, 8000);
  const heightAt = (x, z) => gridHeightAt(grid, x, z);
  const straightDown = rayGround([500, 3000, -200], [0, -1, 0], heightAt, 20000, 8000);
  assert.ok(Math.abs(straightDown.x - 500) < 1e-6 && Math.abs(straightDown.y - 25) < 0.01);
  const len = Math.hypot(1, -1);
  const slanted = rayGround([0, 1000, 0], [1 / len, -1 / len, 0], heightAt, 20000, 8000);
  // y = 1000 − t·0.707 = 0.05·x con x = t·0.707 → x ≈ 952
  assert.ok(Math.abs(slanted.x - 1000 / 1.05) < 0.5, `${slanted.x}`);
  assert.equal(rayGround([0, 1000, 0], [0, 1, 0], heightAt, 20000, 8000), null, 'mirando al cielo no hay suelo');
});

test('desde lo alto la niebla es más fina', () => {
  assert.ok(dustFogDensity(0.5, 5000) < dustFogDensity(0.5, 0) / 5);
  assert.equal(dustFogDensity(0.5), dustFogDensity(0.5, 0));
});

test('se elige el mosaico regional cuando cubre el terreno y el global en otro caso', () => {
  const bbox = (site) => {
    const nw = toLatLon(site, -AREA_M / 2, -AREA_M / 2);
    const se = toLatLon(site, AREA_M / 2, AREA_M / 2);
    return { west: nw.lon, north: nw.lat, east: se.lon, south: se.lat };
  };
  assert.equal(chooseImagery(bbox(JEZERO)).id, 'jezero');
  assert.equal(chooseImagery(bbox({ lat: -4.7, lon: 137.4 })).id, 'gale');
  assert.equal(chooseImagery(bbox({ lat: 1, lon: 3 })).id, 'global');
  assert.ok(IMAGERY.every((layer) => layer.refId));
});

test('las teselas cubren el recuadro y la imagen no pasa del tamaño pedido', () => {
  const box = { west: 77.2, east: 77.48, south: 18.32, north: 18.6 };
  for (const layer of IMAGERY) {
    const level = pickLevel(box, layer, 2048);
    const tiles = tileCover(box, level);
    const { cover } = tiles;
    assert.ok(cover.west <= box.west && cover.east >= box.east && cover.south <= box.south && cover.north >= box.north);
    const cols = tiles.col1 - tiles.col0 + 1;
    assert.ok((cols - 1) * layer.tileSize <= 2048, `${layer.id}: ${cols} columnas`);
    assert.ok(Math.abs(cover.east - cover.west - cols * tileDeg(level)) < 1e-9);
  }
  const url = tileUrl(IMAGERY[0], 12, 1628, 5857);
  assert.ok(url.endsWith('/12/1628/5857.png'));
  assert.deepEqual(uvOf({ west: 0, east: 10, south: 0, north: 10 }, 10, 0), [0, 1], 'esquina noroeste → u 0, v 1');
});

// ---------- Rutas de los rovers dentro de la escena ----------
import { routeCenter, localStops, stopAtSol, nearestStop, photoSols, pointAtDistance, elevationProfile, MAX_PHOTO_SOLS } from '../src/modules/descent/traverse.js';

const fakeStops = [
  { sol: 10, site: 1, drive: 0, distM: 0, elevM: -2500, x: 0, z: 0 },
  { sol: 12, site: 1, drive: 40, distM: 100, elevM: null, x: 100, z: 0 },
  { sol: 12, site: 1, drive: 90, distM: 150, elevM: -2490, x: 150, z: 0 },
  { sol: 20, site: 2, drive: 0, distM: 400, elevM: -2480, x: 150, z: -250 },
];

test('el recorrido de cada rover cabe en el terreno de 16 km', () => {
  for (const id of ROVER_IDS) {
    const rover = rovers.rovers[id];
    const center = routeCenter(rover);
    const stops = localStops(stopsOf(rover), center);
    const far = Math.max(...stops.map((s) => Math.max(Math.abs(s.x), Math.abs(s.z))));
    assert.ok(far < AREA_M / 2 - 200, `${id}: ${Math.round(far)} m del centro`);
  }
});

test('paradas por sol, por cercanía y a lo largo del recorrido', () => {
  assert.equal(stopAtSol(fakeStops, 5), 0);
  assert.equal(stopAtSol(fakeStops, 12), 2, 'con dos manejos en un sol, la última parada de ese sol');
  assert.equal(stopAtSol(fakeStops, 19), 2);
  assert.equal(stopAtSol(fakeStops, 999), 3);
  assert.equal(nearestStop(fakeStops, 140, 5, 30), 2);
  assert.equal(nearestStop(fakeStops, 500, 500, 30), -1);
  const mid = pointAtDistance(fakeStops, 50);
  assert.deepEqual([mid.x, mid.z, mid.index], [50, 0, 0]);
  const end = pointAtDistance(fakeStops, 1e6);
  assert.equal(end.index, 3);
  assert.deepEqual(elevationProfile(fakeStops).map(([km]) => km), [0, 0.15, 0.4], 'sin las paradas sin dato');
});

test('soles de fotos: exactos con site/drive y aproximados sin ellos', () => {
  const exact = photoSols(fakeStops, 2, true);
  assert.deepEqual(exact.sols, [12, 13, 14, 15]);
  assert.equal(exact.truncated, true, 'se queda en los primeros soles');
  assert.equal(exact.sols.length, MAX_PHOTO_SOLS);
  const approx = photoSols(fakeStops, 1, false);
  assert.deepEqual(approx.sols, [], 'sin site/drive, un sol con dos paradas queda para la última');
  assert.deepEqual(photoSols(fakeStops, 0, false).sols, [10, 11]);
  assert.deepEqual(photoSols(fakeStops, 3, true).sols, [20], 'la última parada: solo su sol');
});

// ---------- Fotos crudas de la NASA ----------
import { normalizeM20, normalizeMSL, cameraFamily, photosForStop, solUrl } from '../src/modules/descent/photos.js';

test('las respuestas de las dos API se leen igual y siempre con https', () => {
  const m20 = normalizeM20({
    images: [
      {
        imageid: 'NLF_0400_A',
        sol: 400,
        site: 4,
        drive: '218',
        sample_type: 'Full',
        camera: { instrument: 'NAVCAM_LEFT' },
        image_files: { small: 'http://x/s.jpg', large: 'https://x/l.jpg' },
        link: 'https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_0400_A',
        credit: 'NASA/JPL-Caltech',
        date_taken_utc: '2022-04-06T10:00:00',
      },
      { imageid: 'thumb', sol: 400, sample_type: 'Thumbnail', camera: { instrument: 'NAVCAM_LEFT' }, image_files: { small: 'a', large: 'b' } },
    ],
  });
  assert.equal(m20.length, 1, 'sin miniaturas');
  assert.equal(m20[0].drive, 218, 'drive llega como texto y se compara como número');
  assert.equal(m20[0].thumb, 'https://x/s.jpg');
  assert.equal(m20[0].family, 'navcam');
  const msl = normalizeMSL({
    items: [{ imageid: '1664ML', sol: 1664, instrument: 'MAST_LEFT', https_url: 'https://y/a.jpg', link: '/raw_images/1', image_credit: 'NASA/JPL-Caltech/MSSS', is_thumbnail: false, site: null, drive: null }],
  });
  assert.equal(msl[0].link, 'https://mars.nasa.gov/raw_images/1');
  assert.equal(msl[0].family, 'mastcam');
  assert.equal(msl[0].site, null);
  assert.equal(cameraFamily('FRONT_HAZCAM_LEFT_A'), 'hazcam');
  assert.equal(cameraFamily('SUPERCAM_RMI'), 'laser');
  assert.ok(solUrl('curiosity', 12).includes('condition_2=12:sol:eq'));
});

test('con Perseverance quedan solo las fotos de la parada exacta', async () => {
  const stops = [
    { sol: 99, site: 4, drive: 218, distM: 0 },
    { sol: 102, site: 4, drive: 372, distM: 50 },
  ];
  const photo = (id, sol, drive) => ({ imageid: id, sol, site: 4, drive: String(drive), sample_type: 'Full', camera: { instrument: 'NAVCAM_LEFT' }, image_files: { small: 's', large: 'l' } });
  const bySol = {
    99: [photo('a', 99, 136), photo('b', 99, 218)],
    100: [photo('c', 100, 218)],
    101: [photo('d', 101, 218)],
    102: [photo('e', 102, 218), photo('f', 102, 372)],
  };
  const fetchFn = async (url) => ({ ok: true, json: async () => ({ images: bySol[Number(new URL(url).searchParams.get('sol'))] ?? [] }) });
  const result = await photosForStop('perseverance', stops, 0, { fetchFn });
  assert.deepEqual(result.photos.map((p) => p.id), ['b', 'c', 'd', 'e']);
  assert.equal(result.exact, true);
});

// ---------- Vehículos y velocidad real ----------
import { VEHICLES, WALK, effectiveSpec, subSteps, travelSeconds } from '../src/modules/descent/vehicles.js';

test('las velocidades reales salen de la NASA (o se marcan como supuesto)', () => {
  assert.ok(Math.abs(VEHICLES.perseverance.realSpeed * 3600 - 152) < 1e-9, '152 m/h');
  assert.ok(Math.abs(VEHICLES.pressurized.realSpeed * 3.6 - 10) < 1e-9, '10 km/h');
  assert.equal(VEHICLES.perseverance.realRef, 'nasa-perseverance-components');
  assert.equal(VEHICLES.pressurized.realRef, 'nasa-sev');
  assert.equal(WALK.realRef, null, 'a pie es un supuesto del equipo');
  assert.ok(Math.abs(travelSeconds(1000, VEHICLES.perseverance.realSpeed) / 3600 - 1000 / 152) < 1e-9);
});

test('en modo real la réplica de Perseverance no pasa de 152 m/h, gira y no gasta batería', () => {
  const spec = effectiveSpec(VEHICLES.perseverance, true);
  const v = makeVehicle(0, 0, 0);
  for (let i = 0; i < 2000; i++) stepVehicle(v, spec, 0.05, { forward: 1, strafe: 0.5, turn: 0, run: true }, flat);
  assert.ok(v.speed <= VEHICLES.perseverance.realSpeed + 1e-12, `${v.speed} m/s`);
  assert.ok(v.speed > VEHICLES.perseverance.realSpeed * 0.9);
  assert.ok(Math.abs(v.heading) > 0.5, 'gira aunque vaya despacio');
  assert.equal(v.battery, 1, 'generador radioisotópico');
  // En una pendiente no rueda solo: sus motores mantienen la velocidad.
  const parked = makeVehicle(0, 0, 0);
  for (let i = 0; i < 200; i++) stepVehicle(parked, spec, 0.05, { forward: 0, strafe: 0, turn: 0, run: false }, { ...flat, heightAt: (x) => -0.2 * x });
  assert.equal(parked.speed, 0);
});

test('el tiempo acelerado se reparte en pasos cortos', () => {
  assert.deepEqual(subSteps(0), { steps: 0, dt: 0 });
  const big = subSteps(16, 0.05, 400);
  assert.equal(big.steps, 320);
  assert.ok(Math.abs(big.steps * big.dt - 16) < 1e-9);
  const capped = subSteps(100, 0.05, 400);
  assert.equal(capped.steps, 400, 'con un tope de pasos por cuadro');
});

// ---------- Buscador ----------
import { fold, parseCoords, buildIndex, searchPlaces } from '../src/modules/descent/search.js';
import { LANDING_SITES } from '../src/core/sites.js';

test('se entienden las coordenadas escritas de varias formas', () => {
  assert.deepEqual(parseCoords('18.4, 77.4'), { lat: 18.4, lon: 77.4 });
  assert.deepEqual(parseCoords('4.6S 137.4E'), { lat: -4.6, lon: 137.4 });
  assert.deepEqual(parseCoords('22.5°N 312°E'), { lat: 22.5, lon: -48 });
  assert.deepEqual(parseCoords('10 N, 20 O'), { lat: 10, lon: -20 });
  assert.equal(parseCoords('95 10'), null);
  assert.equal(parseCoords('Jezero'), null);
  assert.equal(fold('Utópia Planitia'), 'utopia planitia');
});

test('el buscador encuentra sitios, regiones, rutas, paradas por sol y coordenadas', () => {
  const routesIdx = ROVER_IDS.map((id) => ({ id, name: `Ruta de ${id}`, ...routeCenter(rovers.rovers[id]) }));
  const index = buildIndex({ sites: LANDING_SITES, landing: { lat: 1, lon: 3, name: 'Mi sitio' }, hubs: [{ lat: 2, lon: 4, label: 'Invernadero' }], routes: routesIdx });
  const jez = searchPlaces(index, 'jezero');
  assert.ok(jez.some((r) => r.kind === 'region' && r.label === 'Jezero'));
  assert.ok(jez.some((r) => r.kind === 'site' && r.label === 'Perseverance'));
  assert.equal(searchPlaces(index, 'inver')[0].kind, 'hub');
  const stopsByRover = Object.fromEntries(ROVER_IDS.map((id) => [id, stopsOf(rovers.rovers[id])]));
  const sol = searchPlaces(index, 'perseverance sol 500', { stopsByRover });
  const stop = sol.find((r) => r.kind === 'stop');
  assert.equal(stop.rover, 'perseverance');
  assert.ok(stop.sol <= 500);
  assert.equal(searchPlaces(index, '18.4, 77.4')[0].kind, 'coords');
  assert.ok(searchPlaces(index, '').length > 0, 'sin texto sugiere lugares');
});
