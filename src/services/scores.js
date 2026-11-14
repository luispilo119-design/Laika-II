/**
 * Puntuaciones de los minijuegos. Dueño: Parte B — tarea B2.
 * Siempre se guardan en este navegador; si hay Supabase y red, también en la tabla `scores`.
 */
import { ensureSession } from './sync.js';

const SCORES_KEY = 'laika2.scores.v1'; // { [game]: { alias, points, at }[] }
const KEEP_LOCAL = 20;
export const ALIAS_MAX = 16;

/** Alias válido para la tabla: 1 a 16 caracteres. */
export function cleanAlias(alias) {
  const text = String(alias ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ALIAS_MAX);
  return text || 'LAIKA';
}

/**
 * @param {object} deps
 * @param {() => Promise<any>} deps.getClient  Cliente de Supabase o null.
 * @param {{ read: Function, write: Function }} deps.storage
 * @param {() => boolean} [deps.isOnline]
 */
export function createScores({ getClient, storage, isOnline = () => true }) {
  async function cloud() {
    if (!isOnline()) return null;
    return (await getClient()) ?? null;
  }

  return {
    /**
     * @returns {Promise<{ game: string, alias: string, points: number, at: string, cloud: boolean }>}
     *   cloud = true si además quedó guardada en Supabase.
     */
    async submit(game, alias, points) {
      const entry = {
        alias: cleanAlias(alias),
        points: Math.max(0, Math.round(Number(points) || 0)),
        at: new Date().toISOString(),
      };
      const all = storage.read(SCORES_KEY, {}) ?? {};
      all[game] = [...(all[game] ?? []), entry].sort((a, b) => b.points - a.points).slice(0, KEEP_LOCAL);
      storage.write(SCORES_KEY, all);

      let saved = false;
      try {
        const client = await cloud();
        if (client) {
          await ensureSession(client);
          const res = await client.from('scores').insert({ game, alias: entry.alias, points: entry.points });
          saved = !res.error;
        }
      } catch {
        /* sin nube: la puntuación ya está guardada en este navegador */
      }
      return { game, ...entry, cloud: saved };
    },

    /**
     * Mejores puntuaciones de un juego.
     * @returns {Promise<{ source: 'cloud'|'local', rows: { alias: string, points: number, at: string }[] }>}
     */
    async top(game, limit = 10) {
      try {
        const client = await cloud();
        if (client) {
          const res = await client
            .from('scores')
            .select('alias, points, created_at')
            .eq('game', game)
            .order('points', { ascending: false })
            .limit(limit);
          if (!res.error) {
            return {
              source: 'cloud',
              rows: res.data.map((row) => ({ alias: row.alias, points: row.points, at: row.created_at })),
            };
          }
        }
      } catch {
        /* se responde con lo local */
      }
      const all = storage.read(SCORES_KEY, {}) ?? {};
      return { source: 'local', rows: (all[game] ?? []).slice(0, limit) };
    },
  };
}
