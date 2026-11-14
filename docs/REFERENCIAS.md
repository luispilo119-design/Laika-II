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
| Peligros del vuelo espacial | NASA Human Research Program | https://www.nasa.gov/hrp/hazards/ | sin abrir |

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
| Topografía y pendiente | MGS MOLA MEGDR a 16 píxeles por grado, NASA PDS Geosciences Node | https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/ | verificada 2026-11-14 (archivo descargado y comprobado contra Olympus Mons y Hellas) |
| Topografía (artículo) | Smith et al. (2001), MOLA, J. Geophys. Res. | https://doi.org/10.1029/2000JE001364 | sin abrir |
| Hielo subterráneo | NASA, mapa SWIM | https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/ | sin abrir |
| Hielo subterráneo | Proyecto SWIM (PSI), productos SWIM4MIM: consistencia de hielo 0–1 m y 1–5 m | https://swim.psi.edu/SWIM4MIMProducts.php | verificada 2026-11-14 (GeoTIFF descargados) |
| Hielo subterráneo | Morgan et al. (2021), Nature Astronomy | https://doi.org/10.1038/s41550-020-01290-z | sin abrir |
| Cráteres | Robbins y Hynek (2012), base servida por USGS Astrogeology | https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1 | verificada 2026-11-14 (384 343 cráteres; se usan los de 5 km o más) |
| Cráteres (artículo) | Robbins y Hynek (2012), J. Geophys. Res. | https://doi.org/10.1029/2011JE003966 | sin abrir |
| Temperatura y polvo | NASA, temperatura atmosférica y seguimiento de tormentas | https://science.nasa.gov/resource/mars-atmospheric-temperature-and-dust-storm-tracking/ | verificada 2026-11-14 para la época de tormentas regionales (primavera austral); no da valores de Ls |
| Clima (temperatura, presión, polvo, irradiancia) | Mars Climate Database v6.2, interfaz web (LMD/OU/IAA/ESA/CNES). Es un modelo | https://www-mars.lmd.jussieu.fr/mcd_python/ | verificada 2026-11-14 (145 mapas descargados) |
| Clima medido | REMS (Curiosity) y MEDA (Perseverance), NASA PDS | por localizar | sin abrir |
| Radiación en superficie y su dependencia de la presión | Guo et al. (2015), Astrophys. J., equipo de MSL/RAD | https://arxiv.org/abs/1507.03473 | verificada 2026-11-14: unos 0.7 mSv/día en Gale; 0.1 mSv/día entre 700 y 970 Pa; de 0.35 a 1.15 mSv/día según la actividad solar |
| Radiación en superficie (artículo original) | Hassler et al. (2014), Science | https://doi.org/10.1126/science.1244797 | sin abrir (de pago) |
| Gravedad y masa molar de la atmósfera | NASA NSSDCA, Mars Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | verificada 2026-11-14: 3.73 m/s² y 43.49 g/mol |
| Límite de radiación de carrera | NASA OCHMO-TB-020 (resumen de NASA-STD-3001 Vol. 1, V1 4030) | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf | verificada 2026-11-14: 600 mSv |
| Necesidades del cuerpo y soporte vital | NASA, Life Support Baseline Values and Assumptions Document, NASA/TP-2015-218570/REV1 (2018) | https://ntrs.nasa.gov/citations/20180001338 | verificada 2026-11-14: tablas 3-33, 4-20 y 4-1 (ver `src/core/human-needs.js`) |
| Sitios de aterrizaje humanos | Bussey y Hoffman (2016), Human Mars Landing Site and Impacts on Mars Surface Operations, NASA | https://ntrs.nasa.gov/citations/20160002370 | verificada 2026-11-14: latitud ±50°, elevación hasta +2 km (MOLA), evitar pendientes de 5° |
| Composición del aire y radio de Marte | NASA NSSDCA, Mars Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | verificada 2026-11-14: CO₂ 95.1 %, O₂ 0.16 %, radio medio 3389.5 km |
| Recorrido de Curiosity | NASA, ruta propuesta en el monte Sharp | https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/ | sin abrir |
| Hábitats autónomos | Tashakkor (2022), NASA-MSFC, Moon to Mars Autonomous Habitat Status | presentación en poder del equipo | revisada |

## Parte B

| Tema | Fuente | Enlace | Estado |
|---|---|---|---|
| Imágenes de superficie | NASA, imágenes crudas de Mars 2020 | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | sin abrir |
| Confinamiento | NASA, análogo CHAPEA | https://www.nasa.gov/humans-in-space/chapea/ | sin abrir |
| Confinamiento | NASA, análogo HERA | por localizar | sin abrir |
| Confinamiento | Mars-500 (ESA/IBMP) | por localizar | sin abrir |
| Inspiración del fondo ASCII | JIN2-ASCII, BLACK-HOLE | https://github.com/JIN2-ASCII/-JIN2-ASCII/tree/main/BLACK-HOLE | sin abrir; revisar licencia |
