# Datos de ejemplo

Son datos reales de NASA FIRMS, guardados para que cualquiera pueda repetir las pruebas sin clave de la NASA.

| Archivos | Qué son | Quién los usa |
|---|---|---|
| `firms-*-salta.csv` (en esta carpeta) | Focos de Salta guardados el 11/11/2026 | Los tests del relayer y la verificación de la liberación del contrato v1 |
| `en-vivo-2026-11-12/` | Los datos exactos de la liberación en vivo del 12/11, con sus huellas (`huellas.json`) | `verificar-hash` de la transacción `0xd35e…d4a3` |
| `salta-provincia.geojson` | El polígono de la provincia de Salta | El contrato guarda su huella. El relayer cuenta los focos que caen adentro |
| `fuentes-fijas-salta.json` | Celdas de Salta con calor que se repite año tras año, armadas con el historial de NASA FIRMS (2012–2025) | La capa de fuentes fijas del oráculo y `retroprueba.mjs` |
| `uso-del-suelo-salta.json` | Porcentaje de cultivo de cada celda de 0,01° de Salta. Se arma con `analisis/uso-del-suelo.py` a partir de ESA WorldCover 2021 v200 (10 m, CC BY 4.0): © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium | La capa de uso del suelo del oráculo y `retroprueba.mjs` |

Cómo se usan: [`../docs/tecnico/VERIFICAR-HUELLA.md`](../../docs/tecnico/VERIFICAR-HUELLA.md).
