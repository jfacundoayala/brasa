import { test } from "node:test";
import assert from "node:assert/strict";
import { meta, tabla, BASE } from "../src/sensibilidad.mjs";

test("la meta base coincide con la regla del contrato: 14 focos x 14 ha x 320 USD = 62.720", () => {
  assert.equal(meta(14), 62720);
});

test("si el costo real es la mitad, la meta baja a la mitad; si es el doble, sube al doble", () => {
  assert.equal(meta(14, 0.5), 31360);
  assert.equal(meta(14, 2), 125440);
});

test("la tabla suma los incendios por escenario", () => {
  const t = tabla([{ id: 1, nivel: 1, focos: 2 }, { id: 2, nivel: 2, focos: 4 }]);
  assert.deepEqual(t.total, [Math.round(6 * 14 * 320 * 0.5), 6 * 14 * 320, Math.round(6 * 14 * 320 * 1.5), 6 * 14 * 320 * 2]);
  assert.equal(BASE.combate + BASE.logistica + BASE.asistencia, 320);
});
