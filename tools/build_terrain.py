"""Elevación y pendiente desde MOLA -> public/data/elevation.bin, slope.bin y terrain.json

Fuente: MGS MOLA Mission Experiment Gridded Data Record (MEGDR), NASA PDS Geosciences Node.
Producto: topografía a 16 píxeles por grado (megt90n000eb.img), metros sobre el areoide.
    https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/
Referencia: Smith et al. (2001), J. Geophys. Res. 106, doi:10.1029/2000JE001364.

El archivo original es una matriz de 2880 x 5760 enteros de 16 bits (big-endian), con la fila 0 en
90° N y la columna 0 en 0° E (longitud este-positiva de 0 a 360).

Salidas (fila 0 al norte, columna 0 en 180° O, longitud de -180 a 180):
  - elevation.bin: int16, 0.25° por celda (720 x 1440), media de los 4 x 4 píxeles originales.
  - slope.bin: uint8, 0.5° por celda (360 x 720), grados x 5. Es la pendiente media dentro de la
    celda, calculada entre píxeles vecinos del original (línea base de unos 3.7 km en el ecuador).
    Las pendientes a escala de metros, que son las que importan para un aterrizaje, son mayores.

Uso (desde la raíz del repo; requiere numpy):
    python tools/build_terrain.py            # descarga y procesa
    python tools/build_terrain.py --offline  # reprocesa lo ya descargado en tools/raw/mola/
"""

from __future__ import annotations

import datetime
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "mola" / "megt90n000eb.img"
OUT = ROOT / "public" / "data"
URL = "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img"

PPD = 16  # píxeles por grado del original
ROWS, COLS = 180 * PPD, 360 * PPD
MARS_RADIUS_M = 3_396_000  # radio de referencia del MEGDR


def main() -> None:
    if "--offline" not in sys.argv and not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(URL, headers={"User-Agent": "open-data-client"})
        with urllib.request.urlopen(request, timeout=600) as response:
            RAW.write_bytes(response.read())

    topo = np.fromfile(RAW, dtype=">i2").astype(np.float64)
    assert topo.size == ROWS * COLS, f"tamaño inesperado: {topo.size}"
    topo = topo.reshape(ROWS, COLS)
    topo = np.roll(topo, COLS // 2, axis=1)  # de 0..360 a -180..180

    # Elevación a 0.25°
    k = PPD // 4
    elevation = topo.reshape(ROWS // k, k, COLS // k, k).mean(axis=(1, 3))

    # Pendiente entre píxeles vecinos (diferencias centradas), promediada a 0.5°
    cell_m = np.pi * MARS_RADIUS_M / 180 / PPD
    lat = np.radians(90 - (np.arange(ROWS) + 0.5) / PPD)
    dz_dy = np.gradient(topo, axis=0) / cell_m
    dz_dx = (np.roll(topo, -1, axis=1) - np.roll(topo, 1, axis=1)) / (2 * cell_m * np.cos(lat)[:, None])
    slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
    s = PPD // 2
    slope_mean = slope.reshape(ROWS // s, s, COLS // s, s).mean(axis=(1, 3))

    OUT.mkdir(parents=True, exist_ok=True)
    np.rint(elevation).astype("<i2").tofile(OUT / "elevation.bin")
    np.clip(np.rint(slope_mean * 5), 0, 255).astype(np.uint8).tofile(OUT / "slope.bin")
    (OUT / "terrain.json").write_text(
        json.dumps(
            {
                "generated": datetime.date.today().isoformat(),
                "source": "MGS MOLA MEGDR, 16 píxeles por grado (megt90n000eb.img), NASA PDS Geosciences Node",
                "url": URL,
                "elevation": {
                    "file": "elevation.bin", "dtype": "int16", "unit": "m sobre el areoide",
                    "nLat": elevation.shape[0], "nLon": elevation.shape[1], "step": 0.25, "north": 90, "west": -180,
                },
                "slope": {
                    "file": "slope.bin", "dtype": "uint8", "unit": "grados = valor / 5",
                    "nLat": slope_mean.shape[0], "nLon": slope_mean.shape[1], "step": 0.5, "north": 90, "west": -180,
                    "baselineKm": round(cell_m / 1000, 2),
                },
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"elevación {elevation.min():.0f}..{elevation.max():.0f} m; pendiente media {slope_mean.mean():.2f}°, máx {slope_mean.max():.1f}°")


if __name__ == "__main__":
    main()
