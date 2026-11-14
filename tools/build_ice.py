"""Hielo subterráneo (SWIM) -> public/data/ice.bin + ice.json

Fuente: proyecto Subsurface Water Ice Mapping (SWIM), productos SWIM4MIM, Planetary Science
Institute / NASA: https://swim.psi.edu/SWIM4MIMProducts.php
Productos: mapas combinados de consistencia de hielo (Ci) para 0-1 m y 1-5 m de profundidad.
Referencias: Morgan et al. (2021), Nature Astronomy, doi:10.1038/s41550-020-01290-z;
Morgan, Putzig et al. (2025) para los productos SWIM4MIM.

Ci va de -1 (los datos son inconsistentes con la presencia de hielo) a +1 (consistentes con hielo);
0 significa que los datos no indican ni una cosa ni la otra. Los mapas cubren de 60° S a 60° N.

Salida ice.bin: uint8, 0.5° por celda (360 x 720), fila 0 al norte, columna 0 en 180° O.
    255 = sin datos (fuera de la cobertura de SWIM)
    0..200 = Ci x 100 + 100, usando en cada celda el mayor de los dos mapas (0-1 m y 1-5 m), es
    decir, la mejor evidencia de hielo en los primeros 5 m.
src/core/env.js convierte Ci al índice 0..1 del contrato (los valores negativos cuentan como 0).

Uso (desde la raíz del repo; requiere numpy, tifffile e imagecodecs):
    python tools/build_ice.py            # descarga y procesa
    python tools/build_ice.py --offline  # reprocesa lo ya descargado en tools/raw/swim/
"""

from __future__ import annotations

import datetime
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "swim"
OUT = ROOT / "public" / "data"
PAGE = "https://swim.psi.edu/SWIM4MIMProducts.php"
PRODUCTS = ["Ci_0_1", "Ci_1_5"]

STEP = 0.5
N_LAT, N_LON = int(180 / STEP), int(360 / STEP)


def load(product: str, offline: bool) -> tuple[np.ndarray, dict]:
    tif = RAW / f"SWIM4MIM_{product}.tif"
    if not tif.exists():
        if offline:
            raise SystemExit(f"falta {tif}; ejecuta sin --offline")
        url = f"{PAGE}?{product}-GeoTIFF=True&DL-Sel=True"
        request = urllib.request.Request(url, headers={"User-Agent": "open-data-client"})
        with urllib.request.urlopen(request, timeout=600) as response:
            archive = zipfile.ZipFile(io.BytesIO(response.read()))
        RAW.mkdir(parents=True, exist_ok=True)
        names = [n for n in archive.namelist() if n.lower().endswith(".tif")]
        tif.write_bytes(archive.read(names[0]))
    with tifffile.TiffFile(tif) as handle:
        page = handle.pages[0]
        data = page.asarray().astype(np.float64)
        tags = {tag.name: tag.value for tag in page.tags.values()}
    return data, tags


def geometry(tags: dict, shape: tuple[int, int]) -> tuple[float, float, float, float]:
    """(lon del borde oeste, lat del borde norte, grados por píxel en x, en y) a partir de las etiquetas GeoTIFF."""
    scale = tags["ModelPixelScaleTag"]
    tie = tags["ModelTiepointTag"]
    sx, sy = scale[0], scale[1]
    x0, y0 = tie[3] - tie[0] * sx, tie[4] + tie[1] * sy
    if sx > 1:  # unidades en metros (cilíndrica simple sobre esfera): se convierten a grados
        meters_per_degree = sx * shape[1] / 360
        sx, sy, x0, y0 = sx / meters_per_degree, sy / meters_per_degree, x0 / meters_per_degree, y0 / meters_per_degree
    return x0, y0, sx, sy


def regrid(data: np.ndarray, tags: dict) -> np.ndarray:
    nodata = float(tags.get("GDAL_NODATA", -30))
    valid = (data != nodata) & (data >= -1.001) & (data <= 1.001) & np.isfinite(data)
    x0, y0, sx, sy = geometry(tags, data.shape)
    rows, cols = np.nonzero(valid)
    lat = y0 - (rows + 0.5) * sy
    lon = x0 + (cols + 0.5) * sx
    lon = ((lon + 180) % 360) - 180
    r = np.clip(((90 - lat) / STEP).astype(int), 0, N_LAT - 1)
    c = np.clip(((lon + 180) / STEP).astype(int), 0, N_LON - 1)
    total = np.zeros((N_LAT, N_LON))
    count = np.zeros((N_LAT, N_LON))
    np.add.at(total, (r, c), data[rows, cols])
    np.add.at(count, (r, c), 1)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / count
    mean[count == 0] = np.nan
    print(f"  extensión: lon {x0:.2f}..{x0 + sx * data.shape[1]:.2f}, lat {y0 - sy * data.shape[0]:.2f}..{y0:.2f}; {valid.mean() * 100:.0f} % con datos")
    return mean


def main() -> None:
    offline = "--offline" in sys.argv
    grids = []
    for product in PRODUCTS:
        data, tags = load(product, offline)
        print(product, data.shape)
        grids.append(regrid(data, tags))
    with np.errstate(all="ignore"):
        best = np.fmax(grids[0], grids[1])  # fmax ignora NaN si el otro mapa tiene dato

    encoded = np.full(best.shape, 255, dtype=np.uint8)
    ok = np.isfinite(best)
    encoded[ok] = np.clip(np.rint(best[ok] * 100 + 100), 0, 200).astype(np.uint8)

    OUT.mkdir(parents=True, exist_ok=True)
    encoded.tofile(OUT / "ice.bin")
    (OUT / "ice.json").write_text(
        json.dumps(
            {
                "generated": datetime.date.today().isoformat(),
                "source": "SWIM4MIM, mapas combinados de consistencia de hielo 0-1 m y 1-5 m (PSI/NASA)",
                "url": PAGE,
                "file": "ice.bin", "dtype": "uint8",
                "encoding": "255 = sin datos; Ci = (valor - 100) / 100; se usa el mayor de los dos mapas",
                "nLat": N_LAT, "nLon": N_LON, "step": STEP, "north": 90, "west": -180,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"celdas con datos: {ok.mean() * 100:.0f} %; Ci {np.nanmin(best):.2f}..{np.nanmax(best):.2f}; con Ci > 0: {(best > 0).sum()}")


if __name__ == "__main__":
    main()
