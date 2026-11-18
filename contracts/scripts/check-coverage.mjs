import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const minimum = 99;
const path = process.argv[2] ?? fileURLToPath(new URL("../coverage/lcov.info", import.meta.url));
const data = readFileSync(path, "utf8");
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
console.log(`Cobertura de líneas: ${hit}/${found} (${percent.toFixed(2)}%); mínimo ${minimum}%`);
if (percent < minimum) process.exitCode = 1;
