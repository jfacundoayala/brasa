// Despliega BrasaFund y deja todo listo para la demo.
//
//   NETWORK=local  node scripts/deploy.mjs     -> nodo local (npx hardhat node), USDC de prueba y cuentas de la frase pública de Hardhat
//   NETWORK=fuji   node scripts/deploy.mjs     -> Avalanche Fuji, USDC de Circle. Lee las claves de variables de entorno (ver .env.example en la raíz).
//
// Escribe web/public/deployment.json (lo leen la pantalla y el relayer) y, en Fuji, también deployment.fuji.json
// (el que usa la web publicada). NUNCA escribe claves.
//
// Roles separados en Fuji: el deployer solo despliega. La federación (da carnets y crea la zona) es otra wallet,
// FEDERATION_PRIVATE_KEY (se crea con scripts/crear-federacion.mjs). Oráculos y tesorería son otras wallets más.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContractFactory, JsonRpcProvider, Wallet, HDNodeWallet, Mnemonic, encodeBytes32String, keccak256, toUtf8Bytes, parseUnits } from "ethers";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..");
const artefacto = (n) => JSON.parse(readFileSync(resolve(aqui, "..", "artifacts", "contracts", `${n}.sol`, `${n}.json`), "utf8"));

const red = process.env.NETWORK ?? "local";
const U = (n) => parseUnits(String(n), 6);
const ZONA = encodeBytes32String("salta");
// Costos por hectárea DECLARADOS (supuestos calibrados con datos de EE.UU., Chile y Canadá, no medidos en Argentina). Se ven en el explorer.
// v3: 400 USD/ha. La base de 320 sale de fuentes oficiales (ver docs/producto/FORMULA-BRASA.md); el Comandante Mayor de
// Bomberos Voluntarios de Salta la validó el 12/11/2026 y pidió redondear a 400. Reparto 80 / 20: 320 a los cuarteles
// asignados (combate y logística) y 80 a la asistencia de damnificados.
const COSTO = { combate: U(280), logistica: U(40), asistencia: U(80) };
// Mínimo de donación: 0,01 USDC (en la práctica, sin mínimo; el contrato no acepta 0).
const MINIMO = U("0.01");
const COMISION_BPS = 500;
// Sin tope por evento (decisión del equipo, 12/11): limita el monto calculado (focos × ha × costo) y el saldo.
const MAX_POR_EVENTO = 2n ** 255n;
const COOLDOWN = 12 * 3600;
// Focos mínimos por sensor. Cada sensor cuenta solo los focos que el OTRO satélite también vio a menos de 2 km.
// La meta es proporcional (1 foco = 14 ha) y tiene tope por evento y cooldown. En el piloto lo fija la federación.
const MIN_FOCOS = Number(process.env.MIN_FOCOS ?? 2);
// Demora pública entre dar un carnet y que cobre. Fuji: 10 min, para poder mostrarla.
// Piloto: 72 h (259200 s), para que nadie se autocredencie de sorpresa.
const DEMORA_CARNET = BigInt(process.env.RECIPIENT_DELAY ?? (red === "local" ? 0 : 600));
// Demora pública entre proponer una clave de oráculo nueva y que valga. Fuji: 10 min. Piloto: 48 h (172800 s).
const DEMORA_ORACULO = BigInt(process.env.ORACLE_DELAY ?? (red === "local" ? 0 : 600));
// Días que vale la asignación inicial de cuarteles al incendio (máximo del contrato: 30).
const DIAS_ASIGNACION = 29;

// Huella del polígono de Salta: keccak256 del GeoJSON con saltos de línea LF (igual en Windows y en Linux).
// El relayer firma esta misma huella en cada reporte y el contrato exige que sea la de la zona.
export function huellaPoligono() {
  const texto = readFileSync(resolve(raiz, "sample-data", "salta-provincia.geojson"), "utf8").replace(/\r\n/g, "\n");
  return keccak256(toUtf8Bytes(texto));
}

function cuentasLocales(provider) {
  // Frase pública de Hardhat: solo para el nodo local, no sirve en ninguna red real.
  const m = Mnemonic.fromPhrase("test test test test test test test test test test test junk");
  return Array.from({ length: 8 }, (_, i) => HDNodeWallet.fromMnemonic(m, `m/44'/60'/0'/0/${i}`).connect(provider));
}

async function main() {
  let provider, deployer, fed, tesoreria, o0, o1, cuartelA, cuartelB, entidad, donante, usdcAddr, chainId, explorer;

  if (red === "local") {
    provider = new JsonRpcProvider(process.env.RPC_URL ?? "http://127.0.0.1:8545", undefined, { cacheTimeout: -1 });
    const c = cuentasLocales(provider);
    [fed, tesoreria, o0, o1, cuartelA, cuartelB, entidad, donante] = c;
    deployer = fed;
    chainId = 31337;
    explorer = "";
  } else if (red === "fuji") {
    provider = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc", undefined, { cacheTimeout: -1 });
    const necesarias = ["DEPLOYER_PRIVATE_KEY", "TREASURY_ADDRESS", "ORACLE0_ADDRESS", "ORACLE1_ADDRESS", "CUARTEL_A_ADDRESS", "CUARTEL_B_ADDRESS", "ENTIDAD_ADDRESS"];
    const faltan = necesarias.filter((v) => !process.env[v]);
    if (faltan.length) throw new Error(`Faltan variables de entorno: ${faltan.join(", ")}`);
    deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const gas = await provider.getBalance(deployer.address);
    if (gas < parseUnits("0.2", 18)) {
      throw new Error(`El deployer ${deployer.address} tiene ${Number(gas) / 1e18} AVAX. Hacen falta 0,2 (deploy + 0,1 de gas para la federación).`);
    }
    if (process.env.FEDERATION_PRIVATE_KEY) {
      fed = new Wallet(process.env.FEDERATION_PRIVATE_KEY, provider);
      if (fed.address === deployer.address) throw new Error("La federación tiene que ser otra wallet, no la del deployer.");
    } else {
      console.warn("AVISO: sin FEDERATION_PRIVATE_KEY la federación es el deployer (roles juntos). Creala con scripts/crear-federacion.mjs.");
      fed = deployer;
    }
    tesoreria = { address: process.env.TREASURY_ADDRESS };
    o0 = { address: process.env.ORACLE0_ADDRESS };
    o1 = { address: process.env.ORACLE1_ADDRESS };
    cuartelA = { address: process.env.CUARTEL_A_ADDRESS };
    cuartelB = { address: process.env.CUARTEL_B_ADDRESS };
    entidad = { address: process.env.ENTIDAD_ADDRESS };
    chainId = 43113;
    explorer = "https://explorer-test.avax.network/c-chain";
    usdcAddr = process.env.USDC_ADDRESS ?? "0x5425890298aed601595a70AB815c96711a31Bc65"; // USDC nativo de Circle en Fuji
    const net = await provider.getNetwork();
    if (net.chainId !== 43113n) throw new Error(`chainId inesperado: ${net.chainId}`);
  } else {
    throw new Error("NETWORK debe ser local o fuji");
  }

  const fondoArt = artefacto("BrasaFund");
  let usdc;
  if (red === "local") {
    const mArt = artefacto("MockUSDC");
    usdc = await new ContractFactory(mArt.abi, mArt.bytecode, fed).deploy();
    await usdc.waitForDeployment();
    usdcAddr = await usdc.getAddress();
  }

  const fondo = await new ContractFactory(fondoArt.abi, fondoArt.bytecode, deployer).deploy(usdcAddr, tesoreria.address, COMISION_BPS, MINIMO, fed.address, o0.address, o1.address, DEMORA_CARNET, DEMORA_ORACULO);
  await fondo.waitForDeployment();
  const fondoAddr = await fondo.getAddress();
  const bloqueDeploy = (await fondo.deploymentTransaction().wait()).blockNumber;
  console.log("BrasaFund:", fondoAddr, "(bloque", bloqueDeploy + ")");

  // La federación necesita AVAX para el gas de crear la zona y dar los carnets.
  if (fed.address !== deployer.address && (await provider.getBalance(fed.address)) < parseUnits("0.05", 18)) {
    await (await deployer.sendTransaction({ to: fed.address, value: parseUnits("0.1", 18) })).wait();
    console.log("Mandé 0,1 AVAX de gas a la federación:", fed.address);
  }
  const fondoFed = fondo.connect(fed);
  const poligono = huellaPoligono();
  await (await fondoFed.createZone(ZONA, poligono, MIN_FOCOS, COOLDOWN, MAX_POR_EVENTO, COSTO.combate, COSTO.logistica, COSTO.asistencia)).wait();
  await (await fondoFed.addRecipient(encodeBytes32String("cuartel-a"), ZONA, 0, cuartelA.address)).wait();
  await (await fondoFed.addRecipient(encodeBytes32String("cuartel-b"), ZONA, 0, cuartelB.address)).wait();
  await (await fondoFed.addRecipient(encodeBytes32String("entidad-a"), ZONA, 1, entidad.address)).wait();
  // La federación asigna los dos cuarteles al incendio: en el v3 solo cobran los asignados.
  const hasta = (await provider.getBlock("latest")).timestamp + DIAS_ASIGNACION * 24 * 3600;
  await (await fondoFed.setResponders(ZONA, [encodeBytes32String("cuartel-a"), encodeBytes32String("cuartel-b")], hasta)).wait();
  console.log(`Cuarteles asignados al incendio hasta ${new Date(hasta * 1000).toISOString()}.`);
  const activos = new Date((Math.floor(Date.now() / 1000) + Number(DEMORA_CARNET)) * 1000);
  console.log(`Carnets dados. Cobran desde: ${activos.toISOString()} (demora pública de ${Number(DEMORA_CARNET) / 3600} h).`);

  if (red === "local") {
    // Un donante de prueba con fondos y una primera donación, para que la demo arranque con saldo.
    await (await usdc.mint(donante.address, U(50_000))).wait();
    await (await usdc.connect(donante).approve(fondoAddr, U(1_000_000))).wait();
    await (await fondo.connect(donante).donateToZone(ZONA, U(2_000), true)).wait();
    console.log("Donante de prueba (local):", donante.address);
  }

  const salida = {
    network: red,
    chainId,
    rpc: red === "local" ? (process.env.RPC_URL ?? "http://127.0.0.1:8545") : "https://api.avax-test.network/ext/bc/C/rpc",
    explorer,
    fund: fondoAddr,
    usdc: usdcAddr,
    zoneId: ZONA,
    zoneName: "Salta",
    feeBps: COMISION_BPS,
    version: 3,
    deployBlock: bloqueDeploy,
    polygonHash: poligono,
    federation: fed.address,
    recipientDelay: Number(DEMORA_CARNET),
    oracleDelay: Number(DEMORA_ORACULO),
    minDonation: Number(MINIMO) / 1e6,
    costPerHa: 400,
  };
  const destino = resolve(raiz, "web", "public", "deployment.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(salida, null, 2) + "\n");
  console.log("Escrito:", destino);
  if (red === "fuji") {
    // El v3 se escribe en un archivo aparte: la web publicada sigue en deployment.fuji.json (v2) hasta que
    // el v3 tenga su liberación en vivo. Pasar la web al v3 es copiar este archivo sobre deployment.fuji.json.
    const publico = resolve(raiz, "web", "public", "deployment.fuji-v3.json");
    writeFileSync(publico, JSON.stringify(salida, null, 2) + "\n");
    console.log("Escrito:", publico);
  }
}

// Solo despliega si se corre directo (así otros scripts pueden importar huellaPoligono).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => {
  console.error(String(e.shortMessage ?? e.message ?? e).slice(0, 400));
  process.exit(1);
});
