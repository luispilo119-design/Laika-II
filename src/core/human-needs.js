/**
 * Necesidades diarias del cuerpo humano y límites de exposición. Dueño: Parte A (tarea A3).
 * Lo usa la ficha de zona (A4) y lo puede leer la Parte B para las guías (B6).
 *
 * Todas las cifras salen de dos documentos de la NASA, leídos el 2026-11-14:
 *   - BVAD: Life Support Baseline Values and Assumptions Document, NASA/TP-2015-218570/REV1 (2018).
 *     Tabla 3-33 (resumen de valores metabólicos nominales, tripulante de 82 kg con ejercicio),
 *     Tabla 4-20 (uso de agua) y Tabla 4-1 (atmósfera de la cabina).
 *   - OCHMO-TB-020: resumen técnico de NASA-STD-3001 sobre protección contra radiación ionizante.
 *
 * Las unidades por persona y día (kg/CM-d en el BVAD) se escriben aquí como "por día".
 */

/** @type {import('./types.js').Reference[]} */
export const HUMAN_REFERENCES = [
  {
    id: 'bvad2018',
    title: 'Life Support Baseline Values and Assumptions Document, NASA/TP-2015-218570/REV1',
    org: 'NASA Johnson Space Center',
    url: 'https://ntrs.nasa.gov/citations/20180001338',
    year: 2018,
    verified: true,
  },
  {
    id: 'nasa-std-3001-radiation',
    title: 'OCHMO-TB-020: Design for Ionizing Radiation Protection (resumen de NASA-STD-3001)',
    org: 'NASA Office of the Chief Health & Medical Officer',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf',
    year: 2025,
    verified: true,
  },
];

/**
 * @typedef {Object} HumanNeed
 * @property {string} id
 * @property {number} [value]    Valor nominal.
 * @property {number} [min]      Límite inferior aceptable.
 * @property {number} [max]      Límite superior aceptable.
 * @property {string} unit
 * @property {string} refId      id en HUMAN_REFERENCES.
 * @property {string} where      Tabla o sección de donde sale.
 * @property {string} [whereEn] Lo mismo en inglés (la pantalla en inglés usa este).
 */

/** @type {Record<string, HumanNeed>} */
export const HUMAN_NEEDS = {
  oxygen: { id: 'oxygen', value: 0.82, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 3-33 (0.816) y Tabla 3-22 (0.82)', whereEn: 'Table 3-33 (0.816) and Table 3-22 (0.82)' },
  carbonDioxide: { id: 'carbonDioxide', value: 1.04, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 3-33', whereEn: 'Table 3-33' },
  drinkingWater: { id: 'drinkingWater', value: 2.0, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 4-20', whereEn: 'Table 4-20' },
  foodWater: { id: 'foodWater', value: 0.5, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 4-20 (agua para rehidratar alimentos)', whereEn: 'Table 4-20 (water to rehydrate food)' },
  potableWater: { id: 'potableWater', value: 2.5, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 3-33 y Tabla 4-20 (consumo humano total)', whereEn: 'Table 3-33 and Table 4-20 (total human consumption)' },
  food: { id: 'food', value: 1.51, unit: 'kg/d', refId: 'bvad2018', where: 'Tabla 3-33 (sin empaque)', whereEn: 'Table 3-33 (without packaging)' },
  foodEnergy: { id: 'foodEnergy', value: 12.59, unit: 'MJ/d', refId: 'bvad2018', where: 'Tabla 3-33', whereEn: 'Table 3-33' },
  metabolicHeat: { id: 'metabolicHeat', value: 12.0, unit: 'MJ/d', refId: 'bvad2018', where: 'Tabla 3-33', whereEn: 'Table 3-33' },
  cabinPressure: { id: 'cabinPressure', value: 101, min: 48.0, max: 102.7, unit: 'kPa', refId: 'bvad2018', where: 'Tabla 4-1 (nominal: 101, 70.3 o 56.5 kPa)', whereEn: 'Table 4-1 (nominal: 101, 70.3 or 56.5 kPa)' },
  oxygenPressure: { id: 'oxygenPressure', value: 21.2, min: 20.7, max: 50.6, unit: 'kPa', refId: 'bvad2018', where: 'Tabla 4-1 (p[O2] nominal sin deterioro)', whereEn: 'Table 4-1 (nominal p[O2] with no impairment)' },
  temperature: { id: 'temperature', value: 296 - 273.15, min: 291 - 273.15, max: 300 - 273.15, unit: '°C', refId: 'bvad2018', where: 'Tabla 4-1 (291, 296 y 300 K)', whereEn: 'Table 4-1 (291, 296 and 300 K)' },
  careerRadiation: { id: 'careerRadiation', max: 600, unit: 'mSv', refId: 'nasa-std-3001-radiation', where: 'NASA-STD-3001 Vol. 1 [V1 4030]: dosis efectiva de toda la carrera', whereEn: 'NASA-STD-3001 Vol. 1 [V1 4030]: career effective dose' },
};

/** Soles que tardaría la dosis ambiental en sumar el límite de carrera, sin blindaje. */
export function solsToCareerLimit(radiationMSvDay) {
  const MARS_SOL_DAYS = 88775.244 / 86400; // duración del sol en días terrestres
  return HUMAN_NEEDS.careerRadiation.max / (radiationMSvDay * MARS_SOL_DAYS);
}
