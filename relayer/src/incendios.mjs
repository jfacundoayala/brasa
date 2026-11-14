// Agrupa focos de calor cercanos en "incendios" y les pone un nivel 1, 2 o 3.
//
// Reglas (SUPUESTOS del equipo, a calibrar con bomberos; no son datos medidos):
//   - Cuentan solo focos de ALTA confianza. Un píxel de VIIRS es de unos 375 m: 1 foco ~ 14 ha.
//   - Dos focos son del mismo incendio si están a menos de RADIO_KM (agrupación por encadenamiento).
//   - n = focos VIIRS (NOAA-20 / NOAA-21) del grupo; si ambos satélites ven el mismo incendio, se toma el mayor conteo
//     (no se suman: el mismo fuego visto dos veces no es el doble de fuego).
//   - MODIS (píxel de 1 km) no suma hectáreas, solo confirma.
//   - Confirmado = lo ven al menos DOS sensores distintos.
//   - Nivel 1: n 1-2 (hasta ~30 ha) · Nivel 2: n 3-7 (30 a 100 ha) · Nivel 3: n >= 8 (más de ~100 ha).

export const HA_POR_FOCO = 14;
export const RADIO_KM = 2;
export const UMBRAL_NIVEL_2 = 3;
export const UMBRAL_NIVEL_3 = 8;

export function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nivelDe(n) {
  if (n >= UMBRAL_NIVEL_3) return 3;
  if (n >= UMBRAL_NIVEL_2) return 2;
  return 1;
}

const SENSORES_VIIRS = new Set(["noaa20", "noaa21"]);

/** `focos`: [{lat, lon, sensor, confianza, fecha, hora}]. Devuelve los incendios ordenados de mayor a menor. */
export function agruparIncendios(focos, radioKm = RADIO_KM) {
  const altos = focos.filter((f) => f.confianza === "high");
  const padre = altos.map((_, i) => i);
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < altos.length; i++) {
    for (let j = i + 1; j < altos.length; j++) {
      if (distanciaKm(altos[i].lat, altos[i].lon, altos[j].lat, altos[j].lon) <= radioKm) padre[raiz(i)] = raiz(j);
    }
  }
  const grupos = new Map();
  altos.forEach((f, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(f);
  });
  const incendios = [...grupos.values()].map((g) => {
    const porSensor = {};
    for (const f of g) porSensor[f.sensor] = (porSensor[f.sensor] ?? 0) + 1;
    const n = Math.max(0, ...Object.entries(porSensor).filter(([s]) => SENSORES_VIIRS.has(s)).map(([, c]) => c));
    const sensores = Object.keys(porSensor).sort();
    const ultima = g.map((f) => `${f.fecha}T${f.hora.slice(0, 2)}:${f.hora.slice(2)}Z`).sort().at(-1);
    return {
      lat: g.reduce((a, f) => a + f.lat, 0) / g.length,
      lon: g.reduce((a, f) => a + f.lon, 0) / g.length,
      focos: n,
      areaHa: n * HA_POR_FOCO,
      nivel: nivelDe(n),
      sensores,
      confirmado: sensores.length >= 2,
      ultimaDeteccion: ultima,
      // La potencia máxima de sus focos (FRP, MW): mide qué tan intenso es el fuego.
      frpMax: Math.round(Math.max(0, ...g.map((f) => f.frp ?? 0)) * 10) / 10,
    };
  });
  // Un grupo solo de MODIS (sin VIIRS) no tiene hectáreas estimadas confiables: se descarta del mapa de niveles.
  return incendios
    .filter((x) => x.focos > 0)
    .sort((a, b) => b.focos - a.focos)
    .map((x, i) => ({ id: i + 1, ...x }));
}
