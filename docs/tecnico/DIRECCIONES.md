# Direcciones y transacciones

## Stellar (red de prueba): versión vigente

> **Fuente de verdad:** la cadena. Los valores se leyeron del contrato el 19/11/2026 (`config`, `zone`).

| Qué | Valor |
|---|---|
| Contrato `brasa-fund` | [`CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6`](https://stellar.expert/explorer/testnet/contract/CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6) |
| USDC de prueba (emitido por el equipo, sin valor) | [`CAHM3B3MQMPOQLD6IC4UH77AGEVSXQEQCHHGM3SL2J2DJXCEFIRTESO3`](https://stellar.expert/explorer/testnet/contract/CAHM3B3MQMPOQLD6IC4UH77AGEVSXQEQCHHGM3SL2J2DJXCEFIRTESO3) |
| Federación | `GCBB27NIZY2M2VRMKFJIGFBHWYQMQ73BVKIQ2VOPKDLVAU36VLE337GL` |
| Tesorería (cobra la comisión) | `GDWYXQJYVZKW6425D54FURQP6A67B3CHORRRXJ5UYXEY3R343B3WLXZ5` |
| Oráculo del satélite NOAA-20 | `GBDNND5J2OPIFHQT6RHH5L3EBZ7KA6WJDAABM53TIKATDXY4LRHZV6KF` |
| Oráculo del satélite NOAA-21 | `GA3LGHTBATEO5ZPNUIUBPF7UYEQXKIN7FZ6PODL7WF2O3HLX5TOCOQRQ` |
| Zona `salta` | `c48e22d109fbdc9ea9d09115591b16133717abf8f0faad86b3656f23f0a8de5b` |
| Comisión y donación mínima | 5 % · 1 USDC |
| Reglas de la zona de prueba | Mínimo 3 focos · 4 USDC por hectárea (2 combate, 1 logística, 1 asistencia) · tope de 500 USDC por incendio · 1 hora entre pagos |
| Demoras | 1 hora para un alta y 1 hora para cambiar un oráculo. En el piloto: 72 h y 48 h |
| Pago de punta a punta, 19/11/2026 | [`9789094c…d532`](https://stellar.expert/explorer/testnet/tx/9789094c217e84c3aeb28836751057e77f98bc36a7056af1fd72b3fc445dd532): 280 USDC, 210 al cuartel y 70 a la asistencia. Focos cargados a mano |

Todas las cuentas las opera el equipo y son de prueba.

## Primera versión (Avalanche Fuji, red de prueba)

> **Fuente de verdad:** `web/public/deployment.fuji.json`. La web y el relayer leen ese archivo. Los roles de esta tabla se leyeron del contrato el 13/11/2026 (`oracle0()`, `oracle1()`, `treasury()`, `federation()`, `feeBps()`).
> Si este documento y la cadena no coinciden, vale la cadena.

## Contrato vigente (v3, desplegado el 13/11)
| Qué | Valor |
|---|---|
| BrasaFund v3 | [`0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057`](https://build.avax.network/explorer/fuji/c-chain/address/0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057) · [código verificado en Sourcify](https://sourcify.dev/server/repo-ui/43113/0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057) |
| Bloque de despliegue | 60986787 |
| Archivo de despliegue | `web/public/deployment.fuji-v3.json` |
| Donación mínima | 0,01 USDC |
| Costo por hectárea y reparto | 400 USD · 80 % cuarteles asignados, 20 % asistencia |
| Demoras | Hoy, en Fuji: 10 minutos para un alta y 10 minutos para rotar una clave. Paso siguiente, en el piloto: 72 h y 48 h |

Usa los mismos roles y el mismo USDC que el v2. Qué cambió: [`CONTRATO-V3.md`](CONTRATO-V3.md).

## Contrato anterior (v2)
| Qué | Valor |
|---|---|
| BrasaFund v2 | [`0xAABcd03bCfEE730633E1Fd69756E1923Db50c72f`](https://build.avax.network/explorer/fuji/c-chain/address/0xAABcd03bCfEE730633E1Fd69756E1923Db50c72f) (código verificado) |
| Bloque de despliegue | 60937483 |
| USDC de prueba (Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Red | Avalanche Fuji, chainId 43113 |
| Comisión | 5 % (`feeBps = 500`), fija por despliegue |
| Donación mínima | 2 USDC (en el v3: 0,01 USDC) |
| Demora de un alta antes de cobrar | 600 segundos (10 minutos) |

## Roles
| Rol | Dirección | Qué puede hacer |
|---|---|---|
| Oráculo 0 (satélite NOAA-20) | `0xd678ff8c716143515417883cb6dC3b7588a6B651` | Firmar que su satélite vio fuego |
| Oráculo 1 (satélite NOAA-21) | `0x50D250E44fb164ba509f830503199696cfDEE779` | Firmar que su satélite vio fuego |
| Federación | `0xF0862456a666CE6fF13112EFd6E489d0b6fc0052` | Crear zonas, dar y sacar credenciales. En el v3, además: asignar cuarteles a un incendio y proponer la rotación de una clave |
| Tesorería | `0x54e1524Ac29899aD01437545FE6e80D120875cda` | Recibir la comisión |

Ningún rol puede retirar el fondo. Hoy, en Fuji, los roles los opera el equipo. Paso siguiente: en el piloto pasan a terceros, como explica [`../legal/POSICION-PSAV-Y-FONDOS.md`](../legal/POSICION-PSAV-Y-FONDOS.md).

## Transacciones clave
| Qué | Transacción |
|---|---|
| Donación de 0,01 USDC, la mínima (v3) | [`0x841e…c39c`](https://build.avax.network/explorer/fuji/c-chain/tx/0x841e41303da62b7e79fcdf7708f7814f959317793fea60efca9b4a80785ac39c) |
| Donación de 9,9 USDC (v3) | [`0x0971…b7fb`](https://build.avax.network/explorer/fuji/c-chain/tx/0x09713d3061570eebd4e625d69135bfab799a2f54bafffaf2102f696ce132b7fb) |
| Liberación en vivo del 12/11 (v2), 9,5 USDC | [`0xd35e…d4a3`](https://build.avax.network/explorer/fuji/c-chain/tx/0xd35e6748a10d21081a05998893f4b3d8d2f42d2d89d438bcd22944d7edded4a3) |
| Donación de prueba (v2) | [`0x2cda…3ee0`](https://build.avax.network/explorer/fuji/c-chain/tx/0x2cda1aee638693a4665d4443412fe7335e6c34dc83feeb482338f1e318bd3ee0) |
| Primera liberación (v1, con datos guardados) | [`0x67f7…aba0`](https://build.avax.network/explorer/fuji/c-chain/tx/0x67f79d0eb1bb808dc12c873374e7f906ba7bb94aed1212d71b51c87c836caba0) |

## Primer contrato (v1)
`0x014fFD4e42580Cb0a0C2336BaF24A2bfCA174764`. Queda como registro. Tenía otra forma de reporte y cobraba 3 %.

## Cómo comprobarlo
- La huella de los datos de una liberación: [`VERIFICAR-HUELLA.md`](VERIFICAR-HUELLA.md).
- Qué cambió del v1 al v2: [`CONTRATO-V2.md`](CONTRATO-V2.md).
- Qué cambió del v2 al v3: [`CONTRATO-V3.md`](CONTRATO-V3.md).
