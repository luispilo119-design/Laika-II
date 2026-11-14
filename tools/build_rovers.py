"""Recorridos reales de Perseverance y Curiosity -> public/data/rovers.json

Fuente: los GeoJSON que alimentan los mapas "Where is the rover?" de la NASA (mars.nasa.gov).
Esos archivos pesan más de 1 MB cada uno y el servidor no permite leerlos desde otra web (sin CORS),
así que aquí se descargan, se simplifican (Douglas-Peucker, tolerancia ~1.5 m) y se guardan ligeros.

Uso (desde la raíz del repo, solo biblioteca estándar):
    python tools/build_rovers.py            # descarga y procesa
    python tools/build_rovers.py --offline  # reprocesa lo ya descargado en tools/raw/rovers/
"""

from __future__ import annotations

import datetime
import json
import math
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw" / "rovers"
OUT = ROOT / "public" / "data" / "rovers.json"

BASE = "https://mars.nasa.gov/mmgis-maps"
ROVERS = {
    "perseverance": {
        "name": "Perseverance",
        "mission": "Mars 2020",
        "waypoints": f"{BASE}/M20/Layers/json/M20_waypoints.json",
        "traverse": f"{BASE}/M20/Layers/json/M20_traverse.json",
    },
    "curiosity": {
        "name": "Curiosity",
        "mission": "Mars Science Laboratory",
        "waypoints": f"{BASE}/MSL/Layers/json/MSL_waypoints.json",
        "traverse": f"{BASE}/MSL/Layers/json/MSL_traverse.json",
    },
}

TOLERANCE_DEG = 2.5e-5  # ~1.5 m sobre Marte (1 grado ~ 59 km)
JOIN_DEG = 1.0e-4  # tramos cuyo inicio queda a menos de ~6 m del final anterior se unen


def fetch(url: str, dest: Path, offline: bool) -> dict:
    if not offline:
        dest.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "open-data-client"})
        with urllib.request.urlopen(request, timeout=120) as response:
            dest.write_bytes(response.read())
    return json.loads(dest.read_text(encoding="utf-8"))


def simplify(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Douglas-Peucker iterativo sobre pares (lon, lat)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (x1, y1), (x2, y2) = points[first], points[last]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        worst, index = 0.0, -1
        for i in range(first + 1, last):
            px, py = points[i]
            if length == 0:
                distance = math.hypot(px - x1, py - y1)
            else:
                distance = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / length
            if distance > worst:
                worst, index = distance, i
        if worst > tolerance and index > 0:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))
    return [p for p, k in zip(points, keep) if k]


def line_strings(geometry: dict) -> list[list[list[float]]]:
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiLineString":
        return geometry["coordinates"]
    return []


def build(key: str, spec: dict, offline: bool) -> dict:
    waypoints = fetch(spec["waypoints"], RAW / f"{key}_waypoints.json", offline)["features"]
    traverse = fetch(spec["traverse"], RAW / f"{key}_traverse.json", offline)["features"]

    waypoints.sort(key=lambda f: f["properties"]["sol"])
    first, last = waypoints[0]["properties"], waypoints[-1]["properties"]

    paths: list[list[tuple[float, float]]] = []
    for feature in traverse:
        for coords in line_strings(feature["geometry"]):
            segment = [(c[0], c[1]) for c in coords]
            if not segment:
                continue
            if paths and math.hypot(segment[0][0] - paths[-1][-1][0], segment[0][1] - paths[-1][-1][1]) < JOIN_DEG:
                paths[-1].extend(segment[1:])
            else:
                paths.append(segment)

    raw_points = sum(len(p) for p in paths)
    simple = [simplify(p, TOLERANCE_DEG) for p in paths]
    kept_points = sum(len(p) for p in simple)
    print(f"{key}: {len(traverse)} tramos, {raw_points} -> {kept_points} puntos, sol {last['sol']}, {last['dist_total_m'] / 1000:.2f} km")

    return {
        "name": spec["name"],
        "mission": spec["mission"],
        "sources": [spec["waypoints"], spec["traverse"]],
        "firstSol": first["sol"],
        "lastSol": last["sol"],
        "distanceKm": round(last["dist_total_m"] / 1000, 2),
        # [lat, lon], lon este-positivo: el orden que usa Leaflet y el resto de la app.
        "landing": [round(first["lat"], 6), round(first["lon"], 6)],
        "current": [round(last["lat"], 6), round(last["lon"], 6)],
        "paths": [[[round(lat, 6), round(lon, 6)] for lon, lat in path] for path in simple],
    }


def main() -> None:
    offline = "--offline" in sys.argv
    data = {
        "generated": datetime.date.today().isoformat(),
        "note": "Recorridos simplificados a ~1.5 m. 'landing' es el primer punto registrado del rover.",
        "rovers": {key: build(key, spec, offline) for key, spec in ROVERS.items()},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
