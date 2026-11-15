/**
 * Contenido del diálogo "Ecuaciones y algoritmo" de las ventanas de lanzamiento.
 * Muestra las mismas fórmulas que usa orbit.js, en el mismo orden, con las cifras del plan elegido.
 * La notación matemática es igual en los dos idiomas y vive aquí; la prosa vive en i18n.js.
 */
import {
  hohmannIdeal,
  transferBreakdown,
  northernSeason,
  wrap360,
  AU_KM,
  ARRIVAL_ITERATIONS,
  ELEMENTS,
  LEO_ALTITUDE_KM,
  MU_EARTH,
  MU_SUN,
  R_EARTH_KM,
  WINDOW_BISECTIONS,
  WINDOW_STEP_DAYS,
} from './orbit.js';

const EARTH = '⊕';
const MARS = '♂︎'; // ︎: que se dibuje como símbolo y no como emoji
const SUN = '☉';
const STEPS = ['positions', 'ellipse', 'arrival', 'miss', 'search', 'dv', 'season'];
const ELEMENT_ROWS = [
  ['a', 'a'],
  ['e', 'e'],
  ['I', 'I'],
  ['L', 'L'],
  ['peri', 'ϖ'],
  ['node', 'Ω'],
];

/* ---------- Notación ---------- */

const v = (name, index = '') => `<var>${name}</var>${index ? `<sub>${index}</sub>` : ''}`;
const frac = (top, bottom) => `<span class="hohmann__frac"><span>${top}</span><span>${bottom}</span></span>`;
const sqrt = (body) => `<span class="hohmann__sqrt">√<span>${body}</span></span>`;
const eq = (...lines) => `<div class="hohmann__eq">${lines.map((line) => `<div>${line}</div>`).join('')}</div>`;
const times = (n) => `<span class="hohmann__eq-note">× ${n}</span>`;

/**
 * @param {object} p
 * @param {(key: string, vars?: object) => string} p.t
 * @param {string} p.lang
 * @param {(value: number, digits?: number) => string} p.num
 * @param {(date: Date) => string} p.fmtDate
 * @param {ReturnType<import('./orbit.js').planTransfer>} p.plan
 * @param {number} p.searchBackDays días antes de la fecha elegida desde los que se buscan ventanas
 * @returns {string} HTML
 */
export function renderEquations({ t, lang, num, fmtDate, plan, searchBackDays }) {
  const k = (key, vars) => t(`hohmann.math.${key}`, vars);
  const decimal = (1.5).toLocaleString(lang).charAt(1);
  /** Un número literal de la fórmula, con el separador decimal del idioma. */
  const lit = (x) => String(x).replace('-', '−').replace('.', decimal);
  const signed = (x, digits) =>
    Math.abs(x) < 0.5 * 10 ** -digits ? num(0, digits) : `${x > 0 ? '+' : '−'}${num(Math.abs(x), digits)}`;
  const au = k('au');

  const b = transferBreakdown(plan);
  const ideal = hohmannIdeal();
  const earth = plan.earthAtDeparture;
  const mars = plan.marsAtArrival;

  const vals = (...rows) =>
    `<div class="hohmann__vals"><span class="hohmann__vals-kicker">${k('yours')}</span>${rows
      .map((row) => `<p>${row}</p>`)
      .join('')}</div>`;
  const step = (n, key, body, vars) => `
    <section class="hohmann__math-step">
      <h3><span class="hohmann__num">${n}</span>${k(`step.${key}.name`)}</h3>
      <p>${k(`step.${key}.text`, vars)}</p>
      ${body}
    </section>`;

  const planetRow = (label, date, p, days, centuries, rName, lonName) =>
    `<strong>${label}</strong> (${fmtDate(date)}): ${v('D')} = ${num(days, 1)} d · ${v('T')} = ${num(centuries, 5)} · ${v(
      'a',
    )} = ${num(p.a, 5)} ${au} · ${v('e')} = ${num(p.e, 5)} · ${v('M')} = ${num(wrap360(p.meanAnomalyDeg), 2)}° · ${v(
      'E',
    )} = ${num(wrap360(p.eccentricAnomalyDeg), 2)}° → ${rName} = ${num(p.r, 4)} ${au} · ${lonName} = ${num(p.lon, 2)}°`;

  // Paso 1: posiciones (JPL, elementos keplerianos aproximados)
  const s1 = step(
    1,
    'positions',
    eq(
      `${v('T')} = ${frac(v('D'), lit(36525))}`,
      `${v('q')}(${v('T')}) = ${v('q', '0')} + ${v('q', '1')} · ${v('T')}, &nbsp; ${v('q')} ∈ {${v('a')}, ${v('e')}, ${v(
        'I',
      )}, ${v('L')}, ${v('ϖ')}, ${v('Ω')}}`,
      `${v('M')} = ${v('L')} − ${v('ϖ')}, &nbsp; ${v('ω')} = ${v('ϖ')} − ${v('Ω')}`,
      `${v('E')} − ${v('e')} sin ${v('E')} = ${v('M')}`,
      `${v('E', 'n+1')} = ${v('E', 'n')} + ${frac(
        `${v('M')} − ${v('E', 'n')} + ${v('e')} sin ${v('E', 'n')}`,
        `1 − ${v('e')} cos ${v('E', 'n')}`,
      )}`,
      `${v('x')}′ = ${v('a')} (cos ${v('E')} − ${v('e')}), &nbsp; ${v('y')}′ = ${v('a')} ${sqrt(
        `1 − ${v('e')}<sup>2</sup>`,
      )} sin ${v('E')}`,
      `(${v('x')}, ${v('y')}, ${v('z')}) = R(${v('Ω')}, ${v('I')}, ${v('ω')}) · (${v('x')}′, ${v('y')}′, 0)`,
      `${v('r')} = ${sqrt(`${v('x')}<sup>2</sup> + ${v('y')}<sup>2</sup> + ${v('z')}<sup>2</sup>`)}, &nbsp; ${v(
        'λ',
      )} = atan2(${v('y')}, ${v('x')})`,
    ) +
      vals(
        planetRow(k('earthDep'), plan.departure, earth, b.departureDaysJ2000, b.departureCenturies, v('r', '1'), v('λ', EARTH)),
        planetRow(k('marsArr'), plan.arrival, mars, b.arrivalDaysJ2000, b.arrivalCenturies, v('r', '2'), v('λ', MARS)),
      ),
  );

  // Paso 2: media elipse
  const s2 = step(
    2,
    'ellipse',
    eq(
      `${v('a', 'T')} = ${frac(`${v('r', '1')} + ${v('r', '2')}`, '2')}, &nbsp; ${v('e', 'T')} = ${frac(
        `${v('r', '2')} − ${v('r', '1')}`,
        `${v('r', '2')} + ${v('r', '1')}`,
      )}`,
      `Δ${v('t')} = π ${sqrt(frac(`${v('a', 'T')}<sup>3</sup>`, v('μ', SUN)))}`,
    ) +
      vals(
        `${v('a', 'T')} = ${num(plan.aTransferAu, 4)} ${au} · ${v('e', 'T')} = ${num(plan.eccentricity, 4)} · Δ${v(
          't',
        )} = ${num(plan.transferDays, 1)} d`,
      ),
  );

  // Paso 3: iterar la llegada
  const s3 = step(
    3,
    'arrival',
    eq(
      `Δ${v('t')}<sup>(0)</sup> = π ${sqrt(
        frac(`(${frac(`${v('a', EARTH)} + ${v('a', MARS)}`, '2')})<sup>3</sup>`, v('μ', SUN)),
      )}`,
      `${v('r', '2')} ← ${v('r', MARS)}(${v('t', '1')} + Δ${v('t')}), &nbsp; Δ${v('t')} ← π ${sqrt(
        frac(`${v('a', 'T')}<sup>3</sup>`, v('μ', SUN)),
      )} &nbsp; ${times(ARRIVAL_ITERATIONS)}`,
      `${v('t', '2')} = ${v('t', '1')} + Δ${v('t')}`,
    ) +
      vals(
        `Δ${v('t')}<sup>(0)</sup> = ${num(ideal.transferDays, 1)} d → Δ${v('t')} = ${num(plan.transferDays, 1)} d · ${v(
          't',
          '2',
        )} = ${fmtDate(plan.arrival)}`,
      ),
    { n: ARRIVAL_ITERATIONS },
  );

  // Paso 4: ángulo de fallo
  const rawMiss = mars.lon - earth.lon - 180;
  const missResult =
    Math.abs(rawMiss - plan.missDeg) < 1e-6
      ? `= ${signed(plan.missDeg, 3)}°`
      : `= ${num(rawMiss, 2)}° ≡ ${signed(plan.missDeg, 3)}°`;
  const s4 = step(
    4,
    'miss',
    eq(
      `${v('δ')}(${v('t', '1')}) = ${v('λ', MARS)}(${v('t', '1')} + Δ${v('t')}) − ${v('λ', EARTH)}(${v(
        't',
        '1',
      )}) − 180° &nbsp; <span class="hohmann__eq-note">[−180°, 180°)</span>`,
      `${v('δ')}(${v('t', '1')}) = 0`,
    ) +
      vals(
        `${v('δ')} = ${num(mars.lon, 2)}° − ${num(earth.lon, 2)}° − 180° ${missResult}`,
      ),
  );

  // Paso 5: búsqueda y bisección
  const s5 = step(
    5,
    'search',
    eq(
      `${v('δ')}(${v('t')}) &gt; 0 &nbsp; → &nbsp; ${v('δ')}(${v('t')} + ${WINDOW_STEP_DAYS} d) ≤ 0`,
      `${v('t', 'm')} = ${frac(`${v('t', 'a')} + ${v('t', 'b')}`, '2')}, &nbsp; ${v('δ')}(${v('t', 'm')}) &gt; 0 ? ${v(
        't',
        'a',
      )} ← ${v('t', 'm')} : ${v('t', 'b')} ← ${v('t', 'm')} &nbsp; ${times(WINDOW_BISECTIONS)}`,
      `${frac(`${WINDOW_STEP_DAYS} d`, `2<sup>${WINDOW_BISECTIONS}</sup>`)} ≈ ${num(
        ((WINDOW_STEP_DAYS * 86400) / 2 ** WINDOW_BISECTIONS) * 1000,
        2,
      )} ms`,
    ) +
      vals(
        `${v('δ')}(${v('t', '1')} − ${WINDOW_STEP_DAYS} d) = ${signed(b.missBeforeDeg, 2)}° · ${v('δ')}(${v(
          't',
          '1',
        )}) = ${signed(plan.missDeg, 3)}° · ${v('δ')}(${v('t', '1')} + ${WINDOW_STEP_DAYS} d) = ${signed(
          b.missAfterDeg,
          2,
        )}°`,
        `${v('t', '1')} = ${fmtDate(plan.departure)}`,
      ),
    { back: num(searchBackDays), step: WINDOW_STEP_DAYS, n: WINDOW_BISECTIONS },
  );

  // Paso 6: impulsos (vis-viva)
  const s6 = step(
    6,
    'dv',
    eq(
      `${v('v')} = ${sqrt(`${v('μ', SUN)} (${frac('2', v('r'))} − ${frac('1', v('a'))})`)}`,
      `Δ${v('v', '1')} = ${v('v', 'T')}(${v('r', '1')}) − ${v('v', EARTH)}(${v('r', '1')}), &nbsp; Δ${v('v', '2')} = ${v(
        'v',
        MARS,
      )}(${v('r', '2')}) − ${v('v', 'T')}(${v('r', '2')})`,
      `${v('r', '0')} = ${v('R', EARTH)} + ${LEO_ALTITUDE_KM} km`,
      `Δ${v('v', 'LEO')} = ${sqrt(`Δ${v('v', '1')}<sup>2</sup> + ${frac(`2${v('μ', EARTH)}`, v('r', '0'))}`)} − ${sqrt(
        frac(v('μ', EARTH), v('r', '0')),
      )}`,
    ) +
      vals(
        `${v('v', EARTH)}(${v('r', '1')}) = ${num(b.vEarthKmS, 2)} km/s · ${v('v', 'T')}(${v('r', '1')}) = ${num(
          b.vTransferDepartureKmS,
          2,
        )} km/s → Δ${v('v', '1')} = ${num(plan.dvDepartureKmS, 2)} km/s`,
        `${v('v', 'T')}(${v('r', '2')}) = ${num(b.vTransferArrivalKmS, 2)} km/s · ${v('v', MARS)}(${v('r', '2')}) = ${num(
          b.vMarsKmS,
          2,
        )} km/s → Δ${v('v', '2')} = ${num(plan.dvArrivalKmS, 2)} km/s`,
        `Δ${v('v', 'LEO')} = ${num(plan.dvFromLeoKmS, 2)} km/s`,
      ),
    { alt: LEO_ALTITUDE_KM },
  );

  // Paso 7: Ls con Mars24
  const s7 = step(
    7,
    'season',
    eq(
      `${v('M')} = ${lit(19.3871)}° + ${lit(0.52402073)}° · ${v('D')}`,
      `${v('α', 'FMS')} = ${lit(270.3871)}° + ${lit(0.524038496)}° · ${v('D')}`,
      `PBS = Σ<sub>${v('i')}=1…7</sub> ${v('A', 'i')} cos(${frac(`${lit(0.985626)}° · ${v('D')}`, v('τ', 'i'))} + ${v(
        'φ',
        'i',
      )})`,
      `${v('ν')} − ${v('M')} = (${lit(10.691)}° + 3·10<sup>−7</sup>° · ${v('D')}) sin ${v('M')} + ${lit(0.623)}° sin 2${v(
        'M',
      )} + ${lit(0.05)}° sin 3${v('M')}`,
      `&emsp;&emsp;+ ${lit(0.005)}° sin 4${v('M')} + ${lit(0.0005)}° sin 5${v('M')} + PBS`,
      `${v('L', 's')} = ${v('α', 'FMS')} + (${v('ν')} − ${v('M')})`,
    ) +
      vals(
        `${v('D', '2')} = ${num(b.arrivalDaysJ2000, 1)} d → ${v('L', 's')} = ${num(plan.arrivalLs, 1)}° · ${t(
          `hohmann.season.${northernSeason(plan.arrivalLs)}`,
        )} (N)`,
      ),
  );

  // El caso circular (solo explicativo)
  const idealBlock = `
    <section class="hohmann__math-step hohmann__math-step--aside">
      <h3>${k('ideal.name')}</h3>
      <p>${k('ideal.text')}</p>
      ${eq(
        `${v('P')} = 2π ${sqrt(frac(`${v('a')}<sup>3</sup>`, v('μ', SUN)))}`,
        `${v('φ')} = 180° − 360° · ${frac(`Δ${v('t', 'H')}`, v('P', MARS))}, &nbsp; ${v('S')} = ${frac(
          '1',
          `${frac('1', v('P', EARTH))} − ${frac('1', v('P', MARS))}`,
        )}`,
      )}
      ${vals(
        `${v('P', EARTH)} = ${num(ideal.earthPeriodDays, 2)} d · ${v('P', MARS)} = ${num(ideal.marsPeriodDays, 2)} d · Δ${v(
          't',
          'H',
        )} = ${num(ideal.transferDays, 1)} d → ${v('φ')} = ${num(ideal.phaseAngleDeg, 1)}° · ${v('S')} = ${num(
          ideal.synodicDays,
          1,
        )} d`,
      )}
    </section>`;

  // Datos de entrada: constantes y elementos de JPL
  const elementRows = ELEMENT_ROWS.map(
    ([key, symbol]) => `
      <tr>
        <th scope="row">${v(symbol)} <span>${k(`data.el.${key}`)}</span></th>
        <td>${lit(ELEMENTS.earth[key][0])}</td><td>${lit(ELEMENTS.earth[key][1])}</td>
        <td>${lit(ELEMENTS.mars[key][0])}</td><td>${lit(ELEMENTS.mars[key][1])}</td>
      </tr>`,
  ).join('');
  const dataBlock = `
    <section class="hohmann__math-step hohmann__math-step--aside">
      <h3>${k('data.name')}</h3>
      <p>${k('data.text')}</p>
      ${eq(
        `1 ${au} = ${num(AU_KM, 1)} km`,
        `${v('μ', SUN)} = ${num(MU_SUN / 1e11, 11)} × 10<sup>11</sup> km<sup>3</sup>/s<sup>2</sup>`,
        `${v('μ', EARTH)} = ${num(MU_EARTH, 6)} km<sup>3</sup>/s<sup>2</sup>, &nbsp; ${v('R', EARTH)} = ${num(
          R_EARTH_KM,
          4,
        )} km`,
      )}
      <div class="hohmann__table-wrap">
        <table class="hohmann__elements">
          <thead>
            <tr><th rowspan="2">${k('data.element')}</th><th colspan="2">${k('data.earth')}</th><th colspan="2">${k(
              'data.mars',
            )}</th></tr>
            <tr><th>${v('q', '0')}</th><th>${v('q', '1')}</th><th>${v('q', '0')}</th><th>${v('q', '1')}</th></tr>
          </thead>
          <tbody>${elementRows}</tbody>
        </table>
      </div>
    </section>`;

  const limits = ['plane', 'burns', 'angle', 'real']
    .map((key) => `<li>${k(`limits.${key}`, { incl: num(ELEMENTS.mars.I[0], 2) })}</li>`)
    .join('');

  return `
    <div class="hohmann__math-head">
      <h2 id="hohmann-math-title"><span class="hohmann__math-mark" aria-hidden="true">ƒ(x)</span>${k('title')}</h2>
      <button type="button" class="btn hohmann__math-close" data-math-close>${k('close')} <span aria-hidden="true">✕</span></button>
    </div>
    <div class="hohmann__math-body">
      <p class="hohmann__math-intro">${k('intro', { departure: fmtDate(plan.departure), arrival: fmtDate(plan.arrival) })}</p>
      <ol class="hohmann__flow">${STEPS.map((key) => `<li>${k(`step.${key}.name`)}</li>`).join('')}</ol>
      <p class="hohmann__math-legend">${k('legend')}</p>
      ${s1}${s2}${s3}${s4}${s5}${s6}${s7}
      ${idealBlock}
      ${dataBlock}
      <section class="hohmann__math-step hohmann__math-step--aside">
        <h3>${k('limits.name')}</h3>
        <ul class="hohmann__limits">${limits}</ul>
      </section>
      <p class="hohmann__math-sources">${k('sources')}</p>
    </div>`;
}
