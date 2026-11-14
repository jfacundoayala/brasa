// Buzón de firmas: cada oráculo firma solo en su máquina y deja la firma en una issue de GitHub;
// el que tiene --enviar junta las dos y manda la liberación. Así nadie tiene que esperar al otro.
//
//   node src/buzon.mjs --oraculo 0 --issue 58                 (Facundo: firma y publica)
//   node src/buzon.mjs --oraculo 1 --issue 58 --enviar        (Gastón: firma, publica y envía el par)
//
// Opciones: --cada <minutos> (20) · --hasta <HH:MM, hora argentina> (19:30) · --siempre (no corta nunca) · --repo <dueño/nombre>
//           Con --siempre queda como firma automática: cada operador lo deja corriendo y firma solo cuando hay dato nuevo.
//           --autores <login1,login2> (cuentas de GitHub cuyas firmas se aceptan; por defecto, las del equipo)
//
// Qué viaja por la issue: solo el archivo de firma (reporte + firma EIP-712). No tiene claves.
// El contrato acepta las dos firmas con hasta 3 h de diferencia (MAX_REPORT_SPREAD) y de no más de 6 h.
// Para enviar, paga el gas RELAYER_PRIVATE_KEY; si no está, se usa DEPLOYER_PRIVATE_KEY (o la clave del oráculo).
// Necesita: el CLI `gh` con sesión iniciada, MAP_KEY y ORACLE<N>_PRIVATE_KEY en ../.env.local (o en el entorno).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTORES, comentarioDeFirma, firmaMasNueva, motivoParaEsperar } from "./buzon-lib.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const relayer = resolve(aqui, "..");
const raiz = resolve(relayer, "..");
const args = process.argv.slice(2);
const valor = (o, d) => (args.includes(o) ? args[args.indexOf(o) + 1] : d);

const n = Number(valor("--oraculo"));
const issue = valor("--issue");
const enviar = args.includes("--enviar");
const cadaMin = Number(valor("--cada", "20"));
const hasta = valor("--hasta", "19:30");
const repo = valor("--repo", "jfacundoayala/brasa");
const autores = valor("--autores", AUTORES.join(",")).split(",").map((a) => a.trim()).filter(Boolean);

if (![0, 1].includes(n) || !issue) {
  console.error("Uso: node src/buzon.mjs --oraculo 0|1 --issue <número> [--enviar] [--cada 20] [--hasta 19:30]");
  process.exit(2);
}

// Entorno: ../.env.local si existe (las claves quedan en este proceso y sus hijos; nunca se imprimen).
const envLocal = resolve(raiz, ".env.local");
if (existsSync(envLocal)) process.loadEnvFile(envLocal);
// Contrato: el v3 desplegado en Fuji (se puede cambiar con DEPLOYMENT_FILE).
if (!process.env.DEPLOYMENT_FILE) process.env.DEPLOYMENT_FILE = resolve(raiz, "web", "public", "deployment.fuji-v3.json");
if (enviar && !process.env.RELAYER_PRIVATE_KEY && process.env.DEPLOYER_PRIVATE_KEY)
  process.env.RELAYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const corre = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { cwd: relayer, encoding: "utf8", env: process.env, ...opts });
const nodo = (argv) => corre(process.execPath, argv);
const gh = (argv) => corre("gh", argv);
const hora = () => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
const log = (m) => console.log(`[${hora()}] ${m}`);

function limite() {
  if (args.includes("--siempre")) return Infinity;
  const [h, m] = hasta.split(":").map(Number);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return new Date(`${hoy}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-03:00`).getTime();
}

function chequeos() {
  if (!process.env[`ORACLE${n}_PRIVATE_KEY`]) throw new Error(`Falta ORACLE${n}_PRIVATE_KEY en ../.env.local o en el entorno.`);
  if (!process.env.MAP_KEY) throw new Error("Falta MAP_KEY (la clave gratis de NASA FIRMS) en ../.env.local o en el entorno.");
  // Se prueba la API de verdad (gh auth status puede fallar por una sesión vieja aunque la activa ande).
  if (gh(["api", `repos/${repo}`, "--jq", ".full_name"]).status !== 0)
    throw new Error(`El CLI gh no puede leer ${repo}: corré \`gh auth login\` con una cuenta que tenga acceso al repo.`);
  // El relayer lee la ABI del contrato compilado: se compila para que no quede vieja.
  const c = corre("npx hardhat compile", [], { cwd: resolve(raiz, "contracts"), shell: true });
  if (c.status !== 0) throw new Error("No pude compilar el contrato (cd contracts && npx hardhat compile).");
}

/** Firma con este oráculo. Devuelve el objeto de la firma o null si el relayer se negó (por ejemplo, menos de 2 focos). */
function firmar() {
  const archivo = join(relayer, `firma-oraculo${n}.json`);
  rmSync(archivo, { force: true });
  const r = nodo(["src/index.mjs", "firmar", "--oraculo", String(n), "--live"]);
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n").filter((l) => l.trim() && !/private/i.test(l));
  log(salida.slice(-2).join(" | ") || "(sin salida)");
  return existsSync(archivo) ? JSON.parse(readFileSync(archivo, "utf8")) : null;
}

function publicar(f) {
  const cuerpo = comentarioDeFirma(f, n);
  const tmp = join(mkdtempSync(join(tmpdir(), "buzon-")), "c.md");
  writeFileSync(tmp, cuerpo);
  const p = gh(["issue", "comment", issue, "-R", repo, "--body-file", tmp]);
  if (p.status !== 0) throw new Error(`No pude publicar la firma en la issue ${issue}: ${p.stderr}`);
  log(`Firma publicada en la issue ${issue}.`);
}

/** La firma más nueva del otro oráculo que dejó el buzón (solo de las cuentas del equipo). */
function firmaDelOtro() {
  const r = gh(["api", `repos/${repo}/issues/${issue}/comments`, "--paginate"]);
  return r.status === 0 ? firmaMasNueva(r.stdout, 1 - n, { autores }) : null;
}

function intentarEnvio(mia, otra) {
  const motivo = motivoParaEsperar(mia, otra);
  if (motivo) { log(motivo); return null; }
  const dir = mkdtempSync(join(tmpdir(), "buzon-"));
  const f0 = join(dir, "firma-oraculo0.json"), f1 = join(dir, "firma-oraculo1.json");
  writeFileSync(n === 0 ? f0 : f1, JSON.stringify(mia, null, 2));
  writeFileSync(n === 0 ? f1 : f0, JSON.stringify(otra, null, 2));
  log("Tengo las dos firmas: mando la liberación al contrato…");
  const r = nodo(["src/index.mjs", "enviar", f0, f1]);
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n").filter((l) => l.trim() && !/private/i.test(l));
  console.log(salida.join("\n"));
  if (r.status !== 0) return null;
  const tx = (salida.join(" ").match(/0x[0-9a-fA-F]{64}/) ?? [])[0];
  return tx ?? "enviada";
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

chequeos();
log(`Buzón de firmas: oráculo ${n}, issue ${issue}${enviar ? ", envía el par" : ""}. Intento cada ${cadaMin} min hasta las ${hasta}.`);
let mia = null;
while (Date.now() < limite()) {
  // Firmo de nuevo si no tengo firma o si la mía tiene más de 2 h (para quedar cerca del otro oráculo).
  if (!mia || Date.now() / 1000 - Number(mia.reporte.observedAt) > 2 * 3600) {
    const f = firmar();
    if (f) { mia = f; publicar(f); }
  }
  if (enviar && mia) {
    const otra = firmaDelOtro();
    if (!otra) log(`Todavía no hay firma del oráculo ${1 - n} en el buzón.`);
    else {
      const tx = intentarEnvio(mia, otra);
      if (tx) {
        const tmp = join(mkdtempSync(join(tmpdir(), "buzon-")), "c.md");
        writeFileSync(tmp, `**Liberación enviada** con las dos firmas. Tx: \`${tx}\`\nhttps://testnet.snowtrace.io/tx/${tx}`);
        gh(["issue", "comment", issue, "-R", repo, "--body-file", tmp]);
        log(`Listo: liberación enviada (${tx}).`);
        process.exit(0);
      }
    }
  }
  if (!enviar && mia) { log("Firma publicada: el otro oráculo arma el par y lo envía."); }
  await esperar(cadaMin * 60 * 1000);
}
log(`Llegó la hora límite (${hasta}) sin liberación. Si no hubo 2 focos cruzados, es la regla funcionando: grabar el rechazo para el video.`);
process.exit(3);
