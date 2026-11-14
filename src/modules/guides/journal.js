/**
 * Diario de supervivencia por sol: lógica pura (sin DOM) para poder probarla.
 *
 * Se guarda en `mission.journal` = { day: number, days: { [sol]: DayLog } }.
 * Cada cifra objetivo sale de una referencia (ver TARGETS); la radiación del sitio viene del
 * entorno (env.sample), que es un MODELO, y se dice así en pantalla.
 */

/**
 * @typedef {Object} DayLog
 * @property {number} water     litros de agua bebida
 * @property {number} meals     comidas completas (0–3); 3 = la ración diaria completa
 * @property {number|null} sleep  horas de sueño (null = sin registrar)
 * @property {number} exercise  horas de ejercicio
 * @property {number} eva       horas fuera del hábitat
 * @property {Object<string, boolean>} checks  pasos de guías marcados ese día
 */

/** Objetivos diarios y su fuente. `need` = id en src/core/human-needs.js cuando el valor viene de ahí. */
export const TARGETS = {
  water: { need: 'drinkingWater', fallback: 2.0, unit: 'L', refId: 'bvad2018' },
  food: { need: 'food', fallback: 1.51, unit: 'kg', refId: 'bvad2018' },
  sleep: { low: 7, high: 9, unit: 'h', refId: 'nasa-sleep-brief' },
  exercise: { value: 2, unit: 'h', refId: 'nasa-bone-muscle' },
};

/** Dosis media medida por RAD dentro de la nave rumbo a Marte (mSv por día). Ref: jpl-rad-cruise. */
export const CRUISE_MSV_PER_DAY = 1.8;
/** Límite de dosis efectiva de toda la carrera (mSv). Ref: nasa-std-3001-radiation. */
export const CAREER_LIMIT_MSV = 600;

export const MEALS_PER_DAY = 3;
export const WATER_STEP_L = 0.25;
export const MAX_DAYS = 999;

export function emptyDay() {
  return { water: 0, meals: 0, sleep: null, exercise: 0, eva: 0, checks: {} };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Normaliza lo guardado (puede venir dañado o de una versión anterior). */
export function readJournal(raw) {
  const out = { day: 1, days: {} };
  if (!raw || typeof raw !== 'object') return out;
  out.day = clamp(Math.round(num(raw.day, 1)), 1, MAX_DAYS);
  const days = raw.days && typeof raw.days === 'object' ? raw.days : {};
  for (const [key, value] of Object.entries(days)) {
    const sol = Number(key);
    if (!Number.isInteger(sol) || sol < 1 || sol > MAX_DAYS || !value || typeof value !== 'object') continue;
    out.days[sol] = {
      water: clamp(num(value.water), 0, 20),
      meals: clamp(Math.round(num(value.meals)), 0, MEALS_PER_DAY),
      sleep: value.sleep == null ? null : clamp(num(value.sleep), 0, 24),
      exercise: clamp(num(value.exercise), 0, 24),
      eva: clamp(num(value.eva), 0, 24),
      checks: value.checks && typeof value.checks === 'object' ? { ...value.checks } : {},
    };
  }
  return out;
}

export function dayOf(journal, sol = journal.day) {
  return journal.days[sol] ?? emptyDay();
}

/** Devuelve un diario nuevo con el día `sol` cambiado (no muta el original). */
export function updateDay(journal, sol, patch) {
  const current = dayOf(journal, sol);
  return { ...journal, days: { ...journal.days, [sol]: { ...current, ...patch } } };
}

/**
 * Qué tan cerca quedó un día de cada objetivo. Cada razón va de 0 a 1 (1 = cumplido).
 * @param {DayLog} day
 * @param {{ water: number, food: number }} values  objetivos de agua (L) y alimento (kg) en uso
 */
export function evaluateDay(day, values) {
  const water = values.water > 0 ? clamp(day.water / values.water, 0, 1) : 0;
  const food = clamp(day.meals / MEALS_PER_DAY, 0, 1);
  let sleep = 0;
  if (day.sleep != null) {
    const { low, high } = TARGETS.sleep;
    if (day.sleep >= low && day.sleep <= high) sleep = 1;
    else if (day.sleep < low) sleep = clamp(day.sleep / low, 0, 1);
    else sleep = clamp(1 - (day.sleep - high) / high, 0, 1);
  }
  const exercise = clamp(day.exercise / TARGETS.exercise.value, 0, 1);
  const score = (water + food + sleep + exercise) / 4;
  const status = score >= 0.85 ? 'good' : score >= 0.5 ? 'fair' : 'poor';
  return {
    water,
    food,
    sleep,
    exercise,
    score,
    status,
    foodKg: (day.meals / MEALS_PER_DAY) * values.food,
    waterMissing: Math.max(0, values.water - day.water),
  };
}

/** Días de viaje según el plan de Hohmann (0 si no hay plan). */
export function cruiseDays(mission) {
  const dep = Date.parse(mission?.departure ?? '');
  const arr = Date.parse(mission?.arrival ?? '');
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return 0;
  return Math.round((arr - dep) / 86400000);
}

/**
 * Dosis acumulada: viaje (RAD) + soles en superficie (modelo del sitio, sin blindaje).
 * @param {{ cruiseDays: number, sols: number, surfaceMSvDay: number|null }} input
 */
export function doseSummary({ cruiseDays: days, sols, surfaceMSvDay }) {
  const cruise = days * CRUISE_MSV_PER_DAY;
  const surface = surfaceMSvDay == null ? 0 : sols * surfaceMSvDay;
  const total = cruise + surface;
  return { cruise, surface, total, share: total / CAREER_LIMIT_MSV };
}

/** Resumen de todos los días registrados (para el tablero y el reporte). */
export function journalStats(journal, values) {
  const sols = Object.keys(journal.days)
    .map(Number)
    .sort((a, b) => a - b);
  const evals = sols.map((sol) => ({ sol, ...evaluateDay(journal.days[sol], values), day: journal.days[sol] }));
  const totalWater = evals.reduce((sum, e) => sum + e.day.water, 0);
  const avgScore = evals.length ? evals.reduce((sum, e) => sum + e.score, 0) / evals.length : 0;
  const goodDays = evals.filter((e) => e.status === 'good').length;
  let streak = 0;
  for (let sol = journal.day; sol >= 1; sol--) {
    const e = evals.find((x) => x.sol === sol);
    if (!e || e.status !== 'good') break;
    streak++;
  }
  return { sols, evals, totalWater, avgScore, goodDays, streak, lastSol: Math.max(journal.day, ...sols, 1) };
}
