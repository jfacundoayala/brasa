import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparIncendios, nivelDe, distanciaKm } from "../src/incendios.mjs";

const f = (lat, lon, sensor = "noaa20", confianza = "high") => ({ lat, lon, sensor, confianza, fecha: "2026-11-11", hora: "1738" });

test("niveles: 1-2 focos es nivel 1, 3-7 nivel 2, 8 o más nivel 3", () => {
  assert.deepEqual([1, 2, 3, 7, 8, 30].map(nivelDe), [1, 1, 2, 2, 3, 3]);
});

test("la distancia de Salta a Jujuy es razonable (~ 100 km)", () => {
  const d = distanciaKm(-24.78, -65.41, -24.19, -65.3);
  assert.ok(d > 55 && d < 80, String(d));
});

test("focos a menos de 2 km se juntan en un incendio; los lejanos, no", () => {
  const r = agruparIncendios([f(-24.0, -64.0), f(-24.005, -64.0), f(-24.01, -64.0), f(-25.5, -63.0)]);
  assert.equal(r.length, 2);
  assert.equal(r[0].focos, 3);
  assert.equal(r[0].nivel, 2);
  assert.equal(r[0].areaHa, 42);
  assert.equal(r[1].focos, 1);
  assert.equal(r[1].nivel, 1);
});

test("solo cuentan focos de alta confianza", () => {
  const r = agruparIncendios([f(-24, -64), f(-24.001, -64, "noaa20", "low"), f(-24.002, -64, "noaa20", "nominal")]);
  assert.equal(r[0].focos, 1);
});

test("el mismo fuego visto por dos satélites no suma el doble, y queda confirmado", () => {
  const r = agruparIncendios([f(-24, -64, "noaa20"), f(-24.001, -64, "noaa20"), f(-24, -64.001, "noaa21"), f(-24.001, -64.001, "noaa21")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].focos, 2);
  assert.equal(r[0].confirmado, true);
});

test("un incendio visto por un solo sensor no está confirmado", () => {
  const r = agruparIncendios([f(-24, -64, "noaa20")]);
  assert.equal(r[0].confirmado, false);
});

test("MODIS confirma pero no suma hectáreas; un grupo solo de MODIS no aparece", () => {
  const r = agruparIncendios([f(-24, -64, "noaa20"), f(-24, -64, "modis"), f(-26, -62, "modis")]);
  assert.equal(r.length, 1);
  assert.equal(r[0].focos, 1);
  assert.equal(r[0].confirmado, true);
});
