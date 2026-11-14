/**
 * Módulo "hubs". Dueño: Parte A — tarea A5 (docs/PARTE-A.md).
 * Ahora es una pantalla provisional: reemplaza mount() con la implementación real.
 * Contrato del módulo: docs/CONTRATOS.md y src/core/types.js (ModuleDef).
 */
import messages from './i18n.js';
import { mountStub } from '../../core/stub.js';

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'hubs',
  phase: 4,
  owner: 'A',
  task: 'A5',
  messages,
  references: [],
  mount(el, ctx) {
    return mountStub(el, ctx, mod);
  },
};

export default mod;
