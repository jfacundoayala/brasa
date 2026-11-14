# Demo guiada y preguntas difíciles

Para recorrer brasa en 3 minutos y comprobar cada cosa que se muestra. Corre en Avalanche Fuji, la red de prueba, con USDC de prueba y datos reales de la NASA.

## Recorrido (3 minutos)

| Tiempo | Pantalla | Qué se ve | Cómo comprobarlo |
|---|---|---|---|
| 0:00–0:25 | Portada de [brasafund.vercel.app](https://brasafund.vercel.app) | El problema: la ayuda llega tarde y quien dona no ve adónde fue | [`VALIDACION-BOMBEROS.md`](producto/VALIDACION-BOMBEROS.md) |
| 0:25–0:50 | Los cuatro pasos | Detecta, calcula, envía y muestra | [`README.md`](../README.md#qué-hace) |
| 0:50–1:20 | Mapa | Los focos del día que confirmaron los dos satélites (VIIRS NOAA-20 y NOAA-21) | NASA FIRMS, misma fecha y zona |
| 1:20–1:40 | Un incendio | La meta: `focos × 14 ha × 400 USD`, con la fuente de cada número | [`FORMULA-BRASA.md`](producto/FORMULA-BRASA.md) |
| 1:40–2:00 | Donar | Una donación de 0,01 USDC en Fuji, con la comisión visible antes de confirmar | [Transacción de 0,01 USDC](https://build.avax.network/explorer/fuji/c-chain/tx/0x841e41303da62b7e79fcdf7708f7814f959317793fea60efca9b4a80785ac39c) |
| 2:00–2:30 | Explorador | El pago en vivo del 12/11: 9,5 USDC a dos cuarteles y a damnificados | [Comprobante](https://build.avax.network/explorer/fuji/c-chain/tx/0xd35e6748a10d21081a05998893f4b3d8d2f42d2d89d438bcd22944d7edded4a3) |
| 2:30–3:00 | Terminal | `verificar-hash` recalcula la huella de los datos de la NASA y dice COINCIDE | [`VERIFICAR-HUELLA.md`](tecnico/VERIFICAR-HUELLA.md) |

```bash
cd relayer && npm ci
node src/index.mjs verificar-hash \
  --tx 0xd35e6748a10d21081a05998893f4b3d8d2f42d2d89d438bcd22944d7edded4a3 \
  --datos sample-data/en-vivo-2026-11-12
```

**Si falla la red:** el video ([youtu.be/Kv2nUGe9D3A](https://youtu.be/Kv2nUGe9D3A)) muestra el mismo recorrido, y `verificar-hash` funciona con los datos guardados en el repo.

## Preguntas difíciles

**¿Por qué no una base de datos común?**
Quien administra una base de datos puede cambiar la regla o mover el dinero, y el donante tiene que creerle. En brasa, la regla está en un contrato verificado que no tiene función de retiro, tampoco para el equipo. Cada movimiento es público.
*Prueba:* `contracts/contracts/BrasaFund.sol` y el test "la federación no tiene ninguna función para mover el fondo".

**Las firmas las opera el equipo: ¿no pueden mentir?**
Cada pago necesita dos firmas, una por satélite, en dos computadoras distintas. Además hay un mínimo de focos cruzados, la meta funciona como techo y pasan 12 horas entre pagos. Cada pago guarda la huella del dato de la NASA, así que un dato falso se puede detectar después. El paso siguiente es una firma para la federación de bomberos y otra para un operador externo. El contrato ya permite rotarlas sin mover el fondo.
*Prueba:* [`CONTRATO-V3.md`](tecnico/CONTRATO-V3.md).

**La NASA publica el dato con unas 3 horas de demora: ¿qué se gana?**
No se ganan esas 3 horas. Se ganan los días que tarda hoy una colecta en llegar al cuartel. Desde que el dato llega al contrato, el pago sale en segundos.

**¿Y si es una quema agrícola y no un incendio?**
Un foco solo no paga. Hace falta alta confianza, que los dos satélites vean el fuego a menos de 2 km, un mínimo de focos y que la federación haya asignado un cuartel a ese incendio. Sin un cuartel asignado, el contrato no libera nada.
*Prueba:* [`FOCOS-QUE-NO-SON-INCENDIOS.md`](producto/FOCOS-QUE-NO-SON-INCENDIOS.md).

**¿De dónde salen los 400 USD por hectárea?**
De los costos oficiales de 12 temporadas de grandes incendios en Chile y Estados Unidos, que van de 251 a 2.904 USD por hectárea. Se acordó con el Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta. El paso siguiente es calibrarlo con las facturas de los cuarteles.
*Prueba:* [`FORMULA-BRASA.md`](producto/FORMULA-BRASA.md).

**¿Quién decide qué cuartel cobra?**
La federación de bomberos. Los satélites dicen dónde hay fuego, y la federación indica qué cuartel lo combate. El contrato paga solo a los cuarteles asignados.

**¿Por qué una comisión de 5 %?**
Paga la detección con satélites, el cálculo de cuánto hace falta, el seguimiento de cada dólar y la difusión. Se ve antes de donar, el donante puede cubrirla para que llegue el 100 %, y 5 % es el tope fijo del contrato.

**¿Es legal? ¿Son un proveedor de activos virtuales (PSAV)?**
No. brasa no cambia, no custodia ni transfiere el dinero de nadie: el donante dona desde su billetera y el contrato reparte según una regla pública. brasa cobra solo la comisión por el servicio.
*Prueba:* [`POSICION-PSAV-Y-FONDOS.md`](legal/POSICION-PSAV-Y-FONDOS.md).

**¿Sirve solo para Salta?**
No. Salta es el piloto. NASA FIRMS cubre todo el planeta, y sumar una zona es una llamada más al contrato (`createZone`), con sus reglas y sus cuarteles.
*Prueba:* [`roadmap.md`](producto/roadmap.md).
