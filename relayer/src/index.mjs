// Relayer de Brasa.
//
//   node src/index.mjs preparar            Arma web/public/focos.json con los focos para el mapa (datos guardados o --live).
//   node src/index.mjs reportar            Cuenta focos, firma dos reportes (dos sensores) y llama a reportFire (las DOS claves en un solo proceso: solo demo).
//   node src/index.mjs firmar --oraculo N  Cada oráculo firma SU reporte con SU clave y escribe firma-oraculoN.json (sin claves).
//   node src/index.mjs enviar f0.json f1.json  Una persona manda el par de firmas al contrato (así los oráculos son de verdad independientes).
//   node src/index.mjs verificar-hash      Muestra la huella (dataHash) de los datos de cada sensor.
//   node src/index.mjs verificar-hash --tx 0x…
//                                          Lee un reportFire de la cadena, recalcula las huellas y dice si coinciden.
//
// Opciones:  --live  baja datos de la API de FIRMS (necesita MAP_KEY en el entorno).
//            Sin --live usa los datos reales guardados en sample-data/ ("datos guardados", se avisa en pantalla).
//            Para firmar y reportar, los datos guardados solo valen en la cadena local (31337): en Fuji se exige --live
//            y el contrato v2 además rechaza datos de NASA de más de 24 h.
//            --datos <carpeta>  usa los CSV de otra carpeta (mismos nombres de archivo que sample-data/).
//            --rpc <url>        RPC para --tx (por defecto, el de deployment.json o el público de Fuji).
// Claves:    ORACLE0_PRIVATE_KEY y ORACLE1_PRIVATE_KEY en el entorno (solo testnet, billeteras descartables).
//            LOCAL_DEMO=1 usa las cuentas públicas de Hardhat y solo funciona en la cadena local 31337.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, HDNodeWallet, Mnemonic, verifyTypedData } from "ethers";
import { BBOX, POLIGONO_SALTA, SENSORES, SENSOR_EXTRA, bajarFirmsTexto, parseCsv, cargarCsvLocal, nivelConfianza, resumir, cruzarSensores, huellaPoligono } from "./firms.mjs";
import { firmarReporte, nuevoNonce, dominio, TIPOS } from "./reporte.mjs";
import { agruparIncendios } from "./incendios.mjs";
import { guardarDatosDelReporte, sello } from "./archivo.mjs";
import { decodificarReportFire, eventoDelRecibo, verificarReportes } from "./verificar.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..", "..");
const archivoDespliegue = process.env.DEPLOYMENT_FILE ?? resolve(raiz, "web", "public", "deployment.json");
const RPC_FUJI = "https://api.avax-test.network/ext/bc/C/rpc";
// La ABI completa sale del contrato compilado; se lee solo cuando hace falta (verificar-hash no la necesita).
const abiFondo = () =>
  JSON.parse(readFileSync(resolve(raiz, "contracts", "artifacts", "contracts", "BrasaFund.sol", "BrasaFund.json"), "utf8")).abi;

const args = process.argv.slice(2);
const orden = args[0];
const vivo = args.includes("--live");
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith("--")) throw new Error(`Falta el valor de ${nombre}.`);
  return v;
};
const muestras = resolve(opcion("--datos") ?? resolve(aqui, "..", "sample-data"));

// CSV tal cual llegó de FIRMS en esta corrida (solo con --live), para guardarlo junto al reporte.
const crudos = {};

async function leerDatos() {
  const out = {};
  for (const s of [...SENSORES, SENSOR_EXTRA]) {
    let filas;
    if (vivo) {
      const key = process.env.MAP_KEY;
      if (!key) throw new Error("Con --live hace falta MAP_KEY en el entorno (la sacás gratis en firms.modaps.eosdis.nasa.gov/api/map_key).");
      crudos[s.clave] = await bajarFirmsTexto(s.fuenteApi, key);
      filas = parseCsv(crudos[s.clave]);
    } else {
      filas = cargarCsvLocal(resolve(muestras, s.archivo));
    }
    out[s.clave] = resumir(filas);
  }
  return cruzarSensores(out); // suma a cada sensor VIIRS los focos que el otro satélite también vio a menos de 2 km
}

/** Con --live, deja una copia de los CSV usados para que cualquiera pueda rehacer la huella. */
function guardarCopia(datos) {
  if (!vivo) return;
  const carpeta = guardarDatosDelReporte(resolve(raiz, "datos-reportes"), sello(), [...SENSORES, SENSOR_EXTRA], crudos, datos);
  console.log(`Copia de los datos de FIRMS: ${carpeta}  (publicala; se verifica con verificar-hash --datos <esa carpeta>)`);
}

async function preparar() {
  const datos = await leerDatos();
  const focos = [];
  for (const [sensor, r] of Object.entries(datos)) {
    for (const f of r.focos) {
      focos.push({
        lat: Number(f.latitude),
        lon: Number(f.longitude),
        sensor,
        confianza: nivelConfianza(f),
        fecha: f.acq_date,
        hora: String(f.acq_time).padStart(4, "0"),
        // Potencia del fuego (FRP, en megavatios): la NASA la usa como medida de intensidad.
        ...(Number.isFinite(Number(f.frp)) && { frp: Number(f.frp) }),
      });
    }
  }
  const salida = {
    generatedAt: new Date().toISOString(),
    datosGuardados: !vivo,
    fuente: "NASA FIRMS (VIIRS NOAA-20, VIIRS NOAA-21, MODIS)",
    zona: { nombre: "Salta", bbox: BBOX, poligono: POLIGONO_SALTA },
    conteo: Object.fromEntries(
      Object.entries(datos).map(([k, r]) => [k, { total: r.total, altaConfianza: r.altaConfianza, ...(r.confirmados !== undefined && { confirmados: r.confirmados }) }])
    ),
    ultimaDeteccionUtc: Math.max(0, ...SENSORES.map((s) => datos[s.clave].ultimaDeteccionUtc)),
    incendios: agruparIncendios(focos),
    focos,
  };
  const destino = resolve(raiz, "web", "public", "focos.json");
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(salida));
  console.log(`focos.json: ${focos.length} focos (${vivo ? "en vivo" : "datos guardados"})`, salida.conteo);
}

function clavesOraculos(chainId) {
  if (process.env.ORACLE0_PRIVATE_KEY && process.env.ORACLE1_PRIVATE_KEY) {
    return [process.env.ORACLE0_PRIVATE_KEY, process.env.ORACLE1_PRIVATE_KEY];
  }
  if (process.env.LOCAL_DEMO === "1") {
    if (chainId !== 31337n) throw new Error("LOCAL_DEMO=1 solo vale en la cadena local (chainId 31337).");
    const m = Mnemonic.fromPhrase("test test test test test test test test test test test junk"); // frase pública de Hardhat
    return [2, 3].map((i) => HDNodeWallet.fromMnemonic(m, `m/44'/60'/0'/0/${i}`).privateKey);
  }
  throw new Error("Faltan ORACLE0_PRIVATE_KEY y ORACLE1_PRIVATE_KEY en el entorno.");
}

const MAX_DATA_AGE = 24 * 3600; // igual que en el contrato

/** Antes de leer nada del contrato: que sea el v3 y que fuera de la cadena local se use --live. */
function chequearDespliegue(dep, chainId) {
  if (dep.version !== 3) {
    throw new Error(`${archivoDespliegue} es de un contrato anterior (v${dep.version ?? 1}, ${dep.fund}). Este relayer firma el formato del v3: desplegá el v3 o usá DEPLOYMENT_FILE.`);
  }
  if (!vivo && orden !== "enviar" && chainId !== 31337n) {
    throw new Error("En Fuji se firma solo con datos en vivo (--live). Los datos guardados son para la cadena local.");
  }
}

/**
 * Horas que van en el reporte. En vivo: dataTime es la hora real de la detección más nueva de NASA y observedAt el
 * momento de firmar. Con datos guardados solo en la cadena local, y simulado (se avisa).
 */
function horasDelReporte(r, ahora, chainId, nombre) {
  if (!vivo) {
    if (chainId !== 31337n) {
      throw new Error("En Fuji se firma solo con datos en vivo (--live). Los datos guardados son para la cadena local.");
    }
    return { observedAt: ahora, dataTime: ahora - 1800 }; // simulación local: "el satélite pasó hace 30 min"
  }
  const dataTime = Math.min(r.ultimaDeteccionUtc, ahora);
  if (!r.ultimaDeteccionUtc || ahora - dataTime > MAX_DATA_AGE) {
    throw new Error(`${nombre}: el dato más nuevo de NASA es de hace más de 24 h (o no hay). No firmo: el contrato lo rechazaría.`);
  }
  return { observedAt: ahora, dataTime };
}

/** El polígono con el que contamos tiene que ser el que guardó la zona en el contrato. */
function polígonoDeLaZona(zona) {
  const local = huellaPoligono();
  if (local.toLowerCase() !== String(zona.polygonHash).toLowerCase()) {
    throw new Error(`El polígono local (${local}) no es el de la zona en el contrato (${zona.polygonHash}). No firmo.`);
  }
  return local;
}

function chequearMinimo(s, r, zona, verbo) {
  if (r.confirmados < Number(zona.minHotspots)) {
    throw new Error(
      `${s.nombre}: ${r.confirmados} focos confirmados por los dos satélites (de ${r.altaConfianza} de alta confianza); el mínimo de la zona es ${zona.minHotspots}. No ${verbo}.`
    );
  }
}

async function reportar() {
  if (!existsSync(archivoDespliegue)) throw new Error(`No encuentro ${archivoDespliegue}. Corré primero el deploy.`);
  const dep = JSON.parse(readFileSync(archivoDespliegue, "utf8"));
  const provider = new JsonRpcProvider(dep.rpc, undefined, { cacheTimeout: -1 });
  const red = await provider.getNetwork();
  if (red.chainId !== BigInt(dep.chainId)) throw new Error(`La red (${red.chainId}) no coincide con deployment.json (${dep.chainId}).`);
  chequearDespliegue(dep, red.chainId);

  const claves = clavesOraculos(red.chainId);
  const datos = await leerDatos();
  guardarCopia(datos);
  const fondo = new Contract(dep.fund, abiFondo(), provider);
  const zona = await fondo.zones(dep.zoneId);
  if (!zona.exists) throw new Error("La zona no existe en el contrato.");

  const polygonHash = polígonoDeLaZona(zona);
  const bloque = await provider.getBlock("latest");
  const ahora = bloque.timestamp;
  const nonce = nuevoNonce();
  const firmas = [];
  const hotspots = [];
  for (const s of SENSORES) {
    const r = datos[s.clave];
    const { observedAt, dataTime } = horasDelReporte(r, ahora, red.chainId, s.nombre);
    chequearMinimo(s, r, zona, "envío nada");
    const f = await firmarReporte({
      clave: claves[s.id],
      chainId: Number(red.chainId),
      fondo: dep.fund,
      zoneId: dep.zoneId,
      polygonHash,
      sensor: s.id,
      hotspots: r.confirmados,
      observedAt,
      dataTime,
      dataHash: r.dataHash,
      nonce,
    });
    firmas.push(f);
    hotspots.push(r.confirmados);
    console.log(`${s.nombre}: ${r.confirmados} focos confirmados por los dos satélites (de ${r.altaConfianza} de alta confianza), dato de ${new Date(dataTime * 1000).toISOString()}, firma de ${f.firmante}`);
  }
  if (!vivo) console.log("AVISO: cadena local con datos GUARDADOS y hora simulada (\"el satélite pasó hace 30 min\"). En Fuji esto no se puede.");

  await enviarReporte({ dep, provider, fondo, firmas, hotspots, pk: process.env.RELAYER_PRIVATE_KEY ?? claves[0], datosGuardados: !vivo });
}

/** Manda el par de reportes firmados al contrato. `pk` paga el gas; no hace falta que sea ninguna clave de oráculo. */
async function enviarReporte({ dep, provider, fondo, firmas, hotspots, pk, datosGuardados }) {
  const menor = Math.min(...hotspots);
  const [area, meta] = await fondo.previewTarget(dep.zoneId, menor);
  const saldo = await fondo.zoneBalance(dep.zoneId);
  console.log(`Regla pública: ${menor} focos × 14 ha = ${area} ha → meta ${Number(meta) / 1e6} USDC. Saldo de la zona: ${Number(saldo) / 1e6} USDC.`);

  // v3: solo cobran los cuarteles que la federación asignó al incendio. Sin asignación vigente el contrato revierte.
  if (saldo > 0n) {
    const [asignados, hasta] = await fondo.responders(dep.zoneId);
    const ahora = (await provider.getBlock("latest")).timestamp;
    if (asignados.length === 0 || Number(hasta) < ahora) {
      throw new Error("La federación todavía no asignó cuarteles a este incendio (o la asignación venció). No envío: el contrato lo rechazaría. Ver contracts/scripts/asignar.mjs.");
    }
  }

  const { Wallet } = await import("ethers");
  const billetera = new Wallet(pk, provider);
  let tx;
  try {
    tx = await fondo.connect(billetera).reportFire([firmas[0].reporte, firmas[1].reporte], [firmas[0].firma, firmas[1].firma]);
  } catch (e) {
    const err = e.data ? fondo.interface.parseError(e.data) : null;
    throw new Error(err ? `El contrato rechazó el reporte: ${err.name}` : (e.shortMessage ?? e.message));
  }
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  const evento = rc.logs.map((l) => { try { return fondo.interface.parseLog(l); } catch { return null; } }).find((e) => e?.name === "FireEvent");
  const liberado = evento ? Number(evento.args.released) / 1e6 : 0;
  console.log(`Liberado: ${liberado} USDC (evento #${evento?.args.eventId}). Bloque ${rc.blockNumber}.`);
  const resumen = {
    tx: tx.hash,
    block: rc.blockNumber,
    explorer: dep.explorer ? `${dep.explorer}/tx/${tx.hash}` : "",
    eventId: evento ? Number(evento.args.eventId) : null,
    hotspots: menor,
    areaHa: Number(area),
    targetUsdc: Number(meta) / 1e6,
    releasedUsdc: liberado,
    datosGuardados,
  };
  writeFileSync(resolve(raiz, "web", "public", "ultimo-reporte.json"), JSON.stringify(resumen, null, 2) + "\n");
  if (liberado > 0 && dep.network === "fuji") {
    anotarLiberacion(dep.fund, { tx: tx.hash, eventId: resumen.eventId, fecha: new Date().toISOString(), focos: menor, liberadoUsdc: liberado });
  }
}

/** Suma la liberación a web/public/liberaciones.json (va al repo): la web la muestra aunque el RPC no deje leer el historial. */
function anotarLiberacion(fondo, item) {
  const archivo = resolve(raiz, "web", "public", "liberaciones.json");
  const todo = existsSync(archivo) ? JSON.parse(readFileSync(archivo, "utf8")) : {};
  const lista = todo[fondo] ?? [];
  if (!lista.some((x) => x.tx === item.tx)) lista.push(item);
  todo[fondo] = lista;
  writeFileSync(archivo, JSON.stringify(todo, null, 2) + "\n");
  console.log(`Anotada en ${archivo}: subila al repo para que la web publicada la muestre.`);
}

// --- Dos personas, dos claves: cada oráculo firma SU reporte en SU máquina y uno solo manda el par al contrato. ---
async function contexto() {
  if (!existsSync(archivoDespliegue)) throw new Error(`No encuentro ${archivoDespliegue}. Corré primero el deploy.`);
  const dep = JSON.parse(readFileSync(archivoDespliegue, "utf8"));
  const provider = new JsonRpcProvider(dep.rpc, undefined, { cacheTimeout: -1 });
  const red = await provider.getNetwork();
  if (red.chainId !== BigInt(dep.chainId)) throw new Error(`La red (${red.chainId}) no coincide con deployment.json (${dep.chainId}).`);
  chequearDespliegue(dep, red.chainId);
  const fondo = new Contract(dep.fund, abiFondo(), provider);
  const zona = await fondo.zones(dep.zoneId);
  if (!zona.exists) throw new Error("La zona no existe en el contrato.");
  return { dep, provider, red, fondo, zona };
}

function valorDe(opcion) {
  const i = args.indexOf(opcion);
  return i >= 0 ? args[i + 1] : undefined;
}

const aTipos = (r) => ({ ...r, observedAt: BigInt(r.observedAt), dataTime: BigInt(r.dataTime), nonce: BigInt(r.nonce) });

/** node src/index.mjs firmar --oraculo 0|1 [--live]  ->  escribe firma-oraculo<N>.json (sin claves). Usa ORACLE<N>_PRIVATE_KEY. */
async function firmar() {
  const n = Number(valorDe("--oraculo"));
  if (![0, 1].includes(n)) throw new Error("Usá --oraculo 0 o --oraculo 1.");
  const clave = process.env[`ORACLE${n}_PRIVATE_KEY`];
  if (!clave) throw new Error(`Falta ORACLE${n}_PRIVATE_KEY en el entorno (solo la clave de este oráculo).`);
  const { dep, provider, red, zona } = await contexto();
  const s = SENSORES[n];
  const todos = await leerDatos();
  guardarCopia(todos);
  const r = todos[s.clave];
  const polygonHash = polígonoDeLaZona(zona);
  const ahora = (await provider.getBlock("latest")).timestamp;
  const { observedAt, dataTime } = horasDelReporte(r, ahora, red.chainId, s.nombre);
  chequearMinimo(s, r, zona, "firmo");
  const f = await firmarReporte({
    clave, chainId: Number(red.chainId), fondo: dep.fund, zoneId: dep.zoneId, polygonHash, sensor: s.id,
    hotspots: r.confirmados, observedAt, dataTime, dataHash: r.dataHash, nonce: nuevoNonce(),
  });
  const salida = {
    version: 3,
    chainId: Number(red.chainId),
    fondo: dep.fund,
    firmante: f.firmante,
    datosGuardados: !vivo,
    reporte: { ...f.reporte, observedAt: String(f.reporte.observedAt), dataTime: String(f.reporte.dataTime), nonce: String(f.reporte.nonce) },
    firma: f.firma,
  };
  const archivo = resolve(process.cwd(), `firma-oraculo${n}.json`);
  writeFileSync(archivo, JSON.stringify(salida, null, 2) + "\n");
  console.log(`${s.nombre}: ${r.confirmados} focos confirmados por los dos satélites (de ${r.altaConfianza} de alta confianza), dato de ${new Date(dataTime * 1000).toISOString()}, firma de ${f.firmante}`);
  console.log(`Escribí ${archivo}. No tiene claves: se puede pasar al otro oráculo.`);
}

/** node src/index.mjs enviar firma-oraculo0.json firma-oraculo1.json  ->  manda el par al contrato. Paga el gas RELAYER_PRIVATE_KEY (o una clave de oráculo). */
async function enviar() {
  const archivos = args.slice(1).filter((a) => !a.startsWith("--"));
  if (archivos.length !== 2) throw new Error("Uso: enviar firma-oraculo0.json firma-oraculo1.json");
  const { dep, provider, red, fondo } = await contexto();
  const firmas = archivos.map((a) => JSON.parse(readFileSync(a, "utf8")));
  for (const f of firmas) {
    if (f.version !== 3) throw new Error("Una de las firmas es de un formato viejo (v1 o v2). Hay que volver a firmar con el relayer actual.");
    if (f.datosGuardados && red.chainId !== 31337n) throw new Error("Una firma se hizo con datos guardados: en Fuji solo valen firmas con --live.");
    if (f.chainId !== Number(red.chainId) || f.fondo.toLowerCase() !== dep.fund.toLowerCase()) throw new Error("Una de las firmas es de otro contrato o de otra red.");
    const rec = verifyTypedData(dominio(f.chainId, f.fondo), TIPOS, aTipos(f.reporte), f.firma);
    if (rec.toLowerCase() !== f.firmante.toLowerCase()) throw new Error("Una firma no corresponde a su firmante declarado.");
  }
  firmas.sort((a, b) => a.reporte.sensor - b.reporte.sensor);
  if (firmas[0].reporte.sensor === firmas[1].reporte.sensor) throw new Error("Las dos firmas son del mismo sensor: hacen falta sensores distintos.");
  // El contrato exige que el sensor 0 lo firme oracle0 y el 1 oracle1: lo chequeamos antes de gastar gas.
  const autorizados = [await fondo.oracle0(), await fondo.oracle1()];
  for (const f of firmas) {
    if (f.firmante.toLowerCase() !== autorizados[f.reporte.sensor].toLowerCase()) throw new Error(`La firma del sensor ${f.reporte.sensor} es de ${f.firmante}, pero el contrato espera ${autorizados[f.reporte.sensor]}.`);
  }
  const pk = process.env.RELAYER_PRIVATE_KEY ?? process.env.ORACLE0_PRIVATE_KEY ?? process.env.ORACLE1_PRIVATE_KEY;
  if (!pk) throw new Error("Falta una clave para pagar el gas (RELAYER_PRIVATE_KEY).");
  await enviarReporte({
    dep, provider, fondo, pk,
    firmas: firmas.map((f) => ({ reporte: aTipos(f.reporte), firma: f.firma })),
    hotspots: firmas.map((f) => f.reporte.hotspots),
    datosGuardados: firmas.some((f) => f.datosGuardados),
  });
}

async function verificarHash() {
  const datos = await leerDatos();
  const origen = vivo ? "API de FIRMS en vivo" : `datos guardados en ${muestras}`;
  const txHash = opcion("--tx");

  if (!txHash) {
    console.log(`Huellas (dataHash) recalculadas con ${origen}:`);
    for (const s of SENSORES) {
      const r = datos[s.clave];
      const hora = r.ultimaDeteccionUtc ? new Date(r.ultimaDeteccionUtc * 1000).toISOString() : "sin datos";
      console.log(`  ${s.nombre}: ${r.dataHash}  (${r.altaConfianza} focos de alta confianza en Salta, ${r.confirmados} confirmados por el otro satélite a menos de 2 km; dato más nuevo: ${hora})`);
    }
    console.log(`  Polígono (polygonHash): ${huellaPoligono()}`);
    console.log("Para comparar con la cadena: node src/index.mjs verificar-hash --tx <hash de la transacción reportFire>");
    return;
  }

  let rpc = opcion("--rpc");
  if (!rpc && existsSync(archivoDespliegue)) rpc = JSON.parse(readFileSync(archivoDespliegue, "utf8")).rpc;
  const provider = new JsonRpcProvider(rpc ?? RPC_FUJI, undefined, { cacheTimeout: -1 });
  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error(`No encuentro la transacción ${txHash} en ${rpc ?? RPC_FUJI}.`);
  const recibo = await provider.getTransactionReceipt(txHash);
  if (recibo && recibo.status !== 1) console.log("AVISO: esa transacción falló en la cadena (revert); igual verifico lo que se envió.");

  const reportes = decodificarReportFire(tx.data);
  // En la cadena local la hora del dato es simulada: ahí no se compara.
  const resultados = verificarReportes(reportes, datos, { chainId: Number(tx.chainId), fondo: tx.to, horaSimulada: Number(tx.chainId) === 31337 });
  const evento = eventoDelRecibo(recibo?.logs);

  console.log(`Transacción ${txHash} (contrato ${tx.to}), comparada con ${origen}:`);
  for (const r of resultados) {
    if (r.error) {
      console.log(`  ${r.nombre}: ERROR, ${r.error}`);
      continue;
    }
    console.log(`  ${r.nombre}: ${r.ok ? "COINCIDE" : "NO COINCIDE"}`);
    console.log(`    huella en la cadena:  ${r.dataHashCadena}`);
    console.log(`    huella recalculada:   ${r.dataHashRecalculado}${r.huellaOk ? "" : "  <- distinta"}`);
    if (r.formato === "v1") {
      console.log(`    focos de alta confianza en la cadena: ${r.focosCadena}; recalculados: ${r.focosRecalculados}${r.focosOk ? "" : "  <- distintos"}`);
      console.log("    (reporte del contrato v1: no trae hora del dato ni polígono, y los focos no se cruzaban entre satélites)");
      continue;
    }
    console.log(`    focos confirmados en la cadena: ${r.focosCadena}; recalculados: ${r.focosRecalculados} (de ${r.focosAltaConfianza} de alta confianza)${r.focosOk ? "" : "  <- distintos"}`);
    const iso = (t) => (t ? new Date(t * 1000).toISOString() : "sin dato");
    console.log(`    hora del dato en la cadena: ${iso(r.horaCadena)}; recalculada: ${iso(r.horaRecalculada)}${r.horaOk ? "" : "  <- distinta"}`);
    console.log(`    polígono: ${r.poligonoOk ? "el mismo" : `distinto (cadena ${r.poligonoCadena}, local ${r.poligonoLocal})`}`);
    if (r.firmante) console.log(`    firmado por: ${r.firmante}`);
  }
  if (evento) {
    const enEvento = [evento.dataHash0, evento.dataHash1].map((h) => h.toLowerCase());
    const enTx = reportes.map((x) => String(x.reporte.dataHash).toLowerCase());
    const iguales = enEvento[0] === enTx[0] && enEvento[1] === enTx[1];
    console.log(`  FireEvent #${evento.eventId}: ${iguales ? "las huellas del evento son las mismas que las del reporte" : "las huellas del evento NO son las del reporte"}`);
  }
  if (resultados.some((r) => !r.ok)) {
    console.log("Resultado: NO COINCIDE. Los datos que tenés no son los que usó el oráculo (o el reporte se armó con otros).");
    process.exitCode = 1;
  } else {
    console.log("Resultado: COINCIDE. El reporte en la cadena se armó exactamente con estos datos de NASA FIRMS.");
  }
}

try {
  if (orden === "preparar") await preparar();
  else if (orden === "reportar") await reportar();
  else if (orden === "firmar") await firmar();
  else if (orden === "enviar") await enviar();
  else if (orden === "verificar-hash") await verificarHash();
  else {
    console.log("Uso: node src/index.mjs preparar | reportar | firmar --oraculo 0|1 | enviar <firma0.json> <firma1.json> | verificar-hash [--tx <hash>]   [--live] [--datos <carpeta>] [--rpc <url>]");
    process.exit(2);
  }
} catch (e) {
  console.error(String(e.shortMessage ?? e.message ?? e).slice(0, 500));
  process.exit(1);
}
