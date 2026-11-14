/**
 * Registro de módulos. Dueño: Parte A.
 * Todos los módulos planeados ya están listados: para construir uno solo se edita su carpeta.
 * Para agregar un módulo NUEVO: crea src/modules/<id>/ (index.js + i18n.js) y añade aquí una
 * línea de import y una entrada en `modules`. Es el único archivo compartido que hay que tocar.
 */
import home from '../modules/home/index.js';
import hohmann from '../modules/hohmann/index.js';
import map from '../modules/map/index.js';
import transit from '../modules/transit/index.js';
import descent from '../modules/descent/index.js';
import hubs from '../modules/hubs/index.js';
import routes from '../modules/routes/index.js';
import guides from '../modules/guides/index.js';
import references from '../modules/references/index.js';
import dashboard from '../modules/dashboard/index.js';

/** Fases de la misión, en el orden en que se recorren. */
export const PHASES = [
  { id: 0, key: 'core.phase.0' },
  { id: 1, key: 'core.phase.1' },
  { id: 2, key: 'core.phase.2' },
  { id: 3, key: 'core.phase.3' },
  { id: 4, key: 'core.phase.4' },
  { id: 5, key: 'core.phase.5' },
  { id: 6, key: 'core.phase.6' },
];

/** @type {import('./types.js').ModuleDef[]} */
export const modules = [home, hohmann, map, transit, descent, hubs, routes, guides, dashboard, references];
