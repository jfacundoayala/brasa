import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Todos los links · brasa",
  description: "La web, el video, el resumen en una página, la presentación, el contrato y el código de brasa, en un solo lugar.",
  alternates: { canonical: "/links" },
};

/** Link del video de la demo. Vacío: la fila no se muestra. */
const VIDEO = "/video";

type Fila = { titulo: string; detalle: string; href: string; destacado?: boolean };

// Los links cortos (/deck, /repo, /contrato...) se definen en next.config.mjs.
const FILAS: Fila[] = [
  { titulo: "Web", detalle: "El mapa de incendios, el fondo y cómo donar", href: "/", destacado: true },
  ...(VIDEO ? [{ titulo: "Video de la demo", detalle: "brasa en menos de 3 minutos, con una donación en vivo", href: VIDEO }] : []),
  { titulo: "Resumen en una página", detalle: "El one-pager, en PDF", href: "/one-pager" },
  { titulo: "Presentación", detalle: "El deck, en PDF", href: "/deck" },
  { titulo: "Repositorio", detalle: "Todo el código, público", href: "/repo" },
  { titulo: "Contrato en Avalanche Fuji", detalle: "El fondo, en el explorador", href: "/contrato" },
  { titulo: "Código verificado", detalle: "Sourcify, con coincidencia exacta", href: "/codigo" },
  { titulo: "Pago en vivo del 12/11", detalle: "El comprobante del pago a dos cuarteles y a familias damnificadas", href: "/pago" },
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
        background: "#14110F",
        color: "#F4EEE8",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/simbolo-brasa.svg" alt="" width={72} height={72} />
      <h1 style={{ fontSize: 34, margin: "14px 0 6px" }}>brasa</h1>
      <p style={{ margin: 0, maxWidth: 440, textAlign: "center", color: "#B9ADA3", lineHeight: 1.5 }}>
        Ayuda a tiempo, recursos a la vista. Cuando dos satélites de la NASA confirman un incendio, tu donación llega a los
        bomberos y a las familias afectadas.
      </p>
      <nav aria-label="Links de brasa" style={{ width: "100%", maxWidth: 480, marginTop: 28, display: "grid", gap: 12 }}>
        {FILAS.map((f) => {
          const externo = f.href !== "/" && f.href !== "/fundamentos";
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
                background: f.destacado ? "#FF5A1F" : "#221C18",
                border: f.destacado ? "1px solid #FF5A1F" : "1px solid #3a2e27",
                color: f.destacado ? "#14110F" : "#F4EEE8",
              }}
            >
              <b style={{ fontSize: 17 }}>{f.titulo}</b>
              <span style={{ fontSize: 14, color: f.destacado ? "#3a1a0a" : "#B9ADA3" }}>{f.detalle}</span>
            </a>
          );
        })}
      </nav>
      <p style={{ marginTop: 30, fontSize: 13, color: "#8f8379", textAlign: "center" }}>
        Hecho en Chaco, Argentina, para el mundo · Juan Facundo Ayala y Gastón Persoglia
      </p>
    </main>
  );
}
