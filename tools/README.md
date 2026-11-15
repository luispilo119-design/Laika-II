# Data: where each file in `public/data/` comes from

The scripts in this folder download public products from NASA, USGS and other scientific sources and
reduce them to lightweight grids that the web app loads from `public/data/`. The web app never
downloads raw data. Downloads are kept in `tools/raw/` (not committed), and every script accepts
`--offline` to reprocess without downloading again.

Only `src/core/env.js` reads these grids; modules use `ctx.env` (see
[docs/CONTRACTS.md](../docs/CONTRACTS.md)).

## Set up Python

Python 3.10 or later.

```bash
python -m pip install -r tools/requirements.txt
```

Run a script from the repository root, for example:

```bash
python tools/build_terrain.py
```

```bash
python tools/build_terrain.py --offline
```

## Files

| File in `public/data/` | Script | Source | Kind |
|---|---|---|---|
| `elevation.bin`, `slope.bin`, `terrain.json` | `build_terrain.py` | MGS MOLA MEGDR at 16 pixels per degree, NASA PDS Geosciences Node | Measurement |
| `ice.bin`, `ice.json` | `build_ice.py` | SWIM4MIM, ice consistency 0–1 m and 1–5 m, PSI/NASA | Product derived from measurements |
| `craters.bin`, `craters.json` | `build_craters.py` | Robbins and Hynek (2012), via USGS Astrogeology | Catalog |
| `climate.bin`, `climate.json` | `build_climate.py` | Mars Climate Database v6.2, LMD/OU/IAA/ESA/CNES | **Model** |
| `rovers.json` | `build_rovers.py` | NASA/JPL "Where is the rover?" maps (traverse and one stop per drive) | Measurement |

Each `.json` describes the exact format of the `.bin` next to it (data type, dimensions,
orientation and how to convert the stored value to physical units) and the date it was generated.

Shared convention: row 0 to the north, column 0 at 180° W, east-positive longitude from −180 to 180.

### Terrain — `build_terrain.py`

- Input: `megt90n000eb.img`, 2880 × 5760 16-bit integers, meters above the areoid.
  https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/
- `elevation.bin`: mean over 0.25° cells.
- `slope.bin`: slope between neighboring pixels of the original (a baseline of about 3.7 km),
  averaged to 0.5°. It is not the meter-scale slope that decides a landing; the interface calls it
  "mean slope".

### Ice — `build_ice.py`

- Input: the GeoTIFFs `SWIM4MIM_Ci_0_1.tif` and `SWIM4MIM_Ci_1_5.tif` from
  https://swim.psi.edu/SWIM4MIMProducts.php (covering 60° S to 60° N).
- Ci ranges from −1 (data inconsistent with ice) to +1 (consistent with ice).
- `ice.bin`: in each 0.5° cell, the higher Ci of the two maps; 255 = no data.
- In the app, `iceIndex` is Ci with negatives clamped to 0, and `null` outside the coverage.

### Craters — `build_craters.py`

- Input: the `mars/robbinsv1` collection from the USGS Astrogeology API, sorted by diameter.
- Craters of 5 km or more are kept (47,598 of the 384,343 in the database).

### Climate — `build_climate.py`

- Input: 145 queries to the MCD web interface (https://www-mars.lmd.jussieu.fr/mcd_python/),
  climatology scenario with average solar activity: global maps for 12 seasons (Ls every 30°) and 12
  local times (every 2 h).
- Variables: air temperature at 1.5 m, solar flux on a horizontal surface, surface pressure and dust
  column optical depth; plus the terrain height the MCD uses.
- The MCD is a general circulation model validated against observations. Everything that comes from
  it is labeled as a model in the app (`modeled` in every sample).
- Queries run one at a time with a pause, since it is a public service. It takes about 30 minutes.

## What `src/core/env.js` computes instead of reading from a file

- **Pressure at a point:** the MCD pressure at the neighboring nodes, brought to the MOLA elevation of
  the point with the hypsometric equation (gravity and mean molar mass from NASA's Mars Fact Sheet).
- **Radiation:** the dose equivalent RAD measured in Gale crater (about 0.7 mSv/day at 840 Pa) with
  the pressure dependence reported by Guo et al. (2015): about 0.1 mSv/day between 700 and 970 Pa.
  Extending that relation to the whole planet is an extrapolation and is labeled as a model.
- **Daily minimum and maximum:** the lowest and highest of the 12 hourly values, so the real extremes
  may be slightly sharper.
