/**
 * Cálculo orbital para planear el viaje Tierra → Marte. Funciones puras, sin DOM.
 * Pruebas: tests/orbit.test.js
 *
 * Fuentes (ver references en index.js):
 *  - Posiciones de los planetas: elementos keplerianos aproximados de JPL SSD, Tabla 1
 *    (válidos de 1800 a 2050), Standish y Williams (1992).
 *  - Longitud solar de Marte (Ls): algoritmo de Mars24 de NASA GISS, Allison y McEwen (2000).
 *
 * Simplificaciones que la interfaz debe decir:
 *  - La transferencia es de tipo Hohmann: media elipse (180°) tangente a las dos órbitas.
 *  - Se ignora la inclinación de la órbita de Marte (1.85°): todo ocurre en el plano de la eclíptica.
 *  - Los impulsos son instantáneos y se calculan como si la velocidad de cada planeta fuera
 *    perpendicular a su radio.
 *  Las misiones reales usan trayectorias calculadas con más precisión y suelen ser algo más cortas.
 */

// Constantes de JPL SSD: "Astrodynamic Parameters" (UA, GM del Sol, GM de la Tierra según DE440)
// y "Planetary Physical Parameters" (radio ecuatorial de la Tierra).
export const AU_KM = 149597870.7;
export const MU_SUN = 1.32712440041279419e11; // km³/s²
export const MU_EARTH = 398600.435507; // km³/s²
export const R_EARTH_KM = 6378.1366;
export const C_KM_S = 299792.458;
const DAY_S = 86400;
const DAY_MS = 86400000;

/** Parámetros del algoritmo; la pantalla "ecuaciones" los muestra tal cual. */
export const LEO_ALTITUDE_KM = 300; // altura de la órbita baja terrestre de partida
export const ARRIVAL_ITERATIONS = 6; // veces que se recalcula la llegada en planTransfer
export const WINDOW_STEP_DAYS = 4; // paso de la búsqueda de ventanas
export const WINDOW_BISECTIONS = 30; // mitades en que se parte el intervalo que contiene la ventana

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** Lleva un ángulo a 0..360. */
export const wrap360 = (a) => ((a % 360) + 360) % 360;
/** Lleva un ángulo a -180..180. */
export const wrap180 = (a) => wrap360(a + 180) - 180;

/**
 * JPL SSD, "Approximate Positions of the Planets", Tabla 1 (1800–2050).
 * Cada elemento: [valor en J2000, cambio por siglo]. Ángulos en grados, a en UA.
 */
export const ELEMENTS = {
  earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    peri: [102.93768193, 0.32327364],
    node: [0.0, 0.0],
  },
  mars: {
    a: [1.52371034, 0.00001847],
    e: [0.0933941, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    peri: [-23.94362959, 0.44441088],
    node: [49.55953891, -0.29257343],
  },
};

/** TT − UTC en segundos (segundos intercalares vigentes desde cada fecha). */
const TT_MINUS_UTC = [
  [Date.UTC(2017, 0, 1), 69.184],
  [Date.UTC(2015, 6, 1), 68.184],
  [Date.UTC(2012, 6, 1), 67.184],
  [Date.UTC(2009, 0, 1), 66.184],
  [Date.UTC(2006, 0, 1), 65.184],
];

function ttMinusUtc(date) {
  const ms = date.getTime();
  for (const [since, seconds] of TT_MINUS_UTC) if (ms >= since) return seconds;
  return 64.184;
}

/** Días desde J2000 (2000-01-01 12:00 TT). */
export function daysSinceJ2000(date) {
  const jdUt = 2440587.5 + date.getTime() / DAY_MS;
  return jdUt + ttMinusUtc(date) / DAY_S - 2451545.0;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function solveKepler(meanAnomalyRad, e) {
  let E = meanAnomalyRad + e * Math.sin(meanAnomalyRad);
  for (let i = 0; i < 30; i++) {
    const dE = (meanAnomalyRad - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/**
 * Posición heliocéntrica en la eclíptica J2000.
 * @param {'earth'|'mars'} planet
 * @param {Date} date
 * @returns {{x: number, y: number, z: number, r: number, lon: number}} UA y grados (lon 0..360)
 */
export function planetPosition(planet, date) {
  const el = ELEMENTS[planet];
  const T = daysSinceJ2000(date) / 36525;
  const at = (k) => el[k][0] + el[k][1] * T;
  const a = at('a');
  const e = at('e');
  const I = rad(at('I'));
  const node = rad(at('node'));
  const w = rad(at('peri')) - node;
  const M = rad(wrap180(at('L') - at('peri')));
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w);
  const cn = Math.cos(node), sn = Math.sin(node);
  const ci = Math.cos(I), si = Math.sin(I);
  const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  const z = sw * si * xp + cw * si * yp;
  return {
    x,
    y,
    z,
    r: Math.hypot(x, y, z),
    lon: wrap360(deg(Math.atan2(y, x))),
    // Valores intermedios, para mostrar el cálculo paso a paso.
    a,
    e,
    meanAnomalyDeg: deg(M),
    eccentricAnomalyDeg: deg(E),
  };
}

/** Periodo orbital en días para un semieje mayor en UA. */
export function periodDays(aAu) {
  return (2 * Math.PI * Math.sqrt((aAu * AU_KM) ** 3 / MU_SUN)) / DAY_S;
}

/**
 * Media elipse entre dos distancias al Sol.
 * @param {number} r1Au distancia de salida
 * @param {number} r2Au distancia de llegada
 * @param {number} [a1Au] semieje de la órbita de salida (por defecto r1: órbita circular)
 * @param {number} [a2Au] semieje de la órbita de llegada (por defecto r2: órbita circular)
 */
export function transferBetween(r1Au, r2Au, a1Au = r1Au, a2Au = r2Au) {
  const r1 = r1Au * AU_KM;
  const r2 = r2Au * AU_KM;
  const aT = (r1 + r2) / 2;
  const visViva = (r, a) => Math.sqrt(MU_SUN * (2 / r - 1 / a));
  return {
    aTransferAu: aT / AU_KM,
    eccentricity: (r2 - r1) / (r2 + r1),
    transferDays: (Math.PI * Math.sqrt(aT ** 3 / MU_SUN)) / DAY_S,
    dvDepartureKmS: visViva(r1, aT) - visViva(r1, a1Au * AU_KM),
    dvArrivalKmS: visViva(r2, a2Au * AU_KM) - visViva(r2, aT),
  };
}

/** Transferencia de Hohmann de libro: órbitas circulares y coplanares con los semiejes de JPL. */
export function hohmannIdeal() {
  const r1 = ELEMENTS.earth.a[0];
  const r2 = ELEMENTS.mars.a[0];
  const t = transferBetween(r1, r2);
  const pEarth = periodDays(r1);
  const pMars = periodDays(r2);
  return {
    ...t,
    earthPeriodDays: pEarth,
    marsPeriodDays: pMars,
    // Ventaja angular que debe llevar Marte al salir, para estar al otro lado del Sol al llegar.
    phaseAngleDeg: 180 - (360 / pMars) * t.transferDays,
    synodicDays: 1 / (1 / pEarth - 1 / pMars),
  };
}

/** Impulso necesario desde una órbita baja terrestre circular para salir con velocidad de exceso vInf. */
export function dvFromLowEarthOrbit(vInfKmS, altitudeKm = LEO_ALTITUDE_KM) {
  const r = R_EARTH_KM + altitudeKm;
  return Math.sqrt(vInfKmS ** 2 + (2 * MU_EARTH) / r) - Math.sqrt(MU_EARTH / r);
}

/**
 * Plan de viaje saliendo en una fecha: media elipse entre la distancia real de la Tierra al salir y
 * la distancia real de Marte al llegar. `missDeg` dice por cuántos grados fallaría el encuentro:
 * vale 0 en una ventana de lanzamiento.
 * @param {Date} departure
 */
export function planTransfer(departure) {
  const earth = planetPosition('earth', departure);
  let transferDays = hohmannIdeal().transferDays;
  let mars = planetPosition('mars', addDays(departure, transferDays));
  let t = null;
  for (let i = 0; i < ARRIVAL_ITERATIONS; i++) {
    t = transferBetween(earth.r, mars.r, ELEMENTS.earth.a[0], ELEMENTS.mars.a[0]);
    transferDays = t.transferDays;
    mars = planetPosition('mars', addDays(departure, transferDays));
  }
  const arrival = addDays(departure, transferDays);
  return {
    ...t,
    departure,
    arrival,
    earthAtDeparture: earth,
    marsAtArrival: mars,
    missDeg: wrap180(mars.lon - earth.lon - 180),
    dvFromLeoKmS: dvFromLowEarthOrbit(t.dvDepartureKmS),
    arrivalLs: marsLs(arrival),
  };
}

/**
 * Próximas ventanas de lanzamiento a partir de una fecha.
 * @param {Date} from
 * @param {number} [count]
 * @returns {ReturnType<typeof planTransfer>[]}
 */
export function findWindows(from, count = 4) {
  const windows = [];
  const step = WINDOW_STEP_DAYS;
  const miss = (d) => planTransfer(d).missDeg;
  let prevDate = from;
  let prev = miss(prevDate);
  for (let i = 0; i < 2500 && windows.length < count; i++) {
    const date = addDays(prevDate, step);
    const value = miss(date);
    // La Tierra va más rápido que Marte: el fallo baja con el tiempo y cruza por cero en la ventana.
    if (prev > 0 && value <= 0 && prev - value < 90) {
      let lo = prevDate;
      let hi = date;
      for (let k = 0; k < WINDOW_BISECTIONS; k++) {
        const mid = new Date((lo.getTime() + hi.getTime()) / 2);
        if (miss(mid) > 0) lo = mid;
        else hi = mid;
      }
      windows.push(planTransfer(hi));
    }
    prevDate = date;
    prev = value;
  }
  return windows;
}

/**
 * Cifras intermedias de una ventana, para explicar el cálculo paso a paso.
 * No cambia nada del plan: solo vuelve a evaluar las mismas fórmulas.
 * @param {ReturnType<typeof planTransfer>} plan
 */
export function transferBreakdown(plan) {
  const visViva = (rAu, aAu) => Math.sqrt(MU_SUN * (2 / (rAu * AU_KM) - 1 / (aAu * AU_KM)));
  const r1 = plan.earthAtDeparture.r;
  const r2 = plan.marsAtArrival.r;
  const departureDays = daysSinceJ2000(plan.departure);
  return {
    departureDaysJ2000: departureDays,
    departureCenturies: departureDays / 36525,
    arrivalDaysJ2000: daysSinceJ2000(plan.arrival),
    arrivalCenturies: daysSinceJ2000(plan.arrival) / 36525,
    vEarthKmS: visViva(r1, ELEMENTS.earth.a[0]),
    vTransferDepartureKmS: visViva(r1, plan.aTransferAu),
    vTransferArrivalKmS: visViva(r2, plan.aTransferAu),
    vMarsKmS: visViva(r2, ELEMENTS.mars.a[0]),
    missBeforeDeg: planTransfer(addDays(plan.departure, -WINDOW_STEP_DAYS)).missDeg,
    missAfterDeg: planTransfer(addDays(plan.departure, WINDOW_STEP_DAYS)).missDeg,
  };
}

/**
 * Posición de la nave sobre la elipse de transferencia.
 * @param {ReturnType<typeof planTransfer>} plan
 * @param {number} fraction 0 = salida, 1 = llegada
 * @returns {{x: number, y: number, r: number, lon: number}}
 */
export function transferPosition(plan, fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  const e = plan.eccentricity;
  const E = solveKepler(Math.PI * f, e);
  const r = plan.aTransferAu * (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const lon = wrap360(plan.earthAtDeparture.lon + deg(nu));
  return { x: r * Math.cos(rad(lon)), y: r * Math.sin(rad(lon)), r, lon };
}

/** Longitud solar de Marte (Ls, 0..360) con el algoritmo de Mars24. */
export function marsLs(date) {
  const dt = daysSinceJ2000(date);
  const M = rad(19.3871 + 0.52402073 * dt);
  const alphaFms = 270.3871 + 0.524038496 * dt;
  const perturbers = [
    [0.0071, 2.2353, 49.409],
    [0.0057, 2.7543, 168.173],
    [0.0039, 1.1177, 191.837],
    [0.0037, 15.7866, 21.736],
    [0.0021, 2.1354, 15.704],
    [0.002, 2.4694, 95.528],
    [0.0018, 32.8493, 49.095],
  ];
  const pbs = perturbers.reduce((sum, [A, tau, phi]) => sum + A * Math.cos(rad((0.985626 * dt) / tau + phi)), 0);
  const nuMinusM =
    (10.691 + 3.0e-7 * dt) * Math.sin(M) +
    0.623 * Math.sin(2 * M) +
    0.05 * Math.sin(3 * M) +
    0.005 * Math.sin(4 * M) +
    0.0005 * Math.sin(5 * M) +
    pbs;
  return wrap360(alphaFms + nuMinusM);
}

/**
 * Estación del hemisferio norte de Marte para un Ls (NASA GISS: 0° equinoccio de primavera,
 * 90° solsticio de verano, 180° equinoccio de otoño, 270° solsticio de invierno).
 * @returns {'spring'|'summer'|'autumn'|'winter'}
 */
export function northernSeason(ls) {
  return ['spring', 'summer', 'autumn', 'winter'][Math.floor(wrap360(ls) / 90)];
}

/**
 * Primavera austral (Ls 180–270): la época en que, según la NASA, crecen las grandes tormentas
 * regionales de polvo en el hemisferio sur.
 */
export function isDustSeason(ls) {
  const v = wrap360(ls);
  return v >= 180 && v < 270;
}

/** Distancia en UA entre dos puntos del plano. */
export function distanceAu(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/** Minutos que tarda una señal de radio en recorrer una distancia en UA (solo ida). */
export function lightMinutes(au) {
  return (au * AU_KM) / C_KM_S / 60;
}
