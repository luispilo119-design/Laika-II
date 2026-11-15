# Shared contracts

What every module can rely on. The code version is in `src/core/types.js`. Changing anything here
affects several modules: agree on it first and log it at the end of this file.

## 1. Coordinates and units

- `lat`: planetocentric, degrees, −90..90, north positive.
- `lon`: degrees, −180..180, **east positive** (same as NASA Mars Trek). Leaflet uses `[lat, lon]`.
- Elevation in meters above the MOLA areoid. Temperature in °C. Pressure in Pa. Distances in km.
- Radiation in mSv/day. Irradiance in W/m². Dust as optical depth τ.
- Earth dates in ISO 8601 UTC. Martian time with `Clock`.
- Grids: row 0 = north edge, column 0 = west edge.

## 2. Module

```js
// src/modules/<id>/index.js
export default {
  id: 'routes',          // also the route: #/routes
  phase: 4,              // mission phase (PHASES in registry.js); null = cross-cutting resource
  fullscreen: false,     // true = no top bar
  messages,              // { es: {...}, en: {...} } from ./i18n.js
  references: [],        // Reference[] backing the module's data
  mount(el, ctx) {       // renders inside el; returns a cleanup function
    return () => {};
  },
};
```

- The shell remounts the module when the language changes: do not keep important state in the DOM,
  keep it in the store.
- Cleanup must remove global listeners, timers, `requestAnimationFrame` loops, maps and WebGL
  contexts.
- A module's own CSS is imported from its `index.js` and uses classes prefixed with the module id
  (`.routes__...`). Colors and sizes come from the variables in `src/styles/base.css`.
- A module may import from `src/core/` and from `src/services/index.js`, never from another module's
  folder.

## 3. Context (`ctx`)

| Field | What it is |
|---|---|
| `ctx.store` | Shared state (§4) |
| `ctx.t(key, vars)` | Text in the current language (§6) |
| `ctx.env` | Environmental data (§5) |
| `ctx.navigate(id)` | Switches module |
| `ctx.modules`, `ctx.phases` | Lists of modules and phases, for indexes and menus |

## 4. State

```js
{
  lang: 'es' | 'en',
  clock: { sol, localHour, ls },   // sol 0 = landing day; localHour 0..24; ls 0..360
  mission: {
    name: '',
    departure: null,   // ISO; written by hohmann
    arrival: null,     // ISO; written by hohmann
    arrivalLs: null,   // written by hohmann
    site: null,        // { lat, lon, name? }; written by map
    hubs: [],          // Hub[]; written by hubs
    routes: [],        // Route[]; written by routes
    journal: { day: 1, days: {} }, // sol-by-sol journal; written by guides, read by dashboard (src/core/journal.js)
  },
}
```

- `store.get()` returns the state; never mutate it.
- `store.set('mission.site', value)` changes one dotted path. Arrays are replaced whole.
- `store.subscribe((state, path) => {...})` returns the unsubscribe function.
- `store.replaceMission(mission, clock)` and `store.resetMission()` load or reset a mission.
- Each field has **a single module that writes it**; the others only read. Every module must work
  when the fields it reads are `null` or empty (use sensible defaults and a notice that links to the
  module that sets them).
- The keys for `Hub.type` and `Route.profile` are in `src/core/types.js`.

## 5. Environment (`ctx.env`)

| Function | Returns |
|---|---|
| `env.isMock` | `false`: the data is real |
| `await env.ready()` | Resolves once the grids are loaded. The shell already waits for it before mounting any module |
| `env.sample(lat, lon, clock)` | `EnvSample`: elevation, slope, current/min/max temperature, pressure, ice index, radiation, dust, irradiance |
| `env.evaluate(lat, lon, clock, profile)` | `Evaluation`: score 0–100, verdict and weighted factors |
| `await env.craters(bbox, minDiameterKm)` | List of `{ lat, lon, diameterKm }` |
| `await env.elevationGrid(bbox, size)` | `ElevationGrid`: a `Float32Array` of `size × size` meters, row 0 to the north |

- `bbox` is `{ south, west, north, east }`.
- `sample` and `evaluate` are synchronous and fast: they can run on every pointer move.
- `iceIndex` can be `null` (no data). Treat it as "no data", not zero.
- Verdicts: `'viable'` (≥ 65), `'marginal'` (≥ 40), `'not_viable'`. Thresholds (`VERDICT_THRESHOLDS`)
  and per-profile weights (`PROFILES`: `habitat`, `greenhouse`, `solar`) are exported from
  `src/core/env.js` and shown in the interface.
- Every sample includes `modeled`: the fields that come from a model (climate, pressure, radiation)
  rather than a measurement. The interface must say so next to the number.
- Every factor from `evaluate` also has `noData` and `modeled`. A factor without data has
  `value: null`, `score: 0` and `weight: 0`; its weight is spread over the others, so weights still
  add up to 1.
- `env.craters` only has craters of 5 km or more, sorted largest first.
- `env.elevationGrid` comes from a 0.25° grid (about 15 km): a smaller box is interpolated, with no new
  detail.
- The reference for every value is in `ENV_REFERENCES` in `src/core/env.js`.

## 6. Texts

- `src/modules/<id>/i18n.js` exports `{ es: {...}, en: {...} }`; it is registered under the module id.
- `t('routes.title')`, `t('routes.eta', { hours: 5 })` with `{hours}` placeholders.
- Required in every module: `title` and `desc`.
- Shell texts live in `src/core/messages.js` under `core.*`.
- Same keys in both languages; `npm test` checks it.

## 7. References

```js
{ id: 'hassler2014', title: '...', org: 'NASA/JPL', url: 'https://...', year: 2014, verified: false }
```

Each module lists its own in `references`. The `references` screen collects them by reading
`ctx.modules`. `verified` becomes `true` only after someone opened the link and checked the value.

## 8. Base map

```js
import { createMarsMap } from '../../core/marsmap.js';
const mars = createMarsMap(container, { basemap: 'mola', center: [lat, lon], zoom: 4 });
mars.map;                 // Leaflet instance: add markers, polylines and layers here
mars.setBasemap('viking');
mars.destroy();           // call it in the module's cleanup
```

Basemaps (`BASEMAPS`): `mola` (MOLA color), `viking`, `hrsc` (MOLA + HRSC) and `themis` (THEMIS day
infrared).

Other pieces of `src/core/` any module can use:

- `mountClockControl(el, ctx)` from `core/clock.js`: the Martian clock control (sol, local time,
  season). Returns its cleanup function. It writes `clock`; modules find out through
  `store.subscribe`. When the mission has an arrival date, sol and Ls are linked (sol 0 = landing
  day, Ls from the Mars24 algorithm).
- `HUMAN_NEEDS` and `HUMAN_REFERENCES` from `core/human-needs.js`: the body's daily needs and the
  career radiation limit, each value with the table it comes from.
- `core/journal.js`: daily targets and the logic of the sol-by-sol journal.
- `spectrumHtml` and `radarSvg` from `core/viz.js`: score spectrum and factor radar chart.
- `MARS_RADIUS_KM`, `KM_PER_DEG` and `haversineKm` from `core/geo.js`: distances on the surface.
- `LANDING_SITES` and `SITE_REFERENCES` from `core/sites.js`: NASA landing sites (used by `map` and
  `descent`).
- `loadRovers`, `stopsOf`, `ROVER_IDS` and `ROVER_REFERENCES` from `core/rovers.js`: the real
  Perseverance and Curiosity traverses and their stops (sol, site, drive, distance, elevation).
- `esc` and `el` from `core/html.js`: HTML escaping and element creation.
- `collectReferences(modules)` from `core/references.js`: every module's references without
  duplicates (used by the References screen and the dashboard).

## 9. Services and Supabase

- `src/services/index.js` exports `init(ctx)`; `main.js` calls it once at startup.
- Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
- If they are missing, the services answer with local data. No module may break without Supabase.
- What gets saved for a mission is `state.mission` plus `state.clock`, as is.
- Modules never call Supabase directly: they use the functions exported by `src/services/index.js`
  (see [supabase/README.md](../supabase/README.md)).

## 10. Processed data

The grids live in `public/data/` and only `src/core/env.js` reads them; modules never load them on
their own. Their format is described in [tools/README.md](../tools/README.md). The one exception is
`rovers.json` (lines and points, not a grid), which only `core/rovers.js` loads.

## Contract change log

- 2026-11-14 — Initial version.
- 2026-11-14 — `env` switched to real data (`isMock = false`) with no signature changes. Added
  `noData` and `modeled` to the factors from `evaluate`; a factor without data no longer counts as
  zero. The shell waits for `env.ready()`. Added `core/clock.js` and `core/human-needs.js`.
- `mission.journal` added for the sol-by-sol journal (`core/journal.js`).
- 2026-11-15 — `map/sites.js` moved to `core/sites.js`, and the `rovers.json` loader moved from
  `map/index.js` to `core/rovers.js`, so `descent` can use them. `rovers.json` gains `stops` per
  rover (one per drive, from the NASA waypoints). No state or `env` changes.
