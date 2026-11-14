/**
 * Cliente de Supabase. Dueño: Parte B — tarea B2.
 * Solo se crea si existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (.env.local).
 * La biblioteca se carga aparte y bajo demanda: sin esas variables, ni siquiera se descarga.
 */

const vars = import.meta.env ?? {};
const url = String(vars.VITE_SUPABASE_URL ?? '').trim();
const key = String(vars.VITE_SUPABASE_ANON_KEY ?? '').trim();

/**
 * true si la llave es de servidor (service_role o secreta). Esa llave se salta la seguridad
 * por filas y nunca debe ir en el navegador: si alguien la pega por error, no se usa.
 */
export function isServerKey(value) {
  if (value.startsWith('sb_secret_')) return true;
  try {
    const payload = value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role === 'service_role';
  } catch {
    return false;
  }
}

const serverKey = Boolean(key) && isServerKey(key);
if (serverKey) {
  console.warn('[services] VITE_SUPABASE_ANON_KEY es una llave de servidor; Supabase queda desactivado.');
}

/** true si hay URL y llave pública: la app intentará guardar en Supabase. */
export const isConfigured = Boolean(url && key) && !serverKey;

let clientPromise = null;

/**
 * fetch que no lanza. Si no se llega al servidor responde 503, y supabase-js lo devuelve como
 * un error normal (`{ error }`) en vez de escribir la excepción en la consola.
 */
export async function quietFetch(input, init) {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(JSON.stringify({ message: 'No se pudo conectar con Supabase' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** @returns {Promise<import('@supabase/supabase-js').SupabaseClient | null>} null si no hay configuración. */
export function getClient() {
  if (!isConfigured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: quietFetch },
      }),
    )
    .catch(() => null);
  return clientPromise;
}
