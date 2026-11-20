// Capas de detección: sacan lo que no es un incendio antes de contar.
//
//   Capa 2: fuentes fijas. Celdas donde el historial muestra calor que no es fuego de monte
//           (industrias, quema de gas, volcanes). El dato en vivo de la NASA no trae esa marca,
//           así que el mapa se arma con el historial, que sí la trae.
//   Capa 3: uso del suelo. Saca los focos que caen sobre cultivos: ahí el fuego suele ser una
//           quema agrícola. El mapa es ESA WorldCover 2021 (10 m), resumido en celdas de 0,01°.
//   Capa 4: incendio, no focos sueltos. Los focos se agrupan por cercanía y cuenta solo el
//           grupo más grande. Un mismo píxel visto dos veces en la misma pasada cuenta una vez.
//
// Las reglas son SUPUESTOS del equipo, medidos con `retroprueba.mjs` y a calibrar con bomberos.
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { distanciaKm, RADIO_KM } from "./incendios.mjs";

/** Lado de la celda del mapa de fuentes fijas, en grados (unos 1,1 km). */
export const CELDA = 0.01;
/** Lado de la celda que identifica un píxel de VIIRS, en grados (unos 440 m). */
export const CELDA_PIXEL = 0.004;

export const REGLAS_MASCARA = {
  /** Etiquetada: la mayoría de sus detecciones son de tipo 1 a 3 en el historial, con este mínimo. */
  minimoEtiquetadas: 3,
  /** Persistente: ardió al menos estos días, en estos años y en estos meses distintos del año. */
  diasMin: 30,
  aniosMin: 6,
  mesesMin: 8,
};

const indice = (grados, lado) => Math.floor(Number(grados) / lado + 1e-9);

export function claveCelda(lat, lon, lado = CELDA) {
  return `${indice(lat, lado)},${indice(lon, lado)}`;
}

/**
 * Arma el mapa de fuentes fijas con el historial. `filas`: [{latitude, longitude, acq_date, type}].
 * Devuelve { celdas: { "lat,lon": "etiquetada" | "persistente" }, reglas, filas }.
 */
export function armarMascara(filas, reglas = REGLAS_MASCARA) {
  const porCelda = new Map();
  for (const f of filas) {
    const k = claveCelda(f.latitude, f.longitude);
    let c = porCelda.get(k);
    if (!c) porCelda.set(k, (c = { n: 0, fijas: 0, dias: new Set(), anios: new Set(), meses: new Set() }));
    c.n++;
    const tipo = Number(f.type);
    if (tipo >= 1 && tipo <= 3) c.fijas++;
    const fecha = String(f.acq_date);
    c.dias.add(fecha);
    c.anios.add(fecha.slice(0, 4));
    c.meses.add(fecha.slice(5, 7));
  }
  const celdas = {};
  for (const [k, c] of porCelda) {
    if (c.fijas >= reglas.minimoEtiquetadas && c.fijas * 2 > c.n) celdas[k] = "etiquetada";
    else if (c.dias.size >= reglas.diasMin && c.anios.size >= reglas.aniosMin && c.meses.size >= reglas.mesesMin) {
      celdas[k] = "persistente";
    }
  }
  return { celdas, reglas, filas: filas.length };
}

/** ¿El foco cae en una celda marcada como fuente fija? Devuelve el motivo o `undefined`. */
export function motivoFija(mascara, lat, lon) {
  return mascara?.celdas?.[claveCelda(lat, lon)];
}

/** Saca los focos que caen en fuentes fijas. Acepta filas de FIRMS o focos {lat, lon}. */
export function sinFuentesFijas(focos, mascara) {
  if (!mascara) return focos;
  return focos.filter((f) => !motivoFija(mascara, f.lat ?? f.latitude, f.lon ?? f.longitude));
}

/** Una celda cuenta como cultivo si al menos este porcentaje de su superficie lo es. */
export const UMBRAL_CULTIVO = 50;

/** Abre la grilla de uso del suelo que arma `analisis/uso-del-suelo.py`. */
export function leerUsoDelSuelo(json) {
  const pct = new Uint8Array(gunzipSync(Buffer.from(json.datos, "base64")));
  if (pct.length !== json.filas * json.columnas) throw new Error("La grilla de uso del suelo no coincide con su tamaño.");
  return { celda: json.celda, origen: json.origen, filas: json.filas, columnas: json.columnas, anio: json.anio, pct };
}

/** Porcentaje de cultivo de la celda donde cae el punto, o `undefined` si el mapa no la cubre. */
export function cultivoEn(suelo, lat, lon) {
  if (!suelo) return undefined;
  const fila = indice(lat, suelo.celda) - suelo.origen.fila;
  const columna = indice(lon, suelo.celda) - suelo.origen.columna;
  if (fila < 0 || columna < 0 || fila >= suelo.filas || columna >= suelo.columnas) return undefined;
  const v = suelo.pct[fila * suelo.columnas + columna];
  return v === 255 ? undefined : v;
}

/** Saca los focos que caen sobre cultivos. Donde el mapa no tiene dato, el foco se queda. */
export function sinCultivos(focos, suelo, umbral = UMBRAL_CULTIVO) {
  if (!suelo) return focos;
  return focos.filter((f) => !(cultivoEn(suelo, f.lat ?? f.latitude, f.lon ?? f.longitude) >= umbral));
}

/**
 * Deja un foco por píxel, sensor, fecha y pasada (día o noche). Así un fuego que el satélite
 * registra dos veces en la misma pasada no cuenta doble.
 */
export function unoPorPixel(focos) {
  const vistos = new Set();
  return focos.filter((f) => {
    const k = `${f.sensor}|${claveCelda(f.lat, f.lon, CELDA_PIXEL)}|${f.fecha}|${f.dn ?? ""}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/**
 * Agrupa focos en incendios por encadenamiento: dos focos a menos de `radioKm` son del mismo
 * incendio. Usa una grilla para no comparar todos contra todos.
 * `focos`: [{lat, lon, sensor, ...}]. Devuelve una lista de grupos (cada uno, una lista de focos).
 */
export function agrupar(focos, radioKm = RADIO_KM) {
  const lado = radioKm / 100; // un grado son unos 111 km: la celda queda apenas más chica que el radio
  const grilla = new Map();
  focos.forEach((f, i) => {
    const k = claveCelda(f.lat, f.lon, lado);
    if (!grilla.has(k)) grilla.set(k, []);
    grilla.get(k).push(i);
  });
  const padre = focos.map((_, i) => i);
  const raiz = (i) => {
    while (padre[i] !== i) i = padre[i] = padre[padre[i]];
    return i;
  };
  // Más cerca del polo un grado de longitud mide menos: se revisan más celdas vecinas.
  focos.forEach((f, i) => {
    const y = indice(f.lat, lado);
    const x = indice(f.lon, lado);
    const dx = Math.ceil(1 / Math.max(0.2, Math.cos((f.lat * Math.PI) / 180))) + 1;
    for (let a = y - 2; a <= y + 2; a++) {
      for (let b = x - dx; b <= x + dx; b++) {
        for (const j of grilla.get(`${a},${b}`) ?? []) {
          if (j <= i) continue;
          if (distanciaKm(f.lat, f.lon, focos[j].lat, focos[j].lon) <= radioKm) padre[raiz(i)] = raiz(j);
        }
      }
    }
  });
  const grupos = new Map();
  focos.forEach((f, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(f);
  });
  return [...grupos.values()];
}

/**
 * El incendio que cuenta para el reporte. `sensores`: las claves de los sensores que firman.
 * De cada grupo se toma el menor conteo entre esos sensores (el contrato paga por el menor),
 * y gana el grupo donde ese menor es más alto. Con un solo sensor, gana el grupo más grande.
 * Devuelve { conteo: {sensor: n}, focos: n del menor, grupo, lat, lon } o `null` si no hay focos.
 */
export function incendioMayor(focos, sensores, radioKm = RADIO_KM) {
  let mejor = null;
  for (const grupo of agrupar(unoPorPixel(focos), radioKm)) {
    const conteo = Object.fromEntries(sensores.map((s) => [s, 0]));
    for (const f of grupo) if (f.sensor in conteo) conteo[f.sensor]++;
    const menor = Math.min(...Object.values(conteo));
    if (!mejor || menor > mejor.focos || (menor === mejor.focos && grupo.length > mejor.grupo.length)) {
      mejor = {
        conteo,
        focos: menor,
        grupo,
        lat: grupo.reduce((a, f) => a + f.lat, 0) / grupo.length,
        lon: grupo.reduce((a, f) => a + f.lon, 0) / grupo.length,
      };
    }
  }
  return mejor;
}

const esAlta = (f) => {
  const c = String(f.confidence).toLowerCase();
  return c === "high" || c === "h";
};

/** Lee los dos mapas de las capas (fuentes fijas y uso del suelo) y calcula su huella. */
export function cargarMapas(carpeta) {
  const leer = (nombre) => {
    const texto = readFileSync(new URL(nombre, carpeta), "utf8");
    return { json: JSON.parse(texto), huella: "0x" + createHash("sha256").update(texto).digest("hex") };
  };
  const fijas = leer("fuentes-fijas-salta.json");
  const suelo = leer("uso-del-suelo-salta.json");
  return { mascara: fijas.json, suelo: leerUsoDelSuelo(suelo.json), huellas: { fuentesFijas: fijas.huella, usoDelSuelo: suelo.huella } };
}

/** Capa 6, persistencia: el incendio tiene que verse en al menos estos días (UTC) distintos. */
export const DIAS_MINIMOS = 2;

/**
 * El conteo del reporte, capa por capa. `datos`: { [clave del sensor]: resumen de `resumir` } (sus
 * `focos` ya están dentro de la zona). `sensores`: las claves de los dos sensores que firman.
 *
 *   alta confianza -> sin fuentes fijas -> fuera de cultivo -> incendios que ven los dos satélites
 *   -> que se vieron en `diasMin` días distintos -> el más grande.
 *   Un mismo píxel cuenta una vez por satélite, aunque lo vea en varias pasadas.
 *
 * Agrega `incendio` a cada resumen (los focos de ese sensor en el incendio elegido: es lo que se
 * reporta) y devuelve el detalle para mostrar y publicar. `enEspera` es el incendio más grande que
 * ven los dos satélites pero todavía no cumple los días: no se paga hasta que persista.
 */
export function contarPorCapas(datos, sensores, { mascara, suelo, diasMin = DIAS_MINIMOS } = {}) {
  const porSensor = {};
  const todos = [];
  const vistas = new Map(); // píxel de un satélite -> en qué días y pasadas lo vio
  const pixel = (f) => `${f.sensor}|${claveCelda(f.lat, f.lon, CELDA_PIXEL)}`;
  for (const clave of sensores) {
    const altas = datos[clave].focos.filter(esAlta);
    const sinFijas = sinFuentesFijas(altas, mascara);
    const fuera = sinCultivos(sinFijas, suelo);
    porSensor[clave] = { altaConfianza: altas.length, sinFuentesFijas: sinFijas.length, fueraDeCultivo: fuera.length, enIncendio: 0 };
    for (const f of fuera) {
      const foco = { lat: Number(f.latitude), lon: Number(f.longitude), sensor: clave, fecha: "", dn: "" };
      todos.push(foco);
      const k = pixel(foco);
      if (!vistas.has(k)) vistas.set(k, { dias: new Set(), pasadas: new Set() });
      vistas.get(k).dias.add(String(f.acq_date));
      vistas.get(k).pasadas.add(`${clave}|${f.acq_date}|${f.acq_time}`);
    }
  }
  // Candidatos: grupos que ven los dos satélites. Si a uno le falta, no hay incendio confirmado.
  const candidatos = agrupar(unoPorPixel(todos)).map((grupo) => {
    const conteo = Object.fromEntries(sensores.map((x) => [x, 0]));
    const dias = new Set();
    const pasadas = new Set();
    for (const f of grupo) {
      conteo[f.sensor]++;
      const v = vistas.get(pixel(f));
      v.dias.forEach((d) => dias.add(d));
      v.pasadas.forEach((x) => pasadas.add(x));
    }
    return {
      conteo,
      focos: Math.min(...Object.values(conteo)),
      tamanio: grupo.length,
      lat: +(grupo.reduce((t, f) => t + f.lat, 0) / grupo.length).toFixed(4),
      lon: +(grupo.reduce((t, f) => t + f.lon, 0) / grupo.length).toFixed(4),
      dias: dias.size,
      pasadas: pasadas.size,
    };
  }).filter((c) => c.focos > 0).sort((x, y) => y.focos - x.focos || y.tamanio - x.tamanio);
  const mayor = candidatos.find((c) => c.dias >= diasMin) ?? null;
  const enEspera = candidatos.find((c) => c.dias < diasMin) ?? null;
  for (const clave of sensores) {
    porSensor[clave].enIncendio = mayor?.conteo[clave] ?? 0;
    datos[clave].incendio = porSensor[clave].enIncendio;
  }
  const resumen = (c) => c && { lat: c.lat, lon: c.lon, focos: c.focos, dias: c.dias, pasadas: c.pasadas };
  return { porSensor, incendio: resumen(mayor), enEspera: resumen(enEspera), diasMin };
}
