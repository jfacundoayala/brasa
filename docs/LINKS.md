# Links de brasa

Todo lo que hay para ver de brasa, en un solo lugar. El proyecto nació en el Hackathon Argentina Space 2026.

| Qué | Dónde |
|---|---|
| Video de la primera versión | <https://youtu.be/Kv2nUGe9D3A> |
| Web | <https://brasafund.vercel.app> |
| Todos los links | <https://brasafund.vercel.app/links> |
| Presentación | [`brasa-deck.pdf`](presentacion/brasa-deck.pdf) |
| Resumen en una página | [`one-pager.pdf`](presentacion/one-pager.pdf) |
| Contrato en la red de prueba de Stellar | <https://stellar.expert/explorer/testnet/contract/CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6> |
| Código del contrato | [`stellar/`](../stellar) |
| Pago de punta a punta del 19/11 | <https://stellar.expert/explorer/testnet/tx/9789094c217e84c3aeb28836751057e77f98bc36a7056af1fd72b3fc445dd532> |
| Entrevista de validación | [`VALIDACION-BOMBEROS.md`](producto/VALIDACION-BOMBEROS.md) |

## El código

| Carpeta | Qué tiene |
|---|---|
| [`stellar/`](../stellar) | El contrato `brasa-fund` y sus 32 tests |
| [`relayer/`](../relayer) | El oráculo que lee los datos de la NASA, los pasa por las capas de detección y reporta, con 63 tests |
| [`web/`](../web) | La web publicada |
| [`relayer/sample-data/`](../relayer/sample-data) | Datos de la NASA guardados y los mapas de fuentes fijas y uso del suelo |
| [`avalanche/`](../avalanche) | La primera versión del contrato, en Solidity |

Cómo correrlo y comprobarlo: [`README.md`](../README.md).

Equipo: Juan Facundo Ayala y Gastón Persoglia.
