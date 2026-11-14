# Contrato v3: qué cambió y dónde está

> Desplegado y verificado en Avalanche Fuji el 13/11/2026. Es el contrato que lee la web (`web/public/deployment.fuji.json`).

## Dónde está

| Qué | Valor |
|---|---|
| BrasaFund v3 | [`0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057`](https://build.avax.network/explorer/fuji/c-chain/address/0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057) |
| Código verificado | [Sourcify, coincidencia exacta](https://sourcify.dev/server/repo-ui/43113/0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057) |
| Bloque de despliegue | 60986787 |
| Archivo de despliegue | `web/public/deployment.fuji-v3.json` |
| Donación de 0,01 USDC | [`0x841e…c39c`](https://build.avax.network/explorer/fuji/c-chain/tx/0x841e41303da62b7e79fcdf7708f7814f959317793fea60efca9b4a80785ac39c) |
| Donación de 9,9 USDC | [`0x0971…b7fb`](https://build.avax.network/explorer/fuji/c-chain/tx/0x09713d3061570eebd4e625d69135bfab799a2f54bafffaf2102f696ce132b7fb) |
| Saldo del fondo de Salta | 9,415 USDC de prueba |

Los roles son los mismos del v2: dos oráculos, federación y tesorería (ver [`DIRECCIONES.md`](DIRECCIONES.md)).

## Qué cambió respecto del v2

| Cambio | v2 | v3 |
|---|---|---|
| Donación mínima | 2 USDC | 0,01 USDC |
| Costo por hectárea | 320 USD | 400 USD |
| Reparto | 85 % cuarteles, 15 % asistencia | 80 % cuarteles, 20 % asistencia |
| Quién cobra la parte de combate | Todos los cuarteles acreditados, en partes iguales | Solo los que la federación asignó al incendio |
| Sin asignación de la federación | No existía | El fondo no paga |
| Claves de los oráculos | Fijas para siempre | Se rotan de a una, con demora pública |
| Rol de federación | Fijo para siempre | Se traspasa en dos pasos |
| Un mismo dato de la NASA | Podía pagar dos veces en 24 horas | Paga una sola vez |
| Si no se pudo pagar nada | Se gastaba la espera de 12 horas | No se gasta ni la espera ni el dato |

No cambió: no hay función para retirar el fondo, hacen falta dos firmas de dos oráculos distintos y la comisión es del 5 %.

## Las reglas nuevas, una por una

**Cuartel asignado.** La federación llama a `setResponders` con la lista de cuarteles que combaten y una fecha de vencimiento, de 30 días como máximo. Solo valen cuarteles acreditados y activos de esa zona, sin repetidos. Los satélites dicen dónde hay fuego; la federación dice quién fue.

**Rotación de claves.** La federación propone una clave nueva con `proposeOracle`. La propuesta queda pública. Pasada la demora, cualquiera la aplica con `acceptOracle`. Hay tres frenos:
- Se rota de a una clave por vez. No se pueden reemplazar las dos de golpe.
- Una propuesta vence a los 7 días si nadie la aplica.
- Los dos sensores nunca quedan con la misma clave.

**Traspaso de la federación.** `transferFederation` nombra a la cuenta nueva y `acceptFederation` lo confirma. Mientras la nueva no acepta, no cambia nada. Al aceptar se borran las propuestas de claves pendientes.

**Dato nuevo.** Cada sensor guarda la hora de su último dato pagado. Para volver a pagar hace falta una pasada nueva de cada satélite.

## Valores en Fuji y en el piloto

| Parámetro | En Fuji | En el piloto |
|---|---|---|
| Demora de un alta antes de cobrar | 10 minutos | 72 horas |
| Demora para rotar una clave | 10 minutos | 48 horas |
| Focos cruzados mínimos por satélite | 2 | Lo fija la federación |
| Espera entre pagos | 12 horas | Lo fija la federación |

Hoy, en Fuji, las demoras son de 10 minutos para poder mostrarlas en vivo. Paso siguiente: 72 h y 48 h en el piloto. El contrato les pone un tope de 30 días.

## Decisiones de diseño

El código nuevo pasó por revisiones propias y externas antes de desplegarse. Lo que se corrigió está en [`../seguridad/LEEME.md`](../seguridad/LEEME.md). Código público y verificable; auditoría externa en el roadmap. Tres efectos del diseño, a la vista:

1. **El fondo paga solo con asignación de la federación.** Sin asignación, el saldo queda en el fondo. En el piloto la federación es una cuenta de varias firmas, y el rol se puede traspasar.
2. **Las claves se rotan de a una y a la vista.** Con demora de 48 horas, cambiar las dos lleva al menos cuatro días públicos.
3. **Una rotación invalida las firmas que estaban en camino.** No se pierde dinero: se firma de nuevo.

## Cómo se prueba

```bash
npm run instalar
```

```bash
npm test
```

Son 100 tests: 62 del contrato y 38 del oráculo.

## Comandos de la federación

Ver quién está asignado (no necesita claves):

```bash
cd contracts && node scripts/asignar.mjs --ver
```

Asignar cuarteles por 7 días:

```bash
cd contracts && node --env-file=../.env.local scripts/asignar.mjs cuartel-a,cuartel-b 7
```
