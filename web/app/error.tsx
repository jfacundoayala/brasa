"use client";
// Red general: si una parte de la página falla al dibujarse, queda este aviso en lugar de una pantalla en blanco.
import { useEffect } from "react";

export default function ErrorDePagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        background: "#14110F",
        color: "#F4EEE8",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/simbolo-brasa.svg" alt="" width={72} height={72} />
      <h1 style={{ fontSize: 30, margin: 0 }}>No pudimos mostrar esta página</h1>
      <p style={{ margin: 0, maxWidth: 420, color: "#B9ADA3", lineHeight: 1.5 }}>
        Algo falló al cargarla. Probá de nuevo.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        style={{
          marginTop: 8,
          padding: "12px 22px",
          border: 0,
          borderRadius: 999,
          background: "#FF5A1F",
          color: "#14110F",
          font: "inherit",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Reintentar
      </button>
    </main>
  );
}
