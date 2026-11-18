// Órbitas reales de los satélites que ven el fuego (NOAA-20 y NOAA-21), calculadas con SGP4 a partir de su TLE.
// Coordenadas de la escena 3D: la Tierra tiene radio 1; x apunta al meridiano 0, y al polo norte.
import { degreesLat, degreesLong, eciToEcf, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from "satellite.js";

export type Tle = { id: string; nombre: string; norad: number; line1: string; line2: string };
export type Estado = { pos: [number, number, number]; lat: number; lon: number; altKm: number; velKms: number };

export const RADIO_TIERRA_KM = 6371;

/** Lat/lon en grados a un punto de la escena (sobre la esfera de radio r). */
export function latLon(lat: number, lon: number, r = 1): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** Vector en km (ECF o ECI) a la escena. */
const aEscena = (v: { x: number; y: number; z: number }): [number, number, number] => [
  v.x / RADIO_TIERRA_KM,
  v.z / RADIO_TIERRA_KM,
  -v.y / RADIO_TIERRA_KM,
];

export const satrec = (t: Tle): SatRec => twoline2satrec(t.line1, t.line2);

/** Dónde está el satélite en ese momento: posición sobre la Tierra (que gira con ella), altura y velocidad. */
export function estado(s: SatRec, d: Date): Estado | null {
  const pv = propagate(s, d);
  if (!pv || typeof pv.position !== "object" || typeof pv.velocity !== "object") return null;
  const g = gstime(d);
  const geo = eciToGeodetic(pv.position, g);
  const v = pv.velocity;
  return {
    pos: aEscena(eciToEcf(pv.position, g)),
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    altKm: geo.height,
    velKms: Math.hypot(v.x, v.y, v.z),
  };
}

/** Período orbital en minutos (`no` viene en radianes por minuto). */
export const periodoMin = (s: SatRec) => (2 * Math.PI) / s.no;

/** Una vuelta completa en el marco inercial (ECI). Para dibujarla sobre la Tierra se gira -gmst sobre el eje y. */
export function anillo(s: SatRec, d: Date, n = 240): [number, number, number][] {
  const p = periodoMin(s) * 60_000;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const pv = propagate(s, new Date(d.getTime() + (p * i) / n));
    if (pv && typeof pv.position === "object") out.push(aEscena(pv.position));
  }
  return out;
}

export const gmst = (d: Date) => gstime(d);

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(a));
}

/** TLE guardados en el sitio; si responde, se refrescan con los del día. */
export async function leerTles(): Promise<Tle[]> {
  const guardados: Tle[] = (await (await fetch("/tle.json")).json()).satelites;
  const frescos = await Promise.all(
    guardados.map(async (t) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`https://tle.ivanstanojevic.me/api/tle/${t.norad}`, { signal: ctrl.signal });
        clearTimeout(timer);
        const j = r.ok ? await r.json() : null;
        return j?.line1 && j?.line2 ? { ...t, line1: j.line1, line2: j.line2 } : t;
      } catch {
        return t;
      }
    }),
  );
  return frescos;
}
