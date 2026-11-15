/**
 * Cálculos del viaje y de la rutina (sin DOM, para poder probarlos). Parte B — tarea B3.
 * Cada constante lleva el id de la referencia que la respalda (ver data.js).
 */
import { CRUISE_MSV_PER_DAY } from '../../core/journal.js';

// Semiejes mayores de las órbitas, en unidades astronómicas. Ref: jpl-approx-pos.
export const A_EARTH_AU = 1.00000261;
export const A_MARS_AU = 1.52371034;

const DAYS_PER_YEAR = 365.25;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;
const MS_PER_DAY = 86_400_000;

/**
 * Duración de una transferencia de Hohmann Tierra–Marte suponiendo órbitas circulares:
 * media vuelta de una elipse cuyo semieje es el promedio de los dos (tercera ley de Kepler).
 * Es una aproximación; el módulo hohmann calcula el viaje real.
 */
export function hohmannDays() {
  const a = (A_EARTH_AU + A_MARS_AU) / 2;
  return Math.round(0.5 * Math.sqrt(a ** 3) * DAYS_PER_YEAR);
}

/** Duración por defecto cuando todavía no hay plan de viaje. */
export const DEFAULT_TRIP_DAYS = hohmannDays();

/**
 * @param {{ departure?: string|null, arrival?: string|null }} [mission]
 * @returns {{ days: number, departure: string|null, arrival: string|null, isDefault: boolean }}
 */
export function tripInfo(mission) {
  const start = Date.parse(mission?.departure ?? '');
  const end = Date.parse(mission?.arrival ?? '');
  const days = Math.round((end - start) / MS_PER_DAY);
  if (Number.isFinite(days) && days >= 1) {
    return { days, departure: mission.departure, arrival: mission.arrival, isDefault: false };
  }
  return { days: DEFAULT_TRIP_DAYS, departure: null, arrival: null, isDefault: true };
}

// Pérdida de densidad mineral en huesos que cargan peso, % por mes de vuelo. Ref: hrp-gravity.
export const BONE_LOSS_PCT_PER_MONTH = [1, 1.5];
// Ejercicio diario promedio de las tripulaciones de la estación espacial, horas. Ref: nasa-bone-muscle.
export const EXERCISE_H_PER_DAY = 2;

/**
 * Acumulados al día `day` del viaje. Son extrapolaciones lineales de promedios publicados:
 * la interfaz las muestra como estimaciones, no como predicciones.
 */
export function estimates(day) {
  const months = day / DAYS_PER_MONTH;
  return {
    boneLossPct: BONE_LOSS_PCT_PER_MONTH.map((rate) => rate * months),
    doseMSv: CRUISE_MSV_PER_DAY * day,
    exerciseH: EXERCISE_H_PER_DAY * day,
  };
}

/**
 * En qué tramo del viaje cae un día. Los cortes (primer y último 10 %) solo sirven para
 * resaltar una tarjeta en pantalla; no son un dato científico.
 * @returns {'departure'|'cruise'|'arrival'}
 */
export function stageOf(day, days) {
  const progress = days > 0 ? day / days : 0;
  if (progress < 0.1) return 'departure';
  if (progress > 0.9) return 'arrival';
  return 'cruise';
}

// ---------- Rutina del día ----------

export const PLAN_KEYS = ['sleep', 'exercise', 'work', 'leisure'];
export const PLAN_STEP_H = 0.5;
export const DAY_H = 24;
/** Punto de partida del planificador (elección del equipo, dentro de los rangos de abajo). */
export const DEFAULT_PLAN = { sleep: 8, exercise: 2, work: 8, leisure: 3 };
// Sueño que necesita un adulto promedio, horas. Ref: nasa-sleep-brief.
export const SLEEP_RANGE_H = [7, 9];

export const planTotal = (plan) => PLAN_KEYS.reduce((sum, key) => sum + plan[key], 0);

/** Limpia un plan guardado: solo las claves conocidas, en pasos de media hora y sin pasar de 24 h. */
export function sanitizePlan(plan) {
  const clean = {};
  for (const key of PLAN_KEYS) {
    const value = Number(plan?.[key]);
    clean[key] = Number.isFinite(value) ? Math.min(DAY_H, Math.max(0, Math.round(value / PLAN_STEP_H) * PLAN_STEP_H)) : DEFAULT_PLAN[key];
  }
  return planTotal(clean) > DAY_H ? { ...DEFAULT_PLAN } : clean;
}

/** Suma o resta horas a una actividad. Devuelve el mismo plan si el cambio no cabe en el día. */
export function adjustPlan(plan, key, deltaH) {
  const next = plan[key] + deltaH;
  if (next < 0 || planTotal(plan) + deltaH > DAY_H) return plan;
  return { ...plan, [key]: next };
}

/** Compara el plan con las cifras de referencia. */
export function planChecks(plan) {
  const [low, high] = SLEEP_RANGE_H;
  return {
    sleep: plan.sleep < low ? 'low' : plan.sleep > high ? 'high' : 'ok',
    exercise: plan.exercise < EXERCISE_H_PER_DAY ? 'low' : 'ok',
  };
}
