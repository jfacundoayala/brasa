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

const GUARDA = "brasa-tle";
/** Las órbitas se publican pocas veces por día: se piden una vez y se guardan en el navegador. */
const VIGENCIA_MS = 6 * 3600 * 1000;
type Par = [string, string];

async function pedir(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? r : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** El TLE del día de un satélite: primero CelesTrak (la fuente de NORAD) y, si no responde, el servicio de respaldo. */
async function delDia(norad: number): Promise<Par | null> {
  const a = await pedir(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${norad}&FORMAT=TLE`);
  if (a) {
    const lineas = (await a.text().catch(() => "")).split("\n").map((l) => l.trim());
    const l1 = lineas.find((l) => l.startsWith("1 "));
    const l2 = lineas.find((l) => l.startsWith("2 "));
    if (tleOk(norad, l1, l2)) return [l1 as string, l2 as string];
  }
  const b = await pedir(`https://tle.ivanstanojevic.me/api/tle/${norad}`);
  const j = b ? await b.json().catch(() => null) : null;
  return tleOk(norad, j?.line1, j?.line2) ? [j.line1, j.line2] : null;
}

function leerGuarda(): Record<string, Par> | null {
  try {
    const g = JSON.parse(localStorage.getItem(GUARDA) ?? "null") as { t: number; pares: Record<string, Par> } | null;
    return g && Date.now() - g.t < VIGENCIA_MS ? g.pares : null;
  } catch {
    return null;
  }
}

/** TLE del día. Devuelve null si no llegó ninguno válido y distinto del guardado. */
export async function refrescarTles(guardados: Tle[]): Promise<Tle[] | null> {
  let pares = leerGuarda();
  if (!pares) {
    pares = {};
    for (const [i, par] of (await Promise.all(guardados.map((t) => delDia(t.norad)))).entries()) {
      if (par) pares[guardados[i].norad] = par;
    }
    if (Object.keys(pares).length === guardados.length) {
      try {
        localStorage.setItem(GUARDA, JSON.stringify({ t: Date.now(), pares }));
      } catch {
        // sin lugar para guardar: se vuelve a pedir en la próxima visita
      }
    }
  }
  let cambio = false;
  const frescos = guardados.map((t) => {
    const par = pares[t.norad];
    if (!par || !tleOk(t.norad, par[0], par[1]) || (par[0] === t.line1 && par[1] === t.line2)) return t;
    cambio = true;
    return { ...t, line1: par[0], line2: par[1] };
  });
  return cambio ? frescos : null;
}
