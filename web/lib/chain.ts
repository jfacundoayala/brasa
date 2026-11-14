import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
import type { Eip1193Provider } from "ethers";
import { ERC20_ABI, FUND_ABI, V1_ZONES_ABI, V2_ZONES_ABI } from "./abi";

export type Deployment = {
  network: "local" | "fuji";
  chainId: number;
  rpc: string;
  explorer: string;
  fund: string;
  usdc: string;
  zoneId: string;
  zoneName: string;
  /** 2 = contrato v2 (totales, polígono y hora del dato). 3 = v3 (cuarteles asignados por incendio). Sin versión = v1. */
  version?: number;
  /** Comisión en puntos básicos (500 = 5 %). Es fija en cada contrato. */
  feeBps?: number;
  deployBlock?: number;
  polygonHash?: string;
  federation?: string;
  recipientDelay?: number;
  /** Solo v3: espera para cambiar una clave de oráculo, mínimo de donación y costo por hectárea (datos del despliegue). */
  oracleDelay?: number;
  minDonation?: string | number;
  costPerHa?: string | number;
};

/** v2 o posterior (totales, polígono, hora del dato). */
export const esV2 = (d: Deployment) => (d.version ?? 1) >= 2;
/** v3 o posterior (cuarteles asignados a cada incendio). */
export const esV3 = (d: Deployment) => (d.version ?? 1) >= 3;

export type Sensor = "noaa20" | "noaa21" | "modis";
export type Focos = {
  generatedAt: string;
  datosGuardados: boolean;
  fuente: string;
  zona: { nombre: string; bbox: [number, number, number, number]; poligono?: GeoJSON.Polygon | GeoJSON.MultiPolygon };
  /** confirmados: focos de alta confianza que el otro satélite también vio a menos de 2 km (solo NOAA-20 y NOAA-21). */
  conteo: Record<Sensor, { total: number; altaConfianza: number; confirmados?: number }>;
  /** Hora (UTC, segundos) de la detección de NASA más nueva de los dos satélites VIIRS. */
  ultimaDeteccionUtc?: number;
  incendios?: Incendio[];
  focos: { lat: number; lon: number; sensor: Sensor; confianza: "high" | "nominal" | "low"; fecha: string; hora: string }[];
};

/** Incendio = focos de alta confianza a menos de 2 km entre sí. Nivel 1: hasta ~30 ha · 2: 30 a 100 ha · 3: más de ~100 ha (supuestos). */
export type Incendio = {
  id: number;
  lat: number;
  lon: number;
  focos: number;
  areaHa: number;
  nivel: 1 | 2 | 3;
  sensores: Sensor[];
  confirmado: boolean;
  ultimaDeteccion: string;
  /** Potencia del fuego más alta del incendio (FRP, en MW), del CSV de FIRMS. */
  frpMax?: number;
};

export const NIVEL_COLOR: Record<1 | 2 | 3, string> = { 1: "#FFD166", 2: "#FF8A3D", 3: "#FF2E2E" };
export const NIVEL_NOMBRE: Record<1 | 2 | 3, string> = { 1: "leve", 2: "medio", 3: "grave" };
export const NIVEL_TEXTO: Record<1 | 2 | 3, string> = {
  1: "Nivel 1 · leve (hasta ~30 ha)",
  2: "Nivel 2 · medio (30 a 100 ha)",
  3: "Nivel 3 · grave (más de 100 ha)",
};

/** Liberaciones ya hechas (web/public/liberaciones.json, por dirección de contrato). */
export type Liberacion = {
  tx: string;
  eventId: number;
  fecha: string;
  focos: number;
  liberadoUsdc: number;
  /** Lo que fue a cuarteles y a damnificados, si se conoce el reparto exacto de ese pago. */
  cuartelesUsdc?: number;
  asistenciaUsdc?: number;
};

/** Link al código verificado del contrato (Sourcify, coincidencia exacta). */
export const codigoUrl = (d: Deployment) =>
  d.chainId === FUJI_ID ? `https://sourcify.dev/server/repo-ui/${d.chainId}/${d.fund}` : "";

export const FUJI_ID = 43113;
export const FUJI_EXPLORER = "https://explorer-test.avax.network/c-chain";
export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export const USDC_DECIMALS = 6;
export const fmtUsdc = (v: bigint) =>
  Number(formatUnits(v, USDC_DECIMALS)).toLocaleString("es-AR", { maximumFractionDigits: 2 });
export const parseUsdc = (s: string) => parseUnits(s, USDC_DECIMALS);

export function explorerBase(d: Deployment): string {
  if (d.chainId === FUJI_ID) return d.explorer || FUJI_EXPLORER;
  return d.explorer || "";
}
export const txUrl = (d: Deployment, h: string) => (explorerBase(d) ? `${explorerBase(d)}/tx/${h}` : "");
export const addrUrl = (d: Deployment, a: string) => (explorerBase(d) ? `${explorerBase(d)}/address/${a}` : "");

export function getEth(): Eip1193Provider | null {
  const e = (globalThis as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return e && typeof e.request === "function" ? e : null;
}

export async function switchTo(d: Deployment) {
  const eth = getEth();
  if (!eth) throw new Error("No hay wallet");
  const chainId = "0x" + d.chainId.toString(16);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw e;
    const isFuji = d.chainId === FUJI_ID;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: isFuji ? "Avalanche Fuji C-Chain" : `brasa ${d.network} (${d.chainId})`,
          nativeCurrency: { name: isFuji ? "Avalanche" : "Ether", symbol: isFuji ? "AVAX" : "ETH", decimals: 18 },
          rpcUrls: [isFuji ? FUJI_RPC : d.rpc],
          ...(explorerBase(d) ? { blockExplorerUrls: [explorerBase(d)] } : {}),
        },
      ],
    });
  }
}

export const readProvider = (d: Deployment) => new JsonRpcProvider(d.rpc, d.chainId, { staticNetwork: true });

/** bytes32 con texto ASCII ("cafayate") -> texto; si no es texto, 0x1234...abcd. */
export function bytes32Label(id: string): string {
  const hex = id.slice(2);
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16);
    if (c === 0) break;
    if (c < 32 || c > 126) return `${id.slice(0, 8)}…${id.slice(-4)}`;
    out += String.fromCharCode(c);
  }
  return out || `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** activeFrom: desde cuándo cobra (segundos UTC). Antes de esa hora es un alta pendiente, visible para todos. */
export type Recipient = { id: string; label: string; wallet: string; kind: "station" | "assistance"; active: boolean; activeFrom: number };
export type EventoLog = { tipo: "FireEvent" | "Released" | "Donated"; texto: string; tx: string; bloque: number };

export type ZoneData = {
  areaHa: bigint;
  target: bigint;
  combate: bigint;
  logistica: bigint;
  asistencia: bigint;
  maxPerEvent: bigint;
  /** Costo por hectárea de la zona (combate + logística + asistencia), en unidades de USDC. */
  costoHa: bigint;
  /** El mismo costo por hectárea, separado en combate, logística y asistencia a afectados. */
  costosHa: { combate: bigint; logistica: bigint; asistencia: bigint };
  balance: bigint;
  /** Solo v2: todo lo donado y todo lo pagado desde que existe la zona (lo lleva el contrato). */
  totalDonated: bigint | null;
  totalReleased: bigint | null;
  hotspots: number;
  /** Focos cruzados que pide el contrato para enviar (zones().minHotspots). Con menos, reportFire revierte. */
  minHotspots: number;
  recipients: Recipient[];
  /** Solo v3: cuarteles que la federación asignó a la zona y hasta cuándo (segundos UTC). En v2: vacío y 0. */
  responders: string[];
  respondersUntil: number;
  /** Donación mínima que acepta el contrato (minDonation()). null si no se pudo leer. */
  minDonation: bigint | null;
  eventos: EventoLog[];
};

/** true si focos.json trae el cruce de los dos satélites (relayer v2). */
export const hayCruce = (f: Focos) => f.conteo.noaa20.confirmados !== undefined && f.conteo.noaa21.confirmados !== undefined;

/**
 * Focos que usa la meta. Con el cruce (v2): de cada satélite, los que el otro también vio a menos de 2 km; el contrato
 * toma el menor. Sin cruce (datos viejos): el menor de los dos conteos de alta confianza.
 */
export const confirmados = (f: Focos) =>
  hayCruce(f)
    ? Math.min(f.conteo.noaa20.confirmados!, f.conteo.noaa21.confirmados!)
    : Math.min(f.conteo.noaa20.altaConfianza, f.conteo.noaa21.altaConfianza);

/**
 * Nivel de incendio (regla simple, sobre focos confirmados por dos sensores):
 *   0-4 bajo, 5-19 medio, 20-49 alto, 50 o mas critico
 */
export function nivel(n: number): "bajo" | "medio" | "alto" | "crítico" {
  if (n >= 50) return "crítico";
  if (n >= 20) return "alto";
  if (n >= 5) return "medio";
  return "bajo";
}

export async function loadZone(d: Deployment, hotspots: number): Promise<ZoneData> {
  const p = readProvider(d);
  const c = new Contract(d.fund, FUND_ABI, p);
  // El v1 tiene otra forma de zones(): se lee con su propio fragmento. Los campos se leen por nombre, no por posición.
  // El v3 agregó un campo al final de zones(), así que el v2 también usa su propio fragmento.
  const zonas = esV3(d) ? c : new Contract(d.fund, esV2(d) ? V2_ZONES_ABI : V1_ZONES_ABI, p);
  const [prev, z, balance, stations, assist, totales] = await Promise.all([
    c.getFunction("previewTarget")(d.zoneId, BigInt(hotspots)),
    zonas.getFunction("zones")(d.zoneId),
    c.getFunction("zoneBalance")(d.zoneId),
    c.getFunction("stationIds")(d.zoneId),
    c.getFunction("assistanceIds")(d.zoneId),
    esV2(d) ? c.getFunction("zoneTotals")(d.zoneId) : Promise.resolve(null),
  ]);
  // Lecturas extra: si fallan, la zona se muestra igual.
  const [resp, minDon] = await Promise.all([
    esV3(d)
      ? c.getFunction("responders")(d.zoneId).then(
          (r) => ({ ids: [...(r[0] as string[])], hasta: Number(r[1] as bigint) }),
          () => null,
        )
      : Promise.resolve(null),
    esV2(d) ? c.getFunction("minDonation")().then((v) => v as bigint, () => null) : Promise.resolve(null),
  ]);
  const areaHa = prev[0] as bigint;
  const ids: { id: string; kind: "station" | "assistance" }[] = [
    ...(stations as string[]).map((id) => ({ id, kind: "station" as const })),
    ...(assist as string[]).map((id) => ({ id, kind: "assistance" as const })),
  ];
  const recipients = await Promise.all(
    ids.map(async ({ id, kind }) => {
      const r = await c.getFunction("recipients")(id);
      return {
        id,
        label: bytes32Label(id),
        wallet: r.wallet as string,
        kind,
        active: r.active as boolean,
        activeFrom: Number(r.activeFrom as bigint),
      };
    }),
  );

  // Un movimiento del contrato, venga del RPC o del explorador.
  type Crudo = { nombre: string; args: Record<string, unknown>; tx: string; bloque: number };
  const aEvento = (l: Crudo): EventoLog => {
    const a = l.args;
    const tipo = l.nombre as EventoLog["tipo"];
    const donante = String(a.donor ?? "");
    const texto =
      tipo === "FireEvent"
        ? `Evento #${a.eventId}: ${a.hotspots} ${a.hotspots === 1n ? "foco" : "focos"}, liberó ${fmtUsdc(a.released as bigint)} USDC`
        : tipo === "Released"
          ? `Evento #${a.eventId}: ${fmtUsdc(a.amount as bigint)} USDC a ${bytes32Label(a.recipientId as string)}`
          : `Donación: ${fmtUsdc(a.net as bigint)} USDC al fondo (de ${donante.slice(0, 6)}…${donante.slice(-4)})`;
    return { tipo, texto, tx: l.tx, bloque: l.bloque };
  };
  let crudos: Crudo[] = [];
  try {
    const latest = await p.getBlockNumber();
    const from = Math.max(0, latest - 2000);
    const [fires, rels, dons] = await Promise.all([
      c.queryFilter(c.filters.FireEvent(d.zoneId), from),
      c.queryFilter(c.filters.Released(d.zoneId), from),
      c.queryFilter(c.filters.Donated(d.zoneId), from), // donaciones al fondo de la zona
    ]);
    crudos = [...fires, ...rels, ...dons].map((l) => {
      const el = l as unknown as { args: Record<string, unknown>; fragment: { name: string } };
      return { nombre: el.fragment.name, args: el.args, tx: l.transactionHash, bloque: l.blockNumber };
    });
  } catch {
    // El RPC público de Fuji limita el rango de logs. En ese caso se leen del explorador, que los tiene indexados.
    try {
      if (d.chainId === FUJI_ID) {
        const url = `https://api.routescan.io/v2/network/testnet/evm/${FUJI_ID}/etherscan/api?module=logs&action=getLogs&address=${d.fund}&fromBlock=${d.deployBlock ?? 0}&toBlock=latest`;
        const j = (await (await fetch(url)).json()) as {
          result?: { topics: string[]; data: string; transactionHash: string; blockNumber: string }[];
        };
        for (const l of Array.isArray(j.result) ? j.result : []) {
          const pl = c.interface.parseLog({ topics: l.topics, data: l.data });
          if (!pl || !["FireEvent", "Released", "Donated"].includes(pl.name)) continue;
          if (String(l.topics[1]).toLowerCase() !== String(d.zoneId).toLowerCase()) continue; // solo la zona que se muestra
          crudos.push({
            nombre: pl.name,
            args: pl.args as unknown as Record<string, unknown>,
            tx: l.transactionHash,
            bloque: Number(l.blockNumber),
          });
        }
      }
    } catch {
      crudos = []; // sin historial la web sigue andando: los totales salen del contrato
    }
  }
  const eventos: EventoLog[] = crudos
    .map(aEvento)
    .sort((x, y) => y.bloque - x.bloque)
    .slice(0, 6);

  return {
    areaHa,
    target: prev[1] as bigint,
    combate: areaHa * (z.costCombatPerHa as bigint),
    logistica: areaHa * (z.costLogisticsPerHa as bigint),
    asistencia: areaHa * (z.costAssistPerHa as bigint),
    maxPerEvent: z.maxPerEvent as bigint,
    costoHa: (z.costCombatPerHa as bigint) + (z.costLogisticsPerHa as bigint) + (z.costAssistPerHa as bigint),
    costosHa: {
      combate: z.costCombatPerHa as bigint,
      logistica: z.costLogisticsPerHa as bigint,
      asistencia: z.costAssistPerHa as bigint,
    },
    balance: balance as bigint,
    totalDonated: totales ? (totales[0] as bigint) : null,
    totalReleased: totales ? (totales[1] as bigint) : null,
    hotspots,
    minHotspots: Number(z.minHotspots),
    recipients,
    responders: resp?.ids ?? [],
    respondersUntil: resp?.hasta ?? 0,
    minDonation: minDon,
    eventos,
  };
}

export type Reparto = { net: bigint; fee: bigint; total: bigint };

/** Cómo reparte el contrato un aporte. coverFee=false: la comisión sale del monto; true: se suma. */
export async function quoteSplit(d: Deployment, amount: bigint, coverFee: boolean): Promise<Reparto> {
  const c = new Contract(d.fund, FUND_ABI, readProvider(d));
  const [net, fee, total] = (await c.getFunction("quoteSplit")(amount, coverFee)) as [bigint, bigint, bigint];
  return { net, fee, total };
}

export async function usdcBalance(d: Deployment, who: string): Promise<bigint> {
  const u = new Contract(d.usdc, ERC20_ABI, readProvider(d));
  return (await u.getFunction("balanceOf")(who)) as bigint;
}

/** approve(total) y donateToZone(monto, coverFee). Avisa cada paso con onStep. */
export async function donar(
  d: Deployment,
  amount: bigint,
  coverFee: boolean,
  total: bigint,
  onStep: (s: { paso: "approve" | "donar"; hash: string }) => void,
): Promise<string> {
  const eth = getEth();
  if (!eth) throw new Error("No hay wallet");
  const signer = await new BrowserProvider(eth).getSigner();
  const who = await signer.getAddress();
  const usdc = new Contract(d.usdc, ERC20_ABI, signer);
  const need = total;
  const have = (await usdc.getFunction("allowance")(who, d.fund)) as bigint;
  if (have < need) {
    const tx = await usdc.getFunction("approve")(d.fund, need);
    onStep({ paso: "approve", hash: tx.hash });
    await tx.wait();
  }
  const fund = new Contract(d.fund, FUND_ABI, signer);
  const tx = await fund.getFunction("donateToZone")(d.zoneId, amount, coverFee);
  onStep({ paso: "donar", hash: tx.hash });
  await tx.wait();
  return tx.hash as string;
}

/** Errores propios del contrato, en castellano. */
const ERRORES_CONTRATO: Record<string, string> = {
  BelowMinDonation: "El monto es menor que la donación mínima del fondo.",
  UnknownZone: "El fondo no tiene cargada esta zona.",
  RecipientInactive: "Ese destinatario no está activo.",
  NotYetActive: "Ese destinatario todavía no puede recibir. Su alta está en espera.",
};

export function errorCorto(e: unknown): string {
  type Err = {
    code?: string | number;
    reason?: string;
    shortMessage?: string;
    message?: string;
    data?: unknown;
    revert?: { name?: string };
    info?: { error?: { code?: number; message?: string; data?: unknown } };
    error?: { code?: number; message?: string; data?: unknown };
  };
  const x = (e ?? {}) as Err;
  const interno = x.info?.error ?? x.error;
  const texto = [x.shortMessage, x.message, x.reason, interno?.message].filter(Boolean).join(" ");
  const bajo = texto.toLowerCase();
  if (x.code === "ACTION_REJECTED" || x.code === 4001 || interno?.code === 4001 || bajo.includes("user rejected") || bajo.includes("user denied"))
    return "Cancelaste la operación en la billetera.";
  // Error con nombre del contrato: ethers lo decodifica en revert.name; si no, se busca el nombre en el texto.
  const nombre = x.revert?.name ?? Object.keys(ERRORES_CONTRATO).find((k) => texto.includes(k));
  if (nombre && ERRORES_CONTRATO[nombre]) return ERRORES_CONTRATO[nombre];
  if (bajo.includes("transfer amount exceeds balance") || bajo.includes("erc20insufficientbalance"))
    return "No te alcanza el USDC para esta donación.";
  if (x.code === "INSUFFICIENT_FUNDS" || bajo.includes("insufficient funds")) return "Te falta AVAX para pagar el gas.";
  if (x.code === -32603 || interno?.code === -32603 || bajo.includes("internal json-rpc error"))
    return "La red no respondió. Probá de nuevo en unos segundos.";
  if (x.code === "CALL_EXCEPTION") return "El contrato rechazó la operación. No se movió dinero.";
  if (x.code === "NETWORK_ERROR" || x.code === "TIMEOUT" || x.code === "SERVER_ERROR")
    return "La red no respondió. Probá de nuevo en unos segundos.";
  // Nunca un código crudo solo: si hay texto se muestra corto, con una frase delante.
  const msg = (x.shortMessage || x.message || "").slice(0, 120);
  return msg ? `Algo falló: ${msg}` : "Algo falló. Probá de nuevo.";
}
