// Guarda los CSV de NASA FIRMS que se usaron en un reporte en vivo.
//
// La huella (dataHash) que va a la cadena se calcula con esos CSV. FIRMS no guarda el mismo archivo para
// siempre (la ventana de "últimas 24 h" se mueve), así que sin una copia nadie podría rehacer la huella.
// Cada reporte deja una carpeta datos-reportes/<fecha UTC>/ con los CSV (mismos nombres que sample-data/)
// y huellas.json. Cualquiera la verifica con:  node src/index.mjs verificar-hash --tx 0x… --datos <carpeta>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Nombre de carpeta seguro para Windows a partir de una fecha: 2026-11-12T03-15-00Z. */
export function sello(fecha = new Date()) {
  return fecha.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
}

/**
 * @param {string} base      carpeta raíz (datos-reportes/)
 * @param {string} nombre    subcarpeta (ver `sello`)
 * @param {{archivo:string, clave:string, nombre:string}[]} sensores
 * @param {Record<string,string>} crudos  CSV tal cual llegó, por clave de sensor
 * @param {Record<string,{dataHash:string, altaConfianza:number, total:number}>} datos  resumen por clave
 * @returns {string} la carpeta escrita
 */
export function guardarDatosDelReporte(base, nombre, sensores, crudos, datos) {
  const carpeta = resolve(base, nombre);
  mkdirSync(carpeta, { recursive: true });
  const huellas = {};
  for (const s of sensores) {
    if (crudos[s.clave] === undefined) continue;
    writeFileSync(resolve(carpeta, s.archivo), crudos[s.clave]);
    huellas[s.clave] = { sensor: s.nombre, archivo: s.archivo, dataHash: datos[s.clave].dataHash, altaConfianza: datos[s.clave].altaConfianza, total: datos[s.clave].total };
  }
  writeFileSync(resolve(carpeta, "huellas.json"), JSON.stringify({ fuente: "NASA FIRMS (API de área, últimas 24 h)", huellas }, null, 2) + "\n");
  return carpeta;
}
