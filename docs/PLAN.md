# Plan de trabajo — Martian Map

Equipo LAIKA II · inicio 2026-11-14 · entrega en 24–48 h · 2 personas, cada una con su agente.

## 1. Qué construimos

Una web (computadora y tablet, español/inglés) que guía una misión a Marte **fase por fase** y cruza
datos abiertos de la NASA con lo que necesita el cuerpo humano para decir qué zonas son viables.

## 2. La experiencia por fases

| Fase | Qué hace la persona | Módulos | Parte |
|---|---|---|---|
| 0 · Inicio | Pantalla tipo videojuego con fondo ASCII animado, INICIAR e índice de recursos | `home` | B |
| 1 · Planear desde la Tierra | Calcula la transferencia de Hohmann (ventana, viaje, llegada) y elige el sitio de aterrizaje sobre el mapa con capas | `hohmann`, `map` | A |
| 2 · Tránsito | Vive los meses de viaje: peligros para el cuerpo, rutina de confinamiento, caso "solo", juegos | `transit` | B |
| 3 · Descenso | Baja al sitio elegido y recorre el terreno en primera persona | `descent` | B |
| 4 · Superficie | Coloca hubs autónomos con veredicto de viabilidad; traza rutas de conducción evitando cráteres | `hubs`, `routes` | A, B |
| 5 · Supervivencia | Consulta las guías: necesidades diarias del cuerpo y respuesta a emergencias | `guides` | B |
| Recursos | Todas las referencias de la app en un solo lugar | `references` | B |

Las fases se encadenan con datos: la fecha de llegada que calcula Hohmann fija la estación marciana
(Ls) del aterrizaje, y esa estación cambia temperaturas y polvo en el mapa, en los hubs y en el descenso.

## 3. División del trabajo

**Parte A — "De la Tierra al sitio de aterrizaje"**: núcleo de la app, Hohmann, mapa, datos
ambientales, viabilidad y hubs. Detalle en [PARTE-A.md](PARTE-A.md).

**Parte B — "Del tránsito a la supervivencia"**: pantalla de inicio, Supabase, tránsito y
confinamiento, rutas, primera persona, guías y referencias. Detalle en [PARTE-B.md](PARTE-B.md).

| Carpeta o archivo | Dueño |
|---|---|
| `src/core/**`, `src/styles/**`, `index.html`, `package.json`, `vite.config.js` | A |
| `src/modules/hohmann/`, `src/modules/map/`, `src/modules/hubs/` | A |
| `tools/**`, `public/data/**` | A |
| `docs/PLAN.md`, `docs/CONTRATOS.md`, `docs/PARTE-A.md` | A |
| `src/modules/home/`, `transit/`, `descent/`, `routes/`, `guides/`, `references/` | B |
| `src/services/**`, `supabase/**` | B |
| `docs/PARTE-B.md` | B |
| `docs/REFERENCIAS.md`, `docs/BACKLOG.md` | Ambos, cada quien en su sección |

La Parte B no espera a la Parte A: `ctx.env` ya responde con datos de relleno con las firmas
definitivas, y `createMarsMap()` ya entrega el mapa base real. Cuando A conecte los datos reales
(tarea A3), los módulos de B los reciben sin cambiar código.

## 4. Arquitectura

- **Vite + JavaScript sin framework.** Sitio estático publicado en GitHub Pages.
- **Módulos.** Cada pantalla vive en `src/modules/<id>/` y exporta un `ModuleDef` con `mount(el, ctx)`.
  El shell (`src/core/shell.js`) pinta la barra de fases y monta el módulo según el hash `#/<id>`.
- **Estado.** `src/core/store.js` guarda idioma, reloj marciano y misión; persiste en localStorage.
- **Entorno.** `src/core/env.js` es la única puerta a los datos ambientales (`sample`, `evaluate`,
  `craters`, `elevationGrid`).
- **Mapa.** Leaflet en proyección equirectangular con mosaicos de NASA Mars Trek (`src/core/marsmap.js`).
- **Datos.** Scripts de Python en `tools/` convierten los productos de NASA/USGS en rejillas ligeras
  dentro de `public/data/`. La web no descarga datos crudos.
- **Backend.** Supabase guarda misiones (sitio, hubs, rutas) y puntuaciones de los minijuegos, con
  sesión anónima y seguridad por filas. Es opcional: sin él, todo sigue en el navegador.
- **Primera persona.** Three.js sobre la rejilla de elevación del sitio elegido.

Contratos exactos en [CONTRATOS.md](CONTRATOS.md).

## 5. Calendario

Horas contadas desde el arranque de cada persona. Los puntos de integración son el momento de hacer
merge a `main` y probar juntos.

| Punto | Hora | Parte A entrega | Parte B entrega |
|---|---|---|---|
| I1 | H+8 | Hohmann funcionando; mapa con capas base | Inicio ASCII con índice; Supabase guardando misión |
| I2 | H+18 | Datos reales en `env`; reloj marciano; ficha de zona | Tránsito y confinamiento con un minijuego; referencias |
| I3 | H+30 | Sitio de aterrizaje y hubs con veredicto | Rutas de conducción; guías de supervivencia |
| I4 | H+40 | Pulido y prueba en tablet | Primera persona; segundo minijuego |
| Cierre | H+44 | Congelar código, auditoría de referencias, guion de demo | Lo mismo |

## 6. Línea de corte

Si el tiempo no alcanza, se recorta en este orden: segundo minijuego → primera persona (se cambia por
una vista fija del sitio con sus datos) → perfiles extra de vehículo en rutas → tipos extra de hub.
No se recorta: Hohmann, mapa con capas, ficha de zona, hubs con veredicto, inicio, referencias.

## 7. Reglas de datos

1. Solo fuentes de la NASA u otras fuentes científicas confiables (USGS, JPL, ESA, artículos revisados).
2. Cada cifra visible enlaza a su referencia. La pantalla de Referencias las reúne todas.
3. Lo modelado o aproximado se etiqueta como tal (por ejemplo, Hohmann supone órbitas circulares).
4. Donde no hay dato se muestra "sin datos".
5. La fórmula y los pesos de la viabilidad se muestran en pantalla.

## 8. Cómo agregar cosas

El plan está abierto. Para sumar algo nuevo:

- **Una idea:** añádela a [BACKLOG.md](BACKLOG.md) en tu sección.
- **Un módulo nuevo:** crea `src/modules/<id>/` con `index.js` e `i18n.js` (copia cualquiera de los
  provisionales) y agrégalo en `src/core/registry.js`. Aparece solo en la barra de fases y en el índice.
- **Una capa del mapa, un tipo de hub o un perfil de vehículo:** son entradas en una lista dentro de
  su módulo; no requieren tocar el núcleo.
- **Una tarea:** añádela a tu archivo `PARTE-X.md` con prioridad y criterio de "hecho cuando".

## 9. Pendientes que requieren a una persona

- **Supabase (persona B):** crear el proyecto, activar el inicio de sesión anónimo y copiar la URL y
  la llave `anon` a `.env.local`. Compartir esos dos valores con la persona A por un canal privado.
- **GitHub Pages (persona A):** en el repositorio, Settings → Pages → Source: GitHub Actions.
- **Colaboración (persona A):** invitar a la persona B como colaboradora del repositorio.
