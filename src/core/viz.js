/**
 * Gráficos pequeños compartidos (HTML/SVG en texto). Dueño: Parte A.
 * - spectrumHtml: dónde cae una puntuación en el espectro no viable → marginal → viable.
 * - radarSvg: polígono con la puntuación de cada factor (una "red" que se deforma según la zona).
 * Los colores salen de las variables de base.css.
 */
import { VERDICT_THRESHOLDS } from './env.js';

/**
 * @param {number} score 0..100
 * @param {(key: string, vars?: object) => string} t
 * @param {{ compact?: boolean }} [opts]
 */
export function spectrumHtml(score, t, { compact = false } = {}) {
  const { viable, marginal } = VERDICT_THRESHOLDS;
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = s >= viable ? 'viable' : s >= marginal ? 'marginal' : 'not_viable';
  return `
    <div class="spectrum ${compact ? 'spectrum--compact' : ''}" role="img"
      aria-label="${t('core.spectrum.aria', { score: s, verdict: t(`core.verdict.${verdict}`) })}">
      <div class="spectrum__track">
        <span class="spectrum__zone spectrum__zone--bad" style="width:${marginal}%"></span>
        <span class="spectrum__zone spectrum__zone--mid" style="width:${viable - marginal}%"></span>
        <span class="spectrum__zone spectrum__zone--good" style="width:${100 - viable}%"></span>
        <span class="spectrum__pin" style="left:${s}%"><b>${s}</b></span>
      </div>
      ${
        compact
          ? ''
          : `<div class="spectrum__labels">
        <span style="width:${marginal}%">${t('core.verdict.not_viable')}<small>0–${marginal - 1}</small></span>
        <span style="width:${viable - marginal}%">${t('core.verdict.marginal')}<small>${marginal}–${viable - 1}</small></span>
        <span style="width:${100 - viable}%">${t('core.verdict.viable')}<small>${viable}–100</small></span>
      </div>
      <p class="spectrum__explain">${t(`core.spectrum.${verdict}`)}</p>`
      }
    </div>`;
}

/**
 * Polígono de radar. Cada eje es un factor con peso > 0; el radio es su puntuación (0..100).
 * El punto central se desplaza hacia los factores fuertes: su distancia al borde "viable"
 * muestra de un vistazo hacia dónde se inclina la zona.
 * @param {{ id: string, score: number, weight: number, noData?: boolean }[]} factors
 * @param {(key: string) => string} t
 * @param {{ size?: number }} [opts]
 */
export function radarSvg(factors, t, { size = 240 } = {}) {
  const axes = factors.filter((f) => f.weight > 0 || f.noData);
  if (axes.length < 3) return '';
  const c = size / 2;
  const R = size / 2 - 34;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const at = (i, r) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r];
  const ring = (frac) =>
    axes
      .map((_, i) => at(i, R * frac))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  const shape = axes
    .map((f, i) => at(i, R * (f.noData ? 0 : f.score / 100)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  // Centro de masa ponderado: hacia dónde "tira" la zona.
  let wx = 0;
  let wy = 0;
  let wt = 0;
  axes.forEach((f, i) => {
    const [x, y] = at(i, R * (f.noData ? 0 : f.score / 100));
    const w = f.weight || 0;
    wx += x * w;
    wy += y * w;
    wt += w;
  });
  const px = wt ? wx / wt : c;
  const py = wt ? wy / wt : c;
  const { viable, marginal } = VERDICT_THRESHOLDS;
  return `
    <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="${t('core.radar.aria')}">
      <polygon points="${ring(1)}" class="radar__ring radar__ring--outer" />
      <polygon points="${ring(viable / 100)}" class="radar__ring radar__ring--viable" />
      <polygon points="${ring(marginal / 100)}" class="radar__ring radar__ring--marginal" />
      ${axes.map((_, i) => `<line x1="${c}" y1="${c}" x2="${at(i, R)[0].toFixed(1)}" y2="${at(i, R)[1].toFixed(1)}" class="radar__axis" />`).join('')}
      <polygon points="${shape}" class="radar__shape" />
      ${axes
        .map((f, i) => {
          const [x, y] = at(i, R * (f.noData ? 0 : f.score / 100));
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="radar__node" />`;
        })
        .join('')}
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7" class="radar__pull" />
      ${axes
        .map((f, i) => {
          const [x, y] = at(i, R + 18);
          const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
          return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" class="radar__label">${t(`core.factorShort.${f.id}`)}</text>`;
        })
        .join('')}
    </svg>`;
}
