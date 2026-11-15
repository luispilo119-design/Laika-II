# Supabase

Guarda las misiones y las puntuaciones de los minijuegos. Es opcional: sin estos pasos la app
funciona igual y guarda todo en el navegador.

## Puesta en marcha (una sola vez, lo hace una persona)

1. Crear un proyecto en <https://supabase.com>.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins:** activarlo.
3. **SQL Editor:** pegar y ejecutar el contenido de
   [migrations/20261114000000_misiones_y_puntuaciones.sql](migrations/20261114000000_misiones_y_puntuaciones.sql).
4. **Project Settings → API:** copiar la URL del proyecto y la llave pública (`anon` o
   `publishable`) a un archivo `.env.local` en la raíz del repositorio:

```bash
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

5. Reiniciar `npm run dev`. En la pantalla de inicio debe decir "Guardado en la nube".
6. Compartir esos dos valores con la otra persona del equipo por un canal privado.

`.env.local` no se sube al repositorio. La llave `service_role` (o `secret`) **nunca** va ahí:
se salta la seguridad por filas. Si se pega por error, la app la detecta y no la usa.

## Qué se guarda

| Tabla | Contenido | Quién puede |
|---|---|---|
| `missions` | `state.mission` y `state.clock` en la columna `data` | Solo su dueño (leer y escribir) |
| `scores` | juego, alias (1–16 caracteres) y puntos | Cualquiera lee; cada quien inserta las suyas |

La sesión es anónima y vive en el navegador: otra computadora es otra persona para Supabase.

## Para los módulos

Los módulos no importan el cliente. Usan `src/services/index.js`:

| Función | Para qué |
|---|---|
| `submitScore(game, alias, points)` | Registrar una puntuación (siempre queda también en local) |
| `topScores(game, limit)` | Mejores puntuaciones; dice si vienen de la nube o de local |
| `getStatus()` / `onStatus(fn)` | Estado del guardado: `local`, `connecting`, `saving`, `synced`, `offline` |
