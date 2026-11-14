"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Deployment,
  type Focos,
  type ZoneData,
  addrUrl,
  confirmados,
  donar,
  errorCorto,
  fmtUsdc,
  getEth,
  loadZone,
  nivel,
  parseUsdc,
  quoteSplit,
  type Reparto,
  switchTo,
  txUrl,
  usdcBalance,
  NIVEL_COLOR,
  NIVEL_NOMBRE,
  NIVEL_TEXTO,
  type Liberacion,
  codigoUrl,
  esV2,
  esV3,
  hayCruce,
} from "@/lib/chain";
import { CONF_NAME, SENSOR_COLOR, SENSOR_NAME } from "./Mapa";
import Logo from "./Logo";
import { IcoCalculo, IcoCandado, IcoCuartel, IcoDonar, IcoExterno, IcoLupa, IcoSatelite, IcoVerificado } from "./Iconos";
import Foto from "./Foto";
import { Gravedad, LLAMA_ADENTRO, LLAMA_AFUERA } from "./Llamas";
import { cuartelCercano } from "@/lib/cuarteles";
import { AMBIENTE, DEPTOS, RADIO_KM, canchas, departamentoDe, genteCerca } from "@/lib/zonas";
import { AYUDA_VIVIENDA_ARS, COSTO_HA, HORA_AVION, RADIO_AFECTADOS_KM, calcular, climaEn, type Clima } from "@/lib/formula";
import { avisosGoes, rumbo, type Aviso } from "@/lib/goes";
import { calibracion } from "@/lib/referencias";

const cal = calibracion();

/** Dólar oficial (venta) de DolarApi, solo como referencia en pesos. */
type Dolar = { venta: number; fecha: string };
const pesos = (usdc: bigint, d: Dolar) => Math.round((Number(usdc) / 1e6) * d.venta).toLocaleString("es-AR") + " pesos";
/** Lo mismo con dólares comunes (número), para la Fórmula Brasa. */
const pesosUsd = (usd: number, d: Dolar) => Math.round(usd * d.venta).toLocaleString("es-AR") + " pesos";
const usd = (x: number) => Math.round(x).toLocaleString("es-AR");
/** Nombre a mostrar de un destinatario: "cuartel-a" pasa a "Cuartel A" y "entidad-a" a "Entidad de asistencia A". */
const nombreDestinatario = (label: string, kind: "station" | "assistance") => {
  const m = /^(?:cuartel|entidad)-([a-z0-9]+)$/i.exec(label);
  if (!m) return label;
  return `${kind === "station" ? "Cuartel" : "Entidad de asistencia"} ${m[1].toUpperCase()}`;
};
/** Cuántos AVAX son esos dólares (precio de CoinGecko), solo como referencia. */
const enAvax = (usdNum: number, precio: number) =>
  (usdNum / precio).toLocaleString("es-AR", { maximumFractionDigits: usdNum / precio < 100 ? 1 : 0 });

const Mapa = dynamic(() => import("./Mapa"), { ssr: false, loading: () => <div className="mapa cargando">Cargando mapa…</div> });

type Tx =
  | { s: "idle" }
  | { s: "pendiente"; paso: "approve" | "donar"; hash: string }
  | { s: "ok"; hash: string }
  | { s: "error"; msg: string };

const ALERTA = { bajo: "baja", medio: "media", alto: "alta", crítico: "crítica" } as const;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** "Datos de NASA del 10 y 11/11 (guardados)" o "actualizado hace 2 h" (en vivo). */
function fechaDatos(f: Focos): string {
  if (!f.datosGuardados) {
    const h = Math.max(0, Math.round((Date.now() - new Date(f.generatedAt).getTime()) / 3600000));
    const act = h < 1 ? "actualizado hace menos de 1 h" : `actualizado hace ${h} h`;
    if (!f.ultimaDeteccionUtc) return `Datos de NASA en vivo: ${act}`;
    // La hora del dato es la de la pasada del satélite (FIRMS tarda unas 3 h en publicarla), no la de la página.
    const det = new Date(f.ultimaDeteccionUtc * 1000).toLocaleString("es-AR", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Salta",
    });
    // Si NASA no trae focos nuevos, el archivo queda con los anteriores: se avisa para no mostrar fuego viejo como actual.
    const hDet = (Date.now() / 1000 - f.ultimaDeteccionUtc) / 3600;
    const viejo = hDet > 6 ? ` · ⚠️ la última detección fue hace ${Math.round(hDet)} h` : "";
    return `Datos de NASA en vivo · última detección: ${det} (hora argentina) · ${act}${viejo}`;
  }
  const dias = [...new Set(f.focos.map((x) => x.fecha))].sort();
  if (dias.length === 0) return "Datos de NASA guardados";
  const xs = dias.map((d) => ({ d: String(Number(d.slice(8, 10))), m: String(Number(d.slice(5, 7))) }));
  const mismoMes = xs.every((x) => x.m === xs[0].m);
  const partes = mismoMes ? xs.map((x) => x.d) : xs.map((x) => `${x.d}/${x.m}`);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0];
  return `Datos de NASA del ${lista}${mismoMes ? `/${xs[0].m}` : ""} (guardados)`;
}

function Hash({ d, h }: { d: Deployment; h: string }) {
  const u = txUrl(d, h);
  return u ? (
    <a href={u} target="_blank" rel="noreferrer">
      {short(h)} ↗ ver en el registro público
    </a>
  ) : (
    <code>{h}</code>
  );
}

export default function Brasa() {
  const [dep, setDep] = useState<Deployment | null>(null);
  const [focosVivo, setFocos] = useState<Focos | null>(null);
  // Ejemplo: datos reales de NASA ya guardados (10 y 11/11), que traen incendios de nivel 1, 2 y 3. Se avisa en pantalla.
  const [focosEj, setFocosEj] = useState<Focos | null>(null);
  const [ver, setVer] = useState<"vivo" | "ejemplo">("vivo");
  const focos = ver === "ejemplo" && focosEj ? focosEj : focosVivo;
  const [loadErr, setLoadErr] = useState("");
  const [zone, setZone] = useState<ZoneData | null>(null);
  const [zoneErr, setZoneErr] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [selInc, setSelInc] = useState<number | null>(null);

  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasWallet, setHasWallet] = useState(true);
  const [amount, setAmount] = useState("100");
  const [cubrir, setCubrir] = useState(false);
  const [reparto, setReparto] = useState<Reparto | null>(null);
  const [saldo, setSaldo] = useState<bigint | null>(null);
  const [tx, setTx] = useState<Tx>({ s: "idle" });
  const [libs, setLibs] = useState<Liberacion[]>([]);
  const [libAnterior, setLibAnterior] = useState(false);
  const [dolar, setDolar] = useState<Dolar | null>(null);
  // Departamento del incendio elegido (se busca en el mapa de departamentos al tocarlo)
  const [deptoSel, setDeptoSel] = useState<{ id: number; lat: number; nombre: string | null } | null>(null);

  const [avax, setAvax] = useState<number | null>(null);
  const [clima, setClima] = useState<{ id: number; c: Clima | null } | null>(null);
  const [goes, setGoes] = useState<{ avisos: Aviso[]; ultimo: string | null } | null>(null);

  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.venta > 0 ? setDolar({ venta: j.venta, fecha: j.fechaActualizacion }) : null))
      .catch(() => setDolar(null));
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.["avalanche-2"]?.usd > 0 ? setAvax(j["avalanche-2"].usd) : null))
      .catch(() => setAvax(null));
    // Alerta temprana GOES-19 (cada 10 min); se vuelve a leer cada 10 min.
    const leerGoes = () => avisosGoes().then(setGoes).catch(() => setGoes(null));
    leerGoes();
    const t = setInterval(leerGoes, 600_000);
    return () => clearInterval(t);
  }, []);

  // Datos de ejecucion (los genera otra parte)
  useEffect(() => {
    // deployment.json lo escribe el deploy local (no va a git). En el sitio publicado se usa deployment.fuji.json,
    // que sí está en el repo y apunta al contrato de Fuji.
    // En producción se va directo a deployment.fuji.json: así la consola del sitio publicado no muestra un 404.
    const leerFuji = () => fetch("/deployment.fuji.json", { cache: "no-store" }).then((r) => r.json());
    const leerDeploy = () =>
      process.env.NODE_ENV === "production"
        ? leerFuji()
        : fetch("/deployment.json", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .catch(leerFuji);
    Promise.all([leerDeploy(), fetch("/focos.json", { cache: "no-store" }).then((r) => r.json())])
      .then(([d, f]) => {
        setDep(d);
        setFocos(f);
      })
      .catch(() => setLoadErr("No pude leer deployment.json o focos.json."));
    fetch("/focos-ejemplo.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setFocosEj)
      .catch(() => setFocosEj(null));
  }, []);
  const cambiarVista = (v: "vivo" | "ejemplo") => {
    setVer(v);
    setSel(null);
    setSelInc(null);
  };

  // Liberaciones ya hechas (las anota el relayer en liberaciones.json, por contrato)
  useEffect(() => {
    if (!dep) return;
    fetch("/liberaciones.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((t: Record<string, Liberacion[] | string>) => {
        const k = Object.keys(t).find((x) => x.toLowerCase() === dep.fund.toLowerCase());
        const v = k ? t[k] : [];
        const propias = Array.isArray(v) ? v : [];
        // Si este contrato todavía no liberó, se muestra el último pago de la versión anterior.
        const otras = Object.values(t)
          .filter((x): x is Liberacion[] => Array.isArray(x))
          .flat()
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        setLibAnterior(propias.length === 0 && otras.length > 0);
        setLibs(propias.length ? propias : otras.slice(-1));
      })
      .catch(() => setLibs([]));
  }, [dep]);

  const hot = focos ? confirmados(focos) : 0;
  const refreshZone = useCallback(() => {
    if (!dep || !focos) return;
    loadZone(dep, confirmados(focos))
      .then((z) => {
        setZone(z);
        setZoneErr("");
      })
      .catch(() => setZoneErr("No pude leer el contrato. ¿Está encendida la red?"));
  }, [dep, focos]);
  useEffect(refreshZone, [refreshZone]);

  // Wallet: solo en el cliente
  useEffect(() => {
    const eth = getEth();
    setHasWallet(!!eth);
    if (!eth) return;
    const onAcc = (a: string[]) => setAccount(a[0] ?? null);
    const onChain = (c: string) => setChainId(parseInt(c, 16));
    eth.request({ method: "eth_accounts" }).then((a) => setAccount((a as string[])[0] ?? null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => onChain(c as string)).catch(() => {});
    const e = eth as unknown as { on?: (n: string, f: (x: never) => void) => void; removeListener?: (n: string, f: (x: never) => void) => void };
    e.on?.("accountsChanged", onAcc as never);
    e.on?.("chainChanged", onChain as never);
    return () => {
      e.removeListener?.("accountsChanged", onAcc as never);
      e.removeListener?.("chainChanged", onChain as never);
    };
  }, []);

  const netOk = !!dep && chainId === dep.chainId;

  // Saldo de USDC del donante
  useEffect(() => {
    if (!dep || !account || !netOk) return setSaldo(null);
    usdcBalance(dep, account).then(setSaldo).catch(() => setSaldo(null));
  }, [dep, account, netOk, tx]);

  // Reparto que cotiza el contrato (aporte, comisión y total)
  const monto = useMemo(() => {
    try {
      const v = parseUsdc(amount.replace(",", "."));
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount]);
  useEffect(() => {
    if (!dep || monto === null) return setReparto(null);
    let ok = true;
    quoteSplit(dep, monto, cubrir).then((r) => ok && setReparto(r)).catch(() => ok && setReparto(null));
    return () => {
      ok = false;
    };
  }, [dep, monto, cubrir]);

  async function connect() {
    const eth = getEth();
    if (!eth) return;
    try {
      const a = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(a[0] ?? null);
      setChainId(parseInt((await eth.request({ method: "eth_chainId" })) as string, 16));
    } catch (e) {
      setTx({ s: "error", msg: errorCorto(e) });
    }
  }
  async function cambiar() {
    if (!dep) return;
    try {
      await switchTo(dep);
    } catch (e) {
      setTx({ s: "error", msg: errorCorto(e) });
    }
  }
  async function onDonar() {
    if (!dep || monto === null || reparto === null || chainId !== dep.chainId) return;
    try {
      setTx({ s: "pendiente", paso: "approve", hash: "" });
      const hash = await donar(dep, monto, cubrir, reparto.total, (st) => setTx({ s: "pendiente", paso: st.paso, hash: st.hash }));
      setTx({ s: "ok", hash });
      refreshZone();
    } catch (e) {
      setTx({ s: "error", msg: errorCorto(e) });
    }
  }

  // Provincia: "Alerta baja/media/alta/crítica" por focos confirmados. Cada incendio: "Nivel 1, 2, 3 · bajo/medio/alto".
  const alerta = nivel(hot);
  // v2: lo pagado lo suma el contrato (zoneTotals). v1: lo anota el relayer en liberaciones.json.
  const delContrato = zone?.totalReleased != null ? Number(zone.totalReleased) / 1e6 : null;
  const anotado = libs.reduce((a, x) => a + x.liberadoUsdc, 0);
  // Mientras el contrato nuevo no libere, se muestra lo que ya pagó la versión anterior.
  const liberado = delContrato != null && !(delContrato === 0 && libAnterior) ? delContrato : anotado;
  const deContrato = zone?.totalReleased != null;
  const ultimaLib = libs.length ? libs[libs.length - 1] : null;
  const pct = zone && zone.target > 0n ? Math.min(100, Number((zone.balance * 10000n) / zone.target) / 100) : 0;
  const f = sel !== null && focos ? focos.focos[sel] : null;
  // Sin tope por evento: el v2 se despliega con un tope enorme; manda el monto calculado.
  const sinTope = !!zone && zone.maxPerEvent >= 10n ** 30n;
  const inc = selInc !== null && focos?.incendios ? focos.incendios[selInc] : null;
  const deptoInc = inc && deptoSel?.id === inc.id && deptoSel.lat === inc.lat ? deptoSel.nombre : null;
  useEffect(() => {
    if (!inc) return;
    let vivo = true;
    departamentoDe(inc.lat, inc.lon)
      .then((nombre) => vivo && setDeptoSel({ id: inc.id, lat: inc.lat, nombre }))
      .catch(() => {});
    climaEn(inc.lat, inc.lon).then((c) => vivo && setClima({ id: inc.id, c }));
    return () => {
      vivo = false;
    };
  }, [inc]);
  const total = reparto ? reparto.total : null;
  const sinSaldo = saldo !== null && total !== null && saldo < total;
  const busy = tx.s === "pendiente";
  const redName = dep ? (dep.chainId === 43113 ? "Avalanche Fuji" : `red local (${dep.chainId})`) : "";

  const nInc = focos?.incendios?.length ?? 0;
  const enVivo = ver === "vivo" && !!focos && !focos.datosGuardados;
  // Si la última detección tiene más de 6 h, no se dice "hoy": se muestra la fecha del dato.
  const detViejo =
    enVivo && !!focos?.ultimaDeteccionUtc && Date.now() / 1000 - focos.ultimaDeteccionUtc > 6 * 3600
      ? new Date(focos.ultimaDeteccionUtc * 1000).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "numeric",
          timeZone: "America/Argentina/Salta",
        })
      : null;
  // El contrato no envía con menos focos cruzados que el mínimo de la zona (v2: 2).
  const bajoMinimo = !!zone && zone.minHotspots > 0 && zone.hotspots < zone.minHotspots;
  const nConf = focos?.incendios?.filter((x) => x.confirmado).length ?? 0;
  const donaciones = zone ? zone.eventos.filter((e) => e.tipo === "Donated").length : 0;
  const neto = reparto ? Number(reparto.net) / 1e6 : null;
  // Costo por hectárea y reparto: se leen del contrato (v2: 320 y 70 / 15 / 15; v3: 400 y 70 / 10 / 20).
  // Las constantes solo se usan mientras el contrato no respondió.
  const costoHaUsd = zone && zone.costoHa > 0n ? Number(zone.costoHa) / 1e6 : COSTO_HA;
  const pz =
    zone && zone.costoHa > 0n
      ? {
          combate: Number((zone.costosHa.combate * 1000n) / zone.costoHa) / 10,
          logistica: Number((zone.costosHa.logistica * 1000n) / zone.costoHa) / 10,
          asistencia: Number((zone.costosHa.asistencia * 1000n) / zone.costoHa) / 10,
        }
      : { combate: 70, logistica: 10, asistencia: 20 };
  const pctTxt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
  // Qué cubre la donación con la regla del fondo (costo por hectárea del contrato). Cancha de fútbol: 105 × 68 m.
  const m2 = neto !== null ? Math.round((neto / costoHaUsd) * 10000) : null;
  // Donación mínima: la lee del contrato (minDonation()). El contrato compara contra lo que llega al fondo.
  const minDon = zone?.minDonation ?? null;
  const bajoMinDon = minDon !== null && reparto !== null && reparto.net < minDon;
  // v3: cuarteles que la federación asignó a la zona. Sin asignación vigente, el fondo no paga.
  const v3 = !!dep && esV3(dep);
  const asignacionVigente = v3 && !!zone && zone.responders.length > 0 && zone.respondersUntil * 1000 > Date.now();
  const asignados = new Set(asignacionVigente && zone ? zone.responders.map((x) => x.toLowerCase()) : []);
  const pasoWallet = hasWallet && !!account;
  const pasoRed = pasoWallet && netOk;
  const pasoListo = tx.s === "ok";
  const compartir = `Doné a los bomberos y a los damnificados por los incendios con brasa: la ayuda llega cuando dos satélites confirman el fuego. ${typeof window !== "undefined" ? window.location.origin : "https://brasafund.vercel.app"}`;

  return (
    <>
      <header className="barra">
        <div className="barra-in">
          <Link href="/" className="barra-logo" aria-label="brasa, inicio">
            <Logo height={40} />
          </Link>
          <nav className="menu" aria-label="Secciones">
            <a href="#mapa">Mapa</a>
            <Link href="/fundamentos">Fundamentos</Link>
            <a href="#donar" className="menu-cta">
              Donar
            </a>
          </nav>
        </div>
      </header>
    <main>
      <p className="lema">Ayuda a tiempo, recursos a la vista.</p>

      <section className="hero" aria-label="Qué está pasando">
        <div className="hero-texto">
          <p className="antetitulo">
            {enVivo && <span className="punto-vivo" aria-hidden="true" />} Salta · {!enVivo ? "datos guardados" : detViejo ? `último dato del ${detViejo}` : "hoy"}
          </p>
          <h1 className="titular">
            Tu donación llega. <span className="acento">Podés comprobarlo.</span>
          </h1>
          <p className="bajada">
            Con satélites de la NASA, brasa detecta los incendios desde el espacio y calcula cuánto cuesta combatirlos. Tu aporte llega sin
            intermediarios a los bomberos y a los damnificados. Cada dólar queda registrado de punta a punta.
          </p>
          <div className="hero-acciones">
            <a className="btn btn-hero" href="#donar">
              Donar ahora
            </a>
            <a className="btn btn-sec" href="#mapa">
              Ver el mapa
            </a>
          </div>
          <div className="montos-rapidos" role="group" aria-label="Elegí un monto para donar">
            <span>o elegí un monto:</span>
            {[10, 25, 50].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAmount(String(v));
                  document.getElementById("donar")?.scrollIntoView({ block: "start" });
                }}
              >
                {v} USDC
              </button>
            ))}
          </div>
          <ul className="sellos" aria-label="Garantías">
            <li><IcoVerificado size={16} /> Contrato verificado</li>
            <li><IcoCandado size={16} /> Sin función de retiro</li>
            <li><IcoSatelite size={16} /> Datos de la NASA</li>
          </ul>
        </div>

        <div className="meta" role="region" aria-label="La meta">
          <p className="estado-vivo">
            {!focos ? (
              "Mirando el cielo de Salta…"
            ) : nInc === 0 ? (
              enVivo && !detViejo ? "Hoy los satélites no ven incendios en Salta" : "Los satélites no vieron incendios en Salta"
            ) : (
              <>
                Los satélites {detViejo ? "vieron" : "ven"} <span className="fuego-num">{nInc}</span>{" "}
                {nInc === 1 ? "incendio" : "incendios"} en Salta
              </>
            )}
          </p>
          {focos && <p className="mini fecha-dato">{fechaDatos(focos)}</p>}
          <p className="meta-tit">La meta para combatir el fuego</p>
          {zoneErr && <p className="error">{zoneErr}</p>}
          {!zone && !zoneErr && <p className="mini">Leyendo el fondo…</p>}
          {zone && (
            <>
              <div className="meta-num">
                <b>
                  <Cuenta n={Number(zone.balance) / 1e6} />
                </b>
                <span>recaudados de {fmtUsdc(zone.target)} USDC</span>
              </div>
              <div className="apagando">
                <div
                  className="progreso"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-label="Recaudado para la meta"
                >
                  <i style={{ width: `${Math.max(pct, zone.balance > 0n ? 1 : 0)}%` }} />
                  <span className="pct">{Math.floor(pct)} %</span>
                </div>
                {pct >= 100 ? (
                  <span className="apagado" aria-hidden="true">✔</span>
                ) : (
                  <svg viewBox="18 2 64 92" className="fueguito" aria-hidden="true" style={{ transform: `scale(${1 - pct / 125})` }}>
                    <path d={LLAMA_AFUERA} fill="#FF5A1F" />
                    <path d={LLAMA_ADENTRO} fill="#FFB000" />
                  </svg>
                )}
              </div>
              <p className="mini">
                {pct >= 100
                  ? "¡Meta cubierta! Los cuarteles tienen para combustible, traslados y comida. Los damnificados reciben ayuda directa."
                  : "Cada donación achica la llama. Cuando llega al 100 %, se apaga."}
              </p>
              {bajoMinimo && (
                <p className="aviso-minimo" role="note">
                  {zone.hotspots === 0
                    ? "Ningún foco"
                    : `${zone.hotspots} ${zone.hotspots === 1 ? "foco confirmado" : "focos confirmados"}`}{" "}
                  por los dos satélites: el fondo pide al menos <b>{zone.minHotspots}</b> para enviar. Lo que dones queda
                  guardado para el próximo incendio confirmado.
                </p>
              )}
              {!bajoMinimo && zone.target > zone.balance && (
                <p className="falta">
                  Faltan <b>{fmtUsdc(zone.target - zone.balance)} USDC</b>
                  {avax && <> · ≈ {enAvax(Number(zone.target - zone.balance) / 1e6, avax)} AVAX</>}
                  {dolar && <> · ≈ {pesos(zone.target - zone.balance, dolar)}</>}
                </p>
              )}
              <ul className="meta-datos">
                <li>
                  <b>
                    <Cuenta n={nConf} />
                  </b>
                  <span>{nConf === 1 ? "incendio confirmado" : "incendios confirmados"}</span>
                </li>
                <li>
                  <b>
                    <Cuenta n={Number(zone.areaHa)} />
                  </b>
                  <span>hectáreas con fuego</span>
                </li>
                <li>
                  <b>
                    <Cuenta n={liberado} />
                  </b>
                  <span>USDC ya enviados a bomberos y damnificados</span>
                </li>
              </ul>
              <details className="cuenta-meta">
                <summary>¿De dónde sale la meta?</summary>
                <p className="mini">
                  {zone.hotspots} {zone.hotspots === 1 ? "foco" : "focos"} de fuego que ven los dos satélites × 14 ha = {zone.areaHa.toString()} ha,
                  y cada hectárea cuesta {fmtUsdc(zone.costoHa)} USDC:
                </p>
                <ul className="desglose">
                  <li><span>Apagar el fuego <small>({fmtUsdc(zone.costosHa.combate)} USDC por ha · {pctTxt(pz.combate)} %)</small></span><Plata v={fmtUsdc(zone.combate)} /></li>
                  <li><span>Traslados y comida <small>({fmtUsdc(zone.costosHa.logistica)} USDC por ha · {pctTxt(pz.logistica)} %)</small></span><Plata v={fmtUsdc(zone.logistica)} /></li>
                  <li><span>Ayuda a los vecinos <small>({fmtUsdc(zone.costosHa.asistencia)} USDC por ha · {pctTxt(pz.asistencia)} %)</small></span><Plata v={fmtUsdc(zone.asistencia)} /></li>
                  <li className="total"><span>Meta</span><Plata v={fmtUsdc(zone.target)} /></li>
                </ul>
                <div className="mini fuente-meta">
                  <p>
                    <b>De dónde sale.</b> La base sale de fuentes oficiales de Chile y Estados Unidos. Le propusimos al
                    Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta subirla a 400 USD por hectárea. Estuvo de
                    acuerdo: es una operación muy costosa. Este contrato
                    usa <b>{fmtUsdc(zone.costoHa)} USDC por hectárea</b>. La fórmula de brasa se calibra con el costo oficial de{" "}
                    <b>{cal.casos} temporadas de grandes incendios</b>: cada hectárea costó de {Math.round(cal.min)} a{" "}
                    {Math.round(cal.max).toLocaleString("es-AR")} USD.
                  </p>
                  <p>
                    El {pctTxt(pz.combate)} % para apagar el fuego sale del gasto real de Chile en 2023, donde el combate fue el 69 %.
                    Del resto, {pctTxt(pz.logistica)} % va a traslados y comida. Otro {pctTxt(pz.asistencia)} % va a los damnificados.
                    El paso siguiente es calibrarlo con las facturas de los cuarteles de Salta.{" "}
                    <Link href="/fundamentos#formula">Ver los {cal.casos} casos y la cuenta completa</Link>
                  </p>
                </div>
                <p className="mini">
                  {bajoMinimo
                    ? `Con menos de ${zone.minHotspots} focos confirmados el fondo no envía nada: así un foco aislado no libera un pago.`
                    : zone.balance === 0n
                    ? "El fondo está vacío: cada donación lo llena para cuando dos satélites confirmen el fuego."
                    : `Si dos satélites confirman, se envían hasta ${fmtUsdc([zone.target, zone.maxPerEvent, zone.balance].reduce((a, b) => (b < a ? b : a)))} USDC (la meta o lo recaudado, lo que sea menor).`}
                  {!sinTope && ` Tope por vez: ${fmtUsdc(zone.maxPerEvent)} USDC.`}{" "}
                  <Link href="/fundamentos#formula">Ver la explicación completa</Link>
                </p>
                {zone.totalDonated != null && zone.totalReleased != null && (
                  <p className="mini">
                    Desde el comienzo entraron <b>{fmtUsdc(zone.totalDonated)} USDC</b> y se enviaron <b>{fmtUsdc(zone.totalReleased)} USDC</b>.
                  </p>
                )}
              </details>
            </>
          )}
        </div>
      </section>

      <section className="prueba" aria-labelledby="prueba-tit">
        <div className="prueba-texto">
          <p className="eyebrow">Ya funciona</p>
          {ultimaLib ? (
            <>
              <h2 id="prueba-tit" className="sec-tit">
                La primera ayuda ya llegó, <em>con datos reales de la NASA</em>
              </h2>
              <p className="prueba-bajada">
                Dos satélites confirmaron el fuego. Dos operadores firmaron el dato por separado. El contrato envió la ayuda solo,
                sin que nadie la tocara en el camino.
              </p>
            </>
          ) : (
            <>
              <h2 id="prueba-tit" className="sec-tit">Reglas públicas, escritas en un contrato que cualquiera puede leer</h2>
              <p className="prueba-bajada">
                El fondo solo envía ayuda cuando dos satélites confirman el fuego. Nadie puede cambiar esa regla a escondidas.
              </p>
            </>
          )}
          <ul className="cifras">
            <li><b>2</b><span>satélites tienen que ver el mismo fuego</span></li>
            <li><b>2</b><span>firmas independientes para cada pago</span></li>
            <li><b>0</b><span>funciones de retiro en el contrato</span></li>
            <li><b>5 %</b><span>de comisión máxima, siempre a la vista</span></li>
          </ul>
        </div>
        {ultimaLib && dep && (
          <div className="recibo" aria-label="Comprobante de la última liberación">
            <header>
              <b>Liberación en vivo #{ultimaLib.eventId}</b>
              <span>
                {new Date(ultimaLib.fecha).toLocaleString("es-AR", {
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                  timeZone: "America/Argentina/Salta",
                })}
              </span>
            </header>
            <dl>
              <div><dt>Focos vistos por dos satélites</dt><dd>{ultimaLib.focos}</dd></div>
              <div><dt>Firmas de oráculos</dt><dd>2 de 2</dd></div>
              <div>
                <dt>A cuarteles de bomberos</dt>
                <dd className="mas">+ {(ultimaLib.cuartelesUsdc ?? (ultimaLib.liberadoUsdc * (pz.combate + pz.logistica)) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })} USDC</dd>
              </div>
              <div>
                <dt>A familias damnificadas</dt>
                <dd className="mas">+ {(ultimaLib.asistenciaUsdc ?? (ultimaLib.liberadoUsdc * pz.asistencia) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 })} USDC</dd>
              </div>
            </dl>
            <a className="recibo-ok" href={txUrl(dep, ultimaLib.tx)} target="_blank" rel="noreferrer">
              <IcoVerificado size={18} /> Ver el comprobante en Avalanche <IcoExterno />
            </a>
            <p className="recibo-nota">
              {libAnterior
                ? "Operación real en Avalanche, hecha con la versión anterior del contrato. Queda registrada para siempre."
                : "Operación real en Avalanche. Queda registrada para siempre."}
            </p>
          </div>
        )}
      </section>

      <section className="herramientas" aria-labelledby="herr-tit">
        <p className="eyebrow">Qué hacemos</p>
        <h2 id="herr-tit" className="sec-tit">Cuatro herramientas para que la ayuda llegue entera y a tiempo</h2>
        <p className="herr-bajada">
          Ante un incendio, la ayuda suele tardar días, nadie sabe cuánto hace falta y el dinero pasa por intermediarios. Con
          brasa, esos tres problemas se resuelven a la vez.
        </p>
        <div className="herr-grid">
          <article className="herr">
            <span className="ico" aria-hidden="true"><IcoSatelite /></span>
            <h3>Detecta y confirma el fuego</h3>
            <p>
              El satélite GOES-19 avisa en minutos. Dos satélites de la NASA tienen que ver el fuego en el mismo lugar para
              confirmarlo: así se filtran las falsas alarmas.
            </p>
            <a href="#mapa" className="comprobante">Ver el mapa en vivo</a>
          </article>
          <article className="herr herr-destacada">
            <span className="ico" aria-hidden="true"><IcoCalculo /></span>
            <h3>Calcula el daño y cuánto hace falta</h3>
            <p>
              Para cada incendio estima el costo de combatirlo y la ayuda para los damnificados: superficie, fuerza del fuego,
              clima, tipo de bosque, avión hidrante y casas cerca, cada número con su fuente.
            </p>
            <div className="ejemplo-calculo" aria-label="Ejemplo de cálculo">
              <small>Ejemplo real · incendio de nivel 3 en Rivadavia, Salta (210 ha) · estimación ampliada (referencia)</small>
              <ul>
                <li><span>Combatir el fuego</span><b>181.440</b></li>
                <li><span>Avión hidrante (6 h)</span><b>24.000</b></li>
                <li><span>Damnificados (6 casas)</span><b>3.060</b></li>
                <li className="total"><span>Estimación ampliada</span><b>≈ 208.500 USDC</b></li>
              </ul>
              <small>El contrato paga con la regla simple: focos confirmados × 14 ha × costo por hectárea.</small>
            </div>
            <Link href="/fundamentos#formula" className="comprobante">Ver la fórmula y sus fuentes</Link>
          </article>
          <article className="herr">
            <span className="ico" aria-hidden="true"><IcoCuartel /></span>
            <h3>Envía directo a bomberos y damnificados</h3>
            <p>
              El contrato paga directo a billeteras verificadas. Reparte {pctTxt(pz.combate)} % para el combate,{" "}
              {pctTxt(pz.logistica)} % para traslados y comida, {pctTxt(pz.asistencia)} % para los damnificados.
            </p>
            <a href="#donar" className="comprobante">Donar ahora</a>
          </article>
          <article className="herr">
            <span className="ico ico-verde" aria-hidden="true"><IcoLupa /></span>
            <h3>Todo trazable, nada se pierde</h3>
            <p>
              Cada dólar queda registrado desde tu billetera hasta su destino, en un registro público que nadie puede borrar.
              Cualquiera puede comprobar adónde fue.
            </p>
            <a href="#traza" className="comprobante">Seguí tu donación</a>
          </article>
        </div>
      </section>

      <section className="traza" id="traza" aria-labelledby="traza-tit">
        <p className="eyebrow">Trazabilidad</p>
        <h2 id="traza-tit" className="sec-tit">Seguí tu donación de punta a punta</h2>
        <p className="traza-bajada">
          En una colecta común el dinero pasa por varias manos. Acá va del fondo a quien lo necesita, sin escalas. Cada paso
          queda en un registro público que nadie puede borrar.
        </p>
        <ol className="traza-pasos">
          <li>
            <span className="ico" aria-hidden="true"><IcoDonar /></span>
            <b><em>01</em> Donás</b>
            <small>Tu aporte entra al fondo de la zona en segundos. La comisión de 5 % se ve antes de confirmar.</small>
            {(() => {
                const d = zone?.eventos.find((e) => e.tipo === "Donated");
                const u = dep && d ? txUrl(dep, d.tx) : dep ? addrUrl(dep, dep.fund) : "";
                return u ? (
                  <a href={u} target="_blank" rel="noreferrer" className="comprobante">
                    {d ? "Ver la última donación" : "Ver el registro"} <IcoExterno />
                  </a>
                ) : null;
              })()}
          </li>
          <li>
            <span className="ico" aria-hidden="true"><IcoCandado /></span>
            <b><em>02</em> Queda protegido</b>
            <small>El fondo no tiene función de retiro: nadie puede sacarlo para otra cosa. Cada pago necesita dos firmas y queda a la vista.</small>
            {dep && codigoUrl(dep) && (
              <a href={codigoUrl(dep)} target="_blank" rel="noreferrer" className="comprobante">
                Ver el código verificado <IcoExterno />
              </a>
            )}
          </li>
          <li>
            <span className="ico" aria-hidden="true"><IcoSatelite /></span>
            <b><em>03</em> Los satélites confirman</b>
            <small>Dos satélites de la NASA tienen que ver el fuego en el mismo lugar. Después, dos operadores independientes verifican el dato y lo firman por separado.</small>
            <a href="#mapa" className="comprobante">Ver el mapa</a>
          </li>
          <li>
            <span className="ico" aria-hidden="true"><IcoCuartel /></span>
            <b><em>04</em> Llega a quien lo necesita</b>
            <small>
              El contrato reparte solo: {pctTxt(pz.combate)} % para el combate, {pctTxt(pz.logistica)} % para traslados y comida,{" "}
              {pctTxt(pz.asistencia)} % para los damnificados.
            </small>
            <Link href="/fundamentos#formula" className="comprobante">Ver la fórmula</Link>
          </li>
          <li>
            <span className="ico" aria-hidden="true"><IcoLupa /></span>
            <b><em>05</em> Cualquiera lo comprueba</b>
            <small>Donación, liberación y destino quedan registrados para siempre. Nada se pierde en el camino.</small>
            {dep && addrUrl(dep, dep.fund) && (
              <a href={addrUrl(dep, dep.fund)} target="_blank" rel="noreferrer" className="comprobante">
                Ver todos los movimientos <IcoExterno />
              </a>
            )}
          </li>
        </ol>
        {zone && zone.totalDonated != null && zone.totalReleased != null && (
          <div className="traza-vivo" aria-label="Cifras del fondo, leídas del contrato">
            <span className="vivo-tag"><i aria-hidden="true" /> En vivo, leído del contrato</span>
            <dl>
              <div><dt>Donado</dt><dd><Plata v={fmtUsdc(zone.totalDonated)} /></dd></div>
              <div><dt>En el fondo</dt><dd><Plata v={fmtUsdc(zone.balance)} /></dd></div>
              <div><dt>Enviado a bomberos y damnificados</dt><dd><Plata v={fmtUsdc(zone.totalReleased)} /></dd></div>
            </dl>
          </div>
        )}
        <p className="mini">
          {dep && codigoUrl(dep) && (
            <>
              <a href={codigoUrl(dep)} target="_blank" rel="noreferrer" className="link-verificado">
                <IcoVerificado size={18} /> Código del fondo público y verificado <IcoExterno />
              </a>{" "}
              ·{" "}
            </>
          )}
          <Link href="/fundamentos">Cómo funciona por dentro</Link>
        </p>
      </section>

      {loadErr && <p className="error">{loadErr}</p>}

      <div className="cols">
        <section aria-label="Mapa" id="mapa">
          <h2 className="sec-tit">El mapa del fuego</h2>
          {focosEj && focosVivo && !focosVivo.datosGuardados && (
            <div className="vista" role="group" aria-label="Qué datos ver">
              <button className={ver === "vivo" ? "on" : ""} aria-pressed={ver === "vivo"} onClick={() => cambiarVista("vivo")}>
                Hoy, en vivo
              </button>
              <button className={ver === "ejemplo" ? "on" : ""} aria-pressed={ver === "ejemplo"} onClick={() => cambiarVista("ejemplo")}>
                Ejemplo con los tres niveles
              </button>
            </div>
          )}
          {ver === "ejemplo" && focosEj && (
            <p className="aviso-ejemplo">
              Estás viendo un ejemplo: datos reales de la NASA del 10 y 11/11, con incendios de los tres niveles. La meta muestra lo
              que costaría. Solo se envían fondos con los datos de hoy.
            </p>
          )}
          <Mapa
            focos={focos}
            seleccionado={selInc}
            onFoco={(i) => {
              setSel(i);
              setSelInc(null);
            }}
            onIncendio={(i) => {
              setSelInc(i);
              setSel(null);
            }}
            onZona={() => {
              setSel(null);
              setSelInc(null);
            }}
            avisos={ver === "vivo" ? goes?.avisos : undefined}
          />
          <p className="toca">👆 Tocá una llama para ver dónde es, a cuánta gente afecta y cuánto hace falta.</p>
          <ul className="leyenda">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <Gravedad nivel={n} px={16} /> {NIVEL_TEXTO[n]}
              </li>
            ))}
            <li>
              <span className="aviso-goes chico" aria-hidden="true" /> Aviso rápido: posible fuego, todavía sin confirmar
            </li>
          </ul>
          {ver === "vivo" && (
            <p className={`alerta-temprana${goes && goes.avisos.length > 0 ? " hay" : ""}`} role="status">
              <b>⏱️ Aviso rápido (cada 10 minutos):</b>{" "}
              {!goes
                ? "mirando…"
                : goes.avisos.length === 0
                  ? "no hay posibles fuegos nuevos en Salta en la última hora."
                  : `${goes.avisos.length} ${goes.avisos.length === 1 ? "posible fuego nuevo" : "posibles fuegos nuevos"} en Salta en la última hora.`}
              {goes?.ultimo && (
                <small>
                  Última foto del satélite GOES-19:{" "}
                  {new Date(goes.ultimo).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Salta" })}{" "}
                  (hora argentina). Avisa en minutos, pero los fondos se envían recién cuando la NASA confirma.
                </small>
              )}
            </p>
          )}
          <details className="curiosos">
            <summary>Para curiosos: qué ve cada satélite</summary>
            {focos && (
              <>
                <p className="mini">
                  Alerta de la provincia: <span className={`nivel zona n-${alerta}`}>{ALERTA[alerta]}</span>
                </p>
                <ul className="conteo">
                  {(Object.keys(SENSOR_NAME) as (keyof typeof SENSOR_NAME)[]).map((k) => (
                    <li key={k}>
                      <strong>{focos.conteo[k].altaConfianza}</strong> focos seguros de {SENSOR_NAME[k]}
                      <small> (de {focos.conteo[k].total} en total)</small>
                    </li>
                  ))}
                </ul>
                <p className="mini">
                  {hayCruce(focos)
                    ? `Para la meta cuentan solo los focos que ven los dos satélites NOAA a menos de 2 km: ${hot}.`
                    : `Para la meta cuentan los focos seguros del satélite NOAA que menos ve: ${hot}.`}{" "}
                  Los niveles se calculan con los focos de cada incendio (un foco ≈ 14 ha).
                </p>
                {zone && (
                  <p className="mini">
                    Sumando todos los incendios del mapa, aunque los vea un solo satélite, serían unas{" "}
                    {(focos.incendios ?? []).reduce((a, x) => a + x.areaHa, 0).toLocaleString("es-AR")} ha. Esa cifra orienta, pero no
                    mueve fondos.
                  </p>
                )}
              </>
            )}
            <p className="mini">
              Fuentes: NASA FIRMS (satélites NOAA-20, NOAA-21 y MODIS), GOES-19 (NOAA) por el programa Queimadas del INPE,
              OpenStreetMap, geoBoundaries (IGN) y Censo 2022 (INDEC).
            </p>
          </details>
        </section>

        <section className="panel" aria-label="Detalle y donación">
          {inc && (
            <div className="card foco" style={{ borderColor: NIVEL_COLOR[inc.nivel] }}>
              <button className="cerrar" onClick={() => setSelInc(null)} aria-label="Cerrar el incendio">
                ✕
              </button>
              <h2>
                Incendio {inc.id}
                {deptoInc && <> en {deptoInc}</>}
              </h2>
              <p className="grav-linea">
                <Gravedad nivel={inc.nivel} px={28} />
                <span className="nivel" style={{ background: NIVEL_COLOR[inc.nivel] }}>
                  Nivel {inc.nivel} · {NIVEL_NOMBRE[inc.nivel]}
                </span>
                <span className={`sello ${inc.confirmado ? "si" : "no"}`}>
                  {inc.confirmado ? "✔ Confirmado por dos satélites" : "Lo ve un solo satélite"}
                </span>
              </p>
              {(() => {
                const d = deptoInc ? DEPTOS[deptoInc] : null;
                const amb = d ? AMBIENTE[d.ambiente] : null;
                const gente = deptoInc ? genteCerca(deptoInc, inc.areaHa) : null;
                return (
                  <ul className="inc-datos">
                    <li>
                      <span aria-hidden="true">📍</span>
                      <span>
                        {d ? (
                          <>
                            Departamento <b>{deptoInc}</b>, Salta (cerca de {d.cabecera})
                          </>
                        ) : (
                          "Provincia de Salta"
                        )}
                      </span>
                    </li>
                    <li>
                      <span aria-hidden="true">🔥</span>
                      <span>
                        Unas <b>{inc.areaHa} ha</b> con fuego: como <b>{canchas(inc.areaHa).toLocaleString("es-AR")} canchas de fútbol</b>
                      </span>
                    </li>
                    {gente !== null && (
                      <li>
                        <span aria-hidden="true">🏠</span>
                        <span>
                          Se estima que unas <b>{gente.toLocaleString("es-AR")} personas</b> viven a menos de {RADIO_KM} km (Censo 2022)
                        </span>
                      </li>
                    )}
                    {amb && (
                      <li>
                        <span aria-hidden="true">🌳</span>
                        <span>
                          <b>{amb.nombre}</b>: {amb.bosque}. El fuego pone en riesgo:
                          <span className="fauna">
                            <span><b>Flora:</b> {amb.flora}.</span>
                            <span><b>Mamíferos:</b> {amb.mamiferos}.</span>
                            <span><b>Aves:</b> {amb.aves}.</span>
                            <a href={amb.url} target="_blank" rel="noreferrer" className="mini">Fuente: {amb.fuente} ↗</a>
                          </span>
                        </span>
                      </li>
                    )}
                  </ul>
                );
              })()}
              {(() => {
                const cl = clima?.id === inc.id ? clima.c : null;
                const k = calcular({ areaHa: inc.areaHa, nivel: inc.nivel, frpMax: inc.frpMax, depto: deptoInc, clima: cl, dolar: dolar?.venta ?? null, costoHa: costoHaUsd });
                const c = cuartelCercano(inc.lat, inc.lon);
                return (
                  <>
                    {zone ? (
                      <div className="inc-plata">
                        <span>Meta del fondo para Salta, la que paga el contrato</span>
                        <b>{fmtUsdc(zone.target)} USDC</b>
                        <small>
                          {zone.hotspots} {zone.hotspots === 1 ? "foco confirmado" : "focos confirmados"} × 14 ha × {fmtUsdc(zone.costoHa)} USDC
                          {avax && <> · ≈ {enAvax(Number(zone.target) / 1e6, avax)} AVAX</>}
                          {dolar && <> · ≈ {pesos(zone.target, dolar)}</>}
                        </small>
                      </div>
                    ) : (
                      <p className="mini">Leyendo la meta del contrato…</p>
                    )}
                    <p className="mini">
                      <b>Estimación ampliada (referencia)</b> para este incendio: unos {usd(k.total)} USDC
                      {dolar && <> (≈ {pesosUsd(k.total, dolar)})</>}. El contrato paga con la regla simple, no con esta estimación.
                    </p>
                    {cl && cl.viento >= 5 && (
                      <p className="viento">
                        🧭 El viento lo empuja hacia <b>{rumbo(cl.vientoDesde + 180)}</b> a {Math.round(cl.viento)} km/h
                      </p>
                    )}
                    <p className="cuartel">
                      🚒 Cuartel más cercano: <b>{c.cuartel.nombre}</b> ({c.cuartel.localidad}), a unos {Math.round(c.km)} km. <small>(Referencia por distancia.)</small>
                    </p>
                    <details className="formula">
                      <summary>Ver la cuenta</summary>
                      <ul className="desglose">
                        <li>
                          <span>
                            Apagar el fuego en el suelo
                            <small>
                              {inc.areaHa} ha × {usd(costoHaUsd)} USDC × intensidad {k.intensidad.f}
                              {k.clima.f !== 1 && <> × clima {k.clima.f}</>}
                              {k.ambiente && <> × ambiente {k.ambiente.f}</>}
                            </small>
                          </span>
                          <Plata v={usd(k.combate)} />
                        </li>
                        {k.horas > 0 && (
                          <li>
                            <span>
                              Avión hidrante
                              <small>
                                {k.horas} h × {usd(HORA_AVION)} USDC por hora
                              </small>
                            </span>
                            <Plata v={usd(k.aereo)} />
                          </li>
                        )}
                        {k.viviendas > 0 && dolar && (
                          <li>
                            <span>
                              Ayuda a los vecinos
                              <small>
                                {k.viviendas.toLocaleString("es-AR")} {k.viviendas === 1 ? "casa" : "casas"} a menos de {RADIO_AFECTADOS_KM} km × $
                                {AYUDA_VIVIENDA_ARS.toLocaleString("es-AR")}
                              </small>
                            </span>
                            <Plata v={usd(k.asistencia)} />
                          </li>
                        )}
                      </ul>
                      <ul className="factores">
                        <li>
                          🔥 Fuerza del fuego: <b>{k.intensidad.clase}</b>
                          {inc.frpMax != null && <> (el satélite midió {inc.frpMax.toLocaleString("es-AR")} MW de potencia)</>}
                        </li>
                        {cl ? (
                          <li>
                            🌡️ Ahora: {Math.round(cl.temp)} °C, humedad {Math.round(cl.humedad)} %, viento {Math.round(cl.viento)} km/h
                            {k.clima.detalle.length > 0 ? <> · suma riesgo: {k.clima.detalle.join(", ")}</> : " · sin agravantes"}
                          </li>
                        ) : (
                          <li>🌡️ Clima: sin dato ahora (se toma como normal)</li>
                        )}
                        {k.ambiente && <li>🌳 Ambiente: {k.ambiente.nombre} (factor {k.ambiente.f})</li>}
                      </ul>
                      <p className="mini">
                        Es una estimación ampliada, solo de referencia. El contrato paga con la regla simple de la zona (focos × 14 ha ×{" "}
                        {usd(costoHaUsd)} USDC).
                        El cuartel es una referencia por distancia: quién va lo coordina Defensa Civil. Última detección:{" "}
                        {horaAr(inc.ultimaDeteccion)} (hora argentina) ({inc.sensores.map((s) => SENSOR_NAME[s]).join(", ")}).{" "}
                        <Link href="/fundamentos#formula">De dónde sale cada número</Link>
                      </p>
                    </details>
                  </>
                );
              })()}
              <p className="mini">
                Tu donación va al fondo de toda la provincia, no a este incendio en particular: se envía cuando dos satélites
                confirman fuego en Salta.
              </p>
              <a className="btn" href="#donar">
                Ayudar a combatirlo
              </a>
            </div>
          )}

          {f && (
            <div className="card foco">
              <button className="cerrar" onClick={() => setSel(null)} aria-label="Cerrar el foco">
                ✕
              </button>
              <h2>Punto de calor</h2>
              <p>
                <i className="dot" style={{ background: SENSOR_COLOR[f.sensor] }} /> Lo vio {SENSOR_NAME[f.sensor]}
              </p>
              <p>
                {horaAr(`${f.fecha}T${f.hora.slice(0, 2)}:${f.hora.slice(2)}:00Z`)} (hora argentina) · confianza del satélite: {CONF_NAME[f.confianza]}
              </p>
            </div>
          )}

          <div className="card donar" id="donar">
            <h2>Doná a bomberos y damnificados</h2>
            <Foto
              src="/fotos/brigadistas-comarca-andina.webp"
              alt="Dos brigadistas apagan con una manguera un incendio forestal de noche"
              ancho={1200}
              alto={800}
              pie="Brigadistas en la Comarca Andina, enero de 2026."
              autor="CatrielGB"
              licencia="CC BY-SA 4.0"
              licenciaUrl="https://creativecommons.org/licenses/by-sa/4.0/deed.es"
              fuente="https://commons.wikimedia.org/wiki/File:Brigadistas_1.jpg"
            />
            <ol className="stepper" aria-label="Pasos para donar">
              <li className={pasoWallet ? "hecho" : "ahora"} aria-current={!pasoWallet ? "step" : undefined}>
                <i>{pasoWallet ? "✔" : "1"}</i>
                <span>Abrí tu billetera</span>
              </li>
              <li className={pasoRed ? "hecho" : pasoWallet ? "ahora" : ""} aria-current={pasoWallet && !pasoRed ? "step" : undefined}>
                <i>{pasoRed ? "✔" : "2"}</i>
                <span>Elegí Avalanche</span>
              </li>
              <li className={pasoListo ? "hecho" : pasoRed ? "ahora" : ""} aria-current={pasoRed && !pasoListo ? "step" : undefined}>
                <i>{pasoListo ? "✔" : "3"}</i>
                <span>Doná</span>
              </li>
            </ol>

            <p className="lbl" id="lbl-monto">¿Cuánto querés donar?</p>
            <div className="chips" role="group" aria-labelledby="lbl-monto">
              {["10", "25", "50", "100"].map((v) => (
                <button key={v} className={amount === v ? "on" : ""} aria-pressed={amount === v} aria-label={`${v} USDC`} onClick={() => setAmount(v)} disabled={busy}>
                  {v}
                </button>
              ))}
            </div>
            <label htmlFor="monto" className="sr">
              Otro monto en USDC
            </label>
            <div className="monto-otro">
              <input id="monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
              <span>USDC</span>
            </div>
            <p className="mini">
              1 USDC = 1 dólar digital.{avax && <> Hoy 1 AVAX ≈ {avax.toLocaleString("es-AR")} USDC.</>}
              {minDon !== null && <> Mínimo: {fmtUsdc(minDon)} USDC que lleguen al fondo.</>}
            </p>
            {bajoMinDon && minDon !== null && (
              <p className="aviso-minimo" role="alert">
                Con este monto llegan menos de {fmtUsdc(minDon)} USDC al fondo. Subí un poco el monto.
              </p>
            )}

            {m2 !== null && m2 > 0 && (
              <p className="impacto" aria-live="polite">
                🌱 Con la regla del fondo, tu aporte cubre unos <b>{m2.toLocaleString("es-AR")} m²</b> de fuego
                {m2 >= 7140 ? <> (≈ {(m2 / 7140).toLocaleString("es-AR", { maximumFractionDigits: 1 })} canchas de fútbol)</> : <> (≈ {Math.max(1, Math.round((m2 / 7140) * 100))} % de una cancha de fútbol)</>}
              </p>
            )}

            <p className="cuenta" aria-live="polite">
              {reparto ? (
                <>
                  Pagás <b>{fmtUsdc(reparto.total)}</b> → llegan <b>{fmtUsdc(reparto.net)}</b> al fondo para bomberos y damnificados
                  <small> ({fmtUsdc(reparto.fee)} quedan para brasa, por la plataforma y la difusión; se ve en el registro público)</small>
                </>
              ) : (
                "Elegí un monto para ver cuánto llega."
              )}
            </p>
            <label className="check">
              <input type="checkbox" checked={cubrir} onChange={(e) => setCubrir(e.target.checked)} disabled={busy} /> Sumo la comisión
              para que llegue el monto completo
            </label>
            <p className="mini">
              Una donación enviada no se puede deshacer.{" "}
              <a href="#terminos">Leé las condiciones</a>.
            </p>
            {saldo !== null && (
              <p className="mini">
                Tenés {fmtUsdc(saldo)} USDC{sinSaldo ? " · no alcanza" : ""}
              </p>
            )}

            {!hasWallet ? (
              <a className="btn" href="https://core.app/" target="_blank" rel="noreferrer">
                Instalar Core, la billetera de Avalanche
              </a>
            ) : !account ? (
              <button className="btn" onClick={connect}>
                Abrir mi billetera
              </button>
            ) : !netOk ? (
              <div className="aviso-red" role="alert">
                <p>
                  <b>Tu billetera está en otra red.</b> Para donar tiene que estar en {redName || "Avalanche Fuji"}.
                </p>
                <button className="btn" onClick={cambiar}>
                  Cambiar a {redName || "Avalanche Fuji"}
                </button>
              </div>
            ) : (
              <button className="btn" onClick={onDonar} disabled={busy || !netOk || reparto === null || sinSaldo || bajoMinDon}>
                {busy ? "Esperando tu firma…" : `Donar ${reparto ? fmtUsdc(reparto.total) : ""} USDC`}
              </button>
            )}

            <p className="estado" role="status" aria-live="polite">
              {!hasWallet && "Para donar necesitás una billetera digital como Core o MetaMask."}
              {hasWallet && !account && "Tu billetera está cerrada."}
              {account && netOk && tx.s === "idle" && `Billetera lista (${short(account)}).`}
            </p>
            {tx.s === "pendiente" && (
              <p className="pend">
                {tx.paso === "approve" ? "1 de 2 · Autorizá el USDC en tu billetera…" : "2 de 2 · Enviando tu donación…"}{" "}
                {tx.hash && dep && <Hash d={dep} h={tx.hash} />}
              </p>
            )}
            {tx.s === "ok" && dep && (
              <div className="ok gracias">
                <div className="chispas" aria-hidden="true">
                  {Array.from({ length: 14 }, (_, i) => (
                    <i key={i} style={{ left: `${(i * 7 + 3) % 100}%`, animationDelay: `${(i % 7) * 0.12}s` }} />
                  ))}
                </div>
                <p className="insignia">🏅 ¡Gracias! Ya sos parte de la brigada de brasa.</p>
                <p>
                  Tu donación quedó registrada. <Hash d={dep} h={tx.hash} />
                </p>
                <a className="btn btn-sec" href={`https://wa.me/?text=${encodeURIComponent(compartir)}`} target="_blank" rel="noreferrer">
                  Contalo por WhatsApp
                </a>
              </div>
            )}
            {tx.s === "error" && <p className="error">{tx.msg}</p>}

            <details className="avax-pasos">
              <summary>¿No tenés billetera o tenés AVAX? Mirá cómo</summary>
              <ol>
                <li>
                  <b>Bajá Core</b>, la billetera de Avalanche.{" "}
                  <a href="https://core.app/" target="_blank" rel="noreferrer">
                    core.app ↗
                  </a>
                </li>
                <li>
                  <b>Si tenés AVAX, cambialo a USDC</b> con el botón “Swap” de Core o en{" "}
                  <a href="https://lfj.gg/avalanche/trade" target="_blank" rel="noreferrer">
                    LFJ ↗
                  </a>
                  . Al fondo siempre llega USDC, así cuarteles y damnificados saben exacto cuánto reciben. Tu AVAX nunca pasa por brasa.
                </li>
                <li>
                  <b>Volvé acá y doná.</b>
                </li>
              </ol>
              <p className="mini">
                En Avalanche Fuji el USDC se pide gratis en{" "}
                <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer">
                  faucet.circle.com ↗
                </a>{" "}
                (elegí Avalanche Fuji).
              </p>
            </details>
          </div>

          <div className="card">
            <h2>Quiénes reciben</h2>
            {zone && zone.recipients.length === 0 && <p className="mini">Todavía no hay cuarteles cargados.</p>}
            {v3 && zone && !asignacionVigente && (
              <p className="aviso-minimo" role="note">
                El fondo paga cuando la federación asigna los cuarteles que combaten el fuego.
              </p>
            )}
            <ul className="quienes">
              {zone?.recipients.map((r) => (
                <li key={r.id}>
                  <span>
                    <span aria-hidden="true">{r.kind === "station" ? "🚒" : "🤝"}</span> <b>{nombreDestinatario(r.label, r.kind)}</b>{" "}
                    <small>
                      {r.kind === "station" ? "combate y logística" : "ayuda a damnificados"}
                      {r.active ? "" : " (inactivo)"}
                    </small>
                    {asignados.has(r.id.toLowerCase()) && zone && (
                      <small className="asignado">
                        {" "}
                        · Asignado a este incendio por la federación, hasta el{" "}
                        {new Date(zone.respondersUntil * 1000).toLocaleString("es-AR", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Argentina/Salta",
                        })}
                      </small>
                    )}
                    {r.active && r.activeFrom * 1000 > Date.now() && (
                      <small className="pendiente">
                        {" "}
                        · recibe desde el{" "}
                        {new Date(r.activeFrom * 1000).toLocaleString("es-AR", {
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Argentina/Salta",
                        })}
                      </small>
                    )}
                  </span>
                  {dep && addrUrl(dep, r.wallet) ? (
                    <a href={addrUrl(dep, r.wallet)} target="_blank" rel="noreferrer">
                      ver cuenta ↗
                    </a>
                  ) : (
                    <code>{short(r.wallet)}</code>
                  )}
                </li>
              ))}
            </ul>
            <p className="mini">
              Solo reciben cuarteles y damnificados verificados. Cada alta nueva se ve en público antes de poder cobrar
              {dep && esV2(dep) && dep.recipientDelay ? ` (${Math.round(dep.recipientDelay / 60)} min hoy; 72 h con la federación)` : ""}.
            </p>
          </div>

          {zone && zone.eventos.length > 0 && (
            <div className="card">
              <h2>
                Últimos movimientos {donaciones > 0 && <span className="pill">{donaciones} {donaciones === 1 ? "donación" : "donaciones"}</span>}
              </h2>
              <ul className="eventos">
                {zone.eventos.map((e) => (
                  <li key={e.tx + e.texto}>
                    <span aria-hidden="true">{e.tipo === "Donated" ? "💛" : e.tipo === "Released" ? "🚒" : "🔥"}</span> {e.texto}
                    {dep && txUrl(dep, e.tx) && (
                      <>
                        {" "}
                        <a href={txUrl(dep, e.tx)} target="_blank" rel="noreferrer">
                          ver ↗
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ultimaLib && dep && !deContrato && (
            <p className="mini">
              Ya se enviaron {liberado.toLocaleString("es-AR", { maximumFractionDigits: 2 })} USDC con la versión anterior del contrato.{" "}
              <a href={txUrl(dep, ultimaLib.tx)} target="_blank" rel="noreferrer">
                Ver el envío ↗
              </a>
            </p>
          )}
        </section>
      </div>

      <details className="terminos" id="terminos" open>
        <summary>Antes de donar, leé esto</summary>
        <ul>
          <li>
            <b>Red:</b> hoy funciona en Avalanche Fuji, la red de prueba de Avalanche. El paso a la red principal está en el roadmap.
          </li>
          <li>
            <b>Comisión:</b> {dep ? `${(dep.feeBps ?? 500) / 100} %` : "5 %"} por la plataforma y la difusión, el máximo que permite el
            fondo. No depende de cómo se use el dinero.
          </li>
          <li>
            <b>El dinero no pasa por brasa:</b> el fondo paga solo, según la regla pública, a destinatarios
            verificados (hoy por el equipo; en el piloto, por la federación de bomberos). La plataforma no es mandataria ni depositaria. Cada
            cuartel o damnificado decide cómo usa lo que recibe.
          </li>
          <li>
            <b>La detección es una estimación</b> de satélite, con unas 3 horas de demora. No es un parte oficial ni un seguro.
          </li>
          <li>
            <b>Donás solo si sos mayor de edad</b> y entendés que una donación enviada no se puede deshacer.
          </li>
        </ul>
      </details>

      <section className="cuarteles" aria-label="Para cuarteles">
        <h2>¿Sos bombero o damnificado?</h2>
        <p>
          La federación de bomberos verifica a cada cuartel y a cada familia damnificada. Cuando dos satélites confirman fuego en
          su zona, reciben el dinero en su billetera. Cada pago queda anotado para rendir cuentas.
        </p>
      </section>

      <BotonFlotante />

    </main>
      <footer className="pie">
        <div className="pie-in">
          <div className="pie-marca">
            <Logo height={34} />
            <p className="lema">Ayuda a tiempo, recursos a la vista.</p>
            <p>
              La ayuda llega más rápido que una colecta. El satélite avisa en minutos, la NASA confirma en horas y el
              dinero llega en segundos.
            </p>
          </div>
          <nav className="pie-col" aria-label="brasa">
            <b>brasa</b>
            <a href="#mapa">Mapa</a>
            <a href="#donar">Donar</a>
            <Link href="/fundamentos">Fundamentos</Link>
          </nav>
          <nav className="pie-col" aria-label="Verificar">
            <b>Verificar</b>
            {dep && codigoUrl(dep) && (
              <a href={codigoUrl(dep)} target="_blank" rel="noreferrer">
                Contrato verificado <IcoExterno />
              </a>
            )}
            {dep && addrUrl(dep, dep.fund) && (
              <a href={addrUrl(dep, dep.fund)} target="_blank" rel="noreferrer">
                Movimientos del fondo <IcoExterno />
              </a>
            )}
            <a href="https://github.com/jfacundoayala/brasa" target="_blank" rel="noreferrer">
              Código en GitHub <IcoExterno />
            </a>
          </nav>
          <div className="pie-col">
            <b>Datos</b>
            <span>Focos: NASA FIRMS (VIIRS)</span>
            <span>Aviso rápido: GOES-19 (INPE)</span>
            <span>Mapa: © OpenStreetMap</span>
            <span>Red: Avalanche Fuji</span>
          </div>
        </div>
        <p className="pie-base">Hecho en Chaco para el mundo · Argentina Space 2026 · Track Avalanche · Juan Facundo Ayala y Gastón Persoglia</p>
      </footer>
    </>
  );
}

/**
 * "Donar ahora" fijo abajo en el celular. Se esconde mientras se ve el botón de arriba o la tarjeta de donar,
 * para no tapar contenido ni repetir el mismo botón dos veces en pantalla.
 */
function BotonFlotante() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // El navegador avisa cuándo entran o salen de pantalla el botón de arriba y la tarjeta de donar.
    // No se mide nada en cada scroll: así el desplazamiento queda fluido en el celular.
    if (typeof IntersectionObserver === "undefined") return;
    const enPantalla = new Map<Element, boolean>();
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) enPantalla.set(e.target, e.isIntersecting);
      setVisible(![...enPantalla.values()].some(Boolean));
    });
    const observados = new Set<Element>();
    const observar = () => {
      for (const el of [document.querySelector(".hero-acciones"), document.getElementById("donar")]) {
        if (el && !observados.has(el)) {
          observados.add(el);
          io.observe(el);
        }
      }
    };
    observar();
    const t = setInterval(observar, 2000); // la tarjeta de donar puede aparecer después de cargar
    return () => {
      io.disconnect();
      clearInterval(t);
    };
  }, []);
  return (
    <a className={`btn btn-flotante${visible ? " visible" : ""}`} href="#donar" aria-hidden={!visible} tabIndex={visible ? 0 : -1}>
      Donar ahora
    </a>
  );
}

/** Monto con su unidad y el ícono de dólar digital, para que nunca quede un número suelto. */
function Plata({ v }: { v: string }) {
  return (
    <b className="plata">
      {v} <IconoUsdc /> USDC
    </b>
  );
}

/** Ícono simple de moneda (círculo azul con $). No es el logo oficial de Circle. */
export function IconoUsdc({ px = 16 }: { px?: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" aria-hidden="true" className="icono-usdc">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">$</text>
    </svg>
  );
}

/** Fecha y hora en Argentina, a partir de una fecha en UTC. */
function horaAr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Salta" });
}

/** Número que sube de 0 al valor (animación corta, como un marcador). Respeta "reducir movimiento". */
function Cuenta({ n }: { n: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || n === 0) {
      setV(n);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(n * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{v.toLocaleString("es-AR", { maximumFractionDigits: n >= 100 || Number.isInteger(n) ? 0 : 2 })}</>;
}
