/**
 * Tipos compartidos (JSDoc). Este archivo es la versión en código de docs/CONTRATOS.md.
 * Dueño: Parte A. Si necesitas cambiar un contrato, avisa antes: los dos lados dependen de él.
 *
 * Convención de coordenadas en TODO el proyecto:
 *   lat: planetocéntrica, grados, -90..90 (norte positivo)
 *   lon: grados, -180..180, ESTE positivo (igual que NASA Mars Trek)
 */

/**
 * @typedef {Object} Clock  Tiempo marciano de la simulación.
 * @property {number} sol        Sol desde la llegada (0 = día del aterrizaje).
 * @property {number} localHour  Hora solar local, 0..24.
 * @property {number} ls         Longitud solar de Marte, 0..360 (0 = equinoccio de primavera norte).
 */

/**
 * @typedef {Object} Site
 * @property {number} lat
 * @property {number} lon
 * @property {string} [name]
 */

/**
 * @typedef {Object} Hub
 * @property {string} id
 * @property {'habitat'|'greenhouse'|'solar'|'ice_mine'|'landing_pad'} type
 * @property {number} lat
 * @property {number} lon
 * @property {number} score      0..100 en el momento de colocarlo.
 * @property {Verdict} verdict
 */

/**
 * @typedef {Object} Route
 * @property {string} id
 * @property {'pressurized_rover'|'light_rover'|'on_foot'} profile
 * @property {[number, number][]} points  Pares [lat, lon].
 * @property {number} distanceKm
 * @property {number} [durationH]
 */

/**
 * @typedef {Object} Mission
 * @property {string} name
 * @property {string|null} departure  Fecha ISO de salida de la Tierra (la fija el módulo hohmann).
 * @property {string|null} arrival    Fecha ISO de llegada a Marte.
 * @property {number|null} arrivalLs  Ls de Marte al llegar.
 * @property {Site|null} site         Sitio de aterrizaje elegido en el mapa.
 * @property {Hub[]} hubs
 * @property {Route[]} routes
 * @property {{ day: number, days: Object<string, object> }} [journal]  Diario de supervivencia por sol
 *   (lo escribe guides; lo lee dashboard). Forma y validación en src/core/journal.js.
 */

/**
 * @typedef {Object} AppState
 * @property {'es'|'en'} lang
 * @property {Clock} clock
 * @property {Mission} mission
 */

/** @typedef {'viable'|'marginal'|'not_viable'} Verdict */

/**
 * @typedef {Object} EnvSample  Condiciones en un punto y un instante.
 * @property {number} elevationM       Respecto al areoide MOLA.
 * @property {number} slopeDeg
 * @property {number} temperatureC     Temperatura del aire cerca de la superficie a esa hora.
 * @property {number} temperatureMinC  Mínima del sol.
 * @property {number} temperatureMaxC  Máxima del sol.
 * @property {number} pressurePa
 * @property {number|null} iceIndex    0..1 (consistencia de hielo SWIM); null = sin datos.
 * @property {number} radiationMSvDay
 * @property {number} dustOpacity      Opacidad óptica del polvo (tau).
 * @property {number} solarWm2         Irradiancia media diaria en superficie.
 * @property {boolean} mock            true = valor de relleno, NO es dato real.
 * @property {string[]} modeled        Campos que vienen de un modelo y no de una medición.
 */

/**
 * @typedef {Object} Factor
 * @property {string} id       'water' | 'temperature' | 'energy' | 'radiation' | 'terrain' | 'pressure' | 'dust'
 * @property {number} score    0..100
 * @property {number} weight   0..1; los pesos de un perfil suman 1.
 * @property {number|null} value  Valor físico usado.
 * @property {string} unit
 * @property {string} refId    id de la referencia que respalda el dato.
 */

/**
 * @typedef {Object} Evaluation
 * @property {number} score    0..100, suma ponderada de factores.
 * @property {Verdict} verdict
 * @property {Factor[]} factors
 * @property {boolean} mock
 */

/**
 * @typedef {Object} BBox
 * @property {number} south
 * @property {number} west
 * @property {number} north
 * @property {number} east
 */

/**
 * @typedef {Object} ElevationGrid  Fila 0 = borde norte; columna 0 = borde oeste.
 * @property {number} width
 * @property {number} height
 * @property {Float32Array} data   Metros, longitud width*height.
 * @property {BBox} bbox
 * @property {boolean} mock
 */

/**
 * @typedef {Object} Reference
 * @property {string} id
 * @property {string} title
 * @property {string} org      NASA, USGS, JPL, ESA/LMD, revista...
 * @property {string} url
 * @property {number} [year]
 * @property {boolean} verified  true solo si alguien abrió el enlace y comprobó que respalda el dato.
 */

/**
 * @typedef {Object} ModuleDef
 * @property {string} id            También es la ruta: #/<id>
 * @property {number|null} phase    Fase de la misión (ver PHASES en registry.js); null = recurso transversal.
 * @property {'A'|'B'} owner
 * @property {string} task          Id de tarea en docs/PARTE-A.md o docs/PARTE-B.md
 * @property {boolean} [fullscreen] true = sin barra superior (pantalla de inicio, primera persona).
 * @property {{es: object, en: object}} messages  Textos; se registran bajo el namespace <id>.
 * @property {Reference[]} references
 * @property {(el: HTMLElement, ctx: Ctx) => (void | (() => void))} mount  Devuelve la función de limpieza.
 */

/**
 * @typedef {Object} Ctx
 * @property {typeof import('./store.js').store} store
 * @property {typeof import('./i18n.js').t} t
 * @property {typeof import('./env.js').env} env
 * @property {(id: string) => void} navigate
 * @property {ModuleDef[]} modules
 * @property {{id: number, key: string}[]} phases
 */

export {};
