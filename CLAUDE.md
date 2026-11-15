# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Martian Map (team LAIKA II)

An interactive guide to surviving on Mars, organized by mission phase, that crosses open NASA data
with what the human body needs. See [README.md](README.md) for the feature overview.

## Before changing anything

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/CONTRACTS.md](docs/CONTRACTS.md).

## Rules

**Contracts.** Modules talk to each other only through `ctx` (store, t, env, navigate). A module may
import from `src/core/` and `src/services/index.js`, never from another module's folder. Do not change
the shape of the state or the signatures of `env` without agreeing on it first; log contract changes
at the end of `docs/CONTRACTS.md`.

**Scientific data.** Never make up figures. Every value shown must have a NASA or other trusted
reference registered in the module's `references`. Set `verified: true` only after opening the link
and checking that it backs the value. If a value comes from a model or an approximation, say so in the
interface. If a zone has no data, show "no data", not a zero.

**Bilingual.** Every visible text goes in the module's `i18n.js`, in both `es` and `en`. `npm test`
fails if a key is missing in either language.

**Tablet.** Touch targets of at least 44 px, nothing that depends on hovering with a mouse, and it must
look right at 768 px wide.

**Supabase is optional.** The app must start and work without `.env.local`. Never commit keys; the
`service_role` key never goes in client code.

**Games.** Minigames are original; no existing game is recreated.

**Language.** Code identifiers are in English. Documentation is in English. Code comments and commit
messages in the existing code are in Spanish.

## Git workflow

- No force-push to `main`.
- Small commits. Before integrating, `npm test` and `npm run build` must pass.
- Integrate with `git pull --rebase origin main`, then merge and push. Every push to `main` deploys.
- A new dependency goes in a commit that only touches `package.json` and `package-lock.json`.

## Commands

Node 20.19 or later. There is no linter or formatter.

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

A single test file (Node's built-in runner, not Vitest or Jest):

```bash
node --test tests/routes.test.js
```

```bash
node --test --test-name-pattern="crater" tests/routes.test.js
```

Every push to `main` runs `npm test` and `npm run build` in GitHub Actions and publishes `dist/` to
GitHub Pages (`.github/workflows/deploy.yml`). If tests fail on `main`, the site is not updated.

## How it is built

Vite + plain JavaScript, no framework. Each screen is a module in `src/modules/<id>/` that exports a
`ModuleDef` (see `src/core/types.js`) with `mount(el, ctx)`; the shell mounts it from the hash `#/<id>`.
Leaflet for the map (`src/core/marsmap.js`), Three.js for the first-person view, Supabase for saving.

**Startup.** `src/main.js` calls `startShell()` (`src/core/shell.js`) and then, without blocking,
`init(ctx)` from `src/services/index.js`. The shell registers the texts and waits for `env.ready()`
(loading the grids in `public/data/`) **before mounting any module**, so `ctx.env.sample()` and
`ctx.env.evaluate()` are synchronous inside `mount`. Only `env.craters()` and `env.elevationGrid()`
are async.

**Module lifecycle.** On every hash change the shell calls the cleanup function returned by the
previous `mount`, creates a new `<main class="view">` and mounts the next module. When the language
changes the shell **remounts** the module, so modules never listen for the language themselves.
`mount` must return a function that removes listeners, timers, Leaflet maps and Three.js scenes.
`fullscreen: true` hides the top bar.

**Registry.** All modules are listed in `src/core/registry.js` (with their phase in `PHASES`). A new
module needs `index.js` + `i18n.js` in its folder and one line in the registry.

**Texts.** `i18n.js` exports `{ es, en }`; the shell registers them under the `<id>` namespace, so
they are read with `t('<id>.key', vars)`. Shared texts are in `src/core/messages.js` (`core.*`).
Every module needs the `title` key (used as the tab title); `tests/i18n.test.js` enforces it.

**State.** `store` (`src/core/store.js`) is immutable and persisted to `localStorage`
(`laika2.state.v1`). Change it with `store.set('mission.site', value)` using a dotted path; arrays are
replaced whole. `store.subscribe((state, path) => …)` returns the unsubscribe function. The shape is
`AppState` in `types.js`. Supabase sync (`src/services/sync.js`) subscribes to the store, so modules
never talk to Supabase directly: they use the functions exported by `src/services/index.js`.

**Environmental data.** `src/core/env.js` is the only gateway to the data: it reads binary grids from
`public/data/` (each `.bin` has a `.json` describing its format) and exposes `sample`, `evaluate`
(weighted score per profile, `PROFILES`, `VERDICT_THRESHOLDS`), `craters` and `elevationGrid`. Fields
that come from a model are listed in each sample's `modeled`. The grids are generated by the Python
scripts in `tools/` (see `tools/README.md`); never edit them by hand.

**Coordinate convention.** Planetocentric latitude −90..90 (north positive) and longitude −180..180,
**east positive**, everywhere. Grids: row 0 = north edge, column 0 = west edge.

**Hohmann equations.** The orbital math lives in `src/modules/hohmann/orbit.js`; the "See equations
and algorithm" dialog (`equations.js`) renders the same formulas in the same order. If you change a
formula or constant in `orbit.js`, update `equations.js` and its texts in `i18n.js` to match.

**Tests.** They run in Node, without a DOM. That is why each module's logic lives in pure files
(`routes/routing.js`, `hohmann/orbit.js`, `map/zone.js`, `hubs/rules.js`, `transit/game.js`…) that
tests import directly, separate from `index.js`, which handles the DOM. Tests that need real data swap
the loader with `setDataLoader()` from `env.js` to read `public/data/` from disk (see
`tests/env.test.js`). Services are tested with `memoryStorage()` instead of `localStorage`.
