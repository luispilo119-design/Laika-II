# Parte B — Del tránsito a la supervivencia

Persona B (segunda persona del equipo) y su agente. Este archivo es autosuficiente: con él,
[CLAUDE.md](../CLAUDE.md), [PLAN.md](PLAN.md) y [CONTRATOS.md](CONTRATOS.md) se puede trabajar sin
esperar a la Parte A.

## Para empezar

```bash
git clone https://github.com/luispilo119-design/Laika-II.git
```

```bash
npm install
```

```bash
git switch -c parte-b
```

```bash
npm run dev
```

La app ya corre: cada módulo tuyo muestra una pantalla provisional que dice qué tarea le toca.
Construir un módulo es reemplazar `mount()` en su `index.js` y sus textos en `i18n.js`.

**Lo que ya puedes usar aunque la Parte A no haya terminado:**

- `ctx.env` responde con datos **de relleno** pero con las firmas definitivas. Programa contra él;
  cuando A conecte los datos reales, tu código no cambia.
- `createMarsMap()` de `src/core/marsmap.js` ya entrega el mapa real de Marte.
- `ctx.store` ya guarda y persiste la misión. Si `mission.site` o `mission.arrival` son `null`,
  usa un valor por defecto y muestra un aviso que lleve al módulo que lo fija.

**Tu territorio:** `src/modules/home/`, `transit/`, `descent/`, `routes/`, `guides/`, `references/`,
`src/services/` y `supabase/`. No edites `src/core/` ni los módulos de A; si necesitas un cambio
ahí, pídelo o mándalo en un commit aparte que solo toque ese archivo.

| Tarea | Prioridad | Horas | Punto de integración |
|---|---|---|---|
| B1 Pantalla de inicio ASCII | P0 | 5 | I1 |
| B2 Supabase | P0 | 4 | I1 |
| B3 Tránsito y confinamiento | P1 | 7 | I2 |
| B7 Pantalla de referencias | P0 | 2 | I2 |
| B4 Rutas de conducción | P1 | 6 | I3 |
| B6 Guías de supervivencia | P1 | 4 | I3 |
| B5 Descenso en primera persona | P2 | 6 | I4 |

---

## B1 · Pantalla de inicio — `src/modules/home/`

Entrada tipo videojuego. Hoy hay una versión mínima que funciona; se reemplaza.

- [ ] Fondo animado en ASCII: un agujero negro con disco de acreción, dibujado con caracteres sobre
      un `<canvas>` o un `<pre>`. La referencia visual es el proyecto BLACK-HOLE de JIN2-ASCII, que
      está en Python para terminal: aquí se **reescribe en JavaScript**. Revisa la licencia de ese
      repositorio antes de reutilizar cualquier fragmento, y da crédito en la pantalla de referencias.
- [ ] Menú: INICIAR (lleva a `hohmann`), CONTINUAR si ya hay una misión guardada, ÍNDICE con todos
      los módulos agrupados por fase (se arma con `ctx.modules` y `ctx.phases`), selector de idioma.
- [ ] Créditos: logo y nombre del equipo, y la dedicatoria a Laika.
- [ ] La animación se pausa con la pestaña oculta, no pasa de 30 cuadros por segundo, y con
      `prefers-reduced-motion` muestra un cuadro fijo. La limpieza de `mount` detiene todo.
- [ ] Navegable con teclado y con toque; legible a 768 px.

**Hecho cuando:** la app abre en esta pantalla, la animación corre fluida en tablet y se puede llegar
a cualquier módulo desde el índice.

## B2 · Supabase — `supabase/`, `src/services/`

**Paso de la persona (no del agente):** crear el proyecto en Supabase, activar el inicio de sesión
anónimo, y copiar la URL y la llave `anon` a `.env.local`. Compartirlas con la persona A en privado.

- [ ] Migración SQL en `supabase/migrations/` con seguridad por filas activada en todas las tablas.
      Punto de partida:

```sql
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  data jsonb not null,               -- state.mission + state.clock, tal cual
  updated_at timestamptz not null default now()
);
alter table public.missions enable row level security;
create policy "misiones propias" on public.missions
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create table public.scores (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game text not null,
  alias text not null check (char_length(alias) between 1 and 16),
  points integer not null check (points >= 0),
  created_at timestamptz not null default now()
);
alter table public.scores enable row level security;
create policy "leer puntuaciones" on public.scores for select using (true);
create policy "insertar propias" on public.scores for insert with check (owner = auth.uid());
```

- [ ] `src/services/supabase.js`: crea el cliente solo si existen las dos variables de entorno.
- [ ] `src/services/index.js` → `init(ctx)`: sesión anónima, carga la última misión guardada y se
      suscribe al store para guardar con retardo (debounce) cada cambio de `mission`.
- [ ] Funciones exportadas para los módulos: guardar y listar misiones, enviar y leer puntuaciones.
- [ ] Sin `.env.local`, o sin red, todo sigue funcionando con localStorage y sin errores en consola.

**Hecho cuando:** elegir un sitio en una computadora, recargar y ver que sigue ahí viniendo de
Supabase; y la app arranca igual con las variables vacías.

## B3 · Tránsito y confinamiento — `src/modules/transit/`

La Fase 2: los meses de viaje. La duración sale de `mission.departure` y `mission.arrival`; si no
hay plan, usa un valor por defecto y un aviso que lleve al módulo `hohmann`.

- [ ] Línea de tiempo del viaje con el día actual y lo que le pasa al cuerpo conforme avanza.
- [ ] Los cinco peligros del vuelo espacial humano según el Human Research Program de la NASA
      (radiación, aislamiento y confinamiento, distancia de la Tierra, gravedad, ambientes hostiles o
      cerrados): una tarjeta por peligro con qué es, qué le hace al cuerpo y cómo se contrarresta.
- [ ] Rutina de confinamiento: un planificador simple del día (sueño, ejercicio, trabajo, ocio).
- [ ] Caso "solo": qué cambia cuando la persona se queda sola y qué recomiendan los estudios de
      análogos. Es información general basada en fuentes, no consejo médico: dilo en la pantalla.
- [ ] Juegos: al menos un minijuego jugable y original (por ejemplo memoria de secuencias o un
      rompecabezas de lógica), más fichas de actividades sin pantalla. Puntuaciones a Supabase.
- [ ] Segundo minijuego si queda tiempo.

**Hecho cuando:** se puede recorrer el viaje, leer los cinco peligros con su fuente y terminar una
partida que guarde puntuación.

**Fuentes:** peligros del HRP de la NASA; análogos HERA y CHAPEA de la NASA; Mars-500; estándares
de salud de tripulación NASA-STD-3001.

## B4 · Rutas de conducción — `src/modules/routes/`

- [ ] Mapa con `createMarsMap()`; la persona marca origen y destino (por defecto, el sitio de
      aterrizaje y el primer hub).
- [ ] Rejilla de costo a partir de `env.elevationGrid(bbox, size)` (pendiente) y
      `env.craters(bbox, minDiameterKm)` (zonas prohibidas o caras alrededor de cráteres grandes).
- [ ] Búsqueda de ruta A* sobre esa rejilla; si no hay ruta posible, decirlo.
- [ ] Perfiles de vehículo (rover presurizado, rover ligero, a pie) con pendiente máxima, velocidad
      y diámetro de cráter que evitan. Las cifras de cada perfil llevan referencia o se etiquetan
      como supuestos del equipo.
- [ ] Resultado: la ruta dibujada, distancia, tiempo estimado, perfil de elevación y guía por tramos
      ("rodea el cráter por el norte", "pendiente máxima en el km 12").
- [ ] Guardar en `mission.routes`.

**Hecho cuando:** entre dos puntos cualesquiera sale una ruta que rodea los cráteres grandes, con
distancia y tiempo, y cambia al cambiar de perfil.

**Fuentes:** recorridos y velocidades reales de Curiosity y Perseverance (NASA/JPL); base de
cráteres de Robbins y Hynek; MOLA.

## B5 · Descenso en primera persona — `src/modules/descent/`

- [ ] Escena Three.js con el terreno alrededor de `mission.site`, construido con
      `env.elevationGrid`. Sin sitio elegido, usa uno por defecto y avisa.
- [ ] Secuencia de "bajar": la cámara desciende desde la vista de mapa hasta el suelo.
- [ ] Caminar: teclado y ratón en computadora, joystick táctil en tablet.
- [ ] Cielo y luz según `clock.localHour` y el polvo; HUD con temperatura, presión, radiación y
      elevación desde `env.sample`.
- [ ] El módulo puede ponerse `fullscreen: true`; debe ofrecer un botón para volver.
- [ ] La limpieza libera el contexto WebGL.

**Hecho cuando:** desde el sitio elegido se puede bajar y caminar en tablet a una velocidad fluida.

**Línea de corte:** si no da tiempo, una vista fija del sitio con su HUD y fotos reales del rover
más cercano.

**Fuentes:** MOLA para el relieve; imágenes crudas de Mars 2020 (NASA/JPL) para referencia visual
del color del cielo y del suelo.

## B6 · Guías de supervivencia — `src/modules/guides/`

- [ ] Lo que necesita el cuerpo humano cada día. Los valores vienen de `src/core/human-needs.js`,
      que entrega la Parte A en el punto I2; mientras tanto arma la pantalla con la estructura y
      deja los valores vacíos. **No escribas cifras de memoria.**
- [ ] Guías por situación: fallo de presión, tormenta de polvo, evento de radiación solar, pérdida
      de comunicación, quedarse sin energía. Cada una con pasos y fuente.
- [ ] Enlace cruzado: desde cada guía, a la capa del mapa o al módulo que la respalda.

**Hecho cuando:** cada guía se lee en una pantalla de tablet y todas sus cifras tienen referencia.

**Fuentes:** NASA-STD-3001, peligros del HRP, documentación de sistemas de soporte vital de la NASA.

## B7 · Pantalla de referencias — `src/modules/references/`

- [ ] Reúne `references` de todos los módulos de `ctx.modules`, agrupadas por fase y sin duplicados.
- [ ] Cada entrada: título, organización, año, enlace y si está verificada.
- [ ] Sección de créditos: equipo, mosaicos de Mars Trek, bibliotecas usadas, inspiración del fondo ASCII.

**Hecho cuando:** toda referencia registrada en cualquier módulo aparece aquí sin tocar esta pantalla.

## Al cerrar

- [ ] Recorrido completo en tablet o a 768 px.
- [ ] Todas las referencias de tus módulos con `verified: true`.
- [ ] Tu parte del guion de demo.
