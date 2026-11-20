# Evidencia del pago del 19/11/2026

La red de prueba de Stellar se reinicia de vez en cuando y borra lo que hay en ella. Por eso esta carpeta guarda una copia del pago de punta a punta y del contrato.

| Archivo | Qué es |
|---|---|
| `pago-explorador.png` | La transacción en el explorador: dos reportes, uno por satélite, en una llamada a `report_fire` |
| `contrato-explorador.png` | El contrato `brasa-fund` con 670 USDC después del pago |
| `tx.json` | La transacción tal como la devuelve Horizon |
| `efectos.json` | Lo que movió: 210 USDC al cuartel y 70 USDC a la asistencia |

- Transacción: `9789094c217e84c3aeb28836751057e77f98bc36a7056af1fd72b3fc445dd532`, ledger 5808382.
- Contrato: `CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6`.
- Copiado el 20/11/2026 de stellar.expert y de horizon-testnet.stellar.org.
