/**
 * Contenido del módulo "guides": referencias, guías por situación y necesidades diarias.
 * Parte B — tarea B6. Los textos viven en i18n.js; aquí van la estructura y las fuentes.
 *
 * Todas las referencias se abrieron el 2026-11-14 y se comprobó que respaldan lo que se muestra.
 * Varias se usan también en otros módulos de la Parte B: llevan el mismo `id` para que la
 * pantalla de referencias las muestre una sola vez.
 */

/** @type {import('../../core/types.js').Reference[]} */
export const REFERENCES = [
  {
    // Tormentas regionales cada año, globales cada ~3 años marcianos; vientos de hasta ~60 mph;
    // atmósfera ~1 % de la densidad terrestre; polvo sobre paneles solares.
    id: 'nasa-dust-storms',
    title: 'The Fact and Fiction of Martian Dust Storms',
    org: 'NASA',
    url: 'https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/',
    year: 2015,
    verified: true,
  },
  {
    // Conjunción solar cada dos años; el gas de la corona puede corromper órdenes; pausa de órdenes.
    id: 'nasa-solar-conjunction',
    title: "What's Mars Solar Conjunction, and Why Does It Matter?",
    org: 'NASA/JPL',
    url: 'https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/',
    year: 2019,
    verified: true,
  },
  {
    // Simulacros de despresurización, fugas e incendio: equipo de seguridad, cerrar la escotilla, evacuar.
    id: 'nasa-iss-emergency-drill',
    title: 'Station Trio Practices Emergency Before Radiation, Physics Research',
    org: 'NASA',
    url: 'https://www.nasa.gov/blogs/spacestation/2019/01/15/station-trio-practices-emergency-before-radiation-physics-research/',
    year: 2019,
    verified: true,
  },
  {
    // Marte sin campo magnético global y con atmósfera tenue; la estructura detiene casi todas las
    // partículas solares; seguimiento de la dosis de cada astronauta.
    id: 'nasa-radiation-mars',
    title: 'Real Martians: How to Protect Astronauts from Space Radiation on Mars',
    org: 'NASA',
    url: 'https://www.nasa.gov/science-research/heliophysics/real-martians-how-to-protect-astronauts-from-space-radiation-on-mars/',
    year: 2015,
    verified: true,
  },
  {
    // El polvo en los paneles redujo la energía hasta agotar las baterías; limpieza con tierra en días de viento.
    id: 'nasa-insight-retire',
    title: 'NASA Retires InSight Mars Lander Mission After Years of Science',
    org: 'NASA/JPL',
    url: 'https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/',
    year: 2022,
    verified: true,
  },
  {
    // Presión en superficie: 6.36 mb en el radio medio (4.0 a 8.7 mb según la estación).
    id: 'nssdca-mars-fact',
    title: 'Mars Fact Sheet',
    org: 'NASA GSFC · NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    verified: true,
  },
  {
    // Hasta 20 minutos de retraso por trayecto.
    id: 'hrp-distance',
    title: 'Hazard: Distance From Earth',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/',
    verified: true,
  },
  {
    // La tripulación resuelve problemas en equipo sin el control de misión; entrenamiento médico.
    id: 'hrp-body',
    title: 'The Human Body in Space',
    org: 'NASA Human Research Program',
    url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/',
    year: 2021,
    verified: true,
  },
  {
    // La tripulación de CHAPEA ensayó un apagón de comunicaciones de dos semanas.
    id: 'nasa-chapea',
    title: 'CHAPEA — Crew Health and Performance Exploration Analog',
    org: 'NASA',
    url: 'https://www.nasa.gov/humans-in-space/chapea/',
    verified: true,
  },
];

const byId = new Map(REFERENCES.map((ref) => [ref.id, ref]));
export const refOf = (id) => byId.get(id);

/**
 * Guías por situación. `facts` y `steps` son claves de texto (guides.guide.<id>.fact.<n> y
 * .step.<n>); cada hecho lleva su fuente. `links` son los módulos de la app que respaldan la guía.
 */
export const GUIDES = [
  {
    id: 'pressure',
    facts: [
      { id: 1, refs: ['nssdca-mars-fact'] },
      { id: 2, refs: ['nasa-dust-storms'] },
      { id: 3, refs: ['nasa-iss-emergency-drill'] },
    ],
    steps: 5,
    stepRefs: ['nasa-iss-emergency-drill', 'hrp-distance'],
    links: ['hubs', 'map'],
  },
  {
    id: 'dust',
    facts: [
      { id: 1, refs: ['nasa-dust-storms'] },
      { id: 2, refs: ['nasa-dust-storms'] },
      { id: 3, refs: ['nasa-dust-storms'] },
    ],
    steps: 5,
    stepRefs: ['nasa-dust-storms', 'nasa-insight-retire'],
    links: ['map', 'routes'],
  },
  {
    id: 'radiation',
    facts: [
      { id: 1, refs: ['nasa-radiation-mars'] },
      { id: 2, refs: ['nasa-radiation-mars'] },
      { id: 3, refs: ['nasa-radiation-mars'] },
    ],
    steps: 4,
    stepRefs: ['nasa-radiation-mars'],
    links: ['map', 'hubs'],
  },
  {
    id: 'comms',
    facts: [
      { id: 1, refs: ['nasa-solar-conjunction'] },
      { id: 2, refs: ['hrp-distance'] },
      { id: 3, refs: ['nasa-chapea'] },
    ],
    steps: 4,
    stepRefs: ['nasa-solar-conjunction', 'hrp-body'],
    links: ['transit'],
  },
  {
    id: 'power',
    facts: [
      { id: 1, refs: ['nasa-insight-retire'] },
      { id: 2, refs: ['nasa-insight-retire'] },
      { id: 3, refs: ['nasa-dust-storms'] },
    ],
    steps: 4,
    stepRefs: ['nasa-insight-retire', 'nasa-dust-storms'],
    links: ['hubs', 'map'],
  },
];

/**
 * Necesidades diarias del cuerpo. Los VALORES no están aquí: los entrega la Parte A en
 * `src/core/human-needs.js` (ver needs.js). Mientras no exista, cada tarjeta dice "sin datos".
 */
export const NEED_IDS = ['water', 'oxygen', 'food', 'pressure', 'temperature', 'radiation'];
