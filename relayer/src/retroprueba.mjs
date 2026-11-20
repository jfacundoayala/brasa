// Prueba de las capas de detección sobre temporadas pasadas.
//
//   node src/retroprueba.mjs --datos <carpeta con viirs-snpp_AAAA_Argentina.csv> [--mascara salida.json] [--suelo grilla.json]
//
// Los CSV son el historial público por país de NASA FIRMS:
//   https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/AAAA/viirs-snpp_AAAA_Argentina.csv
//
// Qué mide, y qué no:
//   - El historial es de UN satélite (Suomi NPP). No mide la regla de los dos satélites.
//   - Cuenta por día (UTC), no por la ventana de 48 h que usa el oráculo en vivo.
//   - El mapa de uso del suelo es de 2021: un campo abierto después no figura como cultivo, y un
//     monte desmontado antes de 2021 figura como cultivo aunque el fuego haya sido el desmonte.
//   - No hay una lista de incendios reales contra la que comparar: muestra cuánto filtra cada
//     capa y deja a la vista los mayores eventos para revisarlos con bomberos.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv, dentroDeZona, esAltaConfianza } from "./firms.mjs";
import { armarMascara, motivoFija, agrupar, unoPorPixel, sinCultivos, leerUsoDelSuelo } from "./capas.mjs";
import { distanciaKm, RADIO_KM, HA_POR_FOCO } from "./incendios.mjs";

export const FOCOS_MINIMOS = 3; // igual que la zona de la demo

/** Lee los CSV anuales y deja solo los focos dentro de la provincia. */
export function leerHistorial(carpeta) {
  const porAnio = {};
  for (const nombre of readdirSync(carpeta).sort()) {
    const m = /^viirs-snpp_(\d{4})_Argentina\.csv$/.exec(nombre);
    if (!m) continue;
    porAnio[m[1]] = parseCsv(readFileSync(resolve(carpeta, nombre), "utf8")).filter((f) => dentroDeZona(f));
  }
  return porAnio;
}

const aFoco = (f) => ({ lat: Number(f.latitude), lon: Number(f.longitude), sensor: "snpp", fecha: f.acq_date, dn: f.daynight });

/**
 * Para un año: días que habrían pagado con la regla anterior (3 focos de alta confianza en
 * toda la provincia) y con cada capa nueva sumada. `suelo` es la grilla de uso del suelo (opcional).
 */
export function medirAnio(filas, mascara, suelo) {
  const altas = filas.filter(esAltaConfianza);
  const porDia = new Map();
  for (const f of altas) {
    if (!porDia.has(f.acq_date)) porDia.set(f.acq_date, []);
    porDia.get(f.acq_date).push(f);
  }
  const r = {
    focos: filas.length, altas: altas.length, enFijas: 0, enCultivo: 0,
    diasAntes: 0, diasSinFijas: 0, diasPorIncendio: 0, diasPersistentes: 0,
    diasFueraDeCultivo: 0, diasFueraDeCultivoPersistentes: 0, eventos: [],
  };
  const grande = (g) => g.length >= FOCOS_MINIMOS;
  const cerca = (g, h) => g.some((f) => h.some((x) => distanciaKm(f.lat, f.lon, x.lat, x.lon) <= RADIO_KM));
  const incendios = (focos) => agrupar(unoPorPixel(focos.map(aFoco))).filter(grande).sort((x, y) => y.length - x.length);
  // Persistencia: el día anterior ya había un incendio de 3 focos o más a menos de 2 km.
  let ayer = [];
  let ayerFuera = [];
  let fechaAyer = "";
  for (const fecha of [...porDia.keys()].sort()) {
    const delDia = porDia.get(fecha);
    const limpios = delDia.filter((f) => !motivoFija(mascara, f.latitude, f.longitude));
    const fuera = sinCultivos(limpios, suelo);
    r.enFijas += delDia.length - limpios.length;
    r.enCultivo += limpios.length - fuera.length;
    if (delDia.length >= FOCOS_MINIMOS) r.diasAntes++;
    if (limpios.length >= FOCOS_MINIMOS) r.diasSinFijas++;
    const seguido = new Date(Date.parse(fecha) - 86400000).toISOString().slice(0, 10) === fechaAyer;
    const grupos = incendios(limpios);
    const persisten = seguido ? grupos.filter((g) => ayer.some((h) => cerca(g, h))) : [];
    if (grupos.length) r.diasPorIncendio++;
    if (persisten.length) r.diasPersistentes++;
    const gruposFuera = suelo ? incendios(fuera) : grupos;
    const persistenFuera = seguido ? gruposFuera.filter((g) => ayerFuera.some((h) => cerca(g, h))) : [];
    if (gruposFuera.length) r.diasFueraDeCultivo++;
    if (persistenFuera.length) r.diasFueraDeCultivoPersistentes++;
    for (const g of grupos) {
      const enCultivo = g.length - sinCultivos(g, suelo).length;
      r.eventos.push({
        fecha,
        focos: g.length,
        ha: g.length * HA_POR_FOCO,
        lat: +(g.reduce((s, f) => s + f.lat, 0) / g.length).toFixed(3),
        lon: +(g.reduce((s, f) => s + f.lon, 0) / g.length).toFixed(3),
        persiste: persisten.includes(g),
        enCultivo,
      });
    }
    ayer = grupos;
    ayerFuera = gruposFuera;
    fechaAyer = fecha;
  }
  return r;
}

/** Cuánto acierta el mapa de fuentes fijas en años que no vio (el historial trae la marca real). */
export function medirMascara(filas, mascara) {
  const r = { fijas: 0, fijasTapadas: 0, vegetacion: 0, vegetacionTapada: 0 };
  for (const f of filas) {
    const fija = Number(f.type) >= 1 && Number(f.type) <= 3;
    const tapada = Boolean(motivoFija(mascara, f.latitude, f.longitude));
    if (fija) (r.fijas++, tapada && r.fijasTapadas++);
    else (r.vegetacion++, tapada && r.vegetacionTapada++);
  }
  return r;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (n) => {
    const i = process.argv.indexOf(n);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const carpeta = arg("--datos");
  if (!carpeta) throw new Error("Falta --datos <carpeta>.");
  const porAnio = leerHistorial(carpeta);
  const anios = Object.keys(porAnio).sort();
  if (anios.length < 3) throw new Error("Hacen falta al menos tres años de historial.");
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + " %" : "sin datos");

  // 1) El mapa se arma con todos los años menos los dos últimos y se prueba con esos dos.
  const prueba = anios.slice(-2);
  const base = anios.slice(0, -2);
  const parcial = armarMascara(base.flatMap((a) => porAnio[a]));
  const m = medirMascara(prueba.flatMap((a) => porAnio[a]), parcial);
  console.log(`Mapa de fuentes fijas armado con ${base[0]}-${base.at(-1)} y probado con ${prueba.join(" y ")}:`);
  console.log(`  celdas marcadas: ${Object.keys(parcial.celdas).length}`);
  console.log(`  fuentes fijas tapadas: ${m.fijasTapadas} de ${m.fijas} (${pct(m.fijasTapadas, m.fijas)})`);
  console.log(`  focos de vegetación tapados por error: ${m.vegetacionTapada} de ${m.vegetacion} (${pct(m.vegetacionTapada, m.vegetacion)})`);

  // 2) El mapa final usa todo el historial.
  const mascara = armarMascara(anios.flatMap((a) => porAnio[a]));
  const marcas = Object.values(mascara.celdas);
  console.log(`\nMapa final (${anios[0]}-${anios.at(-1)}): ${marcas.length} celdas, ${marcas.filter((x) => x === "etiquetada").length} etiquetadas y ${marcas.filter((x) => x === "persistente").length} persistentes.`);
  const salida = arg("--mascara");
  if (salida) {
    writeFileSync(salida, JSON.stringify({ fuente: "NASA FIRMS, historial VIIRS S-NPP de Argentina", anios: [anios[0], anios.at(-1)], celda: 0.01, reglas: mascara.reglas, celdas: mascara.celdas }));
    console.log(`  guardado en ${salida}`);
  }

  // 3) Días que habrían pagado, por año. Para no medir el mapa con sus propios datos, cada año
  //    se mide con un mapa armado sin ese año.
  const rutaSuelo = arg("--suelo");
  const suelo = rutaSuelo ? leerUsoDelSuelo(JSON.parse(readFileSync(rutaSuelo, "utf8"))) : undefined;
  const col = (v, n) => String(v).padStart(n);
  console.log("\nDías con pago posible por año (un satélite, alta confianza, 3 focos o más):");
  console.log("  año   focos  altas  en fijas  en cultivo  regla anterior  sin fijas  por incendio  y persiste  fuera de cultivo  y persiste");
  const claves = ["diasAntes", "diasSinFijas", "diasPorIncendio", "diasPersistentes", "diasFueraDeCultivo", "diasFueraDeCultivoPersistentes"];
  const anchos = [15, 10, 13, 11, 17, 11];
  const total = Object.fromEntries(claves.map((k) => [k, 0]));
  const eventos = [];
  for (const a of anios) {
    const sinEse = armarMascara(anios.filter((x) => x !== a).flatMap((x) => porAnio[x]));
    const r = medirAnio(porAnio[a], sinEse, suelo);
    for (const k of claves) total[k] += r[k];
    eventos.push(...r.eventos);
    console.log(`  ${a}  ${col(r.focos, 6)} ${col(r.altas, 6)} ${col(r.enFijas, 9)} ${col(suelo ? r.enCultivo : "-", 11)} ${claves.map((k, i) => col(suelo || i < 4 ? r[k] : "-", anchos[i])).join(" ")}`);
  }
  console.log(`  total ${" ".repeat(36)} ${claves.map((k, i) => col(suelo || i < 4 ? total[k] : "-", anchos[i])).join(" ")}`);

  console.log("\nLos 15 mayores eventos (para revisar con bomberos):");
  for (const e of eventos.sort((x, y) => y.focos - x.focos).slice(0, 15)) {
    const cultivo = suelo ? `  ${col(e.enCultivo, 3)} sobre cultivo` : "";
    console.log(`  ${e.fecha}  ${col(e.focos, 4)} focos  ~${col(e.ha, 5)} ha  ${e.lat}, ${e.lon}${cultivo}${e.persiste ? "  (seguía del día anterior)" : ""}`);
  }
  if (suelo) {
    const grandes = eventos.filter((e) => e.focos >= 10);
    const mayoria = grandes.filter((e) => e.enCultivo * 2 > e.focos).length;
    console.log(`\nEventos de 10 focos o más: ${grandes.length}; con más de la mitad sobre cultivo (mapa de ${suelo.anio}): ${mayoria}.`);
  }
}
