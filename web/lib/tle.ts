// TLE de NOAA-20 y NOAA-21: los guardados en el sitio y, si llegan bien, los del día.
// Va aparte de orbita.ts para que la portada no cargue satellite.js antes que el globo.

export type Tle = { id: string; nombre: string; norad: number; line1: string; line2: string };

/** Dígito de control de una línea de TLE: suma de sus dígitos, y cada signo menos vale 1. */
function controlOk(linea: string): boolean {
  let suma = 0;
  for (const c of linea.slice(0, 68)) suma += c === "-" ? 1 : c >= "0" && c <= "9" ? Number(c) : 0;
  return String(suma % 10) === linea[68];
}

const lineaOk = (linea: unknown, n: 1 | 2, norad: number): linea is string =>
  typeof linea === "string" && linea.length === 69 && linea.startsWith(`${n} ${String(norad).padStart(5, "0")}`) && controlOk(linea);

/** Solo se acepta un TLE bien formado y del satélite pedido. */
export const tleOk = (norad: number, line1: unknown, line2: unknown) => lineaOk(line1, 1, norad) && lineaOk(line2, 2, norad);

/** TLE guardados en el sitio: con estos se dibuja el globo sin esperar a nadie. */
export async function leerTles(): Promise<Tle[]> {
  const guardados: Tle[] = (await (await fetch("/tle.json")).json()).satelites;
  return guardados.filter((t) => tleOk(t.norad, t.line1, t.line2));
}

/** TLE del día. Devuelve null si no llegó ninguno válido y distinto del guardado. */
export async function refrescarTles(guardados: Tle[]): Promise<Tle[] | null> {
  let cambio = false;
  const frescos = await Promise.all(
    guardados.map(async (t) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`https://tle.ivanstanojevic.me/api/tle/${t.norad}`, { signal: ctrl.signal });
        const j = r.ok ? await r.json() : null;
        clearTimeout(timer);
        if (!tleOk(t.norad, j?.line1, j?.line2) || (j.line1 === t.line1 && j.line2 === t.line2)) return t;
        cambio = true;
        return { ...t, line1: j.line1 as string, line2: j.line2 as string };
      } catch {
        return t;
      }
    }),
  );
  return cambio ? frescos : null;
}
