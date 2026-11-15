/** Fuentes de toda la app: las que registra cada módulo en `references`. Dueño: Parte A. */

/**
 * Reúne las referencias de todos los módulos, sin duplicados (misma `id` o, si falta, misma URL).
 * Cada fuente queda en la fase del primer módulo que la registra y recuerda todos los que la usan.
 * @param {import('./types.js').ModuleDef[]} modules
 */
export function collectReferences(modules) {
  const byKey = new Map();
  for (const mod of modules) {
    for (const ref of mod.references ?? []) {
      const key = ref.id || ref.url;
      if (!key) continue;
      const found = byKey.get(key);
      if (found) {
        if (!found.usedBy.includes(mod.id)) found.usedBy.push(mod.id);
        // Basta con que un módulo la haya comprobado.
        found.ref = { ...found.ref, verified: Boolean(found.ref.verified || ref.verified) };
      } else {
        byKey.set(key, { ref: { ...ref }, phase: mod.phase ?? null, usedBy: [mod.id] });
      }
    }
  }
  return [...byKey.values()];
}
