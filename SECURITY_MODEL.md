# Modelo de amenazas — brasa

Para quien revisa la seguridad de brasa (personas y escaneos automáticos). Fuente: [`SECURITY.md`](SECURITY.md) y [`docs/seguridad/LEEME.md`](docs/seguridad/LEEME.md), más lectura del código. Lo que viene de esos archivos se marca **[del equipo]**; lo inferido del código, **[inferido]**.

## 1. Qué es el sistema
Fondo de ayuda para incendios en Salta. Donantes ponen USDC en el contrato `BrasaFund` (Avalanche Fuji, testnet, USDC de prueba **[del equipo]**). Cuando dos oráculos firman (EIP-712) que dos satélites VIIRS distintos vieron fuego en la zona, cualquiera puede llamar `reportFire` y el contrato paga a los cuarteles asignados según una regla pública (focos × 14 ha × costo por ha). No hay infraestructura como código (Terraform, etc.); la infraestructura está en `relayer/deploy/` y `.github/workflows/`.

## 2. Componentes
| Nombre | Código | Qué hace |
|---|---|---|
| Contrato | `contracts/contracts/BrasaFund.sol` | Guarda el fondo, verifica firmas, paga. Sin función de retiro **[del equipo]** |
| Oráculo | `relayer/src/` (`index.mjs`, `firms.mjs`, `reporte.mjs`, `verificar.mjs`, `incendios.mjs`, `archivo.mjs`) | Baja datos de NASA FIRMS, cuenta focos, firma reportes, arma `focos.json` |
| Buzón de firmas | `relayer/src/buzon.mjs`, `buzon-lib.mjs` | Cada oráculo publica su firma en una issue de GitHub; el que envía junta el par (filtra por autores del equipo) |
| Web | `web/` (Next.js 16, ethers) | Mapa público y botón de donar (approve + `donateToZone`) con la billetera del visitante. En Vercel y en una VM de Oracle |
| Scripts de despliegue | `contracts/scripts/` | Despliegue, alta de federación, asignación de cuarteles, generar wallets |
| CI e infraestructura | `.github/workflows/`, `.githooks/`, `relayer/deploy/` | Tests y búsqueda de claves; workflow `datos-nasa` con `contents: write` y secreto `MAP_KEY`; VM con cron cada 3 h, pm2, puerto 3000 abierto |

## 3. Límites de confianza y entradas
- **Cualquiera en la cadena** → `donateToZone`, `donateToRecipient`, `reportFire` (vale solo con dos firmas válidas), `acceptFederation`/`acceptOracle` (solo el pendiente / tras demora).
- **Federación** (billetera del equipo hoy **[del equipo]**) → `createZone`, `addRecipient`, `setResponders`, `revokeRecipient`, `proposeOracle`, `transferFederation`. Demoras públicas: 10 min en Fuji **[del equipo]**.
- **Dos oráculos** (dos personas, dos claves, dos computadoras; ninguna clave en servidores ni CI **[del equipo]**) → firman `FireReport`.
- **NASA FIRMS** (HTTP con `MAP_KEY`) → datos que el oráculo cuenta y que la web muestra.
- **Issues/comentarios de GitHub** → el buzón lee firmas del otro oráculo (filtro por login).
- **APIs externas en el navegador**: dolarapi.com, coingecko, GOES; archivos JSON en `web/public/`.
- **Visitante de la web** → solo lectura; firma con su propia billetera.

## 4. Activos
1. Saldo USDC de cada zona en el contrato (mayor valor).
2. Que el pago llegue solo al cuartel asignado y con la regla correcta.
3. Claves de los oráculos y de la federación (y `DEPLOYER/RELAYER_PRIVATE_KEY`).
4. Integridad de lo que muestra la web (dirección del contrato en `deployment*.json`, focos) — si se altera, un donante podría aprobar USDC a otra dirección **[inferido]**.
5. Secreto `MAP_KEY` y permiso de escritura del workflow `datos-nasa`.

## 5. Atacantes
- Cualquiera en internet / en la cadena (donante, visitante, quien llama `reportFire`).
- Un destinatario con credencial que quiere cobrar de más o antes.
- Quien robe **una** clave de oráculo (no debería alcanzar para pagar).
- Quien controle la federación o el equipo (hoy confiables por diseño **[del equipo]**; el paso siguiente es multisig).
- Quien pueda comentar en la issue del buzón o inyectar datos en FIRMS/JSON públicos.

## 6. Controles existentes **[del equipo]**
Dos firmas EIP-712 de sensores distintos, nonces y dominio con `chainId`; un dato de NASA paga una vez; cooldown; frescura (6 h reporte, 24 h dato, 3 h entre firmas); polígono dentro de la firma; demora para credenciales y rotación de claves; `MAX_FEE_BPS = 500`; `ReentrancyGuard`, `SafeERC20`; tope de 25 destinatarios; pagos fallidos vuelven al fondo; 62 tests de contrato y 38 del oráculo; búsqueda de claves en hook y CI; dependencias fijas con lockfile; cabeceras de seguridad en la web.

## 7. Fuera de alcance / riesgo aceptado
- Hoy el equipo opera la federación y las dos claves: que el equipo actúe de mala fe es confianza aceptada en esta etapa **[del equipo]**.

## 8. Preguntas abiertas
- ¿Qué activos importan más y qué atacantes preocupan más?
- ¿Se juzga como red principal o el riesgo propio de testnet es aceptado?
- ¿Los scripts de despliegue y la VM de Oracle están en uso real?
