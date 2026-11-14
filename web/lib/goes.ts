// Alerta temprana: focos del satélite geoestacionario GOES-19 (NOAA), que mira Sudamérica cada 10 minutos.
// Los publica el programa Queimadas del INPE (Brasil) en archivos CSV cada 10 minutos, abiertos y sin clave:
// https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/
// GOES avisa rápido pero con píxeles grandes (unos 2 km): es un "posible foco" hasta que lo confirman los VIIRS de la NASA.
// No mueve fondos: el contrato solo libera con la confirmación de los dos satélites NOAA.

const BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/";

export type Aviso = { lat: number; lon: number; satelite: string; hora: string };

/** Rectángulo de Salta (oeste, sur, este, norte). */
const BBOX = [-68.6, -26.5, -62.3, -21.9] as const;

/** Avisos de la última hora (6 archivos de 10 min) dentro del rectángulo de Salta. Solo GOES, que es el rápido. */
export async function avisosGoes(archivos = 6): Promise<{ avisos: Aviso[]; ultimo: string | null }> {
  const lista = await (await fetch(BASE, { cache: "no-store" })).text();
  const nombres = [...lista.matchAll(/href="(focos_10min_\d{8}_\d{4}\.csv)"/g)].map((m) => m[1]);
  const ult = nombres.slice(-archivos);
  const textos = await Promise.all(
    ult.map((n) => fetch(BASE + n, { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")).catch(() => "")),
  );
  const [w, s, e, n] = BBOX;
  const avisos: Aviso[] = [];
  const vistos = new Set<string>();
  for (const t of textos) {
    for (const linea of t.split("\n").slice(1)) {
      const [la, lo, sat, hora] = linea.split(",").map((x) => x.trim());
      const lat = Number(la);
      const lon = Number(lo);
      if (!sat?.startsWith("GOES") || !Number.isFinite(lat) || lat < s || lat > n || lon < w || lon > e) continue;
      const k = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      avisos.push({ lat, lon, satelite: sat, hora });
    }
  }
  const m = ult.at(-1)?.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
  const ultimo = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z` : null;
  return { avisos, ultimo };
}

/** Rumbo en grados hacia donde va el viento (el fuego avanza hacia ahí) → texto. */
export function rumbo(gradosHacia: number): string {
  const r = ["el norte", "el noreste", "el este", "el sureste", "el sur", "el suroeste", "el oeste", "el noroeste"];
  return r[Math.round((((gradosHacia % 360) + 360) % 360) / 45) % 8];
}
