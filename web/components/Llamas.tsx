// La llama del logo de Brasa (sin el satélite), para marcar incendios y su gravedad.
// Gravedad: 1 a 3 llamas encendidas, como un medidor de "estrellas"; las apagadas quedan en gris.

export const LLAMA_AFUERA =
  "M50 6 C58 22 78 32 78 56 C78 74 66 90 50 90 C34 90 22 76 22 58 C22 46 30 38 36 30 C38 38 42 42 46 42 C44 30 46 16 50 6 Z";
export const LLAMA_ADENTRO =
  "M50 44 C55 54 66 58 66 70 C66 80 59 87 50 87 C41 87 34 80 34 71 C34 64 38 60 42 56 C43 61 46 63 48 63 C47 56 48 50 50 44 Z";

export type Nivel = 1 | 2 | 3;
export const GRAVEDAD: Record<Nivel, string> = { 1: "leve", 2: "medio", 3: "grave" };

/** SVG de una llama como texto, para los marcadores de Leaflet (que piden HTML). */
export function llamaHtml(px: number): string {
  // Borde oscuro fino para que se lea sobre el mapa; sin sombras pesadas.
  return `<svg viewBox="14 0 72 96" width="${Math.round(px * 0.75)}" height="${px}" shape-rendering="geometricPrecision" aria-hidden="true"><path d="${LLAMA_AFUERA}" fill="#FF5A1F" stroke="#1B1512" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><path d="${LLAMA_ADENTRO}" fill="#FFB000"/></svg>`;
}

function Llama({ px, encendida }: { px: number; encendida: boolean }) {
  return (
    <svg viewBox="18 2 64 92" width={px * 0.7} height={px} aria-hidden="true" className={encendida ? "ll on" : "ll off"}>
      <path d={LLAMA_AFUERA} fill={encendida ? "#FF5A1F" : "none"} stroke={encendida ? "none" : "#9b8f86"} strokeWidth={5} />
      {encendida && <path d={LLAMA_ADENTRO} fill="#FFB000" />}
    </svg>
  );
}

/** Medidor de gravedad: tres llamas, se encienden tantas como el nivel. */
export function Gravedad({ nivel, px = 20, texto = false }: { nivel: Nivel; px?: number; texto?: boolean }) {
  return (
    <span className="gravedad" role="img" aria-label={`Nivel ${nivel} de 3: ${GRAVEDAD[nivel]}`}>
      {([1, 2, 3] as const).map((n) => (
        <Llama key={n} px={px} encendida={n <= nivel} />
      ))}
      {texto && <b className="grav-texto">Nivel {nivel} · {GRAVEDAD[nivel]}</b>}
    </span>
  );
}
