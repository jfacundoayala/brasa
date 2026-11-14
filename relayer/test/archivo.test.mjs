import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SENSORES, SENSOR_EXTRA, cargarCsvLocal, parseCsv, resumir } from "../src/firms.mjs";
import { guardarDatosDelReporte, sello } from "../src/archivo.mjs";

const muestras = resolve(dirname(fileURLToPath(import.meta.url)), "..", "sample-data");
const sensores = [...SENSORES, SENSOR_EXTRA];

test("la copia guardada reproduce exactamente la misma huella", () => {
  const crudos = {}, datos = {};
  for (const s of sensores) {
    crudos[s.clave] = readFileSync(resolve(muestras, s.archivo), "utf8"); // como si hubiera llegado de la API
    datos[s.clave] = resumir(parseCsv(crudos[s.clave]));
  }
  const base = mkdtempSync(resolve(tmpdir(), "brasa-"));
  const carpeta = guardarDatosDelReporte(base, sello(new Date("2026-11-12T03:15:00.123Z")), sensores, crudos, datos);
  assert.ok(carpeta.endsWith("2026-11-12T03-15-00Z"), "el nombre no tiene ':' (Windows)");
  for (const s of sensores) {
    const rehecha = resumir(cargarCsvLocal(resolve(carpeta, s.archivo)));
    assert.equal(rehecha.dataHash, datos[s.clave].dataHash, s.nombre);
  }
  const h = JSON.parse(readFileSync(resolve(carpeta, "huellas.json"), "utf8"));
  assert.equal(h.huellas.noaa20.dataHash, datos.noaa20.dataHash);
  assert.equal(readdirSync(carpeta).length, sensores.length + 1);
});
