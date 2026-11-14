// Crea la wallet de la federación (la que da carnets y crea la zona) y la guarda en .env.local, que no va a git.
// Así la federación es otra wallet, distinta del deployer, de los oráculos y de la tesorería.
//
//   node scripts/crear-federacion.mjs
//
// Muestra solo la dirección. La clave privada nunca se imprime.
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const archivo = resolve(raiz, ".env.local");
const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";

const ya = actual.match(/^FEDERATION_PRIVATE_KEY=(0x[0-9a-fA-F]{64})\s*$/m);
if (ya) {
  console.log("Ya hay una federación en .env.local:", new Wallet(ya[1]).address);
  process.exit(0);
}

const w = Wallet.createRandom();
const salto = actual === "" || actual.endsWith("\n") ? "" : "\n";
appendFileSync(archivo, `${salto}# Federación de la demo v2 (wallet de prueba, solo Fuji)\nFEDERATION_PRIVATE_KEY=${w.privateKey}\n`);
console.log("Federación creada y guardada en .env.local:", w.address);
console.log("El deploy le manda 0,1 AVAX de gas desde el deployer.");
