/**
 * Módulo "transit". Dueño: Parte B — tarea B3 (docs/PARTE-B.md).
 * Ahora es una pantalla provisional: reemplaza mount() con la implementación real.
 * Contrato del módulo: docs/CONTRATOS.md y src/core/types.js (ModuleDef).
 */
import messages from './i18n.js';
import { mountStub } from '../../core/stub.js';

/** @type {import('../../core/types.js').ModuleDef} */
const mod = {
  id: 'transit',
  phase: 2,
  owner: 'B',
  task: 'B3',
  messages,
  references: [],
  mount(el, ctx) {
    return mountStub(el, ctx, mod);
  },
};

export default mod;
