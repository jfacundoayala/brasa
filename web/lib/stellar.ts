// La misma capa de cadena que chain.ts, para el contrato del fondo en Stellar.
//
// El USDC de Stellar tiene 7 decimales y la web trabaja con 6: los montos se convierten acá, al
// leer y al enviar, y el resto de la web no cambia.
// El SDK y el kit de billeteras se cargan recién cuando hacen falta, para no pesar en la portada.
import type { Deployment, EventoLog, Recipient, Reparto, ZoneData } from "./chain";

const TESTNET = "Test SDF Network ; September 2015";
const EXPLORADOR = "https://stellar.expert/explorer/testnet";
/** Ledgers hacia atrás que se miran para el historial (unas 24 horas). */
const VENTANA_HISTORIAL = 17_000;

export const explorerStellar = (d: Deployment) => d.explorer || EXPLORADOR;
export const txUrlStellar = (d: Deployment, h: string) => `${explorerStellar(d)}/tx/${h}`;
export const addrUrlStellar = (d: Deployment, a: string) => `${explorerStellar(d)}/${a.startsWith("C") ? "contract" : "account"}/${a}`;

const aWeb = (v: unknown) => BigInt(v as bigint) / 10n; // 7 decimales -> 6
const aCadena = (v: bigint) => v * 10n; // 6 decimales -> 7
const hex = (b: unknown) => Array.from(b as Uint8Array, (x) => x.toString(16).padStart(2, "0")).join("");
const corta = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;
const red = (d: Deployment) => d.passphrase || TESTNET;

const sdk = () => import("@stellar/stellar-sdk");
type Sdk = Awaited<ReturnType<typeof sdk>>;

/** Lee del contrato sin enviar nada. La cuenta de origen solo hace falta para armar la simulación. */
async function leer(S: Sdk, d: Deployment, contrato: string, funcion: string, ...args: unknown[]): Promise<unknown> {
  const server = new S.rpc.Server(d.rpc);
  const origen = new S.Account(d.federation || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
  const tx = new S.TransactionBuilder(origen, { fee: S.BASE_FEE, networkPassphrase: red(d) })
    .addOperation(new S.Contract(contrato).call(funcion, ...(args as never[])))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (S.rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  if (!sim.result) throw new Error(`${funcion}: la simulación no devolvió nada`);
  return S.scValToNative(sim.result.retval);
}

const deHex = (h: string) => Uint8Array.from((h.replace(/^0x/, "").match(/../g) ?? []).map((x) => parseInt(x, 16)));
const zonaScVal = (S: Sdk, d: Deployment) => S.nativeToScVal(deHex(d.zoneId));

export async function loadZoneStellar(d: Deployment, hotspots: number): Promise<ZoneData> {
  const S = await sdk();
  const zona = zonaScVal(S, d);
  const fondo = (f: string, ...a: unknown[]) => leer(S, d, d.fund, f, ...a);
  const [prev, z, estaciones, asistencia, asignados, cfg] = (await Promise.all([
    fondo("preview_target", zona, S.nativeToScVal(hotspots, { type: "u32" })),
    fondo("zone", zona),
    fondo("station_ids", zona),
    fondo("assistance_ids", zona),
    fondo("responders", zona).catch(() => null),
    fondo("config").catch(() => null),
  ])) as [
    { area_ha: bigint; target: bigint },
    Record<string, bigint | number>,
    Uint8Array[],
    Uint8Array[],
    { ids: Uint8Array[]; valid_until: bigint } | null,
    { min_donation: bigint } | null,
  ];

  const ids = [
    ...estaciones.map((id) => ({ id, kind: "station" as const })),
    ...asistencia.map((id) => ({ id, kind: "assistance" as const })),
  ];
  const recipients: Recipient[] = await Promise.all(
    ids.map(async ({ id, kind }) => {
      const r = (await fondo("recipient", S.nativeToScVal(Uint8Array.from(id)))) as { wallet: string; active: boolean; active_from: bigint };
      return { id: hex(id), label: corta(hex(id)), wallet: r.wallet, kind, active: r.active, activeFrom: Number(r.active_from) };
    }),
  );

  const areaHa = BigInt(prev.area_ha);
  const costos = { combate: aWeb(z.cost_combat_per_ha), logistica: aWeb(z.cost_logistics_per_ha), asistencia: aWeb(z.cost_assist_per_ha) };
  return {
    areaHa,
    target: aWeb(prev.target),
    combate: areaHa * costos.combate,
    logistica: areaHa * costos.logistica,
    asistencia: areaHa * costos.asistencia,
    maxPerEvent: aWeb(z.max_per_event),
    costoHa: costos.combate + costos.logistica + costos.asistencia,
    costosHa: costos,
    balance: aWeb(z.balance),
    totalDonated: aWeb(z.total_donated),
    totalReleased: aWeb(z.total_released),
    hotspots,
    minHotspots: Number(z.min_hotspots),
    recipients,
    responders: (asignados?.ids ?? []).map(hex),
    respondersUntil: Number(asignados?.valid_until ?? 0),
    minDonation: cfg ? aWeb(cfg.min_donation) : null,
    eventos: await historial(S, d).catch(() => []), // sin historial la web sigue andando: los totales salen del contrato
  };
}

/** Los últimos movimientos de la zona, leídos de los eventos del contrato. */
async function historial(S: Sdk, d: Deployment): Promise<EventoLog[]> {
  const server = new S.rpc.Server(d.rpc);
  const ultimo = (await server.getLatestLedger()).sequence;
  // El servidor revisa un tramo de ledgers por pedido y devuelve un cursor para seguir: se piden hasta cuatro tramos.
  const filters = [{ type: "contract" as const, contractIds: [d.fund] }];
  const eventos = [];
  let cursor: string | undefined;
  for (let i = 0; i < 4; i++) {
    const r = await server.getEvents(
      cursor ? { cursor, filters, limit: 200 } : { startLedger: Math.max(1, ultimo - VENTANA_HISTORIAL), filters, limit: 200 },
    );
    eventos.push(...r.events);
    if (!r.cursor || r.cursor === cursor) break;
    cursor = r.cursor;
  }
  const zona = d.zoneId.replace(/^0x/, "").toLowerCase();
  const fmt = (v: unknown) => (Number(aWeb(v)) / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const salida: EventoLog[] = [];
  for (const e of eventos) {
    const temas = e.topic.map((t) => S.scValToNative(t));
    const nombre = String(temas[0]);
    if (!["donated", "fire_event", "released"].includes(nombre)) continue;
    if (hex(temas[1]).toLowerCase() !== zona) continue; // solo la zona que se muestra (las donaciones directas a un cuartel no)
    const v = S.scValToNative(e.value) as Record<string, unknown>;
    const base = { tx: e.txHash, bloque: e.ledger };
    if (nombre === "fire_event") {
      const focos = Number(v.hotspots);
      salida.push({ ...base, tipo: "FireEvent", texto: `Evento #${temas[2]}: ${focos} ${focos === 1 ? "foco" : "focos"}, liberó ${fmt(v.released)} USDC` });
    } else if (nombre === "released") {
      salida.push({ ...base, tipo: "Released", texto: `Evento #${temas[2]}: ${fmt(v.amount)} USDC a ${corta(hex(temas[3]))}` });
    } else {
      salida.push({ ...base, tipo: "Donated", texto: `Donación: ${fmt(v.net)} USDC al fondo (de ${corta(String(temas[2]))})` });
    }
  }
  return salida.sort((x, y) => y.bloque - x.bloque).slice(0, 6);
}

export async function quoteSplitStellar(d: Deployment, amount: bigint, coverFee: boolean): Promise<Reparto> {
  const S = await sdk();
  const r = (await leer(S, d, d.fund, "quote_split", S.nativeToScVal(aCadena(amount), { type: "i128" }), S.xdr.ScVal.scvBool(coverFee))) as Record<
    "net" | "fee" | "total",
    bigint
  >;
  return { net: aWeb(r.net), fee: aWeb(r.fee), total: aWeb(r.total) };
}

/** Saldo de USDC de una cuenta. Si todavía no habilitó USDC, la red responde con error y se muestra cero. */
export async function usdcBalanceStellar(d: Deployment, who: string): Promise<bigint> {
  const S = await sdk();
  return leer(S, d, d.usdc, "balance", new S.Address(who).toScVal()).then(aWeb, () => 0n);
}

// --- Billetera: Stellar Wallets Kit (Varial, xBull, Lobstr, Albedo y otras) ---
/** Billeteras que se ofrecen. Varial va primero: es la que nombra la guía de Stellar. */
const BILLETERAS = ["varial", "xbull", "lobstr", "albedo", "hana", "rabet"];
let kitListo: Promise<typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit> | null = null;
function kit(d: Deployment) {
  kitListo ??= (async () => {
    const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/modules/utils"),
    ]);
    StellarWalletsKit.init({ modules: defaultModules({ filterBy: (m) => BILLETERAS.includes(m.productId) }) });
    StellarWalletsKit.setNetwork(red(d) as never);
    return StellarWalletsKit;
  })();
  return kitListo;
}

/** Abre la ventana para elegir billetera y devuelve la dirección de la cuenta. */
export async function conectarStellar(d: Deployment): Promise<string> {
  return (await (await kit(d)).authModal()).address;
}

/** La cuenta ya conectada en este sitio, o null. No abre ninguna ventana. */
export async function cuentaStellar(d: Deployment): Promise<string | null> {
  try {
    return (await (await kit(d)).getAddress()).address || null;
  } catch {
    return null;
  }
}

export async function desconectarStellar(d: Deployment): Promise<void> {
  await (await kit(d)).disconnect().catch(() => {});
}

/**
 * Dona a la zona. Es una sola firma: en Stellar la misma transacción autoriza al contrato a mover
 * el USDC del donante, no hace falta un permiso previo.
 */
export async function donarStellar(
  d: Deployment,
  amount: bigint,
  coverFee: boolean,
  onStep: (s: { paso: "approve" | "donar"; hash: string }) => void,
): Promise<string> {
  const S = await sdk();
  const K = await kit(d);
  const { address } = await K.getAddress();
  const server = new S.rpc.Server(d.rpc);
  const cuenta = await server.getAccount(address);
  const tx = new S.TransactionBuilder(cuenta, { fee: S.BASE_FEE, networkPassphrase: red(d) })
    .addOperation(
      new S.Contract(d.fund).call(
        "donate_to_zone",
        new S.Address(address).toScVal(),
        zonaScVal(S, d),
        S.nativeToScVal(aCadena(amount), { type: "i128" }),
        S.xdr.ScVal.scvBool(coverFee),
      ),
    )
    .setTimeout(180)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (S.rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const lista = S.rpc.assembleTransaction(tx, sim).build();
  const { signedTxXdr } = await K.signTransaction(lista.toXDR(), { networkPassphrase: red(d), address });
  const envio = await server.sendTransaction(S.TransactionBuilder.fromXDR(signedTxXdr, red(d)));
  if (envio.status === "ERROR") throw new Error("La red rechazó la transacción.");
  onStep({ paso: "donar", hash: envio.hash });
  for (let i = 0; i < 40; i++) {
    await new Promise((ok) => setTimeout(ok, 1500));
    const r = await server.getTransaction(envio.hash);
    if (r.status === "SUCCESS") return envio.hash;
    if (r.status === "FAILED") throw new Error("La transacción falló en la red. No se movió dinero.");
  }
  throw new Error("La red tarda en confirmar. Revisá la transacción en el explorador antes de volver a donar.");
}

/** Errores del contrato de Stellar (por número) y de la red, en castellano. null si no reconoce el error. */
export function errorStellar(texto: string): string | null {
  const bajo = texto.toLowerCase();
  const n = /error\(contract, #(\d+)\)/i.exec(texto)?.[1];
  if (n === "7") return "El monto es menor que la donación mínima del fondo.";
  if (n === "2") return "El fondo no tiene cargada esta zona.";
  if (n === "5") return "Ese destinatario no está activo.";
  if (n === "13") return "Ese destinatario todavía no puede recibir. Su alta está en espera.";
  if (n === "10" && bajo.includes("balance")) return "No te alcanza el USDC para esta donación.";
  if (bajo.includes("trustline")) return "Tu cuenta todavía no tiene habilitado USDC. Agregalo en tu billetera y probá de nuevo.";
  if (bajo.includes("resulting balance is not within the allowed range") || bajo.includes("balance is not sufficient"))
    return "No te alcanza el USDC para esta donación.";
  if (bajo.includes("account not found") || bajo.includes("not found")) return "Tu cuenta todavía no existe en esta red. Necesita un poco de XLM para activarse.";
  if (bajo.includes("rejected") || bajo.includes("denied") || bajo.includes("cancel") || bajo.includes("closed the modal"))
    return "Cancelaste la operación en la billetera.";
  if (n) return "El contrato rechazó la operación. No se movió dinero.";
  return null;
}
