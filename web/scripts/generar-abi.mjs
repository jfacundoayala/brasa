// Genera web/lib/abi.ts desde el contrato compilado, para no copiar el ABI a mano.
//
//   cd contracts && npx hardhat compile && cd ../web && node scripts/generar-abi.mjs
//
// FUND_ABI es el del contrato actual (v3). V1_ZONES_ABI y V2_ZONES_ABI permiten seguir leyendo los contratos anteriores.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const artefacto = resolve(aqui, "..", "..", "contracts", "artifacts", "contracts", "BrasaFund.sol", "BrasaFund.json");
const abi = JSON.parse(readFileSync(artefacto, "utf8")).abi.filter((x) => x.type !== "constructor");

const salida = `// ABI de BrasaFund v3. GENERADO por web/scripts/generar-abi.mjs desde contracts/artifacts: no editar a mano.
export const FUND_ABI = ${JSON.stringify(abi, null, 1)} as const;

// Contrato v1 (anterior): solo lo que cambió de forma, para poder seguir leyéndolo.
export const V1_ZONES_ABI = [
  "function zones(bytes32) view returns (bool exists, uint16 minHotspots, uint64 cooldown, uint64 lastRelease, uint256 balance, uint256 maxPerEvent, uint256 costCombatPerHa, uint256 costLogisticsPerHa, uint256 costAssistPerHa, bytes32 polygonHash)",
] as const;

// Contrato v2: zones() no trae lastDataTime (lo agregó el v3). Con el ABI del v3 la lectura fallaría.
export const V2_ZONES_ABI = [
  "function zones(bytes32) view returns (bool exists, uint16 minHotspots, uint64 cooldown, uint64 lastRelease, uint256 balance, uint256 totalDonated, uint256 totalReleased, uint256 maxPerEvent, uint256 costCombatPerHa, uint256 costLogisticsPerHa, uint256 costAssistPerHa, bytes32 polygonHash)",
] as const;

// USDC: solo lo que usamos
export const ERC20_ABI = [
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;
`;
writeFileSync(resolve(aqui, "..", "lib", "abi.ts"), salida);
console.log(`lib/abi.ts: ${abi.length} entradas del ABI de BrasaFund.`);
