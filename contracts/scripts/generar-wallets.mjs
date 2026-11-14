// Genera billeteras DESCARTABLES de testnet y las guarda en ../.env.local (que git ignora).
// Imprime solo las direcciones públicas. Nunca imprime ni sube las claves privadas. No pisa un .env.local existente.
//
//   cd contracts && node scripts/generar-wallets.mjs [oraculo0|oraculo1|todas]
//
// Cada persona corre esto en SU máquina: no se comparten claves. Facundo opera el oráculo 0 y Gastón el oráculo 1.
import { Wallet } from "ethers";
import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const destino = process.env.ENV_FILE ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
if (existsSync(destino)) {
  console.log(`Ya existe ${destino}. No lo piso. Borralo a mano si querés empezar de nuevo.`);
  process.exit(0);
}

const modo = process.argv[2] ?? "todas";
const nueva = () => Wallet.createRandom();
const d = nueva(), t = nueva(), a = nueva(), b = nueva(), e = nueva(), o0 = nueva(), o1 = nueva();

const lineas = [
  "# Billeteras de TESTNET descartables. No se sube a git. Nunca usar con fondos reales.",
  `DEPLOYER_PRIVATE_KEY=${d.privateKey}`,
  `TREASURY_ADDRESS=${t.address}`,
  `ORACLE0_ADDRESS=${o0.address}`,
  `ORACLE1_ADDRESS=${o1.address}`,
  `CUARTEL_A_ADDRESS=${a.address}`,
  `CUARTEL_B_ADDRESS=${b.address}`,
  `ENTIDAD_ADDRESS=${e.address}`,
];
if (modo === "oraculo0" || modo === "todas") lineas.push(`ORACLE0_PRIVATE_KEY=${o0.privateKey}`);
if (modo === "oraculo1" || modo === "todas") lineas.push(`ORACLE1_PRIVATE_KEY=${o1.privateKey}`);
writeFileSync(destino, lineas.join("\n") + "\n", { mode: 0o600 });

console.log("Listo. Claves guardadas en .env.local (ignorado por git). Direcciones públicas:");
console.log("  Deployer (cargarla con AVAX):", d.address);
console.log("  Oráculo 0:", o0.address, modo === "oraculo1" ? "(sin clave acá: la tiene Facundo)" : "");
console.log("  Oráculo 1:", o1.address, modo === "oraculo0" ? "(sin clave acá: la tiene Gastón)" : "");
console.log("Cuando los dos oráculos estén en máquinas distintas, cada uno pasa SOLO su dirección pública al otro y se completan ORACLE0_ADDRESS/ORACLE1_ADDRESS.");
