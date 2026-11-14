// Persistencia y regla de brasa sobre el producto estándar (NOAA-20 y NOAA-21), 1/8 al 29/10 de 2025.
import { resolve } from "node:path";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
// Uso: node --env-file=../.env.map analisis/persistencia.mjs <carpeta de caché> [desde AAAA-MM-DD] [bloques de 5 días]
// Necesita MAP_KEY (gratis en firms.modaps.eosdis.nasa.gov/api/map_key). No usa claves de oráculo.
const { parseCsv, dentroDeZona, esAltaConfianza, BBOX } = await import("../src/firms.mjs");
const { distanciaKm } = await import("../src/incendios.mjs");
const KEY = process.env.MAP_KEY;
const cache = resolve(process.argv[2] ?? ".", "cache-firms");
mkdirSync(cache, { recursive: true });
const desde = process.argv[3] ?? "2025-08-01";
const bloques = Number(process.argv[4] ?? 18);
async function bajar(fuente, fecha) {
  const f = resolve(cache, `${fuente}_${fecha}_5.csv`);
  if (existsSync(f)) return parseCsv(readFileSync(f, "utf8"));
  const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${fuente}/${BBOX.join(",")}/5/${fecha}`, { signal: AbortSignal.timeout(60000) });
  const t = await r.text();
  if (!r.ok || !t.startsWith("latitude")) { console.log(`  ${fuente} ${fecha}: sin datos (${r.status})`); return []; }
  writeFileSync(f, t);
  return parseCsv(t);
}
async function serie(fuente) {
  let filas = [];
  const d0 = new Date(desde + "T00:00:00Z");
  for (let i = 0; i < bloques; i++) filas = filas.concat(await bajar(fuente, new Date(d0.getTime() + i * 5 * 86400000).toISOString().slice(0, 10)));
  return filas.filter((f) => dentroDeZona(f));
}
const n20 = await serie("VIIRS_NOAA20_SP");
const n21 = await serie("VIIRS_NOAA21_SP");
console.log(`Periodo desde ${desde}, ${bloques * 5} días. NOAA-20: ${n20.length} (alta ${n20.filter(esAltaConfianza).length}) · NOAA-21: ${n21.length} (alta ${n21.filter(esAltaConfianza).length})`);
const tipos = (xs) => JSON.stringify(xs.reduce((a, f) => ((a[f.type] = (a[f.type] ?? 0) + 1), a), {}));
console.log("Tipos NOAA-21:", tipos(n21), "· noche/día NOAA-20:", JSON.stringify(n20.reduce((a, f) => ((a[f.daynight] = (a[f.daynight] ?? 0) + 1), a), {})));

// 1) Persistencia por lugar, todas las confianzas: una fuente fija aparece muchos días en la misma celda de ~1 km.
const celda = (f) => `${Number(f.latitude).toFixed(2)},${Number(f.longitude).toFixed(2)}`;
const P = {};
for (const f of [...n20, ...n21]) { const k = celda(f); (P[k] ??= { dias: new Set(), n: 0, altas: 0 }); P[k].dias.add(f.acq_date); P[k].n++; if (esAltaConfianza(f)) P[k].altas++; }
const orden = Object.entries(P).sort((a, b) => b[1].dias.size - a[1].dias.size);
console.log(`\nCeldas con detecciones: ${orden.length}. Con 10 días o más: ${orden.filter((x) => x[1].dias.size >= 10).length}. Con 5 a 9: ${orden.filter((x) => x[1].dias.size >= 5 && x[1].dias.size < 10).length}`);
console.log("Las 15 más persistentes (lat,lon: días distintos / detecciones / alta confianza):");
for (const [k, v] of orden.slice(0, 15)) console.log(`   ${k}: ${v.dias.size} / ${v.n} / ${v.altas}`);
const persistentes = new Set(orden.filter((x) => x[1].dias.size >= 10).map((x) => x[0]));

// 2) Regla de brasa por día: alta confianza, cruce a 2 km, mínimo 2 por satélite.
const dias = [...new Set([...n20, ...n21].map((f) => f.acq_date))].sort();
let dispara = 0, cruzTot = 0, cruzPersist = 0, soloPersist = 0;
const hist = [];
for (const d of dias) {
  const A = n20.filter((f) => f.acq_date === d && esAltaConfianza(f));
  const B = n21.filter((f) => f.acq_date === d && esAltaConfianza(f));
  const cerca = (p, xs) => xs.some((q) => distanciaKm(Number(p.latitude), Number(p.longitude), Number(q.latitude), Number(q.longitude)) <= 2);
  const ca = A.filter((p) => cerca(p, B)), cb = B.filter((p) => cerca(p, A));
  const ok = ca.length >= 2 && cb.length >= 2;
  if (ok) {
    dispara++;
    hist.push(Math.min(ca.length, cb.length));
    const enP = [...ca, ...cb].filter((f) => persistentes.has(celda(f))).length;
    cruzTot += ca.length + cb.length; cruzPersist += enP;
    const sinP = (xs) => xs.filter((f) => !persistentes.has(celda(f))).length;
    if (!(sinP(ca) >= 2 && sinP(cb) >= 2)) soloPersist++;
  }
}
hist.sort((a, b) => a - b);
console.log(`\nDías con datos: ${dias.length}. Días que cumplen la regla de brasa: ${dispara}.`);
console.log(`Focos cruzados en esos días: ${cruzTot}; en celdas persistentes (10 días o más): ${cruzPersist}.`);
console.log(`Días que solo cumplen la regla gracias a celdas persistentes: ${soloPersist}.`);
console.log(`Focos cruzados por día de disparo (el menor de los dos): mínimo ${hist[0]}, mediana ${hist[Math.floor(hist.length / 2)]}, máximo ${hist.at(-1)}.`);
// 3) Lugares conocidos: refinería de Campo Durán (aprox. -22.20, -63.66)
for (const [nombre, la, lo] of [["Campo Durán (refinería)", -22.2, -63.66], ["Ingenio El Tabacal", -23.25, -64.25], ["Ingenio San Isidro", -24.73, -65.03]]) {
  const cercaDe = [...n20, ...n21].filter((f) => distanciaKm(la, lo, Number(f.latitude), Number(f.longitude)) <= 5);
  console.log(`${nombre}: ${cercaDe.length} detecciones a menos de 5 km, ${new Set(cercaDe.map((f) => f.acq_date)).size} días, alta confianza ${cercaDe.filter(esAltaConfianza).length}`);
}
