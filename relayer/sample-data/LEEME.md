# Datos de ejemplo

Son datos reales de NASA FIRMS, guardados para que cualquiera pueda repetir las pruebas sin clave de la NASA.

| Archivos | Qué son | Quién los usa |
|---|---|---|
| `firms-*-salta.csv` (en esta carpeta) | Focos de Salta guardados el 11/11/2026 | Los tests del relayer y la verificación de la liberación del contrato v1 |
| `en-vivo-2026-11-12/` | Los datos exactos de la liberación en vivo del 12/11, con sus huellas (`huellas.json`) | `verificar-hash` de la transacción `0xd35e…d4a3` |
| `salta-provincia.geojson` | El polígono de la provincia de Salta | El contrato guarda su huella. El relayer cuenta los focos que caen adentro |

Cómo se usan: [`../docs/tecnico/VERIFICAR-HUELLA.md`](../../docs/tecnico/VERIFICAR-HUELLA.md).
