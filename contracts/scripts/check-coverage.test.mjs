import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("./check-coverage.mjs", import.meta.url));

for (const [nombre, data, status, output] of [
  ["acepta el umbral exacto", "SF:a.sol\nLH:99\nLF:100\nend_of_record\n", 0, /99.00%/],
  ["suma líneas sin promediar porcentajes", "SF:a.sol\nLH:1\nLF:1\nend_of_record\nSF:b.sol\nLH:97\nLF:99\nend_of_record\n", 1, /98.00%/],
  ["rechaza datos vacíos", "", 1, /LCOV sin líneas/],
  ["rechaza datos incompletos", "SF:a.sol\nLF:100\nend_of_record\n", 1, /LCOV inválido/],
  ["rechaza contadores inconsistentes", "SF:a.sol\nLH:101\nLF:100\nend_of_record\n", 1, /LCOV inválido/],
  ["avisa qué correr si falta el archivo", null, 1, /^No existe .*lcov\.info: corré antes "npx hardhat test --coverage"\.\s*$/],
]) {
  test(nombre, () => {
    const dir = mkdtempSync(join(tmpdir(), "brasa-coverage-"));
    try {
      const path = join(dir, "lcov.info");
      if (data !== null) writeFileSync(path, data);
      const result = spawnSync(process.execPath, [script, path], { encoding: "utf8" });
      assert.equal(result.status, status);
      assert.match(result.stdout + result.stderr, output);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
