// La librería de la red anterior (ethers) vive en evm.ts y se carga recién si el despliegue no es de Stellar.
/** Una billetera del navegador (EIP-1193). */
export type Eip1193Provider = { request(a: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown> };
import { addrUrlStellar, errorStellar, explorerStellar, txUrlStellar } from "./stellar";

export type Deployment = {
  network: "local" | "fuji" | "stellar-testnet";
  /** En Stellar no hay número de red: se usa STELLAR_ID para que el resto de la web no cambie. */
  chainId: number;
  /** Solo Stellar: la frase que identifica la red. */
  passphrase?: string;
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

/** El despliegue es el contrato de Stellar. Tiene todo lo del v3. */
export const STELLAR_ID = -1;
export const esStellar = (d: Deployment) => d.network === "stellar-testnet";

/** v2 o posterior (totales, polígono, hora del dato). */
export const esV2 = (d: Deployment) => esStellar(d) || (d.version ?? 1) >= 2;
/** v3 o posterior (cuarteles asignados a cada incendio). */
export const esV3 = (d: Deployment) => esStellar(d) || (d.version ?? 1) >= 3;

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
export const fmtUsdc = (v: bigint) => (Number(v) / 10 ** USDC_DECIMALS).toLocaleString("es-AR", { maximumFractionDigits: 2 });
/** Texto ("12.5") a unidades de USDC. Si no es un número con hasta 6 decimales, lanza un error. */
export function parseUsdc(s: string): bigint {
  const m = /^(\d*)(?:\.(\d{0,6}))?$/.exec(s.trim());
  if (!m || (!m[1] && !m[2])) throw new Error("Monto inválido");
  return BigInt(m[1] || "0") * 10n ** BigInt(USDC_DECIMALS) + BigInt((m[2] ?? "").padEnd(USDC_DECIMALS, "0"));
}

export function explorerBase(d: Deployment): string {
  if (esStellar(d)) return explorerStellar(d);
  if (d.chainId === FUJI_ID) return d.explorer || FUJI_EXPLORER;
  return d.explorer || "";
}
export const txUrl = (d: Deployment, h: string) => (esStellar(d) ? txUrlStellar(d, h) : explorerBase(d) ? `${explorerBase(d)}/tx/${h}` : "");
export const addrUrl = (d: Deployment, a: string) =>
  esStellar(d) ? addrUrlStellar(d, a) : explorerBase(d) ? `${explorerBase(d)}/address/${a}` : "";

// Billeteras que la web ofrece por nombre. Core es la de Avalanche y va primero.
export type Billetera = { id: "core" | "metamask" | "otra" | "stellar"; nombre: string; provider: Eip1193Provider };
const RDNS: Record<string, Billetera["id"]> = { "app.core.extension": "core", "io.metamask": "metamask" };
const NOMBRE = { core: "Core", metamask: "MetaMask", otra: "mi billetera", stellar: "mi billetera de Stellar" } as const;
/** En Stellar la billetera se elige en la ventana del kit: la web muestra un solo botón. */
export const BILLETERA_STELLAR = { id: "stellar", nombre: NOMBRE.stellar } as const;
type Anuncio = { info: { rdns: string; name: string }; provider: Eip1193Provider };
const anunciadas = new Map<Billetera["id"], Eip1193Provider>();
let escuchando = false;
let elegida: Eip1193Provider | null = null;

const sirve = (e: unknown): e is Eip1193Provider => typeof (e as Eip1193Provider | undefined)?.request === "function";

/** Las billeteras instaladas en el navegador. Se presentan solas (EIP-6963) y responden en el mismo momento. */
export function billeteras(): Billetera[] {
  if (typeof window === "undefined") return [];
  if (!escuchando) {
    escuchando = true;
    window.addEventListener("eip6963:announceProvider", (ev) => {
      const d = (ev as CustomEvent<Anuncio>).detail;
      const id = RDNS[d?.info?.rdns];
      if (id && sirve(d.provider)) anunciadas.set(id, d.provider);
    });
  }
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const g = globalThis as unknown as { avalanche?: unknown; ethereum?: unknown };
  const eth = sirve(g.ethereum) ? (g.ethereum as Eip1193Provider & { isMetaMask?: boolean; isAvalanche?: boolean }) : null;
  // Respaldo para versiones que no se anuncian: Core se publica en window.avalanche y MetaMask marca window.ethereum.
  const core = anunciadas.get("core") ?? (sirve(g.avalanche) ? g.avalanche : eth?.isAvalanche ? eth : null);
  const metamask = anunciadas.get("metamask") ?? (eth?.isMetaMask && !eth.isAvalanche && eth !== core ? eth : null);
  const lista: Billetera[] = [];
  if (core) lista.push({ id: "core", nombre: NOMBRE.core, provider: core });
  if (metamask) lista.push({ id: "metamask", nombre: NOMBRE.metamask, provider: metamask });
  if (lista.length === 0 && eth) lista.push({ id: "otra", nombre: NOMBRE.otra, provider: eth });
  return lista;
}

/** Deja elegida una billetera: desde acá, donar y cambiar de red van por esa. */
export function elegir(id: Billetera["id"]): Eip1193Provider | null {
  elegida = billeteras().find((b) => b.id === id)?.provider ?? null;
  return elegida;
}

/** La billetera elegida o, si todavía no se eligió, la primera de la lista. */
export function getEth(): Eip1193Provider | null {
  return elegida ?? billeteras()[0]?.provider ?? null;
}

export async function switchTo(d: Deployment) {
  const eth = getEth();
  if (!eth) throw new Error("No hay billetera");
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
  if (esStellar(d)) return (await import("./stellar")).loadZoneStellar(d, hotspots);
  return (await import("./evm")).loadZoneEvm(d, hotspots);
}

export type Reparto = { net: bigint; fee: bigint; total: bigint };

/** Cómo reparte el contrato un aporte. coverFee=false: la comisión sale del monto; true: se suma. */
export async function quoteSplit(d: Deployment, amount: bigint, coverFee: boolean): Promise<Reparto> {
  if (esStellar(d)) return (await import("./stellar")).quoteSplitStellar(d, amount, coverFee);
  return (await import("./evm")).quoteSplitEvm(d, amount, coverFee);
}

export async function usdcBalance(d: Deployment, who: string): Promise<bigint> {
  if (esStellar(d)) return (await import("./stellar")).usdcBalanceStellar(d, who);
  return (await import("./evm")).usdcBalanceEvm(d, who);
}

/** approve(total) y donateToZone(monto, coverFee). Avisa cada paso con onStep. */
export async function donar(
  d: Deployment,
  amount: bigint,
  coverFee: boolean,
  total: bigint,
  onStep: (s: { paso: "approve" | "donar"; hash: string }) => void,
): Promise<string> {
  if (esStellar(d)) return (await import("./stellar")).donarStellar(d, amount, coverFee, onStep);
  return (await import("./evm")).donarEvm(d, amount, coverFee, total, onStep);
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
  const deStellar = errorStellar(texto);
  if (deStellar) return deStellar;
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
