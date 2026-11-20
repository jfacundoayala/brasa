# Demo guiada y preguntas difíciles

Para recorrer brasa en 3 minutos y comprobar cada cosa que se muestra. Corre en la red de prueba de Stellar, con USDC de prueba y datos reales de la NASA.

## Recorrido (3 minutos)

| Tiempo | Pantalla | Qué se ve | Cómo comprobarlo |
|---|---|---|---|
| 0:00–0:25 | Portada de [brasafund.vercel.app](https://brasafund.vercel.app) | La Tierra con los dos satélites de la NASA en órbita y la frase del producto | [`web/lib/orbita.ts`](../web/lib/orbita.ts): órbitas calculadas con los elementos públicos de NOAA-20 y NOAA-21 |
| 0:25–0:50 | Las cuatro herramientas | Detecta, calcula, envía y deja todo trazable | [`README.md`](../README.md#cómo-funciona) |
| 0:50–1:20 | Mapa | Los focos del día que confirmaron los dos satélites (VIIRS NOAA-20 y NOAA-21) | NASA FIRMS, misma fecha y zona |
| 1:20–1:40 | Un incendio | La meta: `focos × 14 ha × 400 USD`, con la fuente de cada número | [`FORMULA-BRASA.md`](producto/FORMULA-BRASA.md) |
| 1:40–2:00 | Donar | Una donación en la red de prueba, con una sola firma y la comisión visible antes de confirmar | [El contrato en el explorador](https://stellar.expert/explorer/testnet/contract/CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6) |
| 2:00–2:30 | Explorador | El pago de punta a punta del 19/11: 280 USDC al cuartel y a la asistencia | [Comprobante](https://stellar.expert/explorer/testnet/tx/9789094c217e84c3aeb28836751057e77f98bc36a7056af1fd72b3fc445dd532) |
| 2:30–3:00 | Terminal | El oráculo baja los focos del día y muestra el conteo capa por capa, sin enviar nada | [`README.md`](../README.md#seis-capas-para-no-pagar-un-fuego-falso) |

```bash
cd relayer && npm ci
node src/index.mjs reportar-stellar --publico --simular
```

**Si falla la red:** el video ([youtu.be/Kv2nUGe9D3A](https://youtu.be/Kv2nUGe9D3A)) muestra el recorrido con la primera versión, y los tests del oráculo corren con los datos guardados en el repo.

## Preguntas difíciles

**¿Por qué no una base de datos común?**
Quien administra una base de datos puede cambiar la regla o mover el dinero, y el donante tiene que creerle. En brasa, la regla está en un contrato público que no tiene función de retiro, tampoco para el equipo. Cada movimiento es público.
*Prueba:* [`stellar/contracts/brasa-fund/src/lib.rs`](../stellar/contracts/brasa-fund/src/lib.rs): el dinero sale solo por `report_fire`, hacia destinatarios acreditados.

**Los oráculos los opera el equipo: ¿no pueden mentir?**
Cada pago necesita dos reportes, uno por satélite, autorizados por dos cuentas distintas. Además hay un mínimo de focos, la meta funciona como techo y hay una espera entre pagos. Cada pago guarda la huella del dato de la NASA, así que un dato falso se puede detectar después. El paso siguiente es un oráculo para la federación de bomberos y otro para un operador externo. El contrato ya permite rotarlos sin mover el fondo.
*Prueba:* [`stellar/README.md`](../stellar/README.md).

**La NASA publica el dato con unas 3 horas de demora: ¿qué se gana?**
No se ganan esas 3 horas. Se ganan los días que tarda hoy una colecta en llegar al cuartel. Desde que el dato llega al contrato, el pago sale en segundos.

**¿Y si es una quema agrícola y no un incendio?**
Un foco solo no paga. Antes de contar, pasa por seis capas: alta confianza, fuera de fuentes fijas, fuera de cultivos, en un grupo de focos a menos de 2 km, visto por los dos satélites y en dos días distintos. Además hace falta un mínimo de focos y que la federación haya asignado un cuartel a ese incendio. Sin un cuartel asignado, el contrato no libera nada.
*Prueba:* [`FOCOS-QUE-NO-SON-INCENDIOS.md`](producto/FOCOS-QUE-NO-SON-INCENDIOS.md).

**¿De dónde salen los 400 USD por hectárea?**
De los costos oficiales de 12 temporadas de grandes incendios en Chile y Estados Unidos, que van de 251 a 2.904 USD por hectárea. Se acordó con el Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta. El paso siguiente es calibrarlo con las facturas de los cuarteles.
*Prueba:* [`FORMULA-BRASA.md`](producto/FORMULA-BRASA.md).

**¿Quién decide qué cuartel cobra?**
La federación de bomberos. Los satélites dicen dónde hay fuego, y la federación indica qué cuartel lo combate. El contrato paga solo a los cuarteles asignados.

**¿Por qué una comisión de 5 %?**
Paga la detección con satélites, el cálculo de cuánto hace falta, el seguimiento de cada dólar y la difusión. Se ve antes de donar, el donante puede cubrirla para que llegue el 100 %, y 5 % es el tope fijo del contrato.

**¿Son un proveedor de activos virtuales (PSAV)?**
No. La plataforma no cambia, no custodia ni transfiere el dinero de nadie: el donante dona desde su billetera y el contrato reparte según una regla pública. El equipo de brasa cobra solo la comisión por el servicio.
*Prueba:* [`POSICION-PSAV-Y-FONDOS.md`](legal/POSICION-PSAV-Y-FONDOS.md).

**¿Sirve solo para Salta?**
No. Salta es el piloto. NASA FIRMS cubre todo el planeta, y sumar una zona es una llamada más al contrato (`create_zone`), con sus reglas y sus cuarteles.
*Prueba:* [`roadmap.md`](producto/roadmap.md).
