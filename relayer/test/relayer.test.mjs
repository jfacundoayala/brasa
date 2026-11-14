import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet, verifyTypedData } from "ethers";
import { parseCsv, esAltaConfianza, dentroDeZona, nivelConfianza, resumir, cargarCsvLocal, BBOX, enPoligono, cruzarSensores, huellaPoligono } from "../src/firms.mjs";
import { firmarReporte, nuevoNonce, TIPOS, dominio } from "../src/reporte.mjs";

const muestras = resolve(dirname(fileURLToPath(import.meta.url)), "..", "sample-data");

test("parseCsv lee cabecera y filas", () => {
  const f = parseCsv("latitude,longitude,confidence\n-24.1,-64.2,high\n");
  assert.deepEqual(f, [{ latitude: "-24.1", longitude: "-64.2", confidence: "high" }]);
});

test("alta confianza: VIIRS high y MODIS >= 80", () => {
  assert.equal(esAltaConfianza({ confidence: "high" }), true);
  assert.equal(esAltaConfianza({ confidence: "nominal" }), false);
  assert.equal(esAltaConfianza({ confidence: "low" }), false);
  assert.equal(esAltaConfianza({ confidence: "80" }), true);
  assert.equal(esAltaConfianza({ confidence: "79" }), false);
  assert.equal(nivelConfianza({ confidence: "100" }), "high");
});

test("la zona es un rectángulo sobre Salta", () => {
  assert.equal(dentroDeZona({ latitude: "-24.78", longitude: "-65.41" }), true);
  assert.equal(dentroDeZona({ latitude: "-34.6", longitude: "-58.4" }), false); // Buenos Aires
  assert.equal(BBOX.length, 4);
});

test("los datos reales guardados tienen focos y una huella estable", () => {
  const r1 = resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa20-salta.csv")));
  const r2 = resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa20-salta.csv")));
  assert.ok(r1.total > 0 && r1.altaConfianza > 0 && r1.altaConfianza <= r1.total);
  assert.equal(r1.dataHash, r2.dataHash);
  assert.match(r1.dataHash, /^0x[0-9a-f]{64}$/);
});

test("el reporte firmado se recupera al firmante correcto y no vale con otro dominio", async () => {
  const w = Wallet.createRandom();
  const fondo = "0x000000000000000000000000000000000000dEaD";
  const base = { clave: w.privateKey, chainId: 43113, fondo, zoneId: "0x" + "11".repeat(32), polygonHash: "0x" + "33".repeat(32), sensor: 0, hotspots: 22, observedAt: 1_800_000_000, dataTime: 1_799_990_000, dataHash: "0x" + "22".repeat(32), nonce: nuevoNonce() };
  const { reporte, firma, firmante } = await firmarReporte(base);
  assert.equal(firmante, w.address);
  assert.equal(verifyTypedData(dominio(43113, fondo), TIPOS, reporte, firma), w.address);
  assert.notEqual(verifyTypedData(dominio(1, fondo), TIPOS, reporte, firma), w.address); // otra cadena
});

test("los nonces no se repiten", () => {
  const s = new Set(Array.from({ length: 500 }, () => nuevoNonce()));
  assert.equal(s.size, 500);
});

test("el polígono de Salta deja afuera puntos del rectángulo que son de otros países y provincias", () => {
  assert.equal(enPoligono(-65.41, -24.78), true); // Salta capital
  assert.equal(enPoligono(-65.3, -24.19), false); // San Salvador de Jujuy, dentro del rectángulo
  assert.equal(enPoligono(-62.5, -26.0), false); // Chaco/Formosa, dentro del rectángulo
  assert.equal(enPoligono(-65.3, -26.8), false); // Tucumán
});

test("firmar corta con error si los focos no entran en el reporte (antes se recortaban en silencio)", async () => {
  const w = Wallet.createRandom();
  const base = { clave: w.privateKey, chainId: 43113, fondo: "0x000000000000000000000000000000000000dEaD", zoneId: "0x" + "11".repeat(32), polygonHash: "0x" + "33".repeat(32), sensor: 0, observedAt: 1_800_000_000, dataTime: 1_799_990_000, dataHash: "0x" + "22".repeat(32), nonce: 1n };
  await assert.rejects(firmarReporte({ ...base, hotspots: 65536 }), /fuera de rango/);
  await assert.rejects(firmarReporte({ ...base, hotspots: -1 }), /fuera de rango/);
  const borde = await firmarReporte({ ...base, hotspots: 65535 });
  assert.equal(borde.reporte.hotspots, 65535);
  await assert.rejects(firmarReporte({ ...base, hotspots: 5, dataTime: 1_800_000_100 }), /posterior/);
});

test("cruce de satélites con los datos guardados: NOAA-20 18 de 18 y NOAA-21 14 de 26 (el mismo fuego a menos de 2 km)", () => {
  const d = cruzarSensores({
    noaa20: resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa20-salta.csv"))),
    noaa21: resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa21-salta.csv"))),
  });
  assert.equal(d.noaa20.altaConfianza, 18);
  assert.equal(d.noaa20.confirmados, 18);
  assert.equal(d.noaa21.altaConfianza, 26);
  assert.equal(d.noaa21.confirmados, 14);
});

test("cruce: un foco solo, lejos de todo, no cuenta", () => {
  const foco = (lat, lon) => ({ latitude: String(lat), longitude: String(lon), confidence: "high" });
  const d = cruzarSensores({
    noaa20: { focos: [foco(-24.0, -64.0), foco(-25.0, -65.0)] },
    noaa21: { focos: [foco(-24.005, -64.005)] }, // a ~0,7 km del primero
  });
  assert.equal(d.noaa20.confirmados, 1);
  assert.equal(d.noaa21.confirmados, 1);
});

test("la huella del polígono no depende de los saltos de línea del sistema", () => {
  assert.match(huellaPoligono(), /^0x[0-9a-f]{64}$/);
  assert.equal(huellaPoligono(), huellaPoligono());
});
