# References

Every source the app cites, taken from the `references` lists in the code. The list the user sees is
the References screen in the app (`#/references`), which collects the `references` field of every
module.

**Status:** "verified" means someone opened the link and confirmed it backs the value shown
(`verified: true` in the code). "Not verified" means the link is listed but not yet checked.

## Environmental data (`src/core/env.js`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `mola` | [MGS MOLA Mission Experiment Gridded Data Record (MEGDR), topography at 16 pixels per degree](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/) (2003) | NASA PDS Geosciences Node | verified |
| `swim` | [SWIM4MIM: subsurface ice consistency maps (0–1 m and 1–5 m)](https://swim.psi.edu/SWIM4MIMProducts.php) (2025) | Planetary Science Institute / NASA | verified |
| `robbins2012` | [Robbins and Hynek (2012): global database of Mars impact craters ≥ 1 km](https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1) | USGS Astrogeology | verified |
| `mcd` | [Mars Climate Database v6.2, web interface (general circulation model)](https://www-mars.lmd.jussieu.fr/mcd_python/) (2022) | LMD / OU / IAA / ESA / CNES | verified |
| `guo2015` | [Guo et al. (2015): Modeling the variations of dose rate measured by RAD during the first MSL Martian year](https://arxiv.org/abs/1507.03473) | The Astrophysical Journal (MSL/RAD team) | verified |
| `hassler2014` | [Hassler et al. (2014): Mars' surface radiation environment measured with MSL's Curiosity rover](https://doi.org/10.1126/science.1244797) | Science | not verified (paywalled) |
| `mars-fact-sheet` | [Mars Fact Sheet (surface gravity and mean molar mass of the atmosphere)](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | NASA NSSDCA | verified |

## The human body (`src/core/human-needs.js`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `bvad2018` | [Life Support Baseline Values and Assumptions Document, NASA/TP-2015-218570/REV1](https://ntrs.nasa.gov/citations/20180001338) (2018): Tables 3-33, 4-20 and 4-1 | NASA Johnson Space Center | verified |
| `nasa-std-3001-radiation` | [OCHMO-TB-020: Design for Ionizing Radiation Protection (summary of NASA-STD-3001)](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf): 600 mSv career limit | NASA Office of the Chief Health & Medical Officer | verified |

## Start (`home`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `jin2-black-hole` | [BLACK-HOLE, ASCII animation of a black hole](https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE): visual inspiration for the background. Its license allows personal, non-commercial use with credit to @jin_22ee; **no code was reused**, the background was written from scratch | JIN2 (@jin_22ee) | verified |
| `nasa-dawn-space-age` | [Dawn of the Space Age (Sputnik 1 and Sputnik 2, with Laika on board)](https://www.nasa.gov/history/dawn-of-the-space-age/) | NASA History | verified |

## Hohmann transfer (`hohmann`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `jpl-approx-pos` | [Approximate Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | NASA/JPL Solar System Dynamics | verified |
| `mars24-algorithm` | [Mars24 Sunclock — Algorithm and Worked Examples](https://www.giss.nasa.gov/tools/mars24/help/algorithm.html) | NASA GISS | verified |
| `mars24-notes` | [Mars24 Sunclock — Technical Notes on Mars Solar Time](https://www.giss.nasa.gov/tools/mars24/help/notes.html) | NASA GISS | verified |
| `nasa-dust-storms` | [The Fact and Fiction of Martian Dust Storms](https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/) (2015) | NASA | verified |
| `mars2020` | [Mars 2020: Perseverance Rover](https://science.nasa.gov/mission/mars-2020-perseverance/) | NASA Science | verified |
| `jpl-astro-par` | [Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html) | NASA/JPL Solar System Dynamics | verified |
| `jpl-phys-par` | [Planetary Physical Parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) | NASA/JPL Solar System Dynamics | verified |

## Landing site map (`map`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `trek-api` | [Mars Trek WMTS API, layer catalog](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | NASA/JPL Mars Trek | verified |
| `nasa-track-perseverance` | [Perseverance waypoints and traverse ("Where is Perseverance?" map)](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json) | NASA/JPL | verified |
| `nasa-track-curiosity` | [Curiosity waypoints and traverse ("Where is Curiosity?" map)](https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json) | NASA/JPL | verified |
| `bussey2016` | [Bussey and Hoffman (2016): Human Mars Landing Site and Impacts on Mars Surface Operations](https://ntrs.nasa.gov/citations/20160002370) | NASA Headquarters | verified |

The map also generates references from its own lists:

- **Data layers** (`src/modules/map/layers.js`): thermal inertia, dust cover, albedo and roughness each
  cite the official Mars Trek product abstract
  (`https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=<trekId>`).
- **Landing sites** (`src/modules/map/sites.js`): Viking 1 and 2, Pathfinder, Spirit, Opportunity,
  Phoenix and InSight cite their entry in the NASA NSSDCA Master Catalog. Curiosity and Perseverance
  use the first point of their NASA traverse data. NSSDCA gives no coordinates for InSight, so it uses
  the center of the landing area marked in Mars Trek and is labeled approximate.

## Autonomous hubs (`hubs`)

Uses `bussey2016` (see the map) for the distance rule between hubs and the habitat, plus the
environmental data references.

## Transit (`transit`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `hrp-hazards` | [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | NASA Human Research Program | verified |
| `hrp-radiation` | [Hazard: Space Radiation](https://www.nasa.gov/hrp/hazard-space-radiation/) | NASA Human Research Program | verified |
| `hrp-isolation` | [Hazard: Isolation and Confinement](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/) | NASA Human Research Program | verified |
| `hrp-distance` | [Hazard: Distance From Earth](https://www.nasa.gov/hrp/hazard-distance-from-earth/) | NASA Human Research Program | verified |
| `hrp-gravity` | [Hazard: Gravity Fields](https://www.nasa.gov/hrp/hazard-gravity-fields/) | NASA Human Research Program | verified |
| `hrp-hostile` | [Hazard: Hostile/Closed Environments](https://www.nasa.gov/hrp/hazard-hostile-closed-environments/) | NASA Human Research Program | verified |
| `hrp-body` | [The Human Body in Space](https://www.nasa.gov/humans-in-space/the-human-body-in-space/) (2021) | NASA Human Research Program | verified |
| `nasa-sleep-brief` | [NASA-STD-3001 Technical Brief: Sleep Accommodations (OCHMO-TB-041)](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf) | NASA Office of the Chief Health and Medical Officer | verified |
| `nasa-bone-muscle` | [Counteracting Bone and Muscle Loss in Microgravity](https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/) | NASA | verified |
| `jpl-rad-cruise` | [Data From NASA Rover's Voyage to Mars Aids Planning](https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/) (2013) | NASA/JPL | verified |
| `jpl-approx-pos` | Same as in Hohmann transfer: default trip length | NASA/JPL Solar System Dynamics | verified |

## Descent (`descent`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `nssdca-mars-fact` | [Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | NASA GSFC · NSSDCA | verified |

## Driving routes (`routes`)

| Id | Source | Organization | Status |
|---|---|---|---|
| `nasa-sev` | [Space Exploration Vehicle](https://science.nasa.gov/3d-resources/space-exploration-vehicle/): pressurized rover speed | NASA Science | verified |
| `nssdca-lrv` | [The Apollo Lunar Roving Vehicle](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_lrv.html): light rover speed | NASA GSFC · NSSDCA | verified |
| `nasa-perseverance-components` | [Perseverance Rover Components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/): robotic rover for comparison | NASA Science | verified |
| `nssdca-mars-fact` | Mars Fact Sheet: radius of Mars | NASA GSFC · NSSDCA | verified |

## Survival guides (`guides`)

Uses some references listed above (`hrp-body`, `hrp-distance`, `nasa-sleep-brief`,
`nasa-bone-muscle`, `jpl-rad-cruise`, `nssdca-mars-fact`, `nasa-dust-storms`) plus:

| Id | Source | Organization | Status |
|---|---|---|---|
| `nasa-chapea` | [CHAPEA — Crew Health and Performance Exploration Analog](https://www.nasa.gov/humans-in-space/chapea/) | NASA | verified |
| `nasa-solar-conjunction` | [What's Mars Solar Conjunction, and Why Does It Matter?](https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/) (2019) | NASA/JPL | verified |
| `nasa-iss-emergency-drill` | [Station Trio Practices Emergency Before Radiation, Physics Research](https://www.nasa.gov/blogs/spacestation/2019/01/15/station-trio-practices-emergency-before-radiation-physics-research/) (2019) | NASA | verified |
| `nasa-radiation-mars` | [Real Martians: How to Protect Astronauts from Space Radiation on Mars](https://www.nasa.gov/science-research/heliophysics/real-martians-how-to-protect-astronauts-from-space-radiation-on-mars/) (2015) | NASA | verified |
| `nasa-insight-retire` | [NASA Retires InSight Mars Lander Mission After Years of Science](https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/) (2022) | NASA/JPL | verified |

The guides' emergency steps are a general guide written by the team from these sources, not an
official NASA procedure; the app says so on screen.
