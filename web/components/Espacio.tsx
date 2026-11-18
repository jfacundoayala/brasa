"use client";
// Portada: la Tierra vista desde el espacio, con NOAA-20 y NOAA-21 en sus órbitas reales y los incendios de Salta.
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Brasas from "./Brasas";
import { Gravedad } from "./Llamas";
import type { EstadoSat, Punto } from "./Globo";
import { leerTles, type Tle } from "@/lib/orbita";

const Globo = dynamic(() => import("./Globo"), { ssr: false, loading: () => <div className="globo-cargando" aria-hidden="true" /> });

const ACELERACION = 120;
const fmt = (n: number, d = 1) => n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const coord = (v: number, pos: string, neg: string) => `${fmt(Math.abs(v))}° ${v >= 0 ? pos : neg}`;

function hayWebgl(): boolean {
  try {
    const c = document.createElement("canvas");
    // three ya no dibuja con WebGL 1
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function Espacio({ puntos, enVivo }: { puntos: Punto[]; enVivo: boolean }) {
  const [tles, setTles] = useState<Tle[] | null>(null);
  const [sat, setSat] = useState<EstadoSat | null>(null);
  const [activo, setActivo] = useState(true);
  const [webgl, setWebgl] = useState(true);
  const caja = useRef<HTMLElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    setWebgl(hayWebgl());
    setQuieto(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    leerTles().then(setTles).catch(() => setTles([]));
  }, []);

  // El globo deja de dibujar cuando la portada sale de la pantalla.
  useEffect(() => {
    if (!caja.current) return;
    const io = new IntersectionObserver(([e]) => setActivo(e.isIntersecting), { rootMargin: "80px" });
    io.observe(caja.current);
    return () => io.disconnect();
  }, []);

  // La entrada es CSS puro: el texto se pinta sin esperar al JavaScript.
  const entra = (i: number) => ({ style: { "--i": i } as React.CSSProperties });

  return (
    <section className="espacio" ref={caja} aria-label="brasa desde el espacio">
      <div className="espacio-cielo" aria-hidden="true" />
      <Brasas />
      <div className="espacio-in">
        <div className="espacio-texto">
          <p className="chip-sat entra" {...entra(0)}>
            <span className="punto-vivo" aria-hidden="true" />
            <b>NASA FIRMS</b>
            <span aria-hidden="true">·</span> NOAA-20 y NOAA-21 <span aria-hidden="true">·</span>
            <span className="chip-sat-dim">{enVivo ? "mirando Salta ahora" : "ven el fuego desde el espacio"}</span>
          </p>
          <p className="marca entra" {...entra(1)}>
            brasa
          </p>
          <p className="espacio-bajada entra" {...entra(2)}>
            Cuando dos satélites de la NASA confirman un incendio, el fondo paga a los bomberos y a los damnificados.{" "}
            <b>Ayuda a tiempo, recursos a la vista.</b>
          </p>
          <div className="espacio-niveles entra" {...entra(3)}>
            <span>Cada incendio, en tres niveles:</span>
            <ul>
              {([1, 2, 3] as const).map((n) => (
                <li key={n} className={`nivel-chip n${n}`}>
                  <Gravedad nivel={n} px={14} /> {["Leve", "Medio", "Grave"][n - 1]}
                </li>
              ))}
            </ul>
          </div>
          <div className="espacio-acciones entra" {...entra(4)}>
            <a className="btn btn-hero" href="#donar">
              Donar ahora
            </a>
            <a className="btn btn-vidrio" href="#mapa">
              Ver el mapa del fuego
            </a>
          </div>
        </div>

        <div className="espacio-globo">
          <div className="globo-lienzo">
            {webgl && tles ? (
              <Globo tles={tles} puntos={puntos} aceleracion={quieto ? 1 : ACELERACION} activo={activo} quieto={quieto} onEstado={setSat} />
            ) : (
              <div className="globo-cargando" aria-hidden="true" />
            )}
          </div>
          {webgl && tles?.length !== 0 && (
            <div className={`hud${sat?.sobreSalta ? " escaneando" : ""}`} role="status" aria-live="off">
              <p className="hud-tit">
                <i aria-hidden="true" /> {sat?.nombre ?? "NOAA-20"}, órbita calculada
              </p>
              <dl>
                <div>
                  <dt>Altura</dt>
                  <dd>{sat ? `${fmt(sat.altKm, 0)} km` : "…"}</dd>
                </div>
                <div>
                  <dt>Velocidad</dt>
                  <dd>{sat ? `${fmt(sat.velKms)} km/s` : "…"}</dd>
                </div>
                <div>
                  <dt>Pasa sobre</dt>
                  <dd>{sat ? `${coord(sat.lat, "N", "S")} · ${coord(sat.lon, "E", "O")}` : "…"}</dd>
                </div>
              </dl>
              <p className="hud-pie">{sat?.sobreSalta ? "Escaneando Salta con VIIRS" : `Tiempo acelerado ×${quieto ? 1 : ACELERACION}`}</p>
            </div>
          )}
        </div>
      </div>
      <p className="espacio-creditos">
        Tierra: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">NASA Blue Marble</a> · Órbitas: TLE de NORAD (SGP4) · satélites fuera de escala
      </p>
      <a className="espacio-bajar" href="#inicio">
        <span>Cómo ayuda</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
