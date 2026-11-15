/**
 * Física de los vehículos de la primera persona, sin Three.js ni DOM (para poder probarla).
 * Parte B — tarea B5.
 *
 * Ejes de la escena: x = este, y = arriba, z = sur; 1 unidad = 1 metro. El rumbo (`heading`) es
 * el ángulo del frente del vehículo: 0 = este, π/2 = norte.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Gravedad de Marte, m/s² (NSSDCA Mars Fact Sheet). */
export const MARS_G = 3.71;

// Rover manejable. Valores de juego, no de un vehículo real: aquí se puede ir más rápido para
// recorrer el terreno. Se dice así en pantalla.
export const ROVER = {
  maxSpeed: 8, // m/s (~29 km/h)
  reverseSpeed: 3,
  accel: 2.4, // m/s²
  coast: 0.7, // frenado al soltar el acelerador, 1/s
  turnRate: 0.85, // rad/s a toda velocidad
  length: 5.2,
  width: 2.9,
  radius: 3.2,
  boardDistance: 11, // m: a qué distancia se puede subir
  gravity: MARS_G,
  energyPerM: 0.00004, // fracción de batería por metro en llano (~25 km con carga completa)
  climbEnergy: 0.0004, // extra por metro y por unidad de pendiente de subida
  idleDrain: 0.00002, // por segundo
  solarCharge: 0.0005, // por segundo a pleno sol, detenido
  crashSpeed: 1.2, // m/s: desde aquí un choque hace daño
  crashDamage: 0.035, // daño por m/s de impacto
  maxTiltDeg: 28,
  tiltDamage: 0.06, // daño por segundo inclinado de más
};

/**
 * Vehículos que se pueden usar. `realSpeed` (m/s) sale de una fuente de la NASA (`realRef`) o es un
 * supuesto del equipo (`realRef: null`); el resto son valores de juego, y la pantalla lo dice.
 * `power`: 'battery' se gasta y se recarga al sol; 'rps' es un generador radioisotópico: no depende
 * del sol (NASA, Perseverance Rover Components).
 */
export const VEHICLES = {
  pressurized: {
    ...ROVER,
    id: 'pressurized',
    // "drive about 10 kilometers per hour" (NASA Science, Space Exploration Vehicle).
    realSpeed: 10 / 3.6,
    realRef: 'nasa-sev',
    power: 'battery',
  },
  perseverance: {
    id: 'perseverance',
    maxSpeed: 4, // m/s (~14 km/h) en modo exploración: valor de juego
    reverseSpeed: 1.5,
    accel: 1.6,
    coast: 1.5,
    turnRate: 0.9,
    length: 3,
    width: 2.7,
    radius: 1.9,
    boardDistance: 8,
    gravity: MARS_G,
    holdSpeed: true, // sus motores mantienen la velocidad en pendiente: no rueda solo
    energyPerM: 0,
    climbEnergy: 0,
    idleDrain: 0,
    solarCharge: 0,
    crashSpeed: 0.5,
    crashDamage: 0.08,
    // "rover drivers avoid terrains that would tilt the rover more than 30 degrees" (NASA).
    maxTiltDeg: 30,
    tiltDamage: 0.06,
    // "top speed on flat, hard ground is just under 0.1 mph (152 meters per hour)" (NASA).
    realSpeed: 152 / 3600,
    realRef: 'nasa-perseverance-components',
    power: 'rps',
  },
};

/** A pie: velocidad de exploración (juego) y real. La real es un supuesto del equipo, sin fuente. */
export const WALK = { exploreSpeed: 5, runFactor: 3, realSpeed: 3 / 3.6, realRef: null };

export const VEHICLE_IDS = Object.keys(VEHICLES);

/**
 * Ficha con la que se mueve un vehículo según el modo de velocidad. En modo real la velocidad
 * máxima es la real; la aceleración se ajusta para que llegue a ella en un par de segundos.
 */
export function effectiveSpec(spec, real) {
  if (!real) return spec;
  return {
    ...spec,
    maxSpeed: spec.realSpeed,
    reverseSpeed: spec.realSpeed * 0.5,
    accel: Math.min(spec.accel, Math.max(spec.realSpeed, 0.02)),
    boost: 1, // en modo real no hay impulso
  };
}

/**
 * Divide `simDt` segundos en pasos de como mucho `maxStep`, sin pasar de `maxSteps` (con el tiempo
 * acelerado, un solo paso grande se saltaría choques y pendientes).
 * @returns {{ steps: number, dt: number }}
 */
export function subSteps(simDt, maxStep = 0.05, maxSteps = 400) {
  if (simDt <= 0) return { steps: 0, dt: 0 };
  const steps = Math.min(maxSteps, Math.ceil(simDt / maxStep));
  return { steps, dt: simDt / steps };
}

/** Segundos que se tarda en recorrer `meters` a `speed` m/s. */
export const travelSeconds = (meters, speed) => (speed > 0 ? meters / speed : Infinity);

/** Estado inicial de un vehículo estacionado en (x, z). */
export function makeVehicle(x, z, heading = 0) {
  return { x, z, heading, speed: 0, battery: 1, damage: 0, odometer: 0, tilt: 0, grade: 0, warn: null, chaseYaw: 0, pitch: 0, roll: 0, y: 0 };
}

/**
 * Avanza el vehículo un paso: acelerador, dirección, pendiente, choques, batería y daño.
 * Modifica `v` y devuelve los metros avanzados.
 * @param {ReturnType<typeof makeVehicle>} v
 * @param {typeof ROVER} spec
 * @param {number} dt  segundos
 * @param {{ forward: number, strafe: number, turn: number, run: boolean }} input
 * @param {{ heightAt: (x: number, z: number) => number, clampToArea: (v: number) => number,
 *   obstacles: { x: number, z: number, r: number }[], self?: object, daylight: number }} world
 */
export function stepVehicle(v, spec, dt, input, world) {
  const { heightAt } = world;
  const disabled = v.battery <= 0 || v.damage >= 1;
  const throttle = disabled ? 0 : input.forward;
  const steer = clamp(input.strafe + input.turn, -1, 1);
  const fx = Math.cos(v.heading);
  const fz = -Math.sin(v.heading);
  // Pendiente en la dirección de avance: frena de subida y empuja de bajada.
  v.grade = (heightAt(v.x + fx * 3, v.z + fz * 3) - heightAt(v.x - fx * 3, v.z - fz * 3)) / 6;
  if (throttle !== 0) v.speed += throttle * spec.accel * dt;
  else v.speed -= v.speed * spec.coast * dt;
  if (!spec.holdSpeed) v.speed -= spec.gravity * Math.sin(Math.atan(v.grade)) * dt * 0.6;
  const top = spec.maxSpeed * (input.run ? spec.boost ?? 1.4 : 1) * (1 - 0.6 * v.damage);
  v.speed = clamp(v.speed, -spec.reverseSpeed, top);
  if ((disabled || (throttle === 0 && spec.holdSpeed)) && Math.abs(v.speed) < Math.min(0.05, spec.maxSpeed * 0.05)) v.speed = 0;
  // El giro crece con la velocidad hasta el 40 % de la máxima (o 3 m/s): así también gira despacio.
  v.heading -= steer * spec.turnRate * dt * clamp(v.speed / Math.min(3, spec.maxSpeed * 0.4), -1, 1);

  const step = v.speed * dt;
  v.x = world.clampToArea(v.x + Math.cos(v.heading) * step);
  v.z = world.clampToArea(v.z - Math.sin(v.heading) * step);
  v.odometer += Math.abs(step);

  // Choques con rocas grandes y equipo.
  v.warn = null;
  for (const o of world.obstacles) {
    if (o === world.self) continue;
    const dx = v.x - o.x;
    const dz = v.z - o.z;
    const min = o.r + spec.radius * 0.8;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min || d2 === 0) continue;
    const impact = Math.abs(v.speed);
    if (impact > spec.crashSpeed) {
      v.damage = Math.min(1, v.damage + impact * spec.crashDamage);
      v.warn = 'crash';
    }
    v.speed = -v.speed * 0.25;
    const d = Math.sqrt(d2);
    v.x = o.x + (dx / d) * min;
    v.z = o.z + (dz / d) * min;
  }
  if (world.self) {
    world.self.x = v.x;
    world.self.z = v.z;
  }

  // Inclinación según el terreno bajo las ruedas.
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const rx = Math.sin(v.heading); // derecha del vehículo (perpendicular al avance)
  const rz = Math.cos(v.heading);
  const front = heightAt(v.x + fx * hl, v.z + fz * hl);
  const back = heightAt(v.x - fx * hl, v.z - fz * hl);
  const right = heightAt(v.x + rx * hw, v.z + rz * hw);
  const left = heightAt(v.x - rx * hw, v.z - rz * hw);
  v.pitch = Math.atan2(front - back, spec.length);
  v.roll = Math.atan2(right - left, spec.width);
  v.y = (front + back + left + right) / 4;
  v.tilt = (Math.max(Math.abs(v.pitch), Math.abs(v.roll)) * 180) / Math.PI;
  if (v.tilt > spec.maxTiltDeg) {
    v.damage = Math.min(1, v.damage + spec.tiltDamage * dt);
    v.warn = v.warn ?? 'tilt';
  }

  // Batería: avanzar gasta (más de subida); detenido y con sol, se recarga.
  const climb = Math.max(0, v.speed >= 0 ? v.grade : -v.grade);
  v.battery -= Math.abs(step) * (spec.energyPerM + spec.climbEnergy * climb) + spec.idleDrain * dt;
  if (Math.abs(v.speed) < 0.2) v.battery += spec.solarCharge * world.daylight * dt;
  v.battery = clamp(v.battery, 0, 1);
  if (v.battery <= 0) v.warn = 'battery';
  else if (v.damage >= 1) v.warn = 'broken';
  else if (!v.warn && v.battery < 0.15) v.warn = 'low';
  return step;
}
