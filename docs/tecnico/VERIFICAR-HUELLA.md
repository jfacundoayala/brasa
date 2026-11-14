# Verificar la huella del dato

> Cómo cualquiera comprueba que un pago se hizo con los datos reales de la NASA.

Responde la pregunta del track "¿qué pasa si el dato miente?" con algo que cualquiera puede correr: **cualquiera recalcula la huella de un reporte y la compara con la que quedó en la cadena**, sin claves y sin confiar en nuestro relayer.

```bash
cd relayer
node src/index.mjs verificar-hash                 # huellas de los datos guardados
node src/index.mjs verificar-hash --tx 0x…        # compara con un reportFire de Fuji
node src/index.mjs verificar-hash --tx 0x… --live # con los datos en vivo de FIRMS (MAP_KEY)
```

Dice **COINCIDE** o **NO COINCIDE** por sensor (huella y cantidad de focos), muestra qué oráculo firmó cada reporte y chequea que el `FireEvent` guarde las mismas huellas. Si algo no coincide, sale con código 1.

**Cómo se calcula la huella (`dataHash`)**, para reproducirla en cualquier lenguaje:
1. Leer el CSV de FIRMS del sensor (valores como texto, sin convertir).
2. Quedarse con las filas **dentro del polígono de Salta** (`sample-data/salta-provincia.geojson`) y **de alta confianza** (VIIRS `high`/`h`; MODIS ≥ 80), en el orden del CSV.
3. Pasar esa lista a JSON sin espacios: cada fila es un objeto con las columnas en el orden de la cabecera.
4. `dataHash = "0x" + SHA-256(hex)` de ese texto.

**Qué prueba:**
- Prueba que el reporte se armó **exactamente** con esos datos: cambiar una sola fila que cuenta cambia la huella (probado).
- Las filas que no cuentan (fuera de Salta o de confianza baja) no entran en la huella, porque no afectan la meta.
- **Que NASA publicó ese CSV** se comprueba al bajarlo de FIRMS y comparar. FIRMS reprocesa los datos casi en tiempo real (NRT) y la ventana de "últimas 24 h" se mueve, por eso **cada `reportar --live` y `firmar --live` guarda una copia** en `datos-reportes/<fecha UTC>/`: los CSV tal cual llegaron (mismos nombres que `sample-data/`) y `huellas.json`. Esa carpeta se publica en el repo y se verifica con `verificar-hash --tx 0x… --datos datos-reportes/<fecha>`.
- En `BrasaFund.sol`, el campo `dataHash` guarda la huella de las filas filtradas de arriba.
