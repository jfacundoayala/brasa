// Envío del par de reportes al contrato del fondo en Stellar.
//
// Cada oráculo es una cuenta de Stellar y autoriza SOLO su reporte. La red se ocupa de que una
// autorización no se pueda usar dos veces ni después de vencida.
// Las claves llegan por variables de entorno y no se escriben en ningún archivo.
import {
  BASE_FEE, Contract, Keypair, Networks, TransactionBuilder,
  authorizeEntry, nativeToScVal, rpc, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const REDES = { testnet: Networks.TESTNET, mainnet: Networks.PUBLIC };
const bytes = (hex) => xdr.ScVal.scvBytes(Buffer.from(String(hex).replace(/^0x/, ""), "hex"));

/** El reporte como lo espera el contrato: un mapa con las claves en orden alfabético. */
export function reporteScVal({ zoneId, polygonHash, sensor, hotspots, observedAt, dataTime, dataHash }) {
  const campos = {
    data_hash: bytes(dataHash),
    data_time: nativeToScVal(dataTime, { type: "u64" }),
    hotspots: nativeToScVal(hotspots, { type: "u32" }),
    observed_at: nativeToScVal(observedAt, { type: "u64" }),
    polygon_hash: bytes(polygonHash),
    sensor: nativeToScVal(sensor, { type: "u32" }),
    zone_id: bytes(zoneId),
  };
  return xdr.ScVal.scvMap(
    Object.keys(campos).sort().map((k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: campos[k] })),
  );
}

export function conexion(dep) {
  const red = REDES[dep.red];
  if (!red) throw new Error(`Red de Stellar desconocida: ${dep.red}`);
  return { server: new rpc.Server(dep.rpc), red };
}

async function armar(server, red, cuenta, op) {
  const origen = await server.getAccount(cuenta);
  return new TransactionBuilder(origen, { fee: BASE_FEE, networkPassphrase: red }).addOperation(op).setTimeout(120).build();
}

/** Lee del contrato sin enviar nada (simulación). `cuenta`: cualquier cuenta que exista en la red. */
export async function leer(dep, cuenta, funcion, ...args) {
  const { server, red } = conexion(dep);
  const sim = await server.simulateTransaction(await armar(server, red, cuenta, new Contract(dep.contrato).call(funcion, ...args)));
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${funcion}: ${sim.error}`);
  return scValToNative(sim.result.retval);
}

export const leerZona = (dep, cuenta) => leer(dep, cuenta, "zone", bytes(dep.zona.id));

/**
 * Manda `report_fire(a, b)`. `oraculos`: las dos claves secretas (sensor 0 y sensor 1).
 * `remitente`: la clave que paga la comisión de red; no hace falta que sea un oráculo.
 * Devuelve { hash, estado, evento }.
 */
export async function enviarReportes(dep, reportes, { oraculos, remitente }) {
  const { server, red } = conexion(dep);
  const firmantes = oraculos.map((s) => Keypair.fromSecret(s));
  const paga = Keypair.fromSecret(remitente);
  const llamada = new Contract(dep.contrato).call("report_fire", ...reportes.map(reporteScVal));
  const sim1 = await server.simulateTransaction(await armar(server, red, paga.publicKey(), llamada));
  if (rpc.Api.isSimulationError(sim1)) throw new Error(`El contrato rechazó el reporte: ${sim1.error}`);

  // Cada oráculo firma solo la autorización que lleva su dirección.
  const hasta = (await server.getLatestLedger()).sequence + 200;
  const firmadas = [];
  for (const entrada of sim1.result.auth) {
    const quien = JSON.stringify(entrada, (k, v) => (typeof v === "bigint" ? v.toString() : v)).match(/"address":"(G[A-Z2-7]{55})"/)?.[1];
    const clave = firmantes.find((k) => k.publicKey() === quien);
    if (!clave) throw new Error(`El contrato pide una autorización de ${quien}, que no es ninguno de los oráculos.`);
    firmadas.push(await authorizeEntry(entrada, clave, hasta, red));
  }
  const cuerpo = llamada.body.value ?? Object.values(llamada.body).find((v) => v && typeof v === "object" && "auth" in v);
  if (!cuerpo) throw new Error("Forma inesperada de la operación: no encuentro dónde van las autorizaciones.");
  cuerpo.auth = firmadas;
  const tx = await armar(server, red, paga.publicKey(), llamada);
  const sim2 = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim2)) throw new Error(`El contrato rechazó el reporte: ${sim2.error}`);
  const final = rpc.assembleTransaction(tx, sim2).build();
  final.sign(paga);

  const envio = await server.sendTransaction(final);
  if (envio.status === "ERROR") throw new Error(`La red rechazó la transacción: ${JSON.stringify(envio.errorResult)}`);
  let r;
  do {
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await server.getTransaction(envio.hash);
  } while (r.status === "NOT_FOUND");
  return { hash: envio.hash, estado: r.status, evento: r.status === "SUCCESS" ? scValToNative(r.returnValue) : null };
}
