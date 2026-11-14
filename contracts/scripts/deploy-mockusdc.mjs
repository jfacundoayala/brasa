// PLAN B: si el faucet de Circle no da USDC a tiempo, despliega un USDC de PRUEBA en Fuji y le da saldo a una wallet.
// USDC de prueba propio, no el de Circle. No usar nunca fuera de testnet.
//
//   export DEPLOYER_PRIVATE_KEY=…   (desde .env.local)
//   DONOR_ADDRESS=0x… node scripts/deploy-mockusdc.mjs          (DONOR_ADDRESS opcional; por defecto, el deployer)
//   Después:  USDC_ADDRESS=<la dirección impresa> NETWORK=fuji node scripts/deploy.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ContractFactory, JsonRpcProvider, Wallet, parseUnits } from "ethers";

const aqui = dirname(fileURLToPath(import.meta.url));
const art = JSON.parse(readFileSync(resolve(aqui, "..", "artifacts", "contracts", "MockUSDC.sol", "MockUSDC.json"), "utf8"));

if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("Falta DEPLOYER_PRIVATE_KEY en el entorno (de tu .env.local).");
const provider = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc", undefined, { cacheTimeout: -1 });
const red = await provider.getNetwork();
if (red.chainId !== 43113n) throw new Error(`chainId inesperado: ${red.chainId}`);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const donante = process.env.DONOR_ADDRESS ?? deployer.address;

const usdc = await new ContractFactory(art.abi, art.bytecode, deployer).deploy();
await usdc.waitForDeployment();
const dir = await usdc.getAddress();
await (await usdc.mint(donante, parseUnits("1000000", 6))).wait();
console.log("MockUSDC (solo testnet):", dir);
console.log("Saldo de prueba (1.000.000) para:", donante);
console.log(`Siguiente: USDC_ADDRESS=${dir} NETWORK=fuji node scripts/deploy.mjs`);
