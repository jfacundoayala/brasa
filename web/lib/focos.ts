import type { Focos } from "./chain";

// La rama "datos" del repo guarda un archivo de focos de NASA FIRMS. La web usa el más nuevo entre ese
// y el que viaja con ella, así un dato nuevo no obliga a volver a publicar la web.
const REMOTO = "https://raw.githubusercontent.com/jfacundoayala/brasa/datos/focos.json";

const valido = (f: unknown): f is Focos => {
  const x = f as Focos | null;
  return (
    !!x &&
    typeof x.generatedAt === "string" &&
    Number.isFinite(Date.parse(x.generatedAt)) &&
    typeof x.datosGuardados === "boolean" &&
    Array.isArray(x.focos) &&
    Array.isArray(x.incendios) &&
    !!x.conteo &&
    !!x.zona
  );
};

const leer = async (url: string, ms?: number): Promise<Focos | null> => {
  try {
    const r = await fetch(url, { cache: "no-store", ...(ms && { signal: AbortSignal.timeout(ms) }) });
    if (!r.ok) return null;
    const f: unknown = await r.json();
    return valido(f) ? f : null;
  } catch {
    return null;
  }
};

/** El dato más nuevo entre el de la rama "datos" y el que viaja con la web. Si el remoto falla, queda el local. */
export async function leerFocos(): Promise<Focos> {
  const [remoto, local] = await Promise.all([leer(REMOTO, 4000), leer("/focos.json")]);
  if (!local && !remoto) throw new Error("sin focos");
  if (!local) return remoto!;
  if (!remoto) return local;
  return Date.parse(remoto.generatedAt) > Date.parse(local.generatedAt) ? remoto : local;
}

/** Horas desde que se consultó a la NASA. Pasado este tiempo la web deja de decir "hoy". */
export const HORAS_DATO_FRESCO = 8;
