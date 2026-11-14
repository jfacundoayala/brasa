import { test } from "node:test";
import assert from "node:assert/strict";
import { MARCA, comentarioDeFirma, firmaMasNueva, motivoParaEsperar } from "../src/buzon-lib.mjs";

const firma = (sensor, observedAt) => ({
  version: 3,
  chainId: 43113,
  fondo: "0xAABcd03bCfEE730633E1Fd69756E1923Db50c72f",
  firmante: "0x0000000000000000000000000000000000000001",
  datosGuardados: false,
  reporte: { zoneId: "0x01", polygonHash: "0x02", sensor, hotspots: 3, observedAt: String(observedAt), dataTime: String(observedAt - 3600), dataHash: "0x03", nonce: "7" },
  firma: "0xabc",
});

test("buzón: el comentario publicado se vuelve a leer igual", () => {
  const f = firma(0, 1_800_000_000);
  const salida = JSON.stringify([{ user: { login: "grancobud" }, body: comentarioDeFirma(f, 0) }]);
  assert.deepEqual(firmaMasNueva(salida, 0), f);
});

test("buzón: toma la firma más nueva del sensor pedido e ignora el resto", () => {
  const vieja = firma(0, 1_800_000_000);
  const nueva = firma(0, 1_800_003_600);
  const otroSensor = firma(1, 1_800_009_000);
  const v1 = { ...firma(0, 1_800_099_999), version: 1 };
  // dos páginas pegadas, como devuelve gh --paginate, con comentarios sin marca y JSON roto
  const salida =
    JSON.stringify([{ user: { login: "grancobud" }, body: comentarioDeFirma(vieja, 0) }, { user: { login: "grancobud" }, body: "hola" }, { user: { login: "grancobud" }, body: `${MARCA}\n\`\`\`json\n{roto\n\`\`\`` }]) +
    JSON.stringify([{ user: { login: "grancobud" }, body: comentarioDeFirma(nueva, 0) }, { user: { login: "grancobud" }, body: comentarioDeFirma(otroSensor, 1) }, { user: { login: "grancobud" }, body: comentarioDeFirma(v1, 0) }]);
  assert.equal(firmaMasNueva(salida, 0).reporte.observedAt, String(1_800_003_600));
  assert.equal(firmaMasNueva(salida, 1).reporte.sensor, 1);
});

test("buzón: sin firmas o con salida inválida devuelve null", () => {
  assert.equal(firmaMasNueva("[]", 0), null);
  assert.equal(firmaMasNueva("no es json", 0), null);
});

test("buzón: respeta las ventanas del contrato (3 h entre firmas, menos de 6 h de antigüedad)", () => {
  const t = 1_800_000_000;
  assert.equal(motivoParaEsperar(firma(0, t), firma(1, t + 3600), t + 7200), null);
  assert.match(motivoParaEsperar(firma(0, t), firma(1, t + 3 * 3600 + 1), t + 4 * 3600), /3 h/);
  assert.match(motivoParaEsperar(firma(0, t), firma(1, t + 60), t + 6 * 3600), /vieja/);
});

test("buzón: ignora firmas de cuentas que no son del equipo, aunque sean más nuevas", () => {
  const buena = firma(1, 1_800_000_000);
  const trampa = firma(1, 9_999_999_999);
  const salida = JSON.stringify([
    { user: { login: "grancobud" }, body: comentarioDeFirma(buena, 1) },
    { user: { login: "alguien-externo" }, body: comentarioDeFirma(trampa, 1) },
    { body: comentarioDeFirma(trampa, 1) },
  ]);
  assert.equal(firmaMasNueva(salida, 1).reporte.observedAt, String(1_800_000_000));
  assert.equal(firmaMasNueva(salida, 1, { autores: ["otro"] }), null);
});

test("buzón: con firmante esperado descarta las firmas que dicen venir de otra dirección", () => {
  const f = firma(0, 1_800_000_000);
  const salida = JSON.stringify([{ user: { login: "jfacundoayala" }, body: comentarioDeFirma(f, 0) }]);
  assert.ok(firmaMasNueva(salida, 0, { firmanteEsperado: f.firmante.toUpperCase().replace("0X", "0x") }));
  assert.equal(firmaMasNueva(salida, 0, { firmanteEsperado: "0x0000000000000000000000000000000000000002" }), null);
});
