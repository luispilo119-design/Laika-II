/**
 * Reglas del minijuego "Protocolo de guardia" (sin DOM, para poder probarlas). Parte B — B3.
 *
 * Juego original del equipo: la consola de la nave enciende varios sistemas en orden y hay que
 * repetir ese protocolo. Cada ronda es más larga y, a partir de la cuarta, algunas se repiten
 * en orden inverso.
 */

/** Identificador del juego en la tabla de puntuaciones. */
export const GAME_ID = 'transit-protocol';

/** Sistemas de la consola (3 × 3). `code` se muestra igual en los dos idiomas; el nombre va en i18n. */
export const TILES = [
  { id: 'o2', code: 'O₂' },
  { id: 'co2', code: 'CO₂' },
  { id: 'h2o', code: 'H₂O' },
  { id: 'pwr', code: 'PWR' },
  { id: 'com', code: 'COM' },
  { id: 'nav', code: 'NAV' },
  { id: 'tmp', code: 'TMP' },
  { id: 'prs', code: 'PRS' },
  { id: 'lux', code: 'LUX' },
];

const FIRST_LENGTH = 3;
const MAX_LENGTH = 12;
const REVERSED_FROM_ROUND = 4;
const REVERSED_CHANCE = 0.4;

/**
 * Qué pide la ronda `round` (1, 2, 3…).
 * @param {() => number} rand generador 0..1
 * @returns {{ length: number, reversed: boolean }}
 */
export function roundSpec(round, rand = Math.random) {
  return {
    length: Math.min(MAX_LENGTH, FIRST_LENGTH + round - 1),
    reversed: round >= REVERSED_FROM_ROUND && rand() < REVERSED_CHANCE,
  };
}

/** Secuencia de índices de sistema, sin repetir el mismo dos veces seguidas. */
export function makeSequence(length, rand = Math.random, tileCount = TILES.length) {
  const seq = [];
  while (seq.length < length) {
    const pick = Math.min(tileCount - 1, Math.floor(rand() * tileCount));
    if (pick !== seq[seq.length - 1]) seq.push(pick);
  }
  return seq;
}

/** Lo que debe tocar la persona: la secuencia tal cual o al revés. */
export function expectedInput(sequence, reversed) {
  return reversed ? [...sequence].reverse() : [...sequence];
}

/** Puntos por completar una ronda: las de orden inverso valen más. */
export function roundPoints(length, reversed) {
  return length * (reversed ? 15 : 10);
}
