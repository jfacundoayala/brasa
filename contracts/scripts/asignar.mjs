// La federación asigna qué cuarteles combaten el incendio de la zona (contrato v3).
// Solo los asignados cobran la parte de combate. Sin asignación vigente, el contrato no libera nada.
//
//   cd contracts && node --env-file=../.env.local scripts/asignar.mjs cuartel-a,cuartel-b [días]
//   cd contracts && node --env-file=../.env.local scripts/asignar.mjs --borrar
//   cd contracts && node scripts/asignar.mjs --ver            (solo lee, no necesita claves)
//
// Usa FEDERATION_PRIVATE_KEY (nunca se imprime). Lee el contrato de web/public/deployment.fuji-v3.json
// (o de DEPLOYMENT_FILE). El máximo del contrato es 30 días.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, Wallet, encodeBytes32String, decodeBytes32String } from "ethers";

const aqui = dirname(fileURLToPath(import.meta.url));
const archivo = process.env.DEPLOYMENT_FILE ?? resolve(aqui, "..", "..", "web", "public", "deployment.fuji-v3.json");
const dep = JSON.parse(readFileSync(archivo, "utf8"));
if (dep.version !== 3) throw new Error(`${archivo} no es del contrato v3 (dice v${dep.version ?? 1}).`);

const ABI = [
  "function setResponders(bytes32 zoneId, bytes32[] ids, uint64 validUntil)",
  "function responders(bytes32 zoneId) view returns (bytes32[] ids, uint64 validUntil)",
  "function federation() view returns (address)",
];
const provider = new JsonRpcProvider(dep.rpc, undefined, { cacheTimeout: -1 });
const args = process.argv.slice(2);

async function ver(fondo) {
  const [ids, hasta] = await fondo.responders(dep.zoneId);
  const nombres = ids.map((i) => decodeBytes32String(i));
  if (!nombres.length) return console.log("Sin cuarteles asignados: el fondo no paga hasta que la federación asigne.");
  const vigente = Number(hasta) * 1000 > Date.now();
  console.log(`Asignados: ${nombres.join(", ")} · hasta ${new Date(Number(hasta) * 1000).toISOString()} · ${vigente ? "vigente" : "VENCIDA"}`);
}

async function main() {
  if (args.includes("--ver") || args.length === 0) return ver(new Contract(dep.fund, ABI, provider));
  if (!process.env.FEDERATION_PRIVATE_KEY) throw new Error("Falta FEDERATION_PRIVATE_KEY en el entorno.");
  const fed = new Wallet(process.env.FEDERATION_PRIVATE_KEY, provider);
  const fondo = new Contract(dep.fund, ABI, fed);
  const actual = await fondo.federation();
  if (actual.toLowerCase() !== fed.address.toLowerCase()) throw new Error(`Esta clave es de ${fed.address}, pero la federación del contrato es ${actual}.`);
  const borrar = args.includes("--borrar");
  const ids = borrar ? [] : args[0].split(",").map((s) => encodeBytes32String(s.trim()));
  const dias = Number(args[1] ?? 7);
  if (!borrar && !(dias > 0 && dias <= 30)) throw new Error("Los días tienen que estar entre 1 y 30.");
  const hasta = borrar ? 0 : (await provider.getBlock("latest")).timestamp + Math.floor(dias * 24 * 3600);
  const tx = await fondo.setResponders(dep.zoneId, ids, hasta);
  console.log("tx:", tx.hash);
  await tx.wait();
  await ver(fondo);
}

main().catch((e) => {
  console.error(String(e.shortMessage ?? e.message ?? e).slice(0, 300));
  process.exit(1);
});
