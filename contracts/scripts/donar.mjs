// Dona USDC de prueba a la zona de Salta en Fuji, con una wallet descartable.
//   DONOR_PRIVATE_KEY=0x... node scripts/donar.mjs [monto_usdc] [cubrir]
// Lee el contrato y la zona de web/public/deployment.json. Necesita AVAX de prueba para el gas.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits } from "ethers";

const aqui = dirname(fileURLToPath(import.meta.url));
const dep = JSON.parse(readFileSync(resolve(aqui, "..", "..", "web", "public", "deployment.json"), "utf8"));
const monto = parseUnits(process.argv[2] ?? "20", 6);
const cubrir = (process.argv[3] ?? "false") === "true";
if (!process.env.DONOR_PRIVATE_KEY) throw new Error("Falta DONOR_PRIVATE_KEY en el entorno.");
const provider = new JsonRpcProvider(dep.rpc);
const w = new Wallet(process.env.DONOR_PRIVATE_KEY, provider);
const usdc = new Contract(dep.usdc, ["function balanceOf(address) view returns(uint256)", "function approve(address,uint256) returns(bool)"], w);
const fondo = new Contract(dep.fund, [
  "function donateToZone(bytes32,uint256,bool)",
  "function quoteSplit(uint256,bool) view returns(uint256,uint256,uint256)",
], w);

// El contrato devuelve (net, fee, total): total es lo que hay que aprobar.
const [neto, comision, pagas] = await fondo.quoteSplit(monto, cubrir);
console.log(`Donante ${w.address}: USDC ${formatUnits(await usdc.balanceOf(w.address), 6)}, AVAX ${formatUnits(await provider.getBalance(w.address), 18)}`);
console.log(`Pagás ${formatUnits(pagas, 6)} · llegan ${formatUnits(neto, 6)} · comisión ${formatUnits(comision, 6)}`);
await (await usdc.approve(dep.fund, pagas)).wait();
const tx = await fondo.donateToZone(dep.zoneId, monto, cubrir);
const r = await tx.wait();
console.log(`Donación hecha: ${dep.explorer}/tx/${r.hash}`);
