# Architecture — Martian Map

A static web app (desktop and tablet, Spanish and English) that guides a mission to Mars **phase by
phase** and crosses open NASA data with what the human body needs to decide which zones are viable.

## 1. The experience, phase by phase

| Phase | What the user does | Modules |
|---|---|---|
| 0 · Start | Game-style start screen with an animated ASCII background, START / CONTINUE and an index of every screen | `home` |
| 1 · Plan from Earth | Compute the Hohmann transfer (window, trip, Δv, arrival), see the equations behind it, and choose the landing site on the layered map | `hohmann`, `map` |
| 2 · Transit | Live through the months of travel: the trip day by day, confinement routine, a minigame, hazards to the body | `transit` |
| 3 · Descent | Go down to the chosen site and explore it in first person, on foot or by rover | `descent` |
| 4 · Surface | Place autonomous hubs with a viability verdict; plot driving routes that avoid craters | `hubs`, `routes` |
| 5 · Survival | Log each sol in the survival journal; read the body's daily needs and the emergency guides | `guides` |
| 6 · Report | Mission dashboard and printable report | `dashboard` |
| Resources | Every reference in the app in one place | `references` |

The phases are chained through data: the arrival date computed by `hohmann` sets the Martian season
(Ls) at landing, and that season changes temperature and dust on the map, in the hubs and in the
descent. The landing site chosen in `map` is the starting point for `descent`, `hubs` and `routes`.

## 2. How it is built

- **Vite + plain JavaScript, no framework.** A static site published on GitHub Pages. Navigation uses
  the URL hash (`#/<id>`), so no server routing is needed; `vite.config.js` uses a relative base.
- **Modules.** Each screen lives in `src/modules/<id>/` and exports a `ModuleDef` with
  `mount(el, ctx)`. The shell (`src/core/shell.js`) draws the top bar (`src/core/topbar.js`, a "rail"
  of mission stations) and mounts the module that matches the hash. All modules are listed in
  `src/core/registry.js`.
- **Startup.** `src/main.js` starts the shell and then, without blocking, the optional services. The
  shell waits for `env.ready()` (loading the data grids) before mounting any module, and shows a retry
  button if loading fails.
- **State.** `src/core/store.js` keeps the language, the Martian clock and the mission, and persists
  them in `localStorage`.
- **Environment.** `src/core/env.js` is the only gateway to environmental data (`sample`,
  `evaluate`, `craters`, `elevationGrid`).
- **Map.** Leaflet in an equirectangular projection with NASA Mars Trek tiles (`src/core/marsmap.js`).
- **Data.** Python scripts in `tools/` turn NASA/USGS products into lightweight grids in
  `public/data/`. The web app never downloads raw data.
- **Backend.** Supabase stores missions (site, hubs, routes, journal) and minigame scores, with an
  anonymous session and row-level security. It is optional: without it, everything stays in the
  browser.
- **First person.** Three.js over the elevation grid around the chosen site, loaded on demand so it
  does not weigh on startup. Without WebGL the screen falls back to a static view with the site data.
- **Shared helpers in `src/core/`.** `clock.js` (Martian clock control), `human-needs.js` (the body's
  daily needs and radiation limit), `journal.js` (sol-by-sol journal logic, shared by `guides` and
  `dashboard`), `viz.js` (score spectrum and radar chart), `geo.js` (Mars radius and surface
  distance), `html.js` (escaping and element helpers), `references.js` (collects every module's
  references without duplicates), `hub-icons.js`.
- **Hohmann equations.** `src/modules/hohmann/orbit.js` holds the orbital math (JPL approximate
  orbital elements, Kepler's equation, the transfer ellipse, the launch-window search by bisection,
  vis-viva Δv and the Mars24 season). `equations.js` renders the "See equations and algorithm"
  dialog with the same formulas, in the same order, filled in with the numbers of the chosen window.
  `tests/orbit.test.js` checks the math against published values, including the two Mars24 worked
  examples.

Exact interfaces are in [CONTRACTS.md](CONTRACTS.md).

## 3. Testing

Tests run in Node with its built-in runner (`node --test`), without a browser. That is why each
module keeps its logic in pure files (`hohmann/orbit.js`, `map/zone.js`, `hubs/rules.js`,
`routes/routing.js`, `transit/game.js`, `transit/trip.js`, …) that tests import directly, separate
from `index.js`, which handles the DOM. Tests that need the real data swap the loader with
`setDataLoader()` from `env.js` to read `public/data/` from disk. `tests/i18n.test.js` checks that
every text exists in both languages.

## 4. Data rules

1. Only NASA or other trusted scientific sources (USGS, JPL, ESA, peer-reviewed papers).
2. Every visible figure links to its reference. The References screen collects them all.
3. Anything modeled or approximated is labeled as such (for example, the Hohmann planner assumes
   circular orbits, and climate, pressure and radiation come from models).
4. Where there is no data, the app shows "no data", never a zero.
5. The viability formula and its weights are shown on screen.

## 5. How to add things

- **A new module:** create `src/modules/<id>/` with `index.js` and `i18n.js` (copy an existing one)
  and add it to `src/core/registry.js`. It appears on its own in the top bar and in the index.
- **A map layer:** an entry in `src/modules/map/layers.js` (Mars Trek tiles) or
  `src/modules/map/envlayers.js` (painted from `env`), plus its texts in `i18n.js`.
- **A hub type:** an entry in `HUB_TYPES` (`src/modules/hubs/rules.js`), its weight profile in
  `PROFILES` (`src/core/env.js`), its texts, and the key in `Hub.type` (`src/core/types.js`).
- **A vehicle profile:** an entry in `src/modules/routes/profiles.js`.
- **An idea:** add it to [BACKLOG.md](BACKLOG.md).
