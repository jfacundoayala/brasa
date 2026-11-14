// Funciones puras del buzón de firmas (src/buzon.mjs), separadas para poder testearlas.

export const MARCA = "<!-- brasa-firma -->";
export const SPREAD = 3 * 3600; // MAX_REPORT_SPREAD del contrato
export const EDAD = 6 * 3600 - 15 * 60; // MAX_REPORT_AGE del contrato, con 15 min de margen
/** Cuentas de GitHub que pueden dejar firmas en el buzón (el repo es público: cualquiera puede comentar). */
export const AUTORES = ["jfacundoayala", "grancobud"];

/** Texto del comentario que publica una firma (sin claves: reporte + firma EIP-712). */
export function comentarioDeFirma(f, n) {
  const r = f.reporte;
  return (
    `${MARCA}\n**Firma del oráculo ${n}** (sensor ${r.sensor}): ${r.hotspots} focos cruzados, ` +
    `dato de las ${new Date(Number(r.dataTime) * 1000).toISOString()}, firmada a las ${new Date(Number(r.observedAt) * 1000).toISOString()}. ` +
    `No tiene claves.\n\n\`\`\`json\n${JSON.stringify(f, null, 2)}\n\`\`\``
  );
}

/**
 * De la salida de `gh api …/comments --paginate` (uno o varios arreglos JSON pegados) saca la firma más nueva
 * del sensor pedido. Ignora comentarios sin la marca, con JSON roto, de formato viejo o de autores que no
 * están en `autores`. Con `firmanteEsperado`, descarta además las firmas que digan venir de otra dirección
 * (el contrato y `enviar` igual verifican la firma de verdad).
 */
export function firmaMasNueva(salidaGh, sensor, { autores = AUTORES, firmanteEsperado } = {}) {
  let lista = [];
  try {
    lista = JSON.parse(String(salidaGh).trim().replace(/\]\s*\[/g, ","));
  } catch {
    return null;
  }
  if (!Array.isArray(lista)) return null;
  const firmas = lista
    .filter((c) => typeof c?.body === "string" && c.body.includes(MARCA) && c.body.includes("```json"))
    .filter((c) => autores.includes(c?.user?.login))
    .map((c) => {
      try {
        return JSON.parse(c.body.split("```json")[1].split("```")[0]);
      } catch {
        return null;
      }
    })
    .filter((f) => f && f.version === 3 && f.reporte && Number(f.reporte.sensor) === sensor)
    .filter((f) => !firmanteEsperado || String(f.firmante ?? "").toLowerCase() === String(firmanteEsperado).toLowerCase());
  firmas.sort((a, b) => Number(b.reporte.observedAt) - Number(a.reporte.observedAt));
  return firmas[0] ?? null;
}

/** ¿El contrato aceptaría este par por tiempos? Devuelve null si sí, o el motivo si no. */
export function motivoParaEsperar(mia, otra, ahora = Date.now() / 1000) {
  const a = Number(mia.reporte.observedAt);
  const b = Number(otra.reporte.observedAt);
  if (Math.abs(a - b) > SPREAD) return "Las dos firmas tienen más de 3 h de diferencia: espero una más nueva del otro oráculo.";
  if (ahora - Math.min(a, b) > EDAD) return "Una de las firmas es demasiado vieja: espero una más nueva.";
  return null;
}
