// Tabla de sensibilidad de la meta: "si el costo real es la mitad, la meta baja a X".
// Usa la regla vigente del contrato: meta = focos * 14 ha * (combate + logística + asistencia) por hectárea.
// Los costos base (224/48/48 USD/ha = 320, el dato verificado de Chile 2023) son supuestos calibrados. Cuando haya datos de bomberos, se cambian en BASE.
//
//   node src/sensibilidad.mjs            imprime la tabla en Markdown para los incendios de web/public/focos.json
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BASE = { combate: 224, logistica: 48, asistencia: 48 }; // USD por hectárea = 320 (dato verificado de Chile 2023; ver docs/producto/FORMULA-BRASA.md)
export const HA_POR_FOCO = 14;
export const ESCENARIOS = [
  { nombre: "La mitad", factor: 0.5 },
  { nombre: "Base (supuesto)", factor: 1 },
  { nombre: "50 % más", factor: 1.5 },
  { nombre: "El doble", factor: 2 },
];

export function meta(focos, factor = 1, costos = BASE) {
  const porHa = (costos.combate + costos.logistica + costos.asistencia) * factor;
  return Math.round(focos * HA_POR_FOCO * porHa);
}

export function tabla(incendios, costos = BASE) {
  const filas = incendios.map((x) => ({
    incendio: x.id,
    nivel: x.nivel,
    focos: x.focos,
    ha: x.focos * HA_POR_FOCO,
    metas: ESCENARIOS.map((e) => meta(x.focos, e.factor, costos)),
  }));
  const total = ESCENARIOS.map((e, i) => filas.reduce((a, f) => a + f.metas[i], 0));
  return { filas, total };
}

function aMarkdown(t) {
  const cab = `| Incendio | Nivel | Focos | Ha | ${ESCENARIOS.map((e) => e.nombre).join(" | ")} |\n|---|---|---|---|${ESCENARIOS.map(() => "---").join("|")}|`;
  const fmt = (n) => n.toLocaleString("es-AR");
  const cuerpo = t.filas.map((f) => `| ${f.incendio} | ${f.nivel} | ${f.focos} | ${f.ha} | ${f.metas.map(fmt).join(" | ")} |`).join("\n");
  const pie = `| **Total** | | | | ${t.total.map((n) => `**${fmt(n)}**`).join(" | ")} | `.replace(/\| $/, "|");
  return `${cab}\n${cuerpo}\n${pie.replace(/^\| \*\*Total\*\* \| \| \| \|/, "| **Total** | | | |")}`;
}

if (process.argv[1] && process.argv[1].endsWith("sensibilidad.mjs")) {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const focos = JSON.parse(readFileSync(resolve(aqui, "..", "..", "web", "public", "focos.json"), "utf8"));
  console.log(`Costos base (supuestos): combate ${BASE.combate}, logística ${BASE.logistica}, asistencia ${BASE.asistencia} USD/ha.\n`);
  console.log("Meta en USD por incendio según qué tan real sea el costo:\n");
  console.log(aMarkdown(tabla(focos.incendios ?? [])));
}
