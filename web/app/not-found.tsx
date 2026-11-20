import type { Metadata } from "next";

export const metadata: Metadata = { title: "Página no encontrada · brasa" };

/** Página 404 con la marca: lleva de vuelta a la portada. */
export default function NoEncontrada() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
        textAlign: "center",
        background: "#f3f7fb",
        color: "#101c2b",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/simbolo-brasa.svg" alt="brasa" width={72} height={72} />
      <h1 style={{ fontSize: 30, margin: 0 }}>Esta página no existe</h1>
      <p style={{ margin: 0, maxWidth: 420, color: "#4a5a6d", lineHeight: 1.5 }}>
        El mapa de incendios, el fondo y cada pago están en la portada.
      </p>
      <a
        href="/"
        style={{
          marginTop: 8,
          padding: "12px 22px",
          borderRadius: 999,
          background: "#1b5fae",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Volver a la portada
      </a>
    </main>
  );
}
