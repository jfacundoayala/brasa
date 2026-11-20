"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MotionConfig } from "motion/react";
import Revelar from "./Revelar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type Deployment,
  type Focos,
  type ZoneData,
  addrUrl,
  confirmados,
  donar,
  errorCorto,
  type Billetera,
  billeteras,
  elegir,
  fmtUsdc,
  loadZone,
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
  esStellar,
  BILLETERA_STELLAR,
} from "@/lib/chain";
import { CONF_NAME, SENSOR_NAME } from "./Mapa";
import Logo from "./Logo";
import { IcoCalculo, IcoCandado, IcoOjo, IcoCuartel, IcoExterno, IcoSatelite, IcoVerificado } from "./Iconos";
import Foto from "./Foto";
import Espacio from "./Espacio";
import { Gravedad } from "./Llamas";
import { cuartelCercano } from "@/lib/cuarteles";
import { canchas, departamentoDe } from "@/lib/zonas";
import { climaEn, type Clima } from "@/lib/formula";
import { HORAS_DATO_FRESCO, leerFocos } from "@/lib/focos";
import { avisosGoes, rumbo, type Aviso } from "@/lib/goes";

/** Dólar oficial (venta) de DolarApi, solo como referencia en pesos. */
type Dolar = { venta: number; fecha: string };
const pesos = (usdc: bigint, d: Dolar) => Math.round((Number(usdc) / 1e6) * d.venta).toLocaleString("es-AR") + " pesos";

const Mapa = dynamic(() => import("./Mapa"), { ssr: false, loading: () => <div className="mapa cargando">Cargando mapa…</div> });

type Tx =
  | { s: "idle" }
  | { s: "pendiente"; paso: "approve" | "donar"; hash: string }
  | { s: "ok"; hash: string }
  | { s: "error"; msg: string };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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
  const [wallets, setWallets] = useState<Pick<Billetera, "id" | "nombre">[]>([]);
  const [walletId, setWalletId] = useState<Billetera["id"] | null>(null);
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

  const [clima, setClima] = useState<{ id: number; c: Clima | null } | null>(null);
  const [goes, setGoes] = useState<{ avisos: Aviso[]; ultimo: string | null } | null>(null);

  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.venta > 0 ? setDolar({ venta: j.venta, fecha: j.fechaActualizacion }) : null))
      .catch(() => setDolar(null));
    // Alerta temprana GOES-19 (cada 10 min); se vuelve a leer cada 10 min.
    const leerGoes = () => avisosGoes().then(setGoes).catch(() => setGoes(null));
    leerGoes();
    const t = setInterval(leerGoes, 600_000);
    return () => clearInterval(t);
  }, []);

  // Datos de ejecucion (los genera otra parte)
  useEffect(() => {
    // deployment.json lo escribe el deploy local (no va a git). En el sitio publicado se usa deployment.stellar.json,
    // que sí está en el repo y apunta al contrato de la red de prueba de Stellar.
    // En producción se va directo a ese archivo: así la consola del sitio publicado no muestra un 404.
    const leerPublicado = () => fetch("/deployment.stellar.json", { cache: "no-store" }).then((r) => r.json());
    const leerDeploy = () =>
      process.env.NODE_ENV === "production"
        ? leerPublicado()
        : fetch("/deployment.json", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .catch(leerPublicado);
    Promise.all([leerDeploy(), leerFocos()])
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
        // En Stellar no: esos pagos son de otra red y su comprobante no está en este explorador.
        const otras = (esStellar(dep) ? [] : Object.values(t))
          .filter((x): x is Liberacion[] => Array.isArray(x))
          .flat()
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        setLibAnterior(propias.length === 0 && otras.length > 0);
        setLibs(propias.length ? propias : otras.slice(-1));
      })
      .catch(() => setLibs([]));
  }, [dep]);

  const refreshZone = useCallback(() => {
    if (!dep || !focos) return;
    loadZone(dep, confirmados(focos))
      .then((z) => {
        setZone(z);
        setZoneErr("");
      })
      .catch(() =>
        setZoneErr("No pude leer el fondo ahora. La red de prueba de Stellar se reinicia de vez en cuando; el último pago quedó guardado en «Un pago, paso a paso»."),
      );
  }, [dep, focos]);
  useEffect(refreshZone, [refreshZone]);

  // Billeteras instaladas: solo en el cliente. Si alguna ya está abierta en este sitio, se sigue con esa.
  useEffect(() => {
    if (!dep) return;
    if (esStellar(dep)) {
      // En Stellar la billetera se elige en la ventana del kit. Si ya hay una cuenta conectada, se sigue con esa.
      setHasWallet(true);
      setWallets([BILLETERA_STELLAR]);
      let sigue = true;
      import("@/lib/stellar")
        .then((m) => m.cuentaStellar(dep))
        .then((a) => {
          if (!sigue || !a) return;
          setWalletId("stellar");
          setAccount(a);
          setChainId(dep.chainId);
        })
        .catch(() => {});
      return () => {
        sigue = false;
      };
    }
    const lista = billeteras();
    setHasWallet(lista.length > 0);
    setWallets(lista.map(({ id, nombre }) => ({ id, nombre })));
    let vivo = true;
    (async () => {
      for (const b of lista) {
        const a = (await b.provider.request({ method: "eth_accounts" }).catch(() => [])) as string[];
        if (!vivo) return;
        if (a?.[0]) {
          elegir(b.id);
          setWalletId(b.id);
          return;
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [dep]);

  // Cuenta y red de la billetera elegida
  useEffect(() => {
    if (!walletId || walletId === "stellar") return;
    const eth = elegir(walletId);
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
  }, [walletId]);

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

  async function connect(id: Billetera["id"]) {
    if (id === "stellar") {
      if (!dep) return;
      try {
        const a = await (await import("@/lib/stellar")).conectarStellar(dep);
        setWalletId("stellar");
        setAccount(a);
        setChainId(dep.chainId);
      } catch (e) {
        setTx({ s: "error", msg: errorCorto(e) });
      }
      return;
    }
    const eth = elegir(id);
    if (!eth) return;
    setWalletId(id);
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
      setTx({ s: "pendiente", paso: esStellar(dep) ? "donar" : "approve", hash: "" });
      const hash = await donar(dep, monto, cubrir, reparto.total, (st) => setTx({ s: "pendiente", paso: st.paso, hash: st.hash }));
      setTx({ s: "ok", hash });
      refreshZone();
    } catch (e) {
      setTx({ s: "error", msg: errorCorto(e) });
    }
  }

  // v2: lo pagado lo suma el contrato (zoneTotals). v1: lo anota el relayer en liberaciones.json.
  const delContrato = zone?.totalReleased != null ? Number(zone.totalReleased) / 1e6 : null;
  const anotado = libs.reduce((a, x) => a + x.liberadoUsdc, 0);
  // Mientras el contrato nuevo no libere, se muestra lo que ya pagó la versión anterior.
  const liberado = delContrato != null && !(delContrato === 0 && libAnterior) ? delContrato : anotado;
  const ultimaLib = libs.length ? libs[libs.length - 1] : null;
  const pct = zone && zone.target > 0n ? Math.min(100, Number((zone.balance * 10000n) / zone.target) / 100) : 0;
  const f = sel !== null && focos ? focos.focos[sel] : null;
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
  const stellar = !!dep && esStellar(dep);
  const redName = dep ? (stellar ? "la red de prueba de Stellar" : dep.chainId === 43113 ? "Avalanche Fuji" : `red local (${dep.chainId})`) : "";

  const nInc = focos?.incendios?.length ?? 0;
  const puntosGlobo = useMemo(() => (focos?.incendios ?? []).map((x) => ({ lat: x.lat, lon: x.lon, nivel: x.nivel })), [focos]);
  const enVivo = ver === "vivo" && !!focos && !focos.datosGuardados;
  // La consulta a la NASA cubre las últimas 24 h. Si esa consulta es vieja, no se dice "hoy" ni "en vivo":
  // se muestra la fecha del dato.
  const vivoViejo =
    !!focosVivo && !focosVivo.datosGuardados && Date.now() - Date.parse(focosVivo.generatedAt) > HORAS_DATO_FRESCO * 3600_000
      ? new Date(focosVivo.generatedAt).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "numeric",
          timeZone: "America/Argentina/Salta",
        })
      : null;
  const detViejo = enVivo ? vivoViejo : null;
  const nConf = focos?.incendios?.filter((x) => x.confirmado).length ?? 0;
  // Donación mínima: la lee del contrato (minDonation()). El contrato compara contra lo que llega al fondo.
  const minDon = zone?.minDonation ?? null;
  const bajoMinDon = minDon !== null && reparto !== null && reparto.net < minDon;
  const compartir = `Doné a los bomberos y a los damnificados por los incendios con brasa: la ayuda llega cuando dos satélites confirman el fuego. ${typeof window !== "undefined" ? window.location.origin : "https://brasafund.vercel.app"}`;

  // ---- Portada clara: seis secciones. El detalle vive en /fundamentos. ----
  const btn =
    "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-0 px-6 text-base font-semibold no-underline transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";
  const btnPrimario = `${btn} bg-accion text-white shadow-[0_10px_28px_-10px_rgba(27,95,174,.6)] hover:bg-accion-oscura`;
  const btnSecundario = `${btn} border border-solid border-linea bg-white text-tinta hover:border-tinta/40`;
  const tarjeta = "rounded-3xl border border-solid border-linea bg-white shadow-[0_1px_2px_rgba(28,23,20,.04),0_16px_40px_-20px_rgba(28,23,20,.16)]";
  const eyebrow = "m-0 font-display text-sm font-semibold uppercase tracking-[.14em] text-verde";
  const titulo = "m-0 mt-2 font-display text-3xl font-bold leading-[1.05] tracking-tight text-tinta md:text-5xl";
  const bajada = "m-0 mt-4 max-w-2xl text-lg leading-relaxed text-tinta-2";
  const seccion = "mx-auto w-full max-w-6xl px-5 py-16 md:py-24";
  const enlace = "font-semibold text-tinta underline decoration-accion decoration-2 underline-offset-4 hover:text-accion-oscura";
  const PASOS = [
    { n: "01", t: "Detecta", d: "Dos satélites de la NASA tienen que ver el mismo fuego. Seis capas descartan lo que no es un incendio.", ico: <IcoSatelite size={26} /> },
    { n: "02", t: "Calcula", d: "Una regla pública dice cuánto hace falta para combatirlo, con la fuente de cada número.", ico: <IcoCalculo size={26} /> },
    { n: "03", t: "Envía", d: "El contrato paga solo al cuartel asignado y a los damnificados. Sin intermediarios.", ico: <IcoCuartel size={26} /> },
  ];
  const CIFRAS = [
    { n: "2", t: "satélites tienen que ver el mismo fuego" },
    { n: "2", t: stellar ? "oráculos independientes por cada pago" : "firmas independientes por cada pago" },
    { n: "0", t: "funciones de retiro en el contrato" },
    { n: "6", t: "capas de detección antes de pagar" },
  ];
  // Las tres dudas de quien va a donar. Cada respuesta sale de lo que el contrato hace hoy.
  const DUDAS = [
    { p: "¿Adónde va mi donación?", r: "Al fondo de la zona, que es un contrato público. La comisión de 5 % se ve antes de confirmar y no puede subir." },
    { p: "¿Y si no hay incendio?", r: "Tu donación queda en el fondo hasta el próximo incendio confirmado. Nadie puede retirarla: el contrato no tiene esa función. Por eso tampoco hay devoluciones." },
    { p: "¿Cómo lo compruebo?", r: "Cada pago queda en un registro público con fecha, monto y destinatario. Acá abajo tenés el enlace para verlo vos." },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <header className="sticky top-0 z-[1100] border-0 border-b border-solid border-linea/70 bg-papel/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <Link href="/" className="inline-flex items-center rounded-xl" aria-label="Inicio de brasa">
            <Logo height={34} claro />
          </Link>
          <nav className="flex items-center gap-0.5 whitespace-nowrap text-[15px] font-medium sm:gap-1" aria-label="Secciones">
            <a href="#como" className="hidden rounded-full px-3 py-2 text-tinta-2 no-underline hover:bg-papel-2 hover:text-tinta sm:inline-flex">Cómo funciona</a>
            <a href="#mapa" className="hidden rounded-full px-3 py-2 text-tinta-2 no-underline hover:bg-papel-2 hover:text-tinta sm:inline-flex">Mapa</a>
            <Link href="/fundamentos" className="rounded-full px-2 py-2 text-tinta-2 no-underline hover:bg-papel-2 hover:text-tinta sm:px-3">Fundamentos</Link>
            <a href="#donar" className={`${btnPrimario} ml-1 min-h-10 px-5 text-[15px]`}>Donar</a>
          </nav>
        </div>
      </header>

      <main id="inicio" className="m-0 max-w-none bg-papel p-0 font-sans text-tinta">
        {/* 1 · Inicio: la ventana al espacio */}
        <div className="ventana mx-auto max-w-[1400px] px-3 pt-3 md:px-5 md:pt-5">
          <Espacio puntos={puntosGlobo} enVivo={enVivo && !detViejo} />
        </div>

        {loadErr && <p className="error mx-auto mt-6 max-w-6xl">{loadErr}</p>}

        {/* 2 · Cómo funciona */}
        <section id="como" className={seccion} aria-labelledby="como-tit">
          <Revelar>
            <p className={eyebrow}>Cómo funciona</p>
            <h2 id="como-tit" className={titulo}>Tres pasos. Ningún intermediario.</h2>
          </Revelar>
          <ol className="m-0 mt-10 grid list-none gap-4 p-0 md:grid-cols-3">
            {PASOS.map((p, i) => (
              <Revelar key={p.n} demora={i * 0.08} como="li" className={`${tarjeta} p-7`}>
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-verde-suave text-verde">{p.ico}</span>
                  <span className="font-display text-sm font-semibold tracking-widest text-tinta-3">{p.n}</span>
                </div>
                <h3 className="m-0 mt-6 font-display text-2xl font-bold tracking-tight text-tinta">{p.t}</h3>
                <p className="m-0 mt-2 text-[17px] leading-relaxed text-tinta-2">{p.d}</p>
              </Revelar>
            ))}
          </ol>
        </section>

        {/* 3 · Mapa en vivo */}
        <section id="mapa" className="border-0 border-y border-solid border-linea bg-white" aria-labelledby="mapa-tit">
          <div className={seccion}>
            <Revelar className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={eyebrow}>
                  {enVivo && !detViejo && <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-verde align-middle" aria-hidden="true" />}
                  Salta · {!enVivo ? "datos guardados" : detViejo ? `último dato del ${detViejo}` : "hoy"}
                </p>
                <h2 id="mapa-tit" className={titulo}>
                  {!focos
                    ? "Mirando el cielo de Salta…"
                    : nInc === 0
                      ? "Hoy los satélites no ven incendios en Salta"
                      : `Los satélites ${detViejo ? "vieron" : "ven"} ${nInc} ${nInc === 1 ? "incendio" : "incendios"} en Salta`}
                </h2>
              </div>
              {focosEj && focosVivo && !focosVivo.datosGuardados && (
                <div className="inline-flex rounded-full border border-solid border-linea bg-papel p-1" role="group" aria-label="Qué datos ver">
                  {(["vivo", "ejemplo"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={ver === v}
                      onClick={() => cambiarVista(v)}
                      className={`min-h-10 cursor-pointer rounded-full border-0 px-4 text-sm font-semibold transition ${ver === v ? "bg-tinta text-white" : "bg-transparent text-tinta-2 hover:text-tinta"}`}
                    >
                      {v === "vivo" ? (vivoViejo ? `Último dato (${vivoViejo})` : "Hoy, en vivo") : "Ver un ejemplo"}
                    </button>
                  ))}
                </div>
              )}
            </Revelar>

            {ver === "ejemplo" && focosEj && (
              <p className="m-0 mt-4 rounded-2xl bg-aviso/10 px-4 py-3 text-[15px] text-tinta">
                Estás viendo un ejemplo con datos reales de la NASA del 10 y 11/11. Solo se envían fondos con los datos de hoy.
              </p>
            )}

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <div>
                <div className="overflow-hidden rounded-3xl border border-solid border-linea">
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
                </div>
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-tinta-2">
                  {([1, 2, 3] as const).map((n) => (
                    <li key={n} className="inline-flex items-center gap-1.5">
                      <Gravedad nivel={n} px={15} /> {NIVEL_TEXTO[n]}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid content-start gap-4">
                {inc ? (
                  <div className={`${tarjeta} relative p-6`}>
                    <button
                      type="button"
                      onClick={() => setSelInc(null)}
                      aria-label="Cerrar el incendio"
                      className="absolute right-4 top-4 grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-papel-2 text-tinta-2 hover:text-tinta"
                    >
                      ✕
                    </button>
                    <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-tinta" style={{ background: `${NIVEL_COLOR[inc.nivel]}33` }}>
                        <Gravedad nivel={inc.nivel} px={16} /> Nivel {inc.nivel} · {NIVEL_NOMBRE[inc.nivel]}
                      </span>
                      <span className={`rounded-full px-3 py-1 ${inc.confirmado ? "bg-verde-suave text-verde" : "bg-papel-2 text-tinta-2"}`}>
                        {inc.confirmado ? "✔ Dos satélites" : "Un solo satélite"}
                      </span>
                    </p>
                    <h3 className="m-0 mt-4 pr-8 font-display text-2xl font-bold tracking-tight text-tinta">
                      Incendio {inc.id}
                      {deptoInc && <> en {deptoInc}</>}
                    </h3>
                    <p className="m-0 mt-2 text-[17px] leading-relaxed text-tinta-2">
                      Unas <b className="text-tinta">{inc.areaHa} ha</b> con fuego, como {canchas(inc.areaHa).toLocaleString("es-AR")} canchas de fútbol.
                    </p>
                    {(() => {
                      const cl = clima?.id === inc.id ? clima.c : null;
                      const c = cuartelCercano(inc.lat, inc.lon);
                      return (
                        <ul className="m-0 mt-4 grid list-none gap-2 p-0 text-[15px] text-tinta-2">
                          {cl && cl.viento >= 5 && (
                            <li>
                              Viento hacia el <b className="text-tinta">{rumbo(cl.vientoDesde + 180)}</b>, a {Math.round(cl.viento)} km/h
                            </li>
                          )}
                          <li>
                            Cuartel más cercano: <b className="text-tinta">{c.cuartel.nombre}</b>, a unos {Math.round(c.km)} km
                          </li>
                        </ul>
                      );
                    })()}
                    {zone && (
                      <div className="mt-5 rounded-2xl bg-papel p-4">
                        <p className="m-0 text-sm text-tinta-2">Meta del fondo para Salta</p>
                        <p className="m-0 font-display text-3xl font-bold tracking-tight text-tinta">{fmtUsdc(zone.target)} USDC</p>
                        {dolar && <p className="m-0 text-sm text-tinta-2">≈ {pesos(zone.target, dolar)}</p>}
                      </div>
                    )}
                    <a className={`${btnPrimario} mt-5 w-full`} href="#donar">
                      Ayudar a combatirlo
                    </a>
                  </div>
                ) : (
                  <div className={`${tarjeta} p-6`}>
                    <p className="m-0 text-sm font-semibold text-tinta-2">El fondo de Salta</p>
                    {zoneErr && <p className="error">{zoneErr}</p>}
                    {!zone && !zoneErr && <p className="m-0 mt-2 text-tinta-2">Leyendo el fondo…</p>}
                    {zone && (
                      <>
                        <p className="m-0 mt-1 font-display text-5xl font-bold tracking-tight text-tinta">
                          <Cuenta n={Number(zone.balance) / 1e6} /> <span className="text-2xl text-tinta-2">USDC</span>
                        </p>
                        <p className="m-0 mt-1 text-[15px] text-tinta-2">
                          {zone.target > 0n ? `recaudados de una meta de ${fmtUsdc(zone.target)}` : "listos para el próximo incendio confirmado"}
                        </p>
                        {zone.target > 0n && (
                          <div
                            className="mt-4 h-2.5 overflow-hidden rounded-full bg-papel-2"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(pct)}
                            aria-label="Recaudado para la meta"
                          >
                            <i className="block h-full rounded-full bg-verde transition-[width] duration-700" style={{ width: `${Math.max(Math.min(pct, 100), zone.balance > 0n ? 2 : 0)}%` }} />
                          </div>
                        )}
                        <dl className="m-0 mt-6 grid grid-cols-2 gap-4">
                          <div>
                            <dd className="m-0 font-display text-2xl font-bold text-tinta"><Cuenta n={nConf} /></dd>
                            <dt className="text-sm text-tinta-2">{nConf === 1 ? "incendio confirmado" : "incendios confirmados"}</dt>
                          </div>
                          <div>
                            <dd className="m-0 font-display text-2xl font-bold text-tinta"><Cuenta n={liberado} /></dd>
                            <dt className="text-sm text-tinta-2">USDC ya enviados</dt>
                          </div>
                        </dl>
                      </>
                    )}
                    <p className="m-0 mt-6 text-[15px] text-tinta-2">Tocá una llama del mapa para ver cuánto hace falta.</p>
                  </div>
                )}
                {f && (
                  <div className={`${tarjeta} relative p-5 text-[15px] text-tinta-2`}>
                    <button
                      type="button"
                      onClick={() => setSel(null)}
                      aria-label="Cerrar el foco"
                      className="absolute right-3 top-3 grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-papel-2 text-tinta-2"
                    >
                      ✕
                    </button>
                    <b className="text-tinta">Punto de calor</b> · lo vio {SENSOR_NAME[f.sensor]}
                    <br />
                    {horaAr(`${f.fecha}T${f.hora.slice(0, 2)}:${f.hora.slice(2)}:00Z`)} · confianza {CONF_NAME[f.confianza]}
                  </div>
                )}
                {ver === "vivo" && goes && goes.avisos.length > 0 && (
                  <p className="m-0 rounded-2xl bg-aviso/10 px-4 py-3 text-[15px] text-tinta" role="status">
                    <b>Aviso rápido:</b> {goes.avisos.length} {goes.avisos.length === 1 ? "posible fuego nuevo" : "posibles fuegos nuevos"} en la última hora, todavía sin confirmar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Donar */}
        <section className={seccion} aria-labelledby="donar-tit">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,460px)]">
            <Revelar>
              <p className={eyebrow}>Doná</p>
              <h2 id="donar-tit" className={titulo}>
                Tu donación llega. <span className="text-accion">Podés comprobarlo.</span>
              </h2>
              <p className={bajada}>
                El dinero va de tu billetera al fondo y del fondo a quien combate el fuego. Nadie lo toca en el camino.
              </p>
              <ul className="m-0 mt-8 grid list-none gap-4 p-0 text-[17px] text-tinta">
                {[
                  [<IcoVerificado key="a" size={20} />, stellar ? "Una sola firma desde tu billetera de Stellar." : "Dos firmas desde tu billetera."],
                  [<IcoOjo key="b" size={20} />, `La comisión de ${dep ? (dep.feeBps ?? 500) / 100 : 5} % se ve antes de confirmar.`],
                  [<IcoCandado key="c" size={20} />, "El fondo no tiene función de retiro: solo paga a cuarteles y damnificados verificados."],
                ].map(([ico, txt], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-9 flex-none place-items-center rounded-full bg-verde-suave text-verde">{ico}</span>
                    <span className="leading-snug">{txt}</span>
                  </li>
                ))}
              </ul>
              <div className="foto-clara mt-10 overflow-hidden rounded-3xl">
                <Foto
                  src="/fotos/brigadistas-comarca-andina.webp"
                  chica="/fotos/brigadistas-comarca-andina-640.webp"
                  alt="Dos brigadistas apagan con una manguera un incendio forestal de noche"
                  ancho={1200}
                  alto={800}
                  pie="Brigadistas en la Comarca Andina, enero de 2026."
                  autor="CatrielGB"
                  licencia="CC BY-SA 4.0"
                  licenciaUrl="https://creativecommons.org/licenses/by-sa/4.0/deed.es"
                  fuente="https://commons.wikimedia.org/wiki/File:Brigadistas_1.jpg"
                />
              </div>
            </Revelar>

            <Revelar demora={0.1} className={`${tarjeta} p-6 md:p-8 lg:sticky lg:top-24`}>
              <div id="donar" className="scroll-mt-24">
                <p className="m-0 font-display text-xl font-bold text-tinta" id="lbl-monto">¿Cuánto querés donar?</p>
                <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-labelledby="lbl-monto">
                  {["10", "25", "50", "100"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={amount === v}
                      aria-label={`${v} USDC`}
                      onClick={() => setAmount(v)}
                      disabled={busy}
                      className={`min-h-12 cursor-pointer rounded-2xl border border-solid font-display text-lg font-bold transition ${amount === v ? "border-tinta bg-tinta text-white" : "border-linea bg-white text-tinta hover:border-tinta/40"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <label htmlFor="monto" className="sr">
                  Otro monto en USDC
                </label>
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-solid border-linea bg-papel px-4 focus-within:border-tinta">
                  <input
                    id="monto"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                    className="min-h-14 w-full flex-1 rounded-none border-0 bg-transparent p-0 font-display text-2xl font-bold text-tinta outline-none"
                  />
                  <span className="font-semibold text-tinta-2">USDC</span>
                </div>
                <p className="m-0 mt-2 text-sm text-tinta-2">
                  1 USDC = 1 dólar digital.{minDon !== null && <> Mínimo: {fmtUsdc(minDon)} USDC.</>}
                </p>
                {bajoMinDon && minDon !== null && (
                  <p className="m-0 mt-2 rounded-xl bg-aviso/10 px-3 py-2 text-sm text-tinta" role="alert">
                    Con este monto llegan menos de {fmtUsdc(minDon)} USDC al fondo. Subí un poco el monto.
                  </p>
                )}

                <div className="mt-5 rounded-2xl bg-papel p-4 text-[15px] text-tinta-2" aria-live="polite">
                  {reparto ? (
                    <dl className="m-0 grid gap-1.5">
                      <div className="flex justify-between"><dt>Pagás</dt><dd className="m-0 font-semibold text-tinta">{fmtUsdc(reparto.total)} USDC</dd></div>
                      <div className="flex justify-between"><dt>Comisión de la plataforma</dt><dd className="m-0">{fmtUsdc(reparto.fee)} USDC</dd></div>
                      <div className="mt-1 flex justify-between border-0 border-t border-solid border-linea pt-2 text-base">
                        <dt className="font-semibold text-tinta">Llega al fondo</dt>
                        <dd className="m-0 font-display text-lg font-bold text-verde">{fmtUsdc(reparto.net)} USDC</dd>
                      </div>
                    </dl>
                  ) : (
                    "Elegí un monto para ver cuánto llega."
                  )}
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[15px] font-normal text-tinta-2">
                  <input type="checkbox" checked={cubrir} onChange={(e) => setCubrir(e.target.checked)} disabled={busy} className="mt-1 size-4 w-4 flex-none accent-[#1f7a54]" />
                  Sumo la comisión para que llegue el monto completo
                </label>
                {saldo !== null && (
                  <p className="m-0 mt-2 text-sm text-tinta-2">
                    Tenés {fmtUsdc(saldo)} USDC{sinSaldo ? " · no alcanza" : ""}
                  </p>
                )}

                <div className="mt-5 grid gap-2">
                  {!hasWallet && !stellar ? (
                    <a className={`${btnPrimario} w-full`} href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                      Instalar una billetera
                    </a>
                  ) : !account ? (
                    wallets.map((b, i) => (
                      <button key={b.id} type="button" className={`${i === 0 ? btnPrimario : btnSecundario} w-full`} onClick={() => connect(b.id)}>
                        Abrir {b.nombre}
                      </button>
                    ))
                  ) : !netOk ? (
                    <div role="alert" className="rounded-2xl bg-aviso/10 p-4 text-[15px] text-tinta">
                      <p className="m-0">
                        <b>Tu billetera está en otra red.</b> Para donar tiene que estar en {redName}.
                      </p>
                      <button type="button" className={`${btnPrimario} mt-3 w-full`} onClick={cambiar}>
                        Cambiar de red
                      </button>
                    </div>
                  ) : (
                    <button type="button" className={`${btnPrimario} w-full`} onClick={onDonar} disabled={busy || !netOk || reparto === null || sinSaldo || bajoMinDon}>
                      {busy ? "Esperando tu firma…" : `Donar ${reparto ? fmtUsdc(reparto.total) : ""} USDC`}
                    </button>
                  )}
                </div>

                <p className="m-0 mt-3 text-sm text-tinta-2" role="status" aria-live="polite">
                  {account && netOk && tx.s === "idle" && `Billetera lista (${short(account)}).`}
                </p>
                {tx.s === "pendiente" && (
                  <p className="m-0 mt-2 rounded-xl bg-aviso/10 px-3 py-2 text-[15px] text-tinta">
                    {stellar ? (tx.hash ? "Enviando tu donación…" : "Firmá la donación en tu billetera…") : tx.paso === "approve" ? "1 de 2 · Autorizá el USDC en tu billetera…" : "2 de 2 · Enviando tu donación…"}{" "}
                    {tx.hash && dep && <Hash d={dep} h={tx.hash} />}
                  </p>
                )}
                {tx.s === "ok" && dep && (
                  <div className="mt-3 rounded-2xl bg-verde-suave p-4 text-[15px] text-tinta">
                    <p className="m-0 font-display text-lg font-bold text-verde">¡Gracias! Tu donación ya está en el fondo.</p>
                    <p className="m-0 mt-1">
                      Quedó registrada. <Hash d={dep} h={tx.hash} />
                    </p>
                    <a className={`${btnSecundario} mt-3 w-full`} href={`https://wa.me/?text=${encodeURIComponent(compartir)}`} target="_blank" rel="noreferrer">
                      Contalo por WhatsApp
                    </a>
                  </div>
                )}
                {tx.s === "error" && <p className="m-0 mt-2 rounded-xl bg-red-50 px-3 py-2 text-[15px] font-semibold text-red-800">{tx.msg}</p>}

                <details className="mt-5 text-[15px] text-tinta-2">
                  <summary className="cursor-pointer font-semibold text-tinta">¿Primera vez? Mirá cómo</summary>
                  {stellar ? (
                    <ol className="m-0 mt-2 grid gap-1.5 pl-5">
                      <li>Instalá una billetera de Stellar, por ejemplo Varial, xBull o Lobstr.</li>
                      <li>Habilitá USDC en tu cuenta.</li>
                      <li>Volvé acá y doná. Es una sola firma.</li>
                    </ol>
                  ) : (
                    <ol className="m-0 mt-2 grid gap-1.5 pl-5">
                      <li>Instalá una billetera digital.</li>
                      <li>Cargá USDC en tu cuenta.</li>
                      <li>Volvé acá y doná.</li>
                    </ol>
                  )}
                </details>
                <details className="mt-3 text-[15px] text-tinta-2" id="terminos">
                  <summary className="cursor-pointer font-semibold text-tinta">Antes de donar, leé esto</summary>
                  <ul className="m-0 mt-2 grid gap-1.5 pl-5">
                    <li>Hoy funciona en {redName || "una red de prueba"}: el USDC es de prueba y no tiene valor.</li>
                    <li>El dinero no pasa por brasa: el fondo paga solo, según la regla pública, a destinatarios verificados.</li>
                    <li>La detección es una estimación de satélite, con unas 3 horas de demora. No es un parte oficial ni un seguro.</li>
                    <li>Donás solo si sos mayor de edad. Una donación enviada no se puede deshacer.</li>
                  </ul>
                </details>
              </div>
            </Revelar>
          </div>
        </section>

        {/* 5 · Confianza */}
        <section className="bg-tinta text-white" aria-labelledby="conf-tit">
          <div className={seccion}>
            <Revelar>
              <p className={`${eyebrow} !text-celeste`}>Por qué confiar</p>
              <h2 id="conf-tit" className={`${titulo} !text-white`}>Reglas públicas, escritas en un contrato que cualquiera puede leer.</h2>
            </Revelar>
            <ul className="m-0 mt-12 grid list-none grid-cols-2 gap-x-6 gap-y-10 p-0 md:grid-cols-4">
              {CIFRAS.map((c, i) => (
                <Revelar key={c.t} como="li" demora={i * 0.06}>
                  <b className="block font-display text-6xl font-bold leading-none tracking-tight text-celeste md:text-7xl">{c.n}</b>
                  <span className="mt-3 block max-w-[16ch] text-[17px] leading-snug text-white/75">{c.t}</span>
                </Revelar>
              ))}
            </ul>
            <ul className="m-0 mt-12 grid list-none gap-4 p-0 md:grid-cols-3">
              {DUDAS.map((d, i) => (
                <Revelar key={d.p} como="li" demora={i * 0.06} className="rounded-3xl border border-solid border-white/12 bg-white/5 p-6">
                  <h3 className="m-0 font-display text-xl font-semibold text-white">{d.p}</h3>
                  <p className="m-0 mt-2 text-[16px] leading-relaxed text-white/75">{d.r}</p>
                </Revelar>
              ))}
            </ul>
            <Revelar className="mt-12 flex flex-wrap gap-3">
              {dep && addrUrl(dep, dep.fund) && (
                <a className={btnPrimario} href={addrUrl(dep, dep.fund)} target="_blank" rel="noreferrer">
                  Ver el contrato <IcoExterno />
                </a>
              )}
              {ultimaLib && dep ? (
                <a className={`${btn} border border-solid border-white/25 bg-transparent text-white hover:border-white/60`} href={txUrl(dep, ultimaLib.tx)} target="_blank" rel="noreferrer">
                  Ver el último pago <IcoExterno />
                </a>
              ) : (
                stellar && (
                  <a className={`${btn} border border-solid border-white/25 bg-transparent text-white hover:border-white/60`} href="/pago">
                    Ver un pago, paso a paso
                  </a>
                )
              )}
              <Link className={`${btn} border border-solid border-white/25 bg-transparent text-white hover:border-white/60`} href="/fundamentos">
                Cómo funciona por dentro
              </Link>
            </Revelar>
          </div>
        </section>

        <BotonFlotante />
      </main>

      {/* 6 · Pie */}
      <footer className="bg-papel font-sans text-tinta-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8 px-5 py-12">
          <div>
            <Logo height={34} claro />
            <p className="m-0 mt-2 font-display text-lg font-bold text-tinta">Ayuda a tiempo, recursos a la vista.</p>
            <p className="m-0 mt-1 text-sm">Hecho en Chaco para el mundo · Juan Facundo Ayala y Gastón Persoglia</p>
          </div>
          <nav className="grid gap-2 text-[15px]" aria-label="Enlaces">
            <Link className={enlace} href="/fundamentos">Fundamentos</Link>
            <a className={enlace} href="https://github.com/jfacundoayala/brasa" target="_blank" rel="noreferrer">Código en GitHub</a>
            {dep && addrUrl(dep, dep.fund) && (
              <a className={enlace} href={addrUrl(dep, dep.fund)} target="_blank" rel="noreferrer">Movimientos del fondo</a>
            )}
            <Link className={enlace} href="/links">Todos los enlaces</Link>
          </nav>
        </div>
        <p className="m-0 border-0 border-t border-solid border-linea px-5 py-5 text-center text-xs">
          Focos: NASA FIRMS (VIIRS) · Aviso rápido: GOES-19 (INPE) · Mapa: Esri, Vantor, Earthstar Geographics y © OpenStreetMap contributors · Red: {stellar ? "Stellar (red de prueba)" : redName}
        </p>
      </footer>
    </MotionConfig>
  );
}

/**
 * "Donar ahora" fijo abajo en el celular. Se esconde mientras se ve la portada, el botón de arriba o la tarjeta
 * de donar, para no tapar contenido ni repetir el mismo botón dos veces en pantalla.
 */
function BotonFlotante() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // El navegador avisa cuándo entran o salen de pantalla la portada, el botón de arriba y la tarjeta de donar.
    // No se mide nada en cada scroll: así el desplazamiento queda fluido en el celular.
    if (typeof IntersectionObserver === "undefined") return;
    const enPantalla = new Map<Element, boolean>();
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) enPantalla.set(e.target, e.isIntersecting);
      setVisible(![...enPantalla.values()].some(Boolean));
    });
    const observados = new Set<Element>();
    const observar = () => {
      for (const el of [document.querySelector(".espacio"), document.querySelector(".espacio-acciones"), document.getElementById("donar")]) {
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
