/**
 * Servicios opcionales (Supabase: guardar misión, puntuaciones). Dueño: Parte B — tarea B2.
 *
 * main.js llama a init(ctx) una sola vez al arrancar. Reglas del contrato:
 *  - Si faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, init() no hace nada y la app sigue
 *    funcionando con localStorage (el store ya persiste solo).
 *  - Nunca bloquea el arranque: nada de await largos antes de mostrar la interfaz.
 *  - La sincronización se engancha con ctx.store.subscribe(...).
 *
 * @param {import('../core/types.js').Ctx} _ctx
 */
export async function init(_ctx) {
  // Pendiente: B2.
}
