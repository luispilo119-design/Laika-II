"""Cráteres de Marte -> public/data/craters.bin + craters.json

Fuente: base global de cráteres de Robbins y Hynek (2012), J. Geophys. Res. 117, E05004,
doi:10.1029/2011JE003966, servida por USGS Astrogeology:
    https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1

La base completa tiene 384 343 cráteres de 1 km o más. Aquí se guardan los de MIN_DIAMETER_KM o más,
que son los que importan para trazar rutas y elegir sitios a la escala de la app.

Formato de craters.bin: registros de 6 bytes, little-endian, ordenados de mayor a menor diámetro:
    int16  latitud x 100      (grados, norte positivo)
    int16  longitud x 100     (grados, este positivo, -180..180)
    uint16 diámetro x 10      (km)

Uso (desde la raíz del repo, solo biblioteca estándar):
    python tools/build_craters.py            # descarga y procesa
    python tools/build_craters.py --offline  # reprocesa lo ya descargado en tools/raw/craters/
"""

from __future__ import annotations

import csv
import datetime
import io
import json
import struct
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "craters"
OUT = ROOT / "public" / "data"
API = "https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1/items"

MIN_DIAMETER_KM = 5
PAGE = 5000


def page(offset: int, offline: bool) -> list[dict]:
    dest = RAW / f"page_{offset:06d}.csv"
    if not dest.exists():
        if offline:
            return []
        url = f"{API}?f=csv&sortby=-diamkm&limit={PAGE}&offset={offset}"
        request = urllib.request.Request(url, headers={"User-Agent": "open-data-client"})
        with urllib.request.urlopen(request, timeout=300) as response:
            data = response.read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        time.sleep(1)
    return list(csv.DictReader(io.StringIO(dest.read_text(encoding="utf-8"))))


def main() -> None:
    offline = "--offline" in sys.argv
    craters: list[tuple[float, float, float]] = []
    offset = 0
    while True:
        rows = page(offset, offline)
        if not rows:
            break
        for row in rows:
            diameter = float(row["diamkm"])
            lon = float(row["lon_e"])
            if lon > 180:
                lon -= 360
            craters.append((float(row["lat"]), lon, diameter))
        print(f"{offset + len(rows)} cráteres leídos, el menor de {craters[-1][2]} km", flush=True)
        if craters[-1][2] < MIN_DIAMETER_KM or len(rows) < PAGE:
            break
        offset += PAGE

    craters = sorted((c for c in craters if c[2] >= MIN_DIAMETER_KM), key=lambda c: -c[2])
    payload = b"".join(
        struct.pack("<hhH", round(lat * 100), round(lon * 100), min(65535, round(diameter * 10)))
        for lat, lon, diameter in craters
    )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "craters.bin").write_bytes(payload)
    (OUT / "craters.json").write_text(
        json.dumps(
            {
                "generated": datetime.date.today().isoformat(),
                "source": "Robbins y Hynek (2012), base global de cráteres de Marte, vía USGS Astrogeology",
                "url": "https://astrogeology.usgs.gov/pygeoapi/collections/mars/robbinsv1",
                "minDiameterKm": MIN_DIAMETER_KM,
                "count": len(craters),
                "record": "int16 lat x 100, int16 lon x 100 (este positivo), uint16 diámetro km x 10; little-endian",
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"{len(craters)} cráteres de {MIN_DIAMETER_KM} km o más; {len(payload) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
