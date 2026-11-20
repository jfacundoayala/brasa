import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { armarMascara, motivoFija, sinFuentesFijas, unoPorPixel, agrupar, incendioMayor, claveCelda, leerUsoDelSuelo, cultivoEn, sinCultivos, contarPorCapas, cargarMapas } from "../src/capas.mjs";
import { cargarCsvLocal, resumir, SENSORES } from "../src/firms.mjs";
import { medirAnio, medirMascara } from "../src/retroprueba.mjs";

const fila = (lat, lon, fecha, type = 0) => ({ latitude: String(lat), longitude: String(lon), acq_date: fecha, type: String(type) });
const foco = (lat, lon, sensor = "noaa20", extra = {}) => ({ lat, lon, sensor, fecha: "2026-09-01", dn: "N", ...extra });

test("la celda de un punto es estable y separa puntos lejanos", () => {
  assert.equal(claveCelda(-24.7812, -65.4101), claveCelda(-24.7819, -65.4109));
  assert.notEqual(claveCelda(-24.78, -65.41), claveCelda(-24.80, -65.41));
});

test("marca como etiquetada la celda donde la mayoría de las detecciones son fuentes fijas", () => {
  const filas = [fila(-24.5, -65.0, "2020-01-01", 2), fila(-24.5, -65.0, "2020-02-01", 2), fila(-24.5, -65.0, "2021-03-01", 2), fila(-24.5, -65.0, "2021-03-02", 0)];
  const m = armarMascara(filas);
  assert.equal(motivoFija(m, -24.5, -65.0), "etiquetada");
  assert.equal(motivoFija(m, -24.6, -65.0), undefined);
});

test("no marca una celda con pocas detecciones fijas o donde son minoría", () => {
  const pocas = armarMascara([fila(-24.5, -65.0, "2020-01-01", 2), fila(-24.5, -65.0, "2020-02-01", 2)]);
  assert.equal(motivoFija(pocas, -24.5, -65.0), undefined);
  const minoria = armarMascara([...Array(3).fill(fila(-24.5, -65.0, "2020-01-01", 2)), ...Array(4).fill(fila(-24.5, -65.0, "2020-01-02", 0))]);
  assert.equal(motivoFija(minoria, -24.5, -65.0), undefined);
});

test("marca como persistente la celda que arde muchos días, años y meses distintos", () => {
  const filas = [];
  for (let anio = 2014; anio < 2020; anio++) {
    for (let mes = 1; mes <= 8; mes++) filas.push(fila(-23.1, -64.3, `${anio}-${String(mes).padStart(2, "0")}-10`));
  }
  assert.equal(motivoFija(armarMascara(filas), -23.1, -64.3), "persistente");
});

test("un incendio de una sola temporada no queda marcado, aunque dure un mes", () => {
  const filas = [];
  for (let dia = 1; dia <= 30; dia++) filas.push(fila(-23.1, -64.3, `2022-09-${String(dia).padStart(2, "0")}`));
  assert.equal(motivoFija(armarMascara(filas), -23.1, -64.3), undefined);
});

test("saca los focos que caen en fuentes fijas y deja el resto", () => {
  const m = { celdas: { [claveCelda(-24.5, -65.0)]: "etiquetada" } };
  const focos = [foco(-24.5, -65.0), foco(-24.9, -65.0)];
  assert.deepEqual(sinFuentesFijas(focos, m), [focos[1]]);
  assert.equal(sinFuentesFijas(focos, undefined).length, 2);
});

test("el mismo píxel en la misma pasada cuenta una vez, y en otra pasada o sensor cuenta aparte", () => {
  const focos = [foco(-24.501, -65.001), foco(-24.5011, -65.0011), foco(-24.501, -65.001, "noaa20", { dn: "D" }), foco(-24.501, -65.001, "noaa21")];
  assert.equal(unoPorPixel(focos).length, 3);
});

test("agrupa por encadenamiento y separa lo que está lejos", () => {
  // Tres focos en cadena, cada uno a 1,5 km del anterior, y uno a 30 km.
  const focos = [foco(-24.5, -65.0), foco(-24.5135, -65.0), foco(-24.527, -65.0), foco(-24.8, -65.0)];
  const grupos = agrupar(focos).map((g) => g.length).sort();
  assert.deepEqual(grupos, [1, 3]);
});

test("agrupa igual que comparar todos contra todos", () => {
  let semilla = 7;
  const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  const focos = Array.from({ length: 300 }, () => foco(-24 - azar() * 0.3, -64 - azar() * 0.3));
  const tamanios = (gs) => gs.map((g) => g.length).sort((a, b) => a - b);
  // Con un radio enorme la grilla no ayuda: sirve de referencia.
  const lento = agrupar(focos, 2);
  const padre = focos.map((_, i) => i);
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const R = 6371;
  const dist = (a, b) => {
    const r = Math.PI / 180;
    const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
  };
  for (let i = 0; i < focos.length; i++) for (let j = i + 1; j < focos.length; j++) if (dist(focos[i], focos[j]) <= 2) padre[raiz(i)] = raiz(j);
  const cuenta = new Map();
  focos.forEach((_, i) => cuenta.set(raiz(i), (cuenta.get(raiz(i)) ?? 0) + 1));
  assert.deepEqual(tamanios(lento), [...cuenta.values()].sort((a, b) => a - b));
});

test("tres quemas sueltas no suman: cuenta el incendio más grande", () => {
  const sueltas = [foco(-24.1, -65.0), foco(-24.5, -65.0), foco(-24.9, -65.0)];
  assert.equal(incendioMayor(sueltas, ["noaa20"]).focos, 1);
});

test("con dos sensores gana el incendio que ven los dos, y se informa el menor conteo", () => {
  const focos = [
    // Incendio A: 5 focos de un satélite, ninguno del otro.
    ...[0, 1, 2, 3, 4].map((i) => foco(-24.1, -65.0 + i * 0.005, "noaa20")),
    // Incendio B: 3 de uno y 4 del otro.
    ...[0, 1, 2].map((i) => foco(-24.9, -65.0 + i * 0.005, "noaa20")),
    ...[0, 1, 2, 3].map((i) => foco(-24.905, -65.0 + i * 0.005, "noaa21")),
  ];
  const r = incendioMayor(focos, ["noaa20", "noaa21"]);
  assert.equal(r.focos, 3);
  assert.deepEqual(r.conteo, { noaa20: 3, noaa21: 4 });
  assert.ok(Math.abs(r.lat - -24.9) < 0.01);
});

test("sin focos no hay incendio", () => {
  assert.equal(incendioMayor([], ["noaa20", "noaa21"]), null);
});

test("la prueba histórica separa días por zona, por incendio y con persistencia", () => {
  const alta = (lat, lon, fecha) => ({ latitude: String(lat), longitude: String(lon), acq_date: fecha, confidence: "h", daynight: "N", type: "0" });
  const filas = [
    // Día 1: tres quemas sueltas. Paga con la regla anterior, no por incendio.
    alta(-24.1, -64.5, "2020-09-01"), alta(-24.5, -64.5, "2020-09-01"), alta(-24.9, -64.5, "2020-09-01"),
    // Días 2 y 3: un incendio de 3 focos que sigue en el mismo lugar.
    ...["2020-09-02", "2020-09-03"].flatMap((d) => [0, 1, 2].map((i) => alta(-24.5, -64.5 + i * 0.005, d))),
  ];
  const r = medirAnio(filas, undefined);
  assert.equal(r.diasAntes, 3);
  assert.equal(r.diasPorIncendio, 2);
  assert.equal(r.diasPersistentes, 1);
});

test("mide el acierto del mapa de fuentes fijas contra la marca real", () => {
  const m = { celdas: { [claveCelda(-24.5, -65.0)]: "etiquetada" } };
  const r = medirMascara([fila(-24.5, -65.0, "2025-01-01", 2), fila(-24.9, -65.0, "2025-01-01", 2), fila(-24.5, -65.0, "2025-01-02", 0), fila(-24.2, -65.0, "2025-01-02", 0)], m);
  assert.deepEqual(r, { fijas: 2, fijasTapadas: 1, vegetacion: 2, vegetacionTapada: 1 });
});

// Grilla de prueba de 2 x 2 celdas con origen en -24,51 / -65,01: la fila de abajo va primero.
const grilla = (bytes) => leerUsoDelSuelo({ celda: 0.01, origen: { fila: -2451, columna: -6501 }, filas: 2, columnas: 2, anio: 2021, datos: gzipSync(Buffer.from(bytes)).toString("base64") });

test("lee el porcentaje de cultivo de la celda donde cae el punto", () => {
  const s = grilla([80, 10, 255, 50]);
  assert.equal(cultivoEn(s, -24.505, -65.005), 80);
  assert.equal(cultivoEn(s, -24.505, -64.995), 10);
  assert.equal(cultivoEn(s, -24.495, -64.995), 50);
  assert.equal(cultivoEn(s, -24.495, -65.005), undefined); // sin dato
  assert.equal(cultivoEn(s, -24.6, -65.005), undefined); // fuera del mapa
  assert.equal(cultivoEn(undefined, -24.505, -65.005), undefined);
});

test("saca los focos sobre cultivos y deja los que no tienen dato", () => {
  const s = grilla([80, 10, 255, 50]);
  const focos = [foco(-24.505, -65.005), foco(-24.505, -64.995), foco(-24.495, -65.005), foco(-24.495, -64.995), foco(-24.6, -65.005)];
  assert.deepEqual(sinCultivos(focos, s), [focos[1], focos[2], focos[4]]);
  assert.equal(sinCultivos(focos, undefined).length, 5);
  assert.equal(sinCultivos(focos, s, 90).length, 5);
});

test("rechaza una grilla que no coincide con su tamaño", () => {
  assert.throws(() => leerUsoDelSuelo({ celda: 0.01, origen: { fila: 0, columna: 0 }, filas: 2, columnas: 2, datos: gzipSync(Buffer.from([1, 2, 3])).toString("base64") }));
});

test("la grilla de Salta guardada cubre la provincia y marca los campos del este", () => {
  const s = leerUsoDelSuelo(JSON.parse(readFileSync(new URL("../sample-data/uso-del-suelo-salta.json", import.meta.url), "utf8")));
  assert.equal(s.pct.length, 440 * 630);
  assert.ok(cultivoEn(s, -24.75, -64.05) >= 50); // campos al este de Las Lajitas
  assert.ok(cultivoEn(s, -22.5, -64.7) < 5); // selva de Baritú
});

test("la prueba histórica cuenta aparte los incendios fuera de cultivo", () => {
  const alta = (lat, lon, fecha) => ({ latitude: String(lat), longitude: String(lon), acq_date: fecha, confidence: "h", daynight: "N", type: "0" });
  const s = grilla([80, 10, 255, 50]);
  const filas = [
    // Día 1: tres focos en la celda de cultivo. Día 2: tres focos en la celda de monte.
    ...[0, 1, 2].map((i) => alta(-24.505, -65.009 + i * 0.004, "2020-09-01")),
    ...[0, 1, 2].map((i) => alta(-24.505, -64.999 + i * 0.004, "2020-09-02")),
  ];
  const r = medirAnio(filas, undefined, s);
  assert.equal(r.diasPorIncendio, 2);
  assert.equal(r.diasFueraDeCultivo, 1);
  assert.equal(r.enCultivo, 3);
  assert.deepEqual(r.eventos.map((e) => e.enCultivo), [3, 0]);
});

const filaViva = (lat, lon, hora = "0530", confianza = "high", fecha = "2026-11-10") => ({ latitude: String(lat), longitude: String(lon), acq_date: fecha, acq_time: hora, confidence: confianza });

test("el conteo por capas reporta el incendio que ven los dos satélites, no la suma de la provincia", () => {
  const datos = {
    // NOAA-20: 4 focos en el incendio A, 2 sueltos lejos y 1 de confianza nominal que no cuenta.
    noaa20: { focos: [...[0, 1, 2, 3].map((i) => filaViva(-24.6, -64.5 + i * 0.005)), filaViva(-23.1, -64.5), filaViva(-25.9, -64.5), filaViva(-24.6, -64.48, "0530", "nominal")] },
    // NOAA-21: 3 focos en el incendio A y 5 en otro lugar que NOAA-20 no vio.
    noaa21: { focos: [...[0, 1, 2].map((i) => filaViva(-24.603, -64.5 + i * 0.005, "0620")), ...[0, 1, 2, 3, 4].map((i) => filaViva(-22.5, -64.5 + i * 0.005, "0620"))] },
  };
  const r = contarPorCapas(datos, ["noaa20", "noaa21"], { diasMin: 1 });
  assert.equal(datos.noaa20.incendio, 4);
  assert.equal(datos.noaa21.incendio, 3);
  assert.deepEqual(r.porSensor.noaa20, { altaConfianza: 6, sinFuentesFijas: 6, fueraDeCultivo: 6, enIncendio: 4 });
  assert.equal(r.incendio.focos, 3);
  assert.equal(r.incendio.pasadas, 2);
});

test("el mismo píxel visto en dos pasadas cuenta una vez por satélite", () => {
  const datos = {
    noaa20: { focos: [filaViva(-24.6, -64.5, "0530"), filaViva(-24.6, -64.5, "1730"), filaViva(-24.6, -64.495, "0530")] },
    noaa21: { focos: [filaViva(-24.6, -64.5, "0620"), filaViva(-24.6, -64.495, "0620")] },
  };
  const r = contarPorCapas(datos, ["noaa20", "noaa21"], { diasMin: 1 });
  assert.equal(datos.noaa20.incendio, 2);
  assert.equal(r.incendio.pasadas, 3);
});

test("un incendio sobre cultivo o que ve un solo satélite no se reporta", () => {
  const s = grilla([80, 10, 255, 50]);
  const enCultivo = { noaa20: { focos: [0, 1].map((i) => filaViva(-24.505, -65.009 + i * 0.004)) }, noaa21: { focos: [0, 1].map((i) => filaViva(-24.505, -65.009 + i * 0.004)) } };
  const r = contarPorCapas(enCultivo, ["noaa20", "noaa21"], { suelo: s, diasMin: 1 });
  assert.equal(enCultivo.noaa20.incendio, 0);
  assert.equal(r.incendio, null);
  const unoSolo = { noaa20: { focos: [0, 1, 2].map((i) => filaViva(-24.6, -64.5 + i * 0.005)) }, noaa21: { focos: [] } };
  assert.equal(contarPorCapas(unoSolo, ["noaa20", "noaa21"], { diasMin: 1 }).incendio, null);
  assert.equal(unoSolo.noaa20.incendio, 0);
});

test("con los datos guardados de Salta el conteo por capas es menor que el cruce simple", () => {
  const carpeta = new URL("../sample-data/", import.meta.url);
  const datos = Object.fromEntries(SENSORES.map((x) => [x.clave, resumir(cargarCsvLocal(new URL(x.archivo, carpeta)))]));
  const mapas = cargarMapas(carpeta);
  const r = contarPorCapas(datos, SENSORES.map((x) => x.clave), { ...mapas, diasMin: 1 });
  assert.equal(datos.noaa20.incendio, 14);
  assert.equal(datos.noaa21.incendio, 7);
  assert.equal(r.porSensor.noaa21.fueraDeCultivo, 24);
  // Con la regla vigente (dos días) ese incendio queda en espera: los datos guardados lo ven un solo día.
  const conEspera = contarPorCapas(datos, SENSORES.map((x) => x.clave), mapas);
  assert.equal(conEspera.incendio, null);
  assert.equal(conEspera.enEspera.focos, 7);
  assert.equal(datos.noaa20.incendio, 0);
  assert.match(mapas.huellas.usoDelSuelo, /^0x[0-9a-f]{64}$/);
});

test("persistencia: un incendio visto un solo día queda en espera y uno más chico que persiste se reporta", () => {
  const dia2 = (lat, lon, hora) => filaViva(lat, lon, hora, "high", "2026-11-11");
  const datos = {
    noaa20: { focos: [
      // Incendio nuevo: 5 focos, solo hoy.
      ...[0, 1, 2, 3, 4].map((i) => dia2(-24.6, -64.5 + i * 0.005, "0530")),
      // Incendio que sigue: 3 focos ayer y los mismos 3 hoy.
      ...[0, 1, 2].flatMap((i) => [filaViva(-23.2, -64.5 + i * 0.005), dia2(-23.2, -64.5 + i * 0.005, "0530")]),
    ] },
    noaa21: { focos: [
      ...[0, 1, 2, 3, 4].map((i) => dia2(-24.603, -64.5 + i * 0.005, "0620")),
      ...[0, 1, 2].map((i) => filaViva(-23.203, -64.5 + i * 0.005, "0620")),
    ] },
  };
  const r = contarPorCapas(datos, ["noaa20", "noaa21"]);
  assert.equal(datos.noaa20.incendio, 3);
  assert.equal(datos.noaa21.incendio, 3);
  assert.equal(r.incendio.dias, 2);
  assert.equal(r.enEspera.focos, 5);
  assert.equal(r.enEspera.dias, 1);
});
