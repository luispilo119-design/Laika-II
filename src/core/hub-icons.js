/**
 * Íconos de los hubs vistos desde arriba, como en una imagen satelital (SVG en texto).
 * Son esquemas decorativos, no planos a escala: a los niveles de zoom del mapa un hábitat real
 * mediría menos de un píxel. El aro exterior lleva el color del veredicto.
 */

const shadow = '<ellipse cx="52" cy="54" rx="40" ry="40" fill="rgba(0,0,0,0.28)" />';

const ART = {
  // Domo con módulos radiales y esclusas.
  habitat: `
    ${shadow}
    <rect x="44" y="6" width="12" height="18" rx="2" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>
    <rect x="44" y="76" width="12" height="18" rx="2" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>
    <rect x="6" y="44" width="18" height="12" rx="2" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>
    <rect x="76" y="44" width="18" height="12" rx="2" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>
    <circle cx="50" cy="50" r="30" fill="#efe9dc" stroke="#3b3631" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="20" fill="none" stroke="#a49b8b" stroke-width="1.5"/>
    <path d="M50 20 V80 M20 50 H80 M29 29 L71 71 M71 29 L29 71" stroke="#a49b8b" stroke-width="1.2"/>
    <circle cx="50" cy="50" r="7" fill="#d6402a" stroke="#3b3631" stroke-width="1.5"/>`,
  // Nave de cultivo con costillas de vidrio.
  greenhouse: `
    ${shadow}
    <rect x="14" y="22" width="72" height="56" rx="6" fill="#b9dfb0" stroke="#2f4f2a" stroke-width="2.5"/>
    <path d="M26 22 V78 M38 22 V78 M50 22 V78 M62 22 V78 M74 22 V78" stroke="#4f7d47" stroke-width="1.5"/>
    <path d="M14 50 H86" stroke="#2f4f2a" stroke-width="2"/>
    <rect x="44" y="78" width="12" height="12" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>
    <circle cx="20" cy="30" r="3" fill="#eef7ea"/><circle cx="68" cy="60" r="3" fill="#eef7ea"/>`,
  // Campo de paneles solares.
  solar: `
    ${shadow}
    <g fill="#1f3f7a" stroke="#0e1d38" stroke-width="1.5">
      ${[0, 1, 2, 3]
        .map((r) => [0, 1, 2].map((c) => `<rect x="${12 + c * 26}" y="${12 + r * 20}" width="22" height="16" rx="1"/>`).join(''))
        .join('')}
    </g>
    <g stroke="#6e95d6" stroke-width="0.8">
      ${[0, 1, 2, 3].map((r) => `<path d="M12 ${20 + r * 20} H86"/>`).join('')}
    </g>`,
  // Perforadora de hielo: plataforma, pozo y banda transportadora.
  ice_mine: `
    ${shadow}
    <rect x="16" y="16" width="52" height="52" rx="3" fill="#cfc4ae" stroke="#3b3631" stroke-width="2.5"/>
    <circle cx="42" cy="42" r="16" fill="#e8f3f7" stroke="#2c6f8c" stroke-width="3"/>
    <circle cx="42" cy="42" r="6" fill="#2c6f8c"/>
    <path d="M58 58 L88 88" stroke="#3b3631" stroke-width="7" stroke-linecap="round"/>
    <path d="M58 58 L88 88" stroke="#eab422" stroke-width="3" stroke-dasharray="4 4"/>
    <rect x="78" y="78" width="16" height="16" rx="2" fill="#d9d2c3" stroke="#3b3631" stroke-width="2"/>`,
  // Plataforma de aterrizaje con marcas.
  landing_pad: `
    ${shadow}
    <polygon points="30,8 70,8 92,30 92,70 70,92 30,92 8,70 8,30" fill="#8d8478" stroke="#3b3631" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="#f3eee4" stroke-width="3" stroke-dasharray="7 5"/>
    <path d="M38 34 V66 M62 34 V66 M38 50 H62" stroke="#f3eee4" stroke-width="6" stroke-linecap="square"/>
    <circle cx="14" cy="50" r="3" fill="#eab422"/><circle cx="86" cy="50" r="3" fill="#eab422"/>
    <circle cx="50" cy="14" r="3" fill="#eab422"/><circle cx="50" cy="86" r="3" fill="#eab422"/>`,
};

const VERDICT_STROKE = { viable: '#2f7d4a', marginal: '#eab422', not_viable: '#d6402a' };

/**
 * @param {string} type  id del tipo de hub
 * @param {'viable'|'marginal'|'not_viable'} verdict
 * @param {boolean} [selected]
 */
export function hubIconSvg(type, verdict, selected = false) {
  const art = ART[type] ?? ART.habitat;
  const ring = VERDICT_STROKE[verdict] ?? '#161412';
  return `
    <svg viewBox="-8 -8 116 116" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="50" r="54" fill="none" stroke="${ring}" stroke-width="${selected ? 9 : 6}" ${selected ? '' : 'stroke-dasharray="10 5"'}/>
      ${art}
    </svg>`;
}

/** Tamaño del ícono en px según el zoom del mapa (crece al acercarse, con tope). */
export function hubIconSize(zoom) {
  return Math.round(Math.max(34, Math.min(120, 34 * Math.pow(1.35, zoom - 5))));
}
