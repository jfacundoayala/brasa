import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";
import { resumir, cargarCsvLocal, dentroDeZona, esAltaConfianza, cruzarSensores, huellaPoligono } from "../src/firms.mjs";
import { firmarReporte, nuevoNonce } from "../src/reporte.mjs";
import { ABI_V1, ABI_VERIFICACION, decodificarReportFire, eventoDelRecibo, verificarReportes } from "../src/verificar.mjs";

const muestras = resolve(dirname(fileURLToPath(import.meta.url)), "..", "sample-data");
const datos = cruzarSensores({
  noaa20: resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa20-salta.csv"))),
  noaa21: resumir(cargarCsvLocal(resolve(muestras, "firms-viirs-noaa21-salta.csv"))),
});
const FONDO = "0x000000000000000000000000000000000000dEaD";
const ZONA = "0x" + "11".repeat(32);
const POLIGONO = huellaPoligono();

async function calldata({ hash0 = datos.noaa20.dataHash, focos0 = datos.noaa20.confirmados, hora0 = datos.noaa20.ultimaDeteccionUtc, poligono = POLIGONO } = {}) {
  const o0 = Wallet.createRandom();
  const o1 = Wallet.createRandom();
  const nonce = nuevoNonce();
  const base = { chainId: 43113, fondo: FONDO, zoneId: ZONA, polygonHash: poligono, observedAt: 1_800_000_000, nonce };
  const a = await firmarReporte({ ...base, clave: o0.privateKey, sensor: 0, hotspots: focos0, dataTime: hora0, dataHash: hash0 });
  const b = await firmarReporte({
    ...base, clave: o1.privateKey, sensor: 1, hotspots: datos.noaa21.confirmados, dataTime: datos.noaa21.ultimaDeteccionUtc, dataHash: datos.noaa21.dataHash,
  });
  const data = ABI_VERIFICACION.encodeFunctionData("reportFire", [[a.reporte, b.reporte], [a.firma, b.firma]]);
  return { data, oraculos: [o0.address, o1.address] };
}

test("la huella se reproduce con la definición publicada, sin usar resumir()", () => {
  // Misma receta que en verificar.mjs: filas de alta confianza dentro de Salta, en orden, JSON sin espacios, SHA-256.
  const filas = cargarCsvLocal(resolve(muestras, "firms-viirs-noaa20-salta.csv"));
  const altas = filas.filter((f) => dentroDeZona(f) && esAltaConfianza(f));
  const huella = "0x" + createHash("sha256").update(JSON.stringify(altas)).digest("hex");
  assert.equal(huella, datos.noaa20.dataHash);
});

test("verificar-hash: un reportFire armado con los datos guardados coincide (huella, focos cruzados, hora y polígono)", async () => {
  const { data, oraculos } = await calldata();
  const reportes = decodificarReportFire(data);
  assert.equal(reportes.length, 2);
  const res = verificarReportes(reportes, datos, { chainId: 43113, fondo: FONDO });
  assert.ok(res.every((r) => r.ok));
  assert.deepEqual(res.map((r) => r.firmante), oraculos);
  assert.deepEqual(res.map((r) => r.focosCadena), [18, 14]);
});

test("verificar-hash: una huella cambiada no coincide", async () => {
  const { data } = await calldata({ hash0: "0x" + "ab".repeat(32) });
  const [r0, r1] = verificarReportes(decodificarReportFire(data), datos);
  assert.equal(r0.ok, false);
  assert.equal(r0.huellaOk, false);
  assert.equal(r1.ok, true);
});

test("verificar-hash: contar todos los focos en vez de los cruzados no coincide aunque la huella sea la real", async () => {
  const { data } = await calldata({ focos0: datos.noaa20.confirmados + 5 });
  const [r0] = verificarReportes(decodificarReportFire(data), datos);
  assert.equal(r0.huellaOk, true);
  assert.equal(r0.focosOk, false);
  assert.equal(r0.ok, false);
});

test("verificar-hash: una hora del dato inventada no coincide", async () => {
  const { data } = await calldata({ hora0: datos.noaa20.ultimaDeteccionUtc + 3600 });
  const [r0] = verificarReportes(decodificarReportFire(data), datos);
  assert.equal(r0.horaOk, false);
  assert.equal(r0.ok, false);
  // en la cadena local la hora es simulada y no se compara
  const [l0] = verificarReportes(decodificarReportFire(data), datos, { horaSimulada: true });
  assert.equal(l0.ok, true);
});

test("verificar-hash: otro polígono no coincide", async () => {
  const { data } = await calldata({ poligono: "0x" + "44".repeat(32) });
  const res = verificarReportes(decodificarReportFire(data), datos);
  assert.ok(res.every((r) => !r.poligonoOk && !r.ok));
});

test("verificar-hash: rechaza una transacción que no es reportFire", () => {
  assert.throws(() => decodificarReportFire("0xa9059cbb" + "00".repeat(64)), /no es una llamada a reportFire/);
  assert.throws(() => decodificarReportFire("0x"), /no es una llamada a reportFire/);
});

test("verificar-hash: lee las huellas y las horas del FireEvent e ignora logs de otros contratos", () => {
  const ev = ABI_VERIFICACION.getEvent("FireEvent");
  const { topics, data } = ABI_VERIFICACION.encodeEventLog(ev, [
    ZONA, 7, 14, 196, 39_200_000_000, 1_000_000, datos.noaa20.dataHash, datos.noaa21.dataHash, 1_799_000_000, 1_799_000_500,
  ]);
  const otro = { topics: ["0x" + "99".repeat(32)], data: "0x" };
  const e = eventoDelRecibo([otro, { topics, data }]);
  assert.equal(e.eventId, 7);
  assert.equal(e.dataHash0, datos.noaa20.dataHash);
  assert.equal(e.dataHash1, datos.noaa21.dataHash);
  assert.equal(e.dataTime0, 1_799_000_000);
  assert.equal(e.dataTime1, 1_799_000_500);
  assert.equal(eventoDelRecibo([otro]), null);
});

test("verificar-hash: un reportFire del contrato v1 (primera liberación) se lee y coincide con los datos guardados", () => {
  // Mismos valores que la tx 0x67f79d0e…caba0 de Fuji: huellas de sample-data y focos de alta confianza (18 y 26).
  const r = (sensor, d) => ({ zoneId: ZONA, sensor, hotspots: d.altaConfianza, observedAt: 1_794_000_000, dataHash: d.dataHash, nonce: 1n });
  const data = ABI_V1.encodeFunctionData("reportFire", [[r(0, datos.noaa20), r(1, datos.noaa21)], ["0x", "0x"]]);
  const reportes = decodificarReportFire(data);
  assert.deepEqual(reportes.map((x) => x.reporte.formato), ["v1", "v1"]);
  const res = verificarReportes(reportes, datos);
  assert.ok(res.every((x) => x.ok));
  assert.deepEqual(res.map((x) => x.focosCadena), [18, 26]);
  assert.equal(datos.noaa20.dataHash, "0xc04a666376add584c36d9f7708a7db13899fc462221009b1614b419ac46d6ba9");
  assert.equal(datos.noaa21.dataHash, "0x521385e262109b043b935bf952aeb79a4a92f1cf3f0379a259cb55205080bfe8");
});

test("verificar-hash: en un reporte v1 una huella cambiada no coincide", () => {
  const r = (sensor, d, hash = d.dataHash) => ({ zoneId: ZONA, sensor, hotspots: d.altaConfianza, observedAt: 1, dataHash: hash, nonce: 1n });
  const data = ABI_V1.encodeFunctionData("reportFire", [[r(0, datos.noaa20, "0x" + "ab".repeat(32)), r(1, datos.noaa21)], ["0x", "0x"]]);
  const [r0, r1] = verificarReportes(decodificarReportFire(data), datos);
  assert.equal(r0.ok, false);
  assert.equal(r1.ok, true);
});
