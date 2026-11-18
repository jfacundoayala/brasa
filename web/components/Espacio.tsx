"use client";
// Portada: la Tierra vista desde el espacio, con NOAA-20 y NOAA-21 en sus órbitas reales y los incendios de Salta.
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Brasas from "./Brasas";
import { Gravedad } from "./Llamas";
import type { EstadoSat, Punto } from "./Globo";
import { leerTles, refrescarTles, type Tle } from "@/lib/tle";

const respaldo = <div className="globo-cargando" aria-hidden="true" />;
const Globo = dynamic(() => import("./Globo"), { ssr: false, loading: () => respaldo });

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

/** El globo es un adorno: si falla una textura o su código, queda el círculo fijo y el resto de la página sigue. */
class Contencion extends Component<{ alFallar: () => void; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch() {
    this.props.alFallar();
  }
  render() {
    return this.state.fallo ? respaldo : this.props.children;
  }
}

/** El globo con su panel. Guarda acá el estado del satélite para que cada dato nuevo no vuelva a renderizar la portada. */
function Orbitas({ puntos, activo, quieto }: { puntos: Punto[]; activo: boolean; quieto: boolean }) {
  const [tles, setTles] = useState<Tle[] | null>(null);
  const [sat, setSat] = useState<EstadoSat | null>(null);
  const [webgl, setWebgl] = useState(true);
  const [libre, setLibre] = useState(false);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    setWebgl(hayWebgl());
    let montado = true;
    // Primero los TLE guardados; los del día llegan después y no frenan el globo.
    leerTles()
      .then((guardados) => {
        if (!montado) return;
        setTles(guardados);
        return refrescarTles(guardados).then((frescos) => {
          if (montado && frescos) setTles(frescos);
        });
      })
      .catch(() => setTles((t) => t ?? []));
    return () => {
      montado = false;
    };
  }, []);

  // El globo se monta cuando el navegador queda libre, para no trabar la primera carga.
  useEffect(() => {
    const montar = () => setLibre(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(montar, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    // Safari no tiene requestIdleCallback.
    const id = setTimeout(montar, 300);
    return () => clearTimeout(id);
  }, []);

  const hayGlobo = webgl && !fallo;
  return (
    <div className="espacio-globo">
      <div className="globo-lienzo">
        {hayGlobo && libre && tles ? (
          <Contencion alFallar={() => setFallo(true)}>
            <Globo tles={tles} puntos={puntos} aceleracion={quieto ? 1 : ACELERACION} activo={activo} quieto={quieto} onEstado={setSat} />
          </Contencion>
        ) : (
          respaldo
        )}
      </div>
      {hayGlobo && tles?.length !== 0 && (
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
          <p className="hud-pie">
            {quieto ? "Posición en tiempo real" : `Simulación: órbita real, tiempo acelerado ×${ACELERACION}`}
            {sat?.sobreSalta && <span className="hud-paso">{quieto ? "Pasa sobre Salta" : "En la simulación pasa sobre Salta"}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Espacio({ puntos, enVivo }: { puntos: Punto[]; enVivo: boolean }) {
  const [activo, setActivo] = useState(true);
  const caja = useRef<HTMLElement>(null);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    setQuieto(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // El globo deja de dibujar cuando la portada sale de la pantalla.
  useEffect(() => {
    if (!caja.current) return;
    // Si llegan varios avisos juntos, vale el último.
    const io = new IntersectionObserver((lote) => setActivo(lote[lote.length - 1].isIntersecting), { rootMargin: "80px" });
    io.observe(caja.current);
    return () => io.disconnect();
  }, []);

  // La entrada es CSS puro: el texto se pinta sin esperar al JavaScript.
  const entra = (i: number) => ({ style: { "--i": i } as React.CSSProperties });

  return (
    <section className="espacio" ref={caja} aria-label="La Tierra y los satélites que detectan incendios">
      <div className="espacio-cielo" aria-hidden="true" />
      <Brasas />
      <div className="espacio-in">
        <div className="espacio-texto">
          <p className="chip-sat entra" {...entra(0)}>
            <b>NASA FIRMS</b>
            <span aria-hidden="true">·</span> NOAA-20 y NOAA-21 <span aria-hidden="true">·</span>
            <span className="chip-sat-dim">{enVivo ? "cada uno pasa sobre Salta unas dos veces por día" : "ven el fuego desde el espacio"}</span>
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
              Ver el mapa
            </a>
          </div>
        </div>

        <Orbitas puntos={puntos} activo={activo} quieto={quieto} />
      </div>
      <p className="espacio-creditos">
        Tierra: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">NASA Blue Marble</a> · Órbitas: TLE de NORAD (SGP4) · satélites fuera de escala · iluminación ilustrativa
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
