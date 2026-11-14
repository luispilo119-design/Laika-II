# Datos: de dónde sale cada archivo de `public/data/`

Los scripts de esta carpeta descargan productos públicos de NASA, USGS y otras fuentes científicas, y
los reducen a rejillas ligeras que la web carga desde `public/data/`. La web nunca descarga datos
crudos. Lo descargado se guarda en `tools/raw/` (no se sube al repositorio) y cada script acepta
`--offline` para reprocesar sin volver a descargar.

Solo `src/core/env.js` lee estas rejillas; los módulos usan `ctx.env` (ver `docs/CONTRATOS.md`).

## Preparar Python

Python 3.10 o superior.

```bash
python -m pip install -r tools/requirements.txt
```

## Archivos

| Archivo en `public/data/` | Script | Fuente | Tipo |
|---|---|---|---|
| `elevation.bin`, `slope.bin`, `terrain.json` | `build_terrain.py` | MGS MOLA MEGDR a 16 píxeles por grado, NASA PDS Geosciences Node | Medición |
| `ice.bin`, `ice.json` | `build_ice.py` | SWIM4MIM, consistencia de hielo 0–1 m y 1–5 m, PSI/NASA | Producto derivado de mediciones |
| `craters.bin`, `craters.json` | `build_craters.py` | Robbins y Hynek (2012), vía USGS Astrogeology | Catálogo |
| `climate.bin`, `climate.json` | `build_climate.py` | Mars Climate Database v6.2, LMD/OU/IAA/ESA/CNES | **Modelo** |
| `rovers.json` | `build_rovers.py` | Mapas "Where is the rover?" de NASA/JPL | Medición |

Cada `.json` describe el formato exacto del `.bin` que lo acompaña (tipo de dato, dimensiones,
orientación y cómo convertir el valor guardado a unidades físicas) y la fecha en que se generó.

Convención común: fila 0 al norte, columna 0 en 180° O, longitud este-positiva de −180 a 180.

### Terreno — `build_terrain.py`

- Entrada: `megt90n000eb.img`, 2880 × 5760 enteros de 16 bits, metros sobre el areoide.
  https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/
- `elevation.bin`: media a 0.25° por celda.
- `slope.bin`: pendiente entre píxeles vecinos del original (línea base de unos 3.7 km), promediada a
  0.5°. No es la pendiente a escala de metros que decide un aterrizaje; la interfaz la llama
  "pendiente media".

### Hielo — `build_ice.py`

- Entrada: GeoTIFF `SWIM4MIM_Ci_0_1.tif` y `SWIM4MIM_Ci_1_5.tif` de
  https://swim.psi.edu/SWIM4MIMProducts.php (cubren de 60° S a 60° N).
- Ci va de −1 (datos inconsistentes con hielo) a +1 (consistentes con hielo).
- `ice.bin`: en cada celda de 0.5°, el mayor Ci de los dos mapas; 255 = sin datos.
- En la app, `iceIndex` es Ci con los negativos llevados a 0, y `null` fuera de la cobertura.

### Cráteres — `build_craters.py`

- Entrada: la colección `mars/robbinsv1` de la API de USGS Astrogeology, ordenada por diámetro.
- Se guardan los cráteres de 5 km o más (47 598 de los 384 343 de la base).

### Clima — `build_climate.py`

- Entrada: 145 consultas a la interfaz web de la MCD (https://www-mars.lmd.jussieu.fr/mcd_python/),
  escenario de climatología con actividad solar media: mapas globales para 12 estaciones (Ls cada
  30°) y 12 horas locales (cada 2 h).
- Variables: temperatura del aire a 1.5 m, flujo solar en superficie horizontal, presión en
  superficie y opacidad de la columna de polvo; más la altura del terreno que usa la MCD.
- La MCD es un modelo de circulación general validado con observaciones. Todo lo que sale de aquí se
  marca como modelo en la app (`modeled` en cada muestra).
- Las consultas van de una en una y con pausa: es un servicio público. Tarda unos 30 minutos.

## Lo que se calcula en `src/core/env.js` y no viene en un archivo

- **Presión en un punto:** la presión de la MCD en los nodos vecinos, llevada a la elevación MOLA del
  punto con la ecuación hipsométrica (gravedad y masa molar media del Mars Fact Sheet de la NASA).
- **Radiación:** la dosis equivalente que midió RAD en el cráter Gale (unos 0.7 mSv/día a 840 Pa) con
  la dependencia de la presión que reportan Guo et al. (2015): unos 0.1 mSv/día entre 700 y 970 Pa.
  Extender esa relación a todo el planeta es una extrapolación y se marca como modelo.
- **Mínima y máxima del sol:** el menor y el mayor de los 12 valores horarios, así que los extremos
  reales pueden ser un poco más marcados.
