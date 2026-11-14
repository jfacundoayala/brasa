# Contrato v2: qué cambió y por qué

> **Desplegado el 12/11/2026** en `0xAABcd03bCfEE730633E1Fd69756E1923Db50c72f` (bloque 60937483), con comisión 5 %, 320 USD/ha, mínimo 2 focos cruzados, sin tope fijo, 12 h entre pagos y altas visibles 10 min antes de cobrar. El v1 (`0x014f…4764`) queda como anterior. El contrato vigente es el v3: ver [`CONTRATO-V3.md`](CONTRATO-V3.md).
> Origen: una revisión externa del código y lo que encontramos nosotros (ver [`../seguridad/LEEME.md`](../seguridad/LEEME.md)).
> **Comisión:** el despliegue usa `feeBps = 500`, o sea 5 %: dona 100, llegan 95; si cubre la comisión, paga 105. El ejemplo del comentario en `BrasaFund.sol` usa otro porcentaje; vale `feeBps`. La comisión es `immutable`: cambiarla exige un despliegue nuevo.
> Contrato: 44 tests. Relayer: 30 tests en ese momento (hoy son 38). Slither: 5 avisos, todos explicados (abajo).

## Qué hace distinto el v2, en una línea
**El reporte prueba con qué polígono se contó, de qué hora es el dato de NASA y que los dos satélites vieron el mismo fuego; con datos de otro día no se libera nada.**

## Cambios
### Contrato (`BrasaFund.sol`)
1. **Polígono firmado:** el reporte lleva `polygonHash` y el contrato exige que sea el de la zona (`WrongPolygon`). La huella es `keccak256` del GeoJSON de Salta con saltos de línea LF.
2. **Hora real del dato:** el reporte lleva `dataTime`, la detección más nueva de NASA que se usó. El contrato rechaza un dato posterior al reporte y **un dato de más de 24 h** (`MAX_DATA_AGE`). `FireEvent` publica la hora de cada sensor.
3. **Totales en la cadena:** `zoneTotals(zona)` devuelve todo lo donado y todo lo pagado. Lo que falla al pagar no cuenta como pagado.
4. **Altas a la vista:** `RecipientAdded` publica `activeFrom` (desde cuándo cobra) y `RecipientRevoked` dice la zona.
5. **Dominio EIP-712 versión "2":** una firma hecha para el v1 no sirve en el v2.
6. Sin función de retiro, igual que el v1. Comisión, tesorería y oráculos siguen inmutables.

### Relayer
7. **Cruce de los dos satélites:** cada sensor cuenta solo los focos de alta confianza que el otro satélite también vio a menos de 2 km. Con los datos guardados del 10 y 11/11: NOAA-20 18 → 18, NOAA-21 26 → 14, **meta = 14 focos = 196 ha = 62.720 USDC** a 320 USD/ha (en el v1: 18 focos, 252 ha, 50.400 a 200 USD/ha). Da lo mismo con 1, 2 o 3 km.
8. **En Fuji solo con `--live`.** Los datos guardados y la hora simulada quedan para la cadena local (31337).
9. **Más de 65.535 focos es un error**, no un recorte silencioso.
10. **`verificar-hash`** recalcula huella, focos cruzados, hora del dato y polígono.
11. **FIRMS con 2 días:** con 1 día la API trae solo el día UTC en curso y de madrugada viene vacía. La frescura la controla el contrato (24 h).

### Despliegue (`deploy.mjs`)
12. **Roles separados:** el deployer solo despliega. La federación es otra wallet (`scripts/crear-federacion.mjs`), cada oráculo tiene su propia clave y la tesorería es otra. Quien manda `reportFire` solo paga el gas: no tiene ningún poder.
13. **Demora pública** para que una credencial nueva cobre. Hoy, en Fuji: 10 minutos (v1: 60 s). Paso siguiente, en el piloto: 72 h.
14. **Mínimo de 2 focos cruzados por sensor** (v1: 3 focos sueltos en la provincia). Con el cruce, cada foco ya es fuego visto por dos satélites en el mismo lugar. La meta es proporcional (1 foco = 14 ha = 4.480 USDC), y la meta es el techo de cada pago, con 12 h entre liberaciones.
15. Escribe `deployment.fuji.json` con versión, bloque, polígono, federación y demora.

### Web
16. Lee los totales del contrato (`zoneTotals`), los campos por nombre y no por posición, la hora real del dato y las **altas pendientes** con su hora de inicio. Funciona con el v1 y con el v2.
17. El ABI se genera desde el contrato compilado: `node web/scripts/generar-abi.mjs`.
18. La tarea de NASA deja los datos anteriores si NOAA-20 o NOAA-21 vienen vacíos (MODIS solo no alcanza).

## Slither (0.11.6, 102 detectores)
Quedan 5 avisos, ninguno es un problema:
- **divide-before-multiply** en `_pay`: es a propósito, calcula el resto de la división que va al primero.
- **timestamp** (4): ventanas de horas (demora, frescura, cooldown); unos segundos de margen del validador no cambian nada.
- **cyclomatic-complexity** de `reportFire`: informativo.
Las dos variables "sin inicializar" que marcaba se inicializaron en 0 de forma explícita.
