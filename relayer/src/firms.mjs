// Lectura de focos de calor de NASA FIRMS (CSV) y conteo por sensor.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, toUtf8Bytes } from "ethers";
import { distanciaKm, RADIO_KM } from "./incendios.mjs";

// Polígono de la provincia de Salta (geoBoundaries ARG ADM1, CC BY 2.5). Es de baja resolución (límites de 2006):
// para el piloto se reemplaza por el del IGN. Se usa para NO contar focos de Chile, Bolivia, Jujuy o Tucumán
// que caen dentro del rectángulo.
const aqui = dirname(fileURLToPath(import.meta.url));
const ARCHIVO_POLIGONO = resolve(aqui, "..", "sample-data", "salta-provincia.geojson");
export const POLIGONO_SALTA = JSON.parse(readFileSync(ARCHIVO_POLIGONO, "utf8")).geometry;

/**
 * Huella del polígono: keccak256 del GeoJSON con saltos de línea LF (da lo mismo en Windows y en Linux).
 * Es la que guarda la zona en el contrato (deploy.mjs hace la misma cuenta) y la que firma cada reporte.
 */
export function huellaPoligono(ruta = ARCHIVO_POLIGONO) {
  return keccak256(toUtf8Bytes(readFileSync(ruta, "utf8").replace(/\r\n/g, "\n")));
}

function enAnillo(lon, lat, anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Punto dentro de un Polygon o MultiPolygon de GeoJSON (el primer anillo es el borde; los demás son huecos). */
export function enPoligono(lon, lat, geom = POLIGONO_SALTA) {
  const polis = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polis.some((p) => enAnillo(lon, lat, p[0]) && !p.slice(1).some((h) => enAnillo(lon, lat, h)));
}

// Zona del MVP: provincia de Salta (caja aproximada: oeste, sur, este, norte).
export const BBOX = [-68.6, -26.4, -62.3, -22.0];

// Sensores del MVP. El contrato exige DOS firmas de DOS sensores distintos.
// Aclaración honesta: los dos son VIIRS procesados por NASA FIRMS; son independientes por satélite, no por operador.
export const SENSORES = [
  { id: 0, clave: "noaa20", nombre: "VIIRS NOAA-20", archivo: "firms-viirs-noaa20-salta.csv", fuenteApi: "VIIRS_NOAA20_NRT" },
  { id: 1, clave: "noaa21", nombre: "VIIRS NOAA-21", archivo: "firms-viirs-noaa21-salta.csv", fuenteApi: "VIIRS_NOAA21_NRT" },
];
export const SENSOR_EXTRA = { clave: "modis", nombre: "MODIS", archivo: "firms-modis-salta.csv", fuenteApi: "MODIS_NRT" };

export function parseCsv(texto) {
  const lineas = texto.trim().split(/\r?\n/);
  if (lineas.length < 1 || lineas[0] === "") return [];
  const cab = lineas[0].split(",");
  return lineas.slice(1).map((l) => {
    const c = l.split(",");
    return Object.fromEntries(cab.map((k, i) => [k, c[i]]));
  });
}

export function dentroDeZona(f, bbox = BBOX) {
  const lon = Number(f.longitude);
  const lat = Number(f.latitude);
  if (!(lon >= bbox[0] && lat >= bbox[1] && lon <= bbox[2] && lat <= bbox[3])) return false;
  return enPoligono(lon, lat); // además del rectángulo, tiene que estar dentro de la provincia
}

/** Alta confianza: VIIRS "high" (o "h"); MODIS con confianza numérica >= 80. */
export function esAltaConfianza(f) {
  const c = String(f.confidence).toLowerCase();
  if (c === "high" || c === "h") return true;
  const n = Number(c);
  return Number.isFinite(n) && n >= 80;
}

export function nivelConfianza(f) {
  const c = String(f.confidence).toLowerCase();
  if (c === "high" || c === "h") return "high";
  if (c === "nominal" || c === "n") return "nominal";
  if (c === "low" || c === "l") return "low";
  const n = Number(c);
  if (Number.isFinite(n)) return n >= 80 ? "high" : n >= 30 ? "nominal" : "low";
  return "low";
}

export function cargarCsvLocal(ruta) {
  return parseCsv(readFileSync(ruta, "utf8"));
}

/** Baja el CSV de la API de FIRMS (necesita MAP_KEY propia, gratis en firms.modaps.eosdis.nasa.gov/api/map_key). */
export async function bajarFirms(fuenteApi, mapKey, dias = 2, bbox = BBOX) {
  return parseCsv(await bajarFirmsTexto(fuenteApi, mapKey, dias, bbox));
}

// dias = 2: con 1, FIRMS devuelve solo el día UTC en curso y de madrugada queda vacío (las pasadas de la tarde son del día anterior).
// La frescura la controla el contrato: la detección más nueva no puede tener más de 24 h.
/** Igual que bajarFirms, pero devuelve el CSV tal cual llegó (para guardarlo y que la huella se pueda rehacer). */
export async function bajarFirmsTexto(fuenteApi, mapKey, dias = 2, bbox = BBOX) {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${fuenteApi}/${bbox.join(",")}/${dias}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`FIRMS ${fuenteApi}: HTTP ${r.status}`);
  const t = await r.text();
  if (!t.startsWith("latitude")) throw new Error(`FIRMS ${fuenteApi}: respuesta inesperada`);
  return t;
}

/** Resume los focos de un sensor dentro de la zona: total, alta confianza, hora de la última detección y huella. */
export function resumir(filas) {
  const enZona = filas.filter((f) => dentroDeZona(f));
  const altas = enZona.filter(esAltaConfianza);
  const huella = "0x" + createHash("sha256").update(JSON.stringify(altas)).digest("hex");
  let ultima = 0;
  for (const f of altas) {
    const hh = String(f.acq_time).padStart(4, "0");
    const t = Date.parse(`${f.acq_date}T${hh.slice(0, 2)}:${hh.slice(2)}:00Z`);
    if (Number.isFinite(t) && t > ultima) ultima = t;
  }
  return {
    total: enZona.length,
    altaConfianza: altas.length,
    ultimaDeteccionUtc: ultima ? Math.floor(ultima / 1000) : 0,
    dataHash: huella,
    focos: enZona,
  };
}

/**
 * Cruce de los dos satélites: de cada sensor VIIRS cuenta solo los focos de alta confianza que el OTRO satélite
 * también vio a menos de `radioKm` (por defecto 2 km, el mismo radio que agrupa incendios en el mapa).
 * Así "dos satélites confirman" quiere decir el mismo fuego, no solo fuego en algún lugar de la provincia.
 * Agrega `confirmados` a cada resumen y devuelve el mismo objeto.
 * Ojo: para contar, cada oráculo necesita también los datos públicos del otro sensor (los dos son CSV de NASA FIRMS).
 */
export function cruzarSensores(datos, radioKm = RADIO_KM) {
  const [s0, s1] = SENSORES.map((s) => datos[s.clave]);
  const altas = (r) => r.focos.filter(esAltaConfianza).map((f) => [Number(f.latitude), Number(f.longitude)]);
  const a = altas(s0);
  const b = altas(s1);
  const vistoPorElOtro = (p, otros) => otros.some((q) => distanciaKm(p[0], p[1], q[0], q[1]) <= radioKm);
  s0.confirmados = a.filter((p) => vistoPorElOtro(p, b)).length;
  s1.confirmados = b.filter((p) => vistoPorElOtro(p, a)).length;
  return datos;
}
