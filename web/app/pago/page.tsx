import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";

const TITULO = "Un pago, paso a paso · brasa";
const DESCRIPCION = "Qué pasó en el pago de punta a punta del 19 de noviembre: quién reportó, cuánto se envió, a quién le llegó y cómo comprobarlo.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/pago" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: "/pago",
    // Un openGraph propio reemplaza entero al del layout: la imagen se repite acá.
    images: [{ url: "/og-brasa.png", width: 1200, height: 630, alt: "Fondo brasa para bomberos y damnificados por incendios" }],
    locale: "es_AR",
    type: "article",
  },
};

// Los datos salen de docs/tecnico/DIRECCIONES.md. El comprobante (/comprobante) se define en next.config.mjs.
const TOTAL = 280;
const CUARTEL = 210;
const ASISTENCIA = 70;
const pct = (n: number) => `${Math.round((n / TOTAL) * 100)} %`;

const PASOS = [
  {
    t: "Dos satélites, dos reportes",
    p: "El oráculo del satélite NOAA-20 y el del NOAA-21 reportaron el incendio por separado. Cada uno firma con su propia cuenta: uno solo no alcanza.",
  },
  {
    t: "El contrato comprobó y calculó",
    p: "Con los dos reportes de la misma zona, el contrato aplicó la regla que ya estaba escrita: hectáreas afectadas por el costo de cada hectárea. Nadie eligió el monto.",
  },
  {
    t: "El dinero salió en el mismo momento",
    p: `Envió ${CUARTEL} dólares digitales al cuartel asignado y ${ASISTENCIA} a la asistencia a las familias. Fue una sola operación, sin pasar por ninguna cuenta intermedia.`,
  },
  {
    t: "Quedó anotado para siempre",
    p: "El pago está en el registro público de Stellar. Cualquiera lo puede abrir y ver los mismos números, sin pedirle permiso a nadie.",
  },
];

const tarjeta = "rounded-3xl border border-solid border-linea bg-white shadow-[0_1px_2px_rgba(28,23,20,.04),0_16px_40px_-20px_rgba(28,23,20,.16)]";
const btn = "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold no-underline transition active:scale-[.98]";

/** El pago de punta a punta, contado en lenguaje simple. El registro público prueba; esta página explica. */
export default function Pago() {
  return (
    <div className="min-h-screen bg-papel font-sans text-tinta">
      <header className="border-0 border-b border-solid border-linea/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-5">
          <Link href="/" className="inline-flex items-center rounded-xl" aria-label="Inicio de brasa">
            <Logo height={34} claro />
          </Link>
          <Link href="/#donar" className={`${btn} min-h-10 bg-accion px-5 text-[15px] text-white hover:bg-accion-oscura`}>
            Donar
          </Link>
        </div>
      </header>

      <main className="m-0 mx-auto max-w-3xl p-0 px-5 pb-20 pt-12 md:pt-16">
        <p className="m-0 font-display text-sm font-semibold uppercase tracking-[.14em] text-verde">19 de noviembre de 2026 · red de prueba de Stellar</p>
        <h1 className="m-0 mt-2 font-display text-4xl font-bold leading-[1.05] tracking-tight text-tinta md:text-6xl">Un pago, paso a paso</h1>
        <p className="m-0 mt-5 text-lg leading-relaxed text-tinta-2 md:text-xl">
          Dos satélites reportaron un incendio y el fondo envió la ayuda solo, de punta a punta. Esto es lo que pasó y cómo lo podés comprobar.
        </p>

        <section className={`${tarjeta} mt-10 p-6 md:p-8`} aria-labelledby="reparto-tit">
          <h2 id="reparto-tit" className="m-0 font-display text-sm font-semibold uppercase tracking-[.14em] text-tinta-2">
            Lo que envió el fondo
          </h2>
          <p className="m-0 mt-2 font-display text-5xl font-bold tracking-tight text-accion md:text-6xl">
            {TOTAL} <span className="text-2xl font-semibold text-tinta-2 md:text-3xl">dólares digitales</span>
          </p>
          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-papel-2" aria-hidden="true">
            <span className="block h-full bg-accion" style={{ width: `${(CUARTEL / TOTAL) * 100}%` }} />
            <span className="block h-full bg-verde" style={{ width: `${(ASISTENCIA / TOTAL) * 100}%` }} />
          </div>
          <dl className="m-0 mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-2 text-tinta-2">
                <i className="inline-block size-3 rounded-full bg-accion" aria-hidden="true" /> Al cuartel de bomberos
              </dt>
              <dd className="m-0 mt-1 font-display text-2xl font-bold text-tinta">
                {CUARTEL} <span className="text-base font-medium text-tinta-2">({pct(CUARTEL)})</span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-tinta-2">
                <i className="inline-block size-3 rounded-full bg-verde" aria-hidden="true" /> A la asistencia a las familias
              </dt>
              <dd className="m-0 mt-1 font-display text-2xl font-bold text-tinta">
                {ASISTENCIA} <span className="text-base font-medium text-tinta-2">({pct(ASISTENCIA)})</span>
              </dd>
            </div>
          </dl>
        </section>

        <h2 className="m-0 mt-14 font-display text-2xl font-bold tracking-tight text-tinta md:text-3xl">Qué pasó, en orden</h2>
        <ol className="m-0 mt-6 grid list-none gap-4 p-0">
          {PASOS.map((s, i) => (
            <li key={s.t} className={`${tarjeta} flex gap-5 p-6`}>
              <span className="font-display text-3xl font-bold leading-none text-accion" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="m-0 font-display text-xl font-bold text-tinta">{s.t}</h3>
                <p className="m-0 mt-2 leading-relaxed text-tinta-2">{s.p}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-14 rounded-3xl bg-tinta p-6 text-white md:p-8" aria-labelledby="comprobar-tit">
          <h2 id="comprobar-tit" className="m-0 font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            Comprobalo vos
          </h2>
          <p className="m-0 mt-3 leading-relaxed text-white/80">
            El comprobante se abre en el explorador de Stellar. Ahí vas a ver los dos reportes, uno por satélite, y los dos envíos: {CUARTEL} y{" "}
            {ASISTENCIA}. El explorador los muestra como USDC, el dólar digital que usa el fondo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a className={`${btn} bg-white text-tinta hover:bg-papel-2`} href="/comprobante" target="_blank" rel="noopener noreferrer">
              Abrir el comprobante
            </a>
            <a className={`${btn} border border-solid border-white/25 text-white hover:border-white/60`} href="/contrato" target="_blank" rel="noopener noreferrer">
              Ver el contrato
            </a>
          </div>
          <p className="m-0 mt-5 text-sm leading-relaxed text-white/70">
            La red de prueba se reinicia de vez en cuando y borra lo que hay en ella. Si el explorador ya no muestra el pago,{" "}
            <a className="font-semibold text-white underline underline-offset-4" href="/comprobante.png" target="_blank" rel="noopener noreferrer">
              acá está la captura guardada
            </a>
            .
          </p>
        </section>

        <p className="m-0 mt-8 leading-relaxed text-tinta-2">
          En este pago los focos se cargaron a mano para recorrer el camino completo. En el fondo real los reporta cada oráculo con los datos de la
          NASA. La regla, el reparto y el registro son los mismos.{" "}
          <Link href="/fundamentos" className="font-semibold text-accion-oscura underline underline-offset-4">
            De dónde sale cada número
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
