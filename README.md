# Martian Map — Interplanetary Survival Guide

<p align="center">
  <img src="docs/img/screens/0-start.jpg" alt="Martian Map start screen: the title, START and INDEX buttons, the language switch and an animated ASCII black hole" width="820">
</p>

A hackathon project by team **LAIKA II**.

Martian Map is an interactive guide to surviving on Mars. You go through a crewed mission **phase by
phase**: plan the trip from Earth, pick a landing site on a map built from NASA data, live through the
months in transit, land and explore the site, set up autonomous hubs, plan driving routes, and keep
your body healthy sol by sol.

Its core idea is to **cross public NASA data about Mars with what the human body needs**, so that any
point on the planet gets a clear verdict: viable, marginal or not viable, and why.

It works on desktop and tablet, in Spanish and English.

## Presentation and video

<table>
  <tr>
    <td align="center" width="30%">
      <a href="docs/presentation/martian-map-reel.mp4?raw=true"><img src="docs/presentation/reel-preview.gif" alt="Preview of the 30-second Martian Map video: the ASCII black hole title, then each phase of the app" width="240"></a>
    </td>
    <td align="center">
      <a href="docs/presentation/Martian-Map-presentation.pdf"><img src="docs/presentation/cover.jpg" alt="Cover slide of the Martian Map presentation: team LAIKA II, the title, START and INDEX buttons and the ASCII black hole" width="560"></a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <b>30-second video</b><br>
      <a href="docs/presentation/martian-map-reel.mp4?raw=true">Download MP4</a> · vertical 1080×1920, 21 MB
    </td>
    <td align="center">
      <b>3-minute pitch · 7 slides</b><br>
      <a href="docs/presentation/Martian-Map-presentation.pptx?raw=true">Download PowerPoint</a> (20 MB) ·
      <a href="docs/presentation/Martian-Map-presentation.pdf">View as PDF</a>
    </td>
  </tr>
</table>

<a href="docs/presentation/Martian-Map-presentation.pdf"><img src="docs/presentation/slides.jpg" alt="The seven slides of the Martian Map presentation: cover, the challenge, the solution, plan from Earth, the journey and the descent, build and survive, and how the app answers the challenge" width="820"></a>

The PowerPoint has the app's demo videos and the 30-second video inside. Open it in desktop PowerPoint:
animations and videos start on their own, so it takes one click per slide, and the speaker notes carry
the script for two presenters. The PDF shows the same slides without motion.

## What you can do

| Phase | Screen | What it does |
|---|---|---|
| Start | `home` | Game-style start screen with an animated ASCII background, START / CONTINUE and an index of every screen |
| 1 · Plan from Earth | `hohmann` | Computes a Hohmann transfer: launch windows, travel time, required Δv, arrival date and the Martian season at arrival. A "See equations and algorithm" dialog walks through every formula the app uses, step by step, with the numbers of the chosen window |
| 1 · Plan from Earth | `map` | Map of Mars with NASA Mars Trek basemaps and data layers, past landing sites and rover tracks, a Martian clock, a zone report for any point, the best zones for the current time, and choosing the landing site |
| 2 · Transit | `transit` | The trip day by day, a confinement routine, an original minigame with a score table, and the five hazards of human spaceflight |
| 3 · Descent | `descent` | First-person view of the terrain around the landing site, on foot or driving a rover with battery and damage, a mini map and live conditions |
| 4 · Surface | `hubs` | Place habitats, greenhouses, solar plants, ice mines and landing pads, each with its viability verdict and the full data breakdown |
| 4 · Surface | `routes` | Driving routes (up to 6 stops) that avoid large craters and steep slopes, with distance, time, elevation profile and turn-by-turn guidance |
| 5 · Survival | `guides` | A sol-by-sol journal (water, meals, sleep, exercise, accumulated radiation), the body's daily needs, and step-by-step guides for emergencies |
| 6 · Report | `dashboard` | Everything about the mission in one dashboard, printable or saved as PDF, and a button to start a new mission |
| Resources | `references` | Every source used in the app, with whether it was checked |

The phases are linked by data: the arrival date from the Hohmann planner sets the Martian season
(solar longitude, Ls) at landing, and that season changes temperature and dust on the map, in the hubs
and in the first-person view.

## Screenshots by phase

Screenshots of the app itself, in English, with a sample mission built in the app: the next launch
window, the best-scoring landing zone, five hubs around it and a rover route to the ice mine.

### Phase 1 · Plan from Earth: Hohmann transfer

The launch windows from the planning date, the transfer drawn around the Sun, and the button that
opens the equations behind it.

<img src="docs/img/screens/1-hohmann.jpg" alt="Hohmann transfer screen: orbit diagram of Earth, Mars and the transfer ellipse, and a list of launch windows with the selected plan" width="820">

### Phase 1 · Plan from Earth: landing site

The Mars Trek map with past landing sites, the chosen site (star) and the zone sheet for a tapped
point: its score, its verdict, and each condition next to what the human body needs.

<img src="docs/img/screens/1-landing-site.jpg" alt="Landing site map in color topography with the Martian clock on the left and the zone sheet on the right showing a score of 60, marginal" width="820">

### Phase 2 · Transit

The trip day by day, with what happens to the body at each stage and its NASA source.

<img src="docs/img/screens/2-journey.jpg" alt="The journey screen: departure and arrival dates, a timeline of the 252-day trip and the stages of the trip" width="820">

### Phase 3 · Descent

First-person view of the landing site, with the live conditions at the person's position, a mini map
and a touch joystick for tablets.

<img src="docs/img/screens/3-on-site.jpg" alt="First-person view on the Martian surface with a lander, a rover and a dome, and a panel with temperature, pressure, radiation, elevation, slope and dust" width="820">

### Phase 4 · Surface: autonomous hubs

Habitat, greenhouse, solar plant, ice extraction and landing pad placed around the site, each with its
own viability score.

<img src="docs/img/screens/4-hubs.jpg" alt="Hubs screen: hub types on the left, five hub icons on the map, and the habitat card with a score of 69, viable" width="820">

### Phase 4 · Surface: driving routes

A route from the landing site to the ice mine for the pressurized rover; the red circles are large
craters the route has to avoid.

<img src="docs/img/screens/4-routes.jpg" alt="Driving routes screen: a route from point A to point B on the map, craters to avoid shaded in red, and the origin, destination and base list on the right" width="820">

### Phase 5 · Survival: the sol journal

Water, meals, sleep and exercise logged for each sol and compared with NASA's numbers, plus the
radiation accumulated over the whole mission.

<img src="docs/img/screens/5-guides.jpg" alt="Survival guides: sol 4 of the journal with a score of 91, water glasses, meals, sleep, exercise and accumulated radiation" width="820">

### Phase 6 · Report

The mission dashboard: progress, trip length, landing site score and hubs, ready to print or save as
PDF.

<img src="docs/img/screens/6-report.jpg" alt="Mission dashboard for LAIKA II: mission progress 5 of 5, a 252-day journey, a landing site scored 74 and 5 hubs" width="820">

## Getting started

Requires Node 20.19 or later.

```bash
npm install
```

```bash
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:5173 |
| `npm test` | Runs every test in `tests/` with Node's built-in test runner, including the check that every text exists in both languages |
| `npm run build` | Production build in `dist/` |
| `npm run preview` | Serves the production build locally |

To run a single test file: `node --test tests/routes.test.js`.

### Supabase (optional)

Without any configuration the app saves everything in the browser. To also save missions and
minigame scores in the cloud, copy `.env.example` to `.env.local` and fill in the two values. Setup
steps are in [supabase/README.md](supabase/README.md).

### Deployment

Every push to `main` runs the tests and the build in GitHub Actions and publishes `dist/` to GitHub
Pages ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Pages must be enabled once in
the repository settings (Settings → Pages → Source: GitHub Actions). For the deployed site to use
Supabase, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository variables.

## Project layout

```
src/core/       shared core: shell, state, languages, environment data, base map, Martian clock
src/modules/    one folder per screen
src/services/   optional Supabase saving and sync
src/styles/     global styles and design variables
supabase/       SQL migrations
tools/          Python scripts that turn NASA/USGS products into lightweight grids
public/data/    the processed grids the app loads
tests/          tests for the pure logic (run in Node, no browser)
```

## Data

The app only uses NASA and other trusted scientific sources, and every figure links to its source
inside the app. The environmental data is real: MOLA elevation, SWIM subsurface ice, the Robbins and
Hynek crater catalog, and the Mars Climate Database. Anything that comes from a model (climate,
pressure, radiation) is labeled as such in the interface, and where there is no data the app says
"no data" instead of showing a zero.

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is built and how to add to it |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | Shared interfaces: module definition, `ctx`, state, environment API |
| [docs/REFERENCES.md](docs/REFERENCES.md) | Every source used in the app and its verification status |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Open items and ideas |
| [tools/README.md](tools/README.md) | Where each data file comes from and how to regenerate it |
| [supabase/README.md](supabase/README.md) | Supabase setup and what gets saved |
| [CLAUDE.md](CLAUDE.md) | Instructions for AI coding agents working in this repository |
