/**
 * Ficha de zona (tarea A4): condiciones de un punto frente a lo que necesita el cuerpo humano,
 * desglose de la viabilidad, restricciones de aterrizaje y búsqueda de las mejores zonas.
 * Aquí está la lógica y el HTML de la ficha; index.js la monta y conecta los botones.
 */
import { SCORE_SCALES, VERDICT_THRESHOLDS } from '../../core/env.js';
import { HUMAN_NEEDS, solsToCareerLimit } from '../../core/human-needs.js';

/**
 * Restricciones preliminares de la NASA para zonas de exploración humana en Marte:
 * latitud dentro de ±50°, elevación no mayor de +2 km (MOLA) y capacidad de evitar pendientes de 5°
 * al aterrizar. Bussey y Hoffman (2016), ref. bussey2016.
 */
export const LANDING_CONSTRAINTS = { maxAbsLatDeg: 50, maxElevationM: 2000, maxSlopeDeg: 5, refId: 'bussey2016' };

/** @type {import('../../core/types.js').Reference[]} */
export const ZONE_REFERENCES = [
  {
    id: 'bussey2016',
    title: 'Bussey y Hoffman (2016): Human Mars Landing Site and Impacts on Mars Surface Operations',
    org: 'NASA Headquarters',
    url: 'https://ntrs.nasa.gov/citations/20160002370',
    year: 2016,
    verified: true,
  },
];

/** @returns {{ id: 'latitude'|'elevation'|'slope', ok: boolean, value: number, limit: number }[]} */
export function checkLanding(lat, sample) {
  const c = LANDING_CONSTRAINTS;
  return [
    { id: 'latitude', ok: Math.abs(lat) <= c.maxAbsLatDeg, value: Math.abs(lat), limit: c.maxAbsLatDeg },
    { id: 'elevation', ok: sample.elevationM <= c.maxElevationM, value: sample.elevationM, limit: c.maxElevationM },
    { id: 'slope', ok: sample.slopeDeg <= c.maxSlopeDeg, value: sample.slopeDeg, limit: c.maxSlopeDeg },
  ];
}

/**
 * Recorre la rejilla y devuelve las zonas de mayor puntaje para el instante del reloj, entre las que
 * cumplen las restricciones de aterrizaje, separadas entre sí para que no salgan todas juntas.
 * @param {import('../../core/types.js').Ctx['env']} env
 * @param {import('../../core/types.js').Clock} clock
 */
export function bestZones(env, clock, { count = 8, stepDeg = 2, minSeparationDeg = 15, profile = 'habitat' } = {}) {
  const candidates = [];
  for (let lat = -LANDING_CONSTRAINTS.maxAbsLatDeg; lat <= LANDING_CONSTRAINTS.maxAbsLatDeg; lat += stepDeg) {
    for (let lon = -180; lon < 180; lon += stepDeg) {
      if (!checkLanding(lat, env.sample(lat, lon, clock)).every((c) => c.ok)) continue;
      const { score, verdict } = env.evaluate(lat, lon, clock, profile);
      candidates.push({ lat, lon, score, verdict });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const c of candidates) {
    const far = picked.every((p) => {
      const dLon = Math.abs(((c.lon - p.lon + 540) % 360) - 180) * Math.cos(((c.lat + p.lat) / 2) * (Math.PI / 180));
      return Math.hypot(c.lat - p.lat, dLon) >= minSeparationDeg;
    });
    if (far) picked.push(c);
    if (picked.length === count) break;
  }
  return picked;
}

const FACTOR_DIGITS = { water: 2, temperature: 0, energy: 0, radiation: 2, terrain: 1, pressure: 0, dust: 2 };

/**
 * HTML de la ficha.
 * @param {object} o
 * @param {number} o.lat
 * @param {number} o.lon
 * @param {import('../../core/types.js').EnvSample} o.sample
 * @param {import('../../core/types.js').Evaluation} o.evaluation
 * @param {boolean} o.isSite          true si este punto es el sitio de aterrizaje elegido
 * @param {(key: string, vars?: object) => string} o.t
 * @param {(value: number, digits?: number) => string} o.num
 * @param {(lat: number, lon: number) => string} o.coords
 * @param {(refId: string) => string} o.sourceLink
 */
export function zoneHtml({ lat, lon, sample: s, evaluation, isSite, t, num, coords, sourceLink }) {
  const model = `<abbr class="zone__model" title="${t('map.zone.modelHint')}">${t('map.zone.modelTag')}</abbr>`;
  const tag = (field) => (s.modeled.includes(field) ? ` ${model}` : '');
  const need = HUMAN_NEEDS;
  const kPa = s.pressurePa / 1000;

  const compare = [
    {
      key: 'temperature',
      here: `${t('map.zone.tempHere', { now: num(s.temperatureC), min: num(s.temperatureMinC), max: num(s.temperatureMaxC) })}${tag('temperatureC')}`,
      needs: t('map.zone.tempNeed', { min: num(need.temperature.min), max: num(need.temperature.max) }),
      ref: need.temperature.refId,
    },
    {
      key: 'pressure',
      here: `${t('map.zone.pressureHere', { pa: num(s.pressurePa), kpa: num(kPa, 2) })}${tag('pressurePa')}`,
      needs: t('map.zone.pressureNeed', { min: num(need.cabinPressure.min), max: num(need.cabinPressure.max, 1), o2: num(need.oxygenPressure.min, 1) }),
      ref: need.cabinPressure.refId,
    },
    {
      key: 'water',
      here: s.iceIndex == null ? t('map.zone.waterNoData') : t('map.zone.waterHere', { index: num(s.iceIndex, 2) }),
      needs: t('map.zone.waterNeed', { kg: num(need.potableWater.value, 1) }),
      ref: need.potableWater.refId,
    },
    {
      key: 'air',
      here: `${t('map.zone.airHere')} <small>${sourceLink('mars-fact-sheet')}</small>`,
      needs: t('map.zone.airNeed', { o2: num(need.oxygen.value, 2), food: num(need.food.value, 2) }),
      ref: need.oxygen.refId,
    },
    {
      key: 'radiation',
      here: `${t('map.zone.radiationHere', { dose: num(s.radiationMSvDay, 2) })}${tag('radiationMSvDay')}`,
      needs: t('map.zone.radiationNeed', { limit: num(need.careerRadiation.max), sols: num(solsToCareerLimit(s.radiationMSvDay)) }),
      ref: need.careerRadiation.refId,
    },
  ];

  const factorRows = evaluation.factors
    .filter((f) => f.weight > 0 || f.noData)
    .map((f) => {
      const scale = SCORE_SCALES[f.id];
      const unit = f.unit ? ` ${f.unit}` : '';
      const value = f.noData ? t('map.point.noData') : `${num(f.value, FACTOR_DIGITS[f.id])}${unit}`;
      return `
        <div class="zone__factor${f.noData ? ' is-nodata' : ''}">
          <div class="zone__factor-head">
            <span>${t(`map.factor.${f.id}`)}${f.modeled ? ` ${model}` : ''}</span>
            <strong>${f.noData ? '—' : `${f.score} %`}</strong>
          </div>
          <div class="zone__bar"><i style="width:${f.noData ? 0 : f.score}%"></i></div>
          <p>
            ${t('map.zone.factorLine', { value, weight: num(f.weight * 100), points: num(f.score * f.weight, 1) })}
            ${f.noData ? t('map.zone.factorNoData') : ''}
          </p>
          <p class="zone__scale">
            ${t('map.zone.scale', { worst: `${num(scale.worst, FACTOR_DIGITS[f.id])}${unit}`, best: `${num(scale.best, FACTOR_DIGITS[f.id])}${unit}` })}
            · ${sourceLink(f.refId)}
          </p>
        </div>`;
    })
    .join('');

  const landing = checkLanding(lat, s);
  const landingValue = {
    latitude: (c) => `${num(c.value, 1)}°`,
    elevation: (c) => `${num(c.value)} m`,
    slope: (c) => `${num(c.value, 1)}°`,
  };
  const landingRows = landing
    .map(
      (c) => `
        <li class="${c.ok ? 'is-ok' : 'is-bad'}">
          <span class="zone__mark">${c.ok ? '✓' : '✕'}</span>
          <span>${t(`map.zone.landing.${c.id}`, { limit: num(c.limit) })}</span>
          <strong>${landingValue[c.id](c)}</strong>
        </li>`,
    )
    .join('');

  return `
    <div class="zone__head">
      <div>
        <h2>${t('map.zone.title')}</h2>
        <p class="zone__coords">${coords(lat, lon)}</p>
      </div>
      <button type="button" class="btn btn--ghost" data-zone-close>${t('map.panel.close')}</button>
    </div>

    <div class="zone__score is-${evaluation.verdict}">
      <strong>${evaluation.score}</strong>
      <div>
        <span class="zone__verdict">${t(`map.verdict.${evaluation.verdict}`)}</span>
        <span>${t('map.zone.scoreHint', { viable: VERDICT_THRESHOLDS.viable, marginal: VERDICT_THRESHOLDS.marginal })}</span>
      </div>
    </div>

    <h3>${t('map.zone.compareTitle')}</h3>
    <div class="zone__compare">
      <div class="zone__compare-head"><span>${t('map.zone.here')}</span><span>${t('map.zone.body')}</span></div>
      ${compare
        .map(
          (row) => `
            <div class="zone__compare-row">
              <h4>${t(`map.zone.row.${row.key}`)}</h4>
              <p>${row.here}</p>
              <p>${row.needs} <small>${sourceLink(row.ref)}</small></p>
            </div>`,
        )
        .join('')}
    </div>

    <h3>${t('map.zone.breakdownTitle')}</h3>
    <p class="zone__note">${t('map.zone.formula')}</p>
    ${factorRows}

    <h3>${t('map.zone.landingTitle')}</h3>
    <ul class="zone__landing">${landingRows}</ul>
    <p class="zone__note">${t('map.zone.landingNote')} ${sourceLink(LANDING_CONSTRAINTS.refId)}</p>

    <div class="zone__actions">
      ${
        isSite
          ? `<p class="zone__chosen">${t('map.zone.chosen')}</p>
             <button type="button" class="btn btn--primary" data-zone-next>${t('map.zone.next')}</button>
             <button type="button" class="btn btn--ghost" data-zone-clear>${t('map.zone.clear')}</button>`
          : `<button type="button" class="btn btn--primary" data-zone-choose>${t('map.zone.choose')}</button>`
      }
    </div>
  `;
}
