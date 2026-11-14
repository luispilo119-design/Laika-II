/**
 * Trazado de rutas sobre una rejilla de elevación (sin DOM ni Leaflet, para poder probarlo).
 * Parte B — tarea B4.
 *
 * Pasos:
 *  1. makeGrid() envuelve la rejilla de `env.elevationGrid` y sabe convertir celda ↔ lat/lon.
 *  2. craterMask() marca las celdas dentro de los cráteres que el vehículo evita (prohibidas)
 *     y las del borde exterior (más caras).
 *  3. findPath() busca con A* la ruta más rápida: el costo de cada paso es el tiempo que toma,
 *     según la pendiente; los pasos más empinados que el límite del vehículo no se permiten.
 *     Usa 16 direcciones (las 8 vecinas y los saltos de caballo) para no forzar rumbos de 45°.
 *  4. smoothPath() quita el zigzag de la rejilla, pero solo acepta un atajo recto si no tarda
 *     más que el tramo que reemplaza; measureRoute() mide la ruta final.
 *  5. describeRoute() saca los tramos de la guía (rodeos de cráteres, pendiente máxima…).
 *
 * Coordenadas: [lat, lon] en grados, lon este-positivo. No maneja rutas que crucen el
 * meridiano ±180°.
 */

// Radio medio volumétrico de Marte, km. Ref: nssdca-mars-fact.
export const MARS_RADIUS_KM = 3389.5;
const KM_PER_DEG = (Math.PI * MARS_RADIUS_KM) / 180;
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Modelo del equipo (no es un dato medido): cuánto frena la pendiente y qué margen se deja
// alrededor de un cráter. Se muestran como supuestos en la interfaz.
export const SLOPE_SLOWDOWN = 0.6; // en la pendiente máxima se avanza al 40 % de la velocidad
export const CRATER_BLOCK_FACTOR = 1.1; // prohibido hasta 1.1 radios del centro
export const CRATER_RING_FACTOR = 1.4; // entre 1.1 y 1.4 radios, terreno más lento…
export const CRATER_RING_PENALTY = 1.5; // …que cuesta 1.5 veces el tiempo normal

/** Distancia sobre la superficie entre dos puntos [lat, lon], en km (fórmula del haversine). */
export function distanceKm(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de a hacia b, en grados 0..360 (0 = norte, 90 = este). */
export function bearingDeg(a, b) {
  const dLon = rad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS_8 = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const COMPASS_4 = ['n', 'e', 's', 'w'];
export const compass8 = (bearing) => COMPASS_8[Math.round(bearing / 45) % 8];
export const compass4 = (bearing) => COMPASS_4[Math.round(bearing / 90) % 4];

/** Recuadro que contiene los dos puntos con margen para poder rodear obstáculos. */
export function routeBBox(a, b, padFraction = 0.4, minPadDeg = 0.4) {
  const padLat = Math.max(minPadDeg, Math.abs(a[0] - b[0]) * padFraction);
  const padLon = Math.max(minPadDeg, Math.abs(a[1] - b[1]) * padFraction);
  // Recuadro más o menos cuadrado: una ruta este-oeste también necesita espacio al norte y al sur.
  const pad = Math.max(padLat, padLon);
  return {
    south: clamp(Math.min(a[0], b[0]) - pad, -88, 88),
    north: clamp(Math.max(a[0], b[0]) + pad, -88, 88),
    west: clamp(Math.min(a[1], b[1]) - pad, -180, 180),
    east: clamp(Math.max(a[1], b[1]) + pad, -180, 180),
  };
}

/**
 * Recuadro ampliado para pedir cráteres: uno con el centro fuera del recuadro de trabajo
 * todavía puede meter su borde dentro.
 */
export function expandBBox(bbox, marginDeg) {
  const midLat = (bbox.south + bbox.north) / 2;
  const lonMargin = marginDeg / Math.max(0.2, Math.cos(rad(midLat)));
  return {
    south: clamp(bbox.south - marginDeg, -90, 90),
    north: clamp(bbox.north + marginDeg, -90, 90),
    west: clamp(bbox.west - lonMargin, -180, 180),
    east: clamp(bbox.east + lonMargin, -180, 180),
  };
}

/**
 * @param {import('../../core/types.js').ElevationGrid} elevation  fila 0 = norte, columna 0 = oeste
 */
export function makeGrid(elevation) {
  const { width, height, data, bbox } = elevation;
  const cellLat = (bbox.north - bbox.south) / (height - 1);
  const cellLon = (bbox.east - bbox.west) / (width - 1);
  const latOf = (row) => bbox.north - row * cellLat;
  const lonOf = (col) => bbox.west + col * cellLon;
  const kmY = cellLat * KM_PER_DEG;
  const kmX = new Float64Array(height);
  for (let row = 0; row < height; row++) kmX[row] = cellLon * KM_PER_DEG * Math.cos(rad(latOf(row)));
  return {
    width,
    height,
    data,
    bbox,
    kmY,
    kmX,
    latOf,
    lonOf,
    /** Posición fraccionaria [fila, columna] de un punto. */
    toGrid: ([lat, lon]) => [(bbox.north - lat) / cellLat, (lon - bbox.west) / cellLon],
    /** Celda más cercana a un punto, sin salirse de la rejilla. */
    toCell([lat, lon]) {
      return [
        clamp(Math.round((bbox.north - lat) / cellLat), 0, height - 1),
        clamp(Math.round((lon - bbox.west) / cellLon), 0, width - 1),
      ];
    },
    toPoint: ([row, col]) => [latOf(row), lonOf(col)],
    /** Elevación interpolada en una posición fraccionaria. */
    elevationAt(row, col) {
      const r = clamp(row, 0, height - 1);
      const c = clamp(col, 0, width - 1);
      const r0 = Math.min(height - 2, Math.floor(r));
      const c0 = Math.min(width - 2, Math.floor(c));
      const fr = r - r0;
      const fc = c - c0;
      const at = (rr, cc) => data[rr * width + cc];
      return (
        at(r0, c0) * (1 - fr) * (1 - fc) + at(r0, c0 + 1) * (1 - fr) * fc + at(r0 + 1, c0) * fr * (1 - fc) + at(r0 + 1, c0 + 1) * fr * fc
      );
    },
  };
}

/**
 * Celdas prohibidas (dentro de un cráter) y recargo de tiempo en su borde exterior.
 * @param {ReturnType<typeof makeGrid>} grid
 * @param {{ lat: number, lon: number, diameterKm: number }[]} craters  solo los que el vehículo evita
 */
export function craterMask(grid, craters) {
  const { width, height } = grid;
  const blocked = new Uint8Array(width * height);
  const penalty = new Float32Array(width * height).fill(1);
  for (const crater of craters) {
    const radius = crater.diameterKm / 2;
    const reach = radius * CRATER_RING_FACTOR;
    const [rowC, colC] = grid.toGrid([crater.lat, crater.lon]);
    const dRow = Math.ceil(reach / grid.kmY) + 1;
    const r0 = Math.max(0, Math.floor(rowC - dRow));
    const r1 = Math.min(height - 1, Math.ceil(rowC + dRow));
    for (let row = r0; row <= r1; row++) {
      const dCol = Math.ceil(reach / Math.max(1e-6, grid.kmX[row])) + 1;
      const c0 = Math.max(0, Math.floor(colC - dCol));
      const c1 = Math.min(width - 1, Math.ceil(colC + dCol));
      for (let col = c0; col <= c1; col++) {
        const d = Math.hypot((row - rowC) * grid.kmY, (col - colC) * grid.kmX[row]);
        const i = row * width + col;
        if (d <= radius * CRATER_BLOCK_FACTOR) blocked[i] = 1;
        else if (d <= reach) penalty[i] = Math.max(penalty[i], CRATER_RING_PENALTY);
      }
    }
  }
  return { blocked, penalty };
}

/** Velocidad en km/h sobre una pendiente dada (modelo lineal del equipo). */
export function speedOnSlope(profile, slopeDeg) {
  return profile.speedKmh * (1 - SLOPE_SLOWDOWN * Math.min(1, slopeDeg / profile.maxSlopeDeg));
}

const slopeBetween = (dzM, distKm) => deg(Math.atan2(Math.abs(dzM), distKm * 1000));

/** Montículo binario mínimo de pares (prioridad, valor). */
class MinHeap {
  constructor() {
    this.keys = [];
    this.values = [];
  }
  get size() {
    return this.keys.length;
  }
  push(key, value) {
    const { keys, values } = this;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      values[i] = values[parent];
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }
  pop() {
    const { keys, values } = this;
    const top = values[0];
    const key = keys.pop();
    const value = values.pop();
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        keys[i] = keys[child];
        values[i] = values[child];
        i = child;
      }
      keys[i] = key;
      values[i] = value;
    }
    return top;
  }
}

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
  // Saltos de caballo: rumbos de ~26.6° y ~63.4° sin escalones.
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
];

/** Celdas que atraviesa un paso (además de la de llegada) y que no pueden estar prohibidas. */
function passedCells(row, col, dr, dc) {
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  if (adr + adc < 2) return [];
  if (adr === 1 && adc === 1) return [[row, col + dc], [row + dr, col]];
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  if (adr === 1) return [[row, col + sc], [row + dr, col + sc]];
  return [[row + sr, col], [row + sr, col + dc]];
}

/**
 * Ruta más rápida entre dos celdas con A*.
 * @param {ReturnType<typeof makeGrid>} grid
 * @param {{ blocked: Uint8Array, penalty: Float32Array }} mask
 * @param {{ speedKmh: number, maxSlopeDeg: number }} profile
 * @param {[number, number]} start  [fila, columna]
 * @param {[number, number]} goal
 * @returns {[number, number][] | null} celdas de la ruta, o null si no hay ruta posible
 */
export function findPath(grid, mask, profile, start, goal) {
  const { width, height, data, kmY, kmX } = grid;
  const { blocked, penalty } = mask;
  const startI = start[0] * width + start[1];
  const goalI = goal[0] * width + goal[1];
  if (blocked[startI] || blocked[goalI]) return null;

  const minKmX = Math.min(kmX[0], kmX[height - 1]);
  const heuristic = (i) => {
    const row = (i / width) | 0;
    const col = i - row * width;
    return Math.hypot((row - goal[0]) * kmY, (col - goal[1]) * minKmX) / profile.speedKmh;
  };

  const cost = new Float64Array(width * height).fill(Infinity);
  const from = new Int32Array(width * height).fill(-1);
  const done = new Uint8Array(width * height);
  const open = new MinHeap();
  cost[startI] = 0;
  open.push(heuristic(startI), startI);

  while (open.size > 0) {
    const i = open.pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === goalI) break;
    const row = (i / width) | 0;
    const col = i - row * width;
    for (const [dr, dc] of NEIGHBORS) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= height || c >= width) continue;
      const j = r * width + c;
      if (blocked[j] || done[j]) continue;
      // En diagonal (o salto de caballo) no se "corta la esquina" de una celda prohibida.
      if (passedCells(row, col, dr, dc).some(([pr, pc]) => blocked[pr * width + pc])) continue;
      const dist = Math.hypot(dr * kmY, dc * (kmX[row] + kmX[r]) * 0.5);
      let hours;
      if (Math.abs(dr) + Math.abs(dc) === 1) {
        const slope = slopeBetween(data[j] - data[i], dist);
        if (slope > profile.maxSlopeDeg) continue;
        hours = dist / speedOnSlope(profile, slope);
      } else if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
        const slope = slopeBetween(data[j] - data[i], dist);
        if (slope > profile.maxSlopeDeg) continue;
        hours = dist / speedOnSlope(profile, slope);
      } else {
        // Salto de caballo: solo vale si también se podría hacer en dos pasos normales de la
        // rejilla (por alguna de sus dos celdas intermedias). Así nunca "salta" un escarpe.
        const stepOk = (r0, c0, r1, c1) => {
          const d = Math.hypot((r1 - r0) * kmY, (c1 - c0) * (kmX[r0] + kmX[r1]) * 0.5);
          return slopeBetween(data[r1 * width + c1] - data[r0 * width + c0], d) <= profile.maxSlopeDeg;
        };
        const viaOk = passedCells(row, col, dr, dc).some(([pr, pc]) => stepOk(row, col, pr, pc) && stepOk(pr, pc, r, c));
        if (!viaOk) continue;
        const slope = slopeBetween(data[j] - data[i], dist);
        if (slope > profile.maxSlopeDeg) continue;
        hours = dist / speedOnSlope(profile, slope);
      }
      const next = cost[i] + hours * penalty[j];
      if (next < cost[j]) {
        cost[j] = next;
        from[j] = i;
        open.push(next + heuristic(j), j);
      }
    }
  }

  if (!done[goalI]) return null;
  const cells = [];
  for (let i = goalI; i !== -1; i = from[i]) cells.push([(i / width) | 0, i % width]);
  return cells.reverse();
}

/**
 * Tiempo (h) para ir en línea recta entre dos posiciones de la rejilla, muestreando cada media
 * celda. Infinity si toca una celda prohibida o se pasa de la pendiente del vehículo.
 */
export function segmentTime(grid, mask, profile, a, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  let prevElev = grid.elevationAt(a[0], a[1]);
  let prevRow = a[0];
  let prevCol = a[1];
  let hours = 0;
  for (let s = 1; s <= steps; s++) {
    const row = a[0] + ((b[0] - a[0]) * s) / steps;
    const col = a[1] + ((b[1] - a[1]) * s) / steps;
    const i = Math.round(row) * grid.width + Math.round(col);
    if (mask.blocked[i]) return Infinity;
    const elev = grid.elevationAt(row, col);
    const dist = Math.hypot((row - prevRow) * grid.kmY, (col - prevCol) * grid.kmX[Math.round(row)]);
    if (dist > 0) {
      const slope = slopeBetween(elev - prevElev, dist);
      if (slope > profile.maxSlopeDeg) return Infinity;
      hours += (dist / speedOnSlope(profile, slope)) * mask.penalty[i];
    }
    prevElev = elev;
    prevRow = row;
    prevCol = col;
  }
  return hours;
}

/**
 * Quita el zigzag de la rejilla: une con rectas los puntos entre los que hay paso libre, pero
 * solo si la recta no tarda más que el tramo de rejilla que reemplaza (una recta por una ladera
 * puede ser más corta y aun así más lenta).
 */
export function smoothPath(grid, mask, profile, cells) {
  if (cells.length <= 2) return cells;
  const cum = new Float64Array(cells.length);
  for (let k = 1; k < cells.length; k++) {
    const step = segmentTime(grid, mask, profile, cells[k - 1], cells[k]);
    cum[k] = cum[k - 1] + (Number.isFinite(step) ? step : 1e6);
  }
  const out = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !(segmentTime(grid, mask, profile, cells[i], cells[j]) <= cum[j] - cum[i] + 1e-9)) j--;
    out.push(cells[j]);
    i = j;
  }
  return out;
}

/**
 * Mide una ruta dada por sus vértices [lat, lon].
 * @returns {{ distanceKm: number, durationH: number, samples: { km: number, elevM: number, point: [number, number] }[],
 *   maxSlope: { deg: number, km: number }, highest: { elevM: number, km: number }, lowest: { elevM: number, km: number } }}
 */
export function measureRoute(grid, mask, profile, points) {
  const samples = [];
  let km = 0;
  let hours = 0;
  let maxSlope = { deg: 0, km: 0 };
  let prev = null;
  for (let p = 0; p < points.length - 1; p++) {
    const a = grid.toGrid(points[p]);
    const b = grid.toGrid(points[p + 1]);
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let s = p === 0 ? 0 : 1; s <= steps; s++) {
      const row = a[0] + ((b[0] - a[0]) * s) / steps;
      const col = a[1] + ((b[1] - a[1]) * s) / steps;
      const point = [
        points[p][0] + ((points[p + 1][0] - points[p][0]) * s) / steps,
        points[p][1] + ((points[p + 1][1] - points[p][1]) * s) / steps,
      ];
      const elevM = grid.elevationAt(row, col);
      if (prev) {
        const dist = distanceKm(prev.point, point);
        const slope = dist > 0 ? slopeBetween(elevM - prev.elevM, dist) : 0;
        const cell = clamp(Math.round(row), 0, grid.height - 1) * grid.width + clamp(Math.round(col), 0, grid.width - 1);
        // La recta puede superar un poco el límite entre muestras: se mide al ritmo más lento.
        hours += (dist / speedOnSlope(profile, slope)) * mask.penalty[cell];
        km += dist;
        if (slope > maxSlope.deg) maxSlope = { deg: slope, km };
      }
      prev = { km, elevM, point };
      samples.push(prev);
    }
  }
  let highest = samples[0];
  let lowest = samples[0];
  for (const sample of samples) {
    if (sample.elevM > highest.elevM) highest = sample;
    if (sample.elevM < lowest.elevM) lowest = sample;
  }
  return {
    distanceKm: km,
    durationH: hours,
    samples,
    maxSlope,
    highest: { elevM: highest.elevM, km: highest.km },
    lowest: { elevM: lowest.elevM, km: lowest.km },
  };
}

/**
 * Tramos de la guía, ordenados por kilómetro.
 * @returns {{ type: 'depart'|'crater'|'slope'|'high'|'arrive', km: number, [key: string]: any }[]}
 */
export function describeRoute(route, points, craters) {
  const steps = [{ type: 'depart', km: 0, dir: compass8(bearingDeg(points[0], points[1])) }];
  for (const crater of craters) {
    const center = [crater.lat, crater.lon];
    const radius = crater.diameterKm / 2;
    let nearest = null;
    let best = Infinity;
    for (const sample of route.samples) {
      const d = distanceKm(center, sample.point);
      if (d < best) {
        best = d;
        nearest = sample;
      }
    }
    // Solo cuentan los cráteres junto a los que la ruta pasa de verdad.
    if (nearest && best <= radius * 2 && nearest.km > 0 && nearest.km < route.distanceKm) {
      steps.push({
        type: 'crater',
        km: nearest.km,
        diameterKm: crater.diameterKm,
        side: compass4(bearingDeg(center, nearest.point)),
      });
    }
  }
  if (route.maxSlope.deg >= 1) steps.push({ type: 'slope', km: route.maxSlope.km, deg: route.maxSlope.deg });
  if (route.highest.km > 0 && route.highest.km < route.distanceKm) {
    steps.push({ type: 'high', km: route.highest.km, elevM: route.highest.elevM });
  }
  steps.push({ type: 'arrive', km: route.distanceKm, hours: route.durationH });
  return steps.sort((a, b) => a.km - b.km);
}

/**
 * Todo el cálculo de una ruta a partir de los datos del entorno.
 * @param {object} input
 * @param {[number, number]} input.origin
 * @param {[number, number]} input.destination
 * @param {{ speedKmh: number, maxSlopeDeg: number, avoidCraterKm: number }} input.profile
 * @param {import('../../core/types.js').ElevationGrid} input.elevation
 * @param {{ lat: number, lon: number, diameterKm: number }[]} input.craters
 * @returns {{ ok: true, points: [number, number][], steps: any[], avoided: any[], distanceKm: number, durationH: number,
 *   samples: any[], maxSlope: any, highest: any, lowest: any } | { ok: false, reason: 'origin_blocked'|'destination_blocked'|'no_path' }}
 */
export function planRoute({ origin, destination, profile, elevation, craters }) {
  const grid = makeGrid(elevation);
  const avoided = craters.filter((crater) => crater.diameterKm >= profile.avoidCraterKm);
  const mask = craterMask(grid, avoided);
  const start = grid.toCell(origin);
  const goal = grid.toCell(destination);
  if (mask.blocked[start[0] * grid.width + start[1]]) return { ok: false, reason: 'origin_blocked' };
  if (mask.blocked[goal[0] * grid.width + goal[1]]) return { ok: false, reason: 'destination_blocked' };
  const cells = findPath(grid, mask, profile, start, goal);
  if (!cells) return { ok: false, reason: 'no_path' };
  const smooth = smoothPath(grid, mask, profile, cells);
  const points = smooth.map((cell) => grid.toPoint(cell));
  // Los extremos son los puntos exactos que marcó la persona, no el centro de su celda.
  points[0] = origin;
  if (points.length === 1) points.push(destination);
  else points[points.length - 1] = destination;
  const measured = measureRoute(grid, mask, profile, points);
  return { ok: true, points, avoided, steps: describeRoute(measured, points, avoided), ...measured };
}
