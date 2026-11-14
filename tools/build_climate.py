"""Clima de Marte desde la Mars Climate Database (MCD v6.2) -> public/data/climate.bin + climate.json

Fuente: interfaz web de la MCD (LMD/OU/IAA/ESA/CNES), https://www-mars.lmd.jussieu.fr/mcd_python/
Escenario: climatología de polvo con actividad solar media (la opción por defecto de la web).

Se piden mapas globales para 12 estaciones (Ls 0, 30, ... 330) y 12 horas solares locales
(0, 2, ... 22 h). Cada consulta trae cuatro variables:
  - temperatura del aire a 1.5 m sobre la superficie (K)
  - flujo solar incidente en superficie horizontal (W/m2)
  - presión en superficie (Pa)
  - opacidad visible de la columna de polvo, media mensual
Una consulta más trae la altura del terreno que usa la MCD, para poder ajustar la presión a la
elevación MOLA de cada punto en src/core/env.js.

La MCD es un MODELO de circulación general validado con observaciones; no son mediciones directas.
Por eso estos campos se listan en `modeled` dentro de la app.

Son 145 consultas a un servicio público: se hacen de una en una, con pausa, y cada respuesta se guarda
en tools/raw/mcd/ para no repetirla.

Uso (desde la raíz del repo; requiere numpy):
    python tools/build_climate.py            # descarga lo que falte y procesa
    python tools/build_climate.py --offline  # reprocesa lo ya descargado
"""

from __future__ import annotations

import datetime
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "mcd"
OUT_BIN = ROOT / "public" / "data" / "climate.bin"
OUT_META = ROOT / "public" / "data" / "climate.json"

CGI = "https://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py"
LS_VALUES = list(range(0, 360, 30))
HOURS = list(range(0, 24, 2))
HEIGHT_M = 1.5
PAUSE_S = 1.5

VARS = {
    "t": "Temperature (K)",
    "fluxsurf_dn_sw": "Incident solar flux on horizontal surface (W/m2)",
    "ps": "Surface pressure (Pa)",
    "dod": "Monthly mean dust column visible optical depth above surface",
}


def query(ls: float, hour: float, variables: list[str]) -> str:
    padded = variables + ["none"] * (4 - len(variables))
    params = {
        "datekeyhtml": 1, "ls": ls, "localtime": hour,
        "year": "", "month": "", "day": "", "hours": "", "minutes": "", "seconds": "",
        "julian": "", "martianyear": "", "sol": "",
        "latitude": "all", "longitude": "all", "altitude": HEIGHT_M, "zkey": 3,
        "spacecraft": "none", "isfixedlt": "on", "dust": 1, "hrkey": 1,
        "averaging": "off", "dpi": 80, "islog": "off", "colorm": "jet",
        "minval": "", "maxval": "", "proj": "cyl", "palt": "", "plon": "", "plat": "", "trans": "",
        "iswind": "off", "latpoint": "", "lonpoint": "",
        "var1": padded[0], "var2": padded[1], "var3": padded[2], "var4": padded[3],
    }
    return CGI + "?" + urllib.parse.urlencode(params)


def http_get(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "open-data-client"})
    with urllib.request.urlopen(request, timeout=300) as response:
        return response.read().decode("utf-8", "replace")


def fetch(name: str, ls: float, hour: float, variables: list[str], offline: bool) -> str:
    dest = RAW / f"{name}.txt"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest.read_text(encoding="utf-8")
    if offline:
        raise SystemExit(f"falta {dest}; ejecuta sin --offline")
    last_error = None
    for attempt in range(4):
        try:
            html = http_get(query(ls, hour, variables))
            match = re.search(r"href=['\"]?([^'\" >]+\.txt)", html)
            if not match:
                raise RuntimeError("la respuesta de la MCD no trae enlace al archivo de datos")
            text = http_get(urllib.parse.urljoin(CGI, match.group(1)))
            if text.count("### Columns 2+ are") != len(variables):
                raise RuntimeError("el archivo de datos no trae todas las variables")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding="utf-8")
            time.sleep(PAUSE_S)
            return text
        except Exception as error:  # noqa: BLE001 - se reintenta ante cualquier fallo de red
            last_error = error
            time.sleep(10 * (attempt + 1))
    raise SystemExit(f"no se pudo descargar {name}: {last_error}")


def parse(text: str) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    """Devuelve (latitudes, {título de variable: matriz [lon, lat]})."""
    blocks: dict[str, np.ndarray] = {}
    lats = None
    title = None
    rows: list[list[float]] = []

    def close() -> None:
        if title is not None and rows:
            blocks[title] = np.array(rows, dtype=np.float64)

    for line in text.splitlines():
        if line.startswith("### Columns 2+ are "):
            close()
            title = line[len("### Columns 2+ are "):].strip()
            rows = []
        elif line.startswith("#") or line.startswith("-----") or not line.strip():
            continue
        elif line.startswith("----"):
            lats = np.array([float(v) for v in line.split("||")[1].split()])
        elif "||" in line:
            rows.append([float(v) for v in line.split("||")[1].split()])
    close()
    return lats, blocks


def main() -> None:
    offline = "--offline" in sys.argv
    n_ls, n_h = len(LS_VALUES), len(HOURS)
    temperature = flux = pressure = dust = None
    lats = None

    for i, ls in enumerate(LS_VALUES):
        for j, hour in enumerate(HOURS):
            text = fetch(f"ls{ls:03d}_h{hour:02d}", ls, hour, list(VARS), offline)
            lats, blocks = parse(text)
            if temperature is None:
                n_lon, n_lat = blocks[VARS["t"]].shape
                shape = (n_ls, n_h, n_lat, n_lon)
                temperature, flux, pressure, dust = (np.zeros(shape) for _ in range(4))
            # La MCD entrega [lon, lat] con latitud de sur a norte: se guarda [lat norte->sur, lon].
            for target, key in ((temperature, "t"), (flux, "fluxsurf_dn_sw"), (pressure, "ps"), (dust, "dod")):
                target[i, j] = blocks[VARS[key]].T[::-1]
            print(f"Ls {ls:3d}  {hour:2d} h  T {temperature[i, j].min():.0f}..{temperature[i, j].max():.0f} K", flush=True)

    _, blocks = parse(fetch("oroheight", 0, 12, ["oroheight"], offline))
    oro = next(iter(blocks.values())).T[::-1]

    n_lat, n_lon = oro.shape
    lat_step = 180 / (n_lat - 1)
    lon_step = 360 / (n_lon - 1)
    assert abs(lats[1] - lats[0] - lat_step) < 1e-3, "rejilla de latitud inesperada"

    # Cuantización. Temperatura: 1 K. Flujo, presión y polvo se guardan como media diaria por estación.
    t_u8 = np.clip(np.rint(temperature - 100), 0, 255).astype(np.uint8)          # [ls, hora, lat, lon]
    flux_u16 = np.clip(np.rint(flux.mean(axis=1) * 10), 0, 65535).astype("<u2")   # W/m2 x 10
    ps_u16 = np.clip(np.rint(pressure.mean(axis=1)), 0, 65535).astype("<u2")      # Pa
    dust_u16 = np.clip(np.rint(dust.mean(axis=1) * 1000), 0, 65535).astype("<u2")  # tau x 1000
    oro_i16 = np.clip(np.rint(oro), -32768, 32767).astype("<i2")                 # m

    sections = [("temperature", t_u8), ("solar", flux_u16), ("pressure", ps_u16), ("dust", dust_u16), ("orography", oro_i16)]
    meta_sections = {}
    offset = 0
    payload = b""
    for name, array in sections:
        raw = array.tobytes()
        meta_sections[name] = {"offset": offset, "length": len(raw), "dtype": str(array.dtype.name), "shape": list(array.shape)}
        payload += raw
        offset += len(raw)
        if offset % 2:  # alinea a 2 bytes para poder leer Uint16 directamente
            payload += b"\0"
            offset += 1

    OUT_BIN.parent.mkdir(parents=True, exist_ok=True)
    OUT_BIN.write_bytes(payload)
    OUT_META.write_text(
        json.dumps(
            {
                "generated": datetime.date.today().isoformat(),
                "source": "Mars Climate Database v6.2 (LMD/OU/IAA/ESA/CNES), escenario de climatología con actividad solar media",
                "url": "https://www-mars.lmd.jussieu.fr/mcd_python/",
                "note": "Modelo de circulación general, no mediciones. Temperatura del aire a 1.5 m.",
                "ls": LS_VALUES,
                "hours": HOURS,
                "grid": {"nLat": n_lat, "nLon": n_lon, "north": 90, "west": -180, "latStep": lat_step, "lonStep": lon_step},
                "encoding": {
                    "temperature": "uint8, K = valor + 100, dimensiones [ls, hora, lat, lon]",
                    "solar": "uint16, W/m2 = valor / 10, media diaria, [ls, lat, lon]",
                    "pressure": "uint16, Pa, media diaria, [ls, lat, lon]",
                    "dust": "uint16, tau = valor / 1000, media mensual, [ls, lat, lon]",
                    "orography": "int16, m sobre el areoide, altura del terreno que usa la MCD, [lat, lon]",
                },
                "sections": meta_sections,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"{OUT_BIN.relative_to(ROOT)}: {OUT_BIN.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
