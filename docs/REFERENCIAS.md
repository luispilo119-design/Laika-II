# Referencias

Lista de partida de las fuentes del proyecto. La lista que ve el jurado es la pantalla de
Referencias de la app, que se arma con el campo `references` de cada módulo.

**Estado:** "sin abrir" significa que el enlace viene del plan inicial y nadie lo ha comprobado
todavía. Quien use una fuente la abre, confirma que respalda el dato, corrige el enlace si hace
falta y cambia el estado a "verificada" (y `verified: true` en el código).

## Compartidas

| Tema | Fuente | Enlace | Estado |
|---|---|---|---|
| Mapa y mosaicos | NASA Mars Trek | https://trek.nasa.gov/mars/ | mosaicos comprobados en la app |
| Mapas interactivos | USGS Astrogeology | https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars | sin abrir |
| Peligros del vuelo espacial | NASA Human Research Program | https://www.nasa.gov/hrp/hazards/ | verificada (Parte B, 2026-11-14); cada peligro tiene su página, ver Parte B |

## Parte A

| Tema | Fuente | Enlace | Estado |
|---|---|---|---|
| Catálogo de capas y mosaicos | NASA Mars Trek, API WMTS | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars | verificada 2026-11-14 |
| Inercia térmica, polvo, albedo, rugosidad, infrarrojo | Resúmenes de producto de Mars Trek (MGS TES, MGS MOLA, Odyssey THEMIS) | https://trek.nasa.gov/mars/TrekWS/rest/cat/abstract?label=TES_Thermal_Inertia (y uno por capa, ver `src/modules/map/layers.js`) | verificada 2026-11-14 |
| Sitios de aterrizaje | NASA NSSDCA Master Catalog | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C (y uno por misión, ver `src/modules/map/sites.js`) | verificada 2026-11-14; InSight no trae coordenadas |
| Recorrido de Perseverance | NASA/JPL, datos del mapa "Where is Perseverance?" | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | verificada 2026-11-14 |
| Recorrido de Curiosity | NASA/JPL, datos del mapa "Where is Curiosity?" | https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json | verificada 2026-11-14 |
| Posición de los planetas | JPL SSD, elementos orbitales aproximados (Tabla 1, 1800–2050) | https://ssd.jpl.nasa.gov/planets/approx_pos.html | verificada 2026-11-14 |
| Tiempo y estación marciana (Ls) | NASA GISS, algoritmo de Mars24 (Allison y McEwen, 2000) | https://www.giss.nasa.gov/tools/mars24/help/algorithm.html | verificada 2026-11-14 |
| Estaciones de Marte según Ls | NASA GISS, notas técnicas de Mars24 | https://www.giss.nasa.gov/tools/mars24/help/notes.html | verificada 2026-11-14 |
| Lanzamiento y aterrizaje de Perseverance | NASA Science, Mars 2020 | https://science.nasa.gov/mission/mars-2020-perseverance/ | verificada 2026-11-14 |
| Constantes (UA, GM del Sol y de la Tierra) | JPL SSD, parámetros astrodinámicos | https://ssd.jpl.nasa.gov/astro_par.html | sin abrir |
| Topografía | Smith et al. (2001), MOLA, J. Geophys. Res. | https://doi.org/10.1029/2000JE001364 | sin abrir |
| Hielo subterráneo | NASA, mapa SWIM | https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/ | sin abrir |
| Hielo subterráneo | Proyecto SWIM (PSI) | https://swim.psi.edu | sin abrir |
| Hielo subterráneo | Morgan et al. (2021), Nature Astronomy | https://doi.org/10.1038/s41550-020-01290-z | sin abrir |
| Cráteres | Robbins y Hynek (2012), J. Geophys. Res. | https://doi.org/10.1029/2011JE003966 | sin abrir |
| Temperatura y polvo | NASA, temperatura atmosférica y seguimiento de tormentas | https://science.nasa.gov/resource/mars-atmospheric-temperature-and-dust-storm-tracking/ | verificada 2026-11-14 para la época de tormentas regionales (primavera austral); no da valores de Ls |
| Clima | Mars Climate Database (LMD/ESA/CNES) | https://www-mars.lmd.jussieu.fr/ | sin abrir |
| Clima medido | REMS (Curiosity) y MEDA (Perseverance), NASA PDS | por localizar | sin abrir |
| Radiación en superficie | Hassler et al. (2014), Science | https://doi.org/10.1126/science.1244797 | sin abrir |
| Necesidades del cuerpo | NASA-STD-3001 | por localizar | sin abrir |
| Soporte vital | NASA, Life Support Baseline Values and Assumptions Document | por localizar | sin abrir |
| Sitios de aterrizaje humanos | NASA, estudio de zonas de exploración | por localizar | sin abrir |
| Recorrido de Curiosity | NASA, ruta propuesta en el monte Sharp | https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/ | sin abrir |
| Hábitats autónomos | Tashakkor (2022), NASA-MSFC, Moon to Mars Autonomous Habitat Status | presentación en poder del equipo | revisada |

## Parte B

| Tema | Fuente | Enlace | Estado |
|---|---|---|---|
| Imágenes de superficie | NASA, imágenes crudas de Mars 2020 | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | sin abrir |
| Confinamiento | NASA, análogo CHAPEA | https://www.nasa.gov/humans-in-space/chapea/ | verificada: 4 personas, hábitat de 1,700 pies cuadrados, misiones de 378 días |
| Confinamiento | NASA, análogo HERA | https://www.nasa.gov/mission/hera/ | verificada: hábitat de 650 pies cuadrados, misiones de hasta 45 días |
| Confinamiento | ESA, Mars500: study overview | https://www.esa.int/articles/mars500-study-overview | verificada: 6 personas, 520 días (2010–2011), 20 min de retraso en comunicaciones |
| Efectos y contramedidas de los cinco peligros | NASA, The Human Body in Space (2021) | https://www.nasa.gov/humans-in-space/the-human-body-in-space/ | verificada: sigla RIDGE, efectos y contramedidas de cada peligro |
| Radiación espacial | NASA HRP, Hazard: Space Radiation | https://www.nasa.gov/hrp/hazard-space-radiation/ | verificada |
| Aislamiento | NASA HRP, Hazard: Isolation and Confinement | https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ | verificada |
| Distancia | NASA HRP, Hazard: Distance From Earth | https://www.nasa.gov/hrp/hazard-distance-from-earth/ | verificada: 140 millones de millas en promedio, hasta 20 min de retraso por trayecto |
| Gravedad | NASA HRP, Hazard: Gravity Fields | https://www.nasa.gov/hrp/hazard-gravity-fields/ | verificada: 1 % a 1.5 % de densidad mineral ósea al mes |
| Ambiente cerrado | NASA HRP, Hazard: Hostile/Closed Environments | https://www.nasa.gov/hrp/hazard-hostile-closed-environments/ | verificada |
| Ejercicio | NASA, Counteracting Bone and Muscle Loss in Microgravity | https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/ | verificada: dos horas de ejercicio al día en promedio |
| Radiación en tránsito | NASA/JPL (2013), Data From NASA Rover's Voyage to Mars Aids Planning | https://www.jpl.nasa.gov/news/data-from-nasa-rovers-voyage-to-mars-aids-planning/ | verificada: RAD midió en promedio 1.8 mSv por día dentro de la nave |
| Sueño | NASA OCHMO-TB-041, Sleep Accommodations (resumen técnico de NASA-STD-3001) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf | verificada: un adulto necesita 7–9 h; en el transbordador y la estación se duermen 6–6.5 h |
| Duración por defecto del viaje | JPL SSD, elementos orbitales aproximados | https://ssd.jpl.nasa.gov/planets/approx_pos.html | verificada (Parte B): semiejes de la Tierra y Marte; también está en la lista de la Parte A |
| Inspiración del fondo ASCII | JIN2-ASCII, BLACK-HOLE | https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE | verificada. Licencia propia: solo uso personal, no comercial y con crédito a @jin_22ee; **no se reutilizó código**, el fondo se escribió desde cero en JavaScript |
| Dedicatoria a Laika | NASA History, Dawn of the Space Age | https://www.nasa.gov/history/dawn-of-the-space-age/ | verificada: Sputnik 2 se lanzó el 3 de noviembre de 1957 con la perra Laika. La ficha del catálogo NSSDCA (1957-002A) daba error el 2026-11-14 |
