import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Piso de cobertura de líneas (el lcov de Hardhat no trae ramas). No es 100 % porque BrasaFund.sol tiene dos
// defensas que ningún test puede alcanzar:
//  - acceptOracle, "los dos sensores nunca pueden quedar con la misma clave": proposeOracle ya rechaza esa clave
//    y solo hay una propuesta a la vez.
//  - quoteSplit, "fee > amount": con la comisión topeada en 5 % nunca supera el monto.
// Con esas dos el margen es de una sola línea más sin cubrir.
const minimum = 99;
const path = process.argv[2] ?? fileURLToPath(new URL("../coverage/lcov.info", import.meta.url));
let data;
try {
  data = readFileSync(path, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.error(`No existe ${path}: corré antes "npx hardhat test --coverage".`);
  process.exit(1);
}
const records = data.split("end_of_record").filter((record) => record.includes("SF:"));
let hit = 0;
let found = 0;
for (const record of records) {
  const lh = record.match(/^LH:(\d+)$/m);
  const lf = record.match(/^LF:(\d+)$/m);
  if (!lh || !lf || Number(lh[1]) > Number(lf[1])) throw new Error("LCOV inválido");
  hit += Number(lh[1]);
  found += Number(lf[1]);
}
if (found === 0) throw new Error("LCOV sin líneas");
const percent = (hit / found) * 100;
console.log(`Cobertura de líneas: ${hit}/${found} (${percent.toFixed(2)}%); mínimo ${minimum}% de líneas`);
if (percent < minimum) process.exitCode = 1;
