// Revisa que los links relativos de los .md del repo apunten a archivos que existen.
// Uso: node .github/revisar-enlaces.mjs   (sale con código 1 si hay links rotos)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALTEAR = new Set(["node_modules", ".git", ".next", "artifacts", "cache", "coverage"]);

function listar(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SALTEAR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) listar(p, out);
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

let rotos = 0;
for (const f of listar(raiz)) {
  const texto = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, destino] of texto.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(destino)) continue;
    const ruta = decodeURI(destino.split("#")[0]);
    if (ruta && !existsSync(resolve(dirname(f), ruta))) {
      console.log(`${relative(raiz, f)}: ${destino}`);
      rotos++;
    }
  }
}
console.log(rotos ? `${rotos} links rotos` : "Todos los links relativos existen.");
process.exit(rotos ? 1 : 0);
