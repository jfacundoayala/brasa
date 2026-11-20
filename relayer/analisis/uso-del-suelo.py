# Arma la grilla de uso del suelo que usa la capa 3 del oráculo.
#
#   python -I uso-del-suelo.py <carpeta con los mosaicos> <salida.json>
#
# Fuente: ESA WorldCover 2021 v200, mapa mundial de cobertura del suelo de 10 m (CC BY 4.0).
#   https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_<MOSAICO>_Map.tif
# Mosaicos que cubren Salta: S27W069, S27W066, S27W063, S24W069, S24W066, S24W063.
#
# Para cada celda de 0,01 grados (la misma grilla que el mapa de fuentes fijas) guarda qué
# porcentaje de sus píxeles de 10 m es cultivo (clase 40). 255 = sin dato.
# Necesita rasterio y numpy.
import base64, gzip, json, math, re, sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

CELDA = 0.01
BBOX = (-68.6, -26.4, -62.3, -22.0)  # oeste, sur, este, norte: igual que relayer/src/firms.mjs
CLASE_CULTIVO = 40
PX = 120  # píxeles de 10 m por lado de celda (1/12000 de grado cada uno)

carpeta, salida = Path(sys.argv[1]), Path(sys.argv[2])
y0, y1 = round(BBOX[1] / CELDA), round(BBOX[3] / CELDA)  # índices de fila, de sur a norte
x0, x1 = round(BBOX[0] / CELDA), round(BBOX[2] / CELDA)
filas, columnas = y1 - y0, x1 - x0
grilla = np.full((filas, columnas), 255, dtype=np.uint8)

for tif in sorted(carpeta.glob("ESA_WorldCover_10m_2021_v200_*_Map.tif")):
    m = re.search(r"_([NS])(\d{2})([EW])(\d{3})_Map", tif.name)
    sur = int(m[2]) * (-1 if m[1] == "S" else 1)
    oeste = int(m[4]) * (-1 if m[3] == "W" else 1)
    norte = sur + 3
    # Celdas de la grilla que caen en este mosaico.
    fy0, fy1 = max(y0, sur * 100), min(y1, norte * 100)
    fx0, fx1 = max(x0, oeste * 100), min(x1, (oeste + 3) * 100)
    if fy0 >= fy1 or fx0 >= fx1:
        continue
    with rasterio.open(tif) as d:
        assert d.width == 36000 and d.height == 36000, tif.name
        assert math.isclose(d.bounds.left, oeste) and math.isclose(d.bounds.top, norte), tif.name
        col = (fx0 - oeste * 100) * PX
        ancho = (fx1 - fx0) * PX
        TANDA = 25  # filas de celdas por lectura
        for a in range(fy0, fy1, TANDA):
            b = min(a + TANDA, fy1)
            fila_px = (norte * 100 - b) * PX  # el archivo va de norte a sur
            px = d.read(1, window=Window(col, fila_px, ancho, (b - a) * PX))
            cultivo = (px == CLASE_CULTIVO).reshape(b - a, PX, fx1 - fx0, PX).mean(axis=(1, 3))
            sin_dato = (px == 0).reshape(b - a, PX, fx1 - fx0, PX).mean(axis=(1, 3)) > 0.5
            pct = np.rint(cultivo * 100).astype(np.uint8)
            pct[sin_dato] = 255
            grilla[a - y0 : b - y0, fx0 - x0 : fx1 - x0] = pct[::-1]  # se guarda de sur a norte
    print(tif.name, "listo")

con_dato = grilla != 255
print(f"celdas: {grilla.size}, con dato: {int(con_dato.sum())}, con 50 % o más de cultivo: {int((con_dato & (grilla >= 50)).sum())}")
salida.write_text(json.dumps({
    "fuente": "ESA WorldCover 2021 v200, 10 m. © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium.",
    "licencia": "CC BY 4.0",
    "anio": 2021,
    "clase": "cultivos (clase 40)",
    "celda": CELDA,
    "origen": {"fila": y0, "columna": x0},
    "filas": filas,
    "columnas": columnas,
    "formato": "gzip + base64; un byte por celda, por filas de sur a norte; porcentaje de cultivo, 255 = sin dato",
    "datos": base64.b64encode(gzip.compress(grilla.tobytes(), 9, mtime=0)).decode(),
}))
print("guardado en", salida, salida.stat().st_size, "bytes")
