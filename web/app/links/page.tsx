import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Todos los links · brasa",
  description: "La web, el video, el resumen en una página, la presentación, el contrato y el código de brasa, en un solo lugar.",
  alternates: { canonical: "/links" },
  openGraph: {
    title: "Todos los links · brasa",
    description: "La web, el video, el resumen en una página, la presentación, el contrato y el código de brasa, en un solo lugar.",
    url: "/links",
    // Un openGraph propio reemplaza entero al del layout: la imagen se repite acá.
    images: [{ url: "/og-brasa.png", width: 1200, height: 630, alt: "Fondo brasa para bomberos y damnificados por incendios" }],
    locale: "es_AR",
    type: "website",
  },
};

/** Link del video de la demo. Vacío: la fila no se muestra. */
const VIDEO = "/video";

type Fila = { titulo: string; detalle: string; href: string; destacado?: boolean };

// Los links cortos (/deck, /repo, /contrato...) se definen en next.config.mjs.
const FILAS: Fila[] = [
  { titulo: "Web", detalle: "El mapa de incendios, el fondo y cómo donar", href: "/", destacado: true },
  ...(VIDEO ? [{ titulo: "Video", detalle: "El recorrido de la primera versión, en menos de 3 minutos", href: VIDEO }] : []),
  { titulo: "Resumen en una página", detalle: "El one-pager, en PDF", href: "/one-pager" },
  { titulo: "Presentación", detalle: "El deck, en PDF", href: "/deck" },
  { titulo: "Repositorio", detalle: "Todo el código, público", href: "/repo" },
  { titulo: "Contrato en Stellar", detalle: "El fondo, en el explorador de la red de prueba", href: "/contrato" },
  { titulo: "Código del contrato", detalle: "Escrito en Rust, público y con sus tests", href: "/codigo" },
  { titulo: "Un pago, paso a paso", detalle: "El pago de punta a punta del 19/11, explicado y con su comprobante", href: "/pago" },
  { titulo: "Entrevista de validación", detalle: "Con el Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta", href: "/entrevista" },
  { titulo: "De dónde sale cada número", detalle: "Fundamentos, con cada fuente", href: "/fundamentos" },
];

/** Todos los links de brasa en una sola página, para compartir. */
export default function Links() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 16px 56px",
        background: "var(--color-papel)",
        color: "var(--color-tinta)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/simbolo-brasa.svg" alt="" width={72} height={72} />
      <h1 style={{ fontSize: 34, margin: "14px 0 6px" }}>brasa</h1>
      <p style={{ margin: 0, maxWidth: 440, textAlign: "center", color: "var(--color-tinta-2)", lineHeight: 1.5 }}>
        Ayuda a tiempo, recursos a la vista. Cuando dos satélites de la NASA confirman un incendio, tu donación llega a los
        bomberos y a las familias afectadas.
      </p>
      <nav aria-label="Links de brasa" style={{ width: "100%", maxWidth: 480, marginTop: 28, display: "grid", gap: 12 }}>
        {FILAS.map((f) => {
          const externo = !["/", "/fundamentos", "/pago"].includes(f.href);
          return (
            <a
              key={f.titulo}
              href={f.href}
              {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              style={{
                display: "grid",
                gap: 2,
                padding: "14px 18px",
                borderRadius: 14,
                textDecoration: "none",
                background: f.destacado ? "var(--color-accion)" : "#fff",
                border: f.destacado ? "1px solid var(--color-accion)" : "1px solid var(--color-linea)",
                color: f.destacado ? "#fff" : "var(--color-tinta)",
              }}
            >
              <b style={{ fontSize: 17 }}>{f.titulo}</b>
              <span style={{ fontSize: 14, color: f.destacado ? "#e3eefb" : "var(--color-tinta-2)" }}>{f.detalle}</span>
            </a>
          );
        })}
      </nav>
      <p style={{ marginTop: 30, fontSize: 13, color: "var(--color-tinta-2)", textAlign: "center" }}>
        Hecho en Chaco, Argentina, para el mundo · Juan Facundo Ayala y Gastón Persoglia
      </p>
    </main>
  );
}
