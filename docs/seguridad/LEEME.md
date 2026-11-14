# Revisiones del contrato

El contrato pasó por varias rondas de revisión antes de la entrega, propias y con herramientas de análisis externas. Cada hallazgo corregido quedó cubierto por un test que corre en cada cambio.

Las medidas de seguridad y cómo avisar de un problema están en [`../../SECURITY.md`](../../SECURITY.md).

## Cómo se revisa cada cambio

- **100 tests automáticos** en cada pull request: 62 del contrato y 38 del oráculo.
- **Búsqueda de claves privadas** en cada cambio, en la computadora y en el CI.
- **Web:** revisión de tipos y compilación completa.
- **Enlaces de la documentación** revisados en cada cambio.
- **Código verificado** en Sourcify, con coincidencia exacta.

## Qué se corrigió

Cada fila es un hallazgo de una revisión, su arreglo y el test que lo comprueba (`contracts/test/BrasaFund.ts`).

| Hallazgo | Arreglo | Test |
|---|---|---|
| Un destinatario nuevo podía cobrar apenas se lo daba de alta | Demora pública antes de poder cobrar | "un carnet nuevo no cobra hasta pasada la demora (anti-autocredencial)" |
| Un reporte que no liberaba nada gastaba la espera entre pagos | Ya no la gasta | "un reporte que libera 0 no arranca el cooldown" |
| Una observación anterior podía volver a contarse | Se rechaza | "no se vuelve a contar una observación anterior a la última liberación" |
| Una billetera bloqueada frenaba el pago de todos | El resto cobra. Esa parte vuelve al fondo | "un pago que falla (wallet bloqueada) no frena al resto y el dinero vuelve al fondo" |
| Las bajas ocupaban lugar en la lista de destinatarios | La baja libera el lugar | "revocar libera el lugar en la lista (el tope de 25 no se llena con bajas)" |
| Una zona podía crearse con valores extremos | Cotas al crear la zona | "createZone pone cotas de cordura (cooldown y costos)" |
| Un token que cobra al transferir descuadraba el saldo | Se acredita lo que llegó de verdad | "con un token que cobra al transferir, la zona acredita lo que llegó de verdad" |
| Se podían hacer donaciones vacías | El mínimo es mayor que cero | "el mínimo de donación no puede ser 0 (evita aportes vacíos o que son solo comisión)" |
| El reporte no estaba atado al polígono de la zona | El polígono va dentro de la firma | "un reporte contado con otro polígono revierte" |

## Qué sumó el contrato v3

| Mejora | Test |
|---|---|
| Cobra solo el cuartel que la federación asignó al incendio | "solo cobran los cuarteles que la federación asignó al incendio" |
| Un mismo dato de la NASA paga una sola vez | "un mismo dato de NASA no paga dos veces, aunque pase el cooldown" |
| Las claves de firma se rotan de a una, con propuesta pública y demora | "las claves se rotan de a una: no se pueden reemplazar las dos de golpe" |
| La federación se traspasa en dos pasos, sin mover el fondo | "traspaso de la federación en dos pasos: la nueva acepta y la vieja pierde el rol" |
| Si no se pudo pagar nada, no se gasta ni la espera ni el dato | "si no se pudo pagar nada, no se gastan ni el cooldown ni el dato" |

Detalle del v3: [`../tecnico/CONTRATO-V3.md`](../tecnico/CONTRATO-V3.md).

## Paso siguiente

Auditoría externa, fuzzing con herramientas dedicadas y análisis estático en el CI, antes de la red principal. El plan está en [`../producto/roadmap.md`](../producto/roadmap.md).
