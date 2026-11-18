"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import type { Aviso } from "@/lib/goes";
import { NIVEL_COLOR, type Focos, type Sensor } from "@/lib/chain";
import { GRAVEDAD, llamaHtml } from "./Llamas";

export const SENSOR_COLOR: Record<Sensor, string> = { noaa20: "#FFC857", noaa21: "#FF6A2B", modis: "#4FC3F7" };
export const SENSOR_NAME: Record<Sensor, string> = { noaa20: "Satélite NOAA-20", noaa21: "Satélite NOAA-21", modis: "Satélites MODIS" };
export const CONF_NAME = { high: "alta", nominal: "media", low: "baja" } as const;

type Props = {
  focos: Focos | null;
  seleccionado: number | null;
  onFoco: (i: number) => void;
  onIncendio: (i: number) => void;
  onZona: () => void;
  /** Alerta temprana GOES-19: posibles focos de la última hora, sin confirmar. */
  avisos?: Aviso[];
};

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

// Imagen satelital (Esri World Imagery), nombres de lugares encima y relieve real (AWS Terrain Tiles).
const ESTILO: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 9, 0] },
  sources: {
    satelite: {
      type: "raster",
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagen: Esri, Maxar, Earthstar Geographics",
    },
    nombres: { type: "raster", tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
    sombras: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 12,
    },
    relieve: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 12,
      attribution: "Relieve: Mapzen / AWS Terrain Tiles",
    },
  },
  layers: [
    { id: "satelite", type: "raster", source: "satelite", paint: { "raster-saturation": -0.15, "raster-contrast": 0.08, "raster-brightness-max": 0.82 } },
    { id: "sombras", type: "hillshade", source: "sombras", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#0b0805", "hillshade-highlight-color": "#fff3e0" } },
    { id: "nombres", type: "raster", source: "nombres", paint: { "raster-opacity": 0.85 } },
  ],
  terrain: { source: "relieve", exaggeration: 1.3 },
};

/** En pantallas de alta densidad se piden teselas un nivel más finas, para que la imagen no se vea borrosa. */
function estilo(): StyleSpecification {
  if (window.devicePixelRatio < 1.5) return ESTILO;
  return { ...ESTILO, sources: { ...ESTILO.sources, satelite: { ...ESTILO.sources.satelite, tileSize: 128 } as StyleSpecification["sources"][string] } };
}

const quieto = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Mapa({ focos, seleccionado, onFoco, onIncendio, onZona, avisos }: Props) {
  const mapaRef = useRef<MlMap | null>(null);
  const [listo, setListo] = useState(0);
  // El mapa no "atrapa" la ruedita ni el dedo hasta que lo tocás: así la página baja normal.
  const [activo, setActivo] = useState(false);
  const [aviso, setAviso] = useState(false);
  // Sin WebGL 2 no hay mapa: los incendios se muestran en una lista para poder abrirlos igual.
  const [sinMapa, setSinMapa] = useState(false);
  const tactil = useRef(false);
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef({ onFoco, onIncendio, onZona });
  cb.current = { onFoco, onIncendio, onZona };
  const sel = useRef<number | null>(seleccionado);
  sel.current = seleccionado;

  // El mapa (y sus teselas) recién se cargan cuando la persona se acerca: la portada queda liviana.
  const [cerca, setCerca] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCerca(true), { rootMargin: "600px" });
    io.observe(el.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!el.current || !focos || !cerca) return;
    let map: MlMap | undefined;
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      // El worker se copia a public/ en predev/prebuild (package.json).
      ml.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
      const [w, s, e, n] = focos.zona.bbox;
      tactil.current = window.matchMedia("(pointer: coarse)").matches;
      const centro: [number, number] = [(w + e) / 2, (s + n) / 2];
      try {
        map = new ml.Map({
          container: el.current,
          style: estilo(),
          // Más de 2 no se nota y en celulares de 3× traba el relieve.
          pixelRatio: Math.min(window.devicePixelRatio, 2),
          center: centro,
          zoom: 1.6,
          pitch: 0,
          maxPitch: 75,
          scrollZoom: false,
          dragPan: !tactil.current,
          attributionControl: { compact: true },
          canvasContextAttributes: { antialias: true },
        });
      } catch {
        setSinMapa(true);
        return;
      }
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new ml.FullscreenControl(), "top-right");
      const m = map;
      m.on("load", () => {
        if (cancelled) return;
        // Provincia: relleno tenue, borde con brillo.
        const zona: GeoJSON.GeoJSON = focos.zona.poligono
          ? (focos.zona.poligono as GeoJSON.GeoJSON)
          : { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] };
        m.addSource("zona", { type: "geojson", data: zona });
        m.addLayer({ id: "zona-relleno", type: "fill", source: "zona", paint: { "fill-color": "#FF5A1F", "fill-opacity": 0.05 } });
        m.addLayer({ id: "zona-brillo", type: "line", source: "zona", paint: { "line-color": "#FF6A2B", "line-width": 7, "line-blur": 6, "line-opacity": 0.45 } });
        m.addLayer({ id: "zona-borde", type: "line", source: "zona", paint: { "line-color": "#FFB27A", "line-width": 1.6 } });
        m.on("click", (ev) => {
          if (m.queryRenderedFeatures(ev.point, { layers: ["zona-relleno"] }).length) cb.current.onZona();
        });
        // Entra desde el espacio hasta Salta, inclinado para que se vea la cordillera.
        m.once("moveend", () => {
          if (cancelled) return;
          m.setMinZoom(Math.max(3, m.getZoom() - 2.5));
          m.setMaxBounds([[w - 6, s - 5], [e + 6, n + 5]]);
        });
        m.fitBounds([[w, s], [e, n]], { padding: 24, pitch: 48, bearing: -12, duration: quieto() ? 0 : 3200, essential: false });
      });

      // Incendios: la llama del logo, tantas como el nivel (1 leve, 2 medio, 3 grave). Brillan y titilan.
      (focos.incendios ?? []).forEach((x, i) => {
        const alto = 20 + x.nivel * 3;
        const color = NIVEL_COLOR[x.nivel];
        const nodo = document.createElement("button");
        nodo.type = "button";
        nodo.className = "fuego-boton";
        nodo.style.zIndex = String(x.nivel);
        nodo.title = `Incendio ${x.id}: nivel ${x.nivel} de 3 (${GRAVEDAD[x.nivel]}), ~${x.areaHa} ha`;
        nodo.setAttribute("aria-label", nodo.title);
        const marca = sel.current === i ? " elegido" : "";
        nodo.innerHTML = `<span class="fuego n${x.nivel}${marca}" style="--c:${color}" aria-hidden="true">${Array.from({ length: x.nivel }, () => llamaHtml(alto)).join("")}</span>`;
        nodo.addEventListener("click", (ev) => {
          ev.stopPropagation();
          cb.current.onIncendio(i);
        });
        new ml.Marker({ element: nodo, anchor: "bottom" }).setLngLat([x.lon, x.lat]).addTo(m);
      });
      mapaRef.current = map;
      setListo((x) => x + 1);
    })();
    return () => {
      cancelled = true;
      mapaRef.current = null;
      map?.remove();
    };
  }, [focos, cerca]); // no se redibuja al elegir un incendio, para no perder el zoom

  // Capa aparte para los avisos GOES: se actualiza cada 10 min sin tocar el zoom.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || !avisos?.length) return;
    let cancelado = false;
    const marcas: Marker[] = [];
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelado) return;
      for (const a of avisos) {
        const nodo = document.createElement("span");
        nodo.className = "aviso-goes";
        nodo.title = `Posible foco (GOES-19, ${a.hora} UTC): aviso temprano, sin confirmar`;
        marcas.push(new ml.Marker({ element: nodo }).setLngLat([a.lon, a.lat]).addTo(map));
      }
    })();
    return () => {
      cancelado = true;
      marcas.forEach((x) => x.remove());
    };
  }, [avisos, listo]);

  // Activar/desactivar la ruedita (y el arrastre con el dedo) según si la persona está usando el mapa.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    if (activo) {
      map.scrollZoom.enable();
      if (tactil.current) map.dragPan.enable();
      setAviso(false);
    } else {
      map.scrollZoom.disable();
      if (tactil.current) map.dragPan.disable();
    }
  }, [activo, listo]);

  useEffect(() => {
    if (!activo) return;
    // Al salir del mapa (mouse) o tocar fuera (dedo), vuelve a quedar quieto.
    const fuera = (ev: Event) => {
      if (el.current && !el.current.contains(ev.target as Node)) setActivo(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [activo]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  if (sinMapa) {
    const lista = focos?.incendios ?? [];
    return (
      <div className="mapa sin-mapa">
        <p>Tu navegador no puede dibujar el mapa. {lista.length ? "Estos son los incendios:" : "No hay incendios confirmados."}</p>
        <ul>
          {lista.map((x, i) => (
            <li key={x.id}>
              <button type="button" className={seleccionado === i ? "elegido" : undefined} onClick={() => onIncendio(i)}>
                Incendio {x.id}: {GRAVEDAD[x.nivel]}, ~{x.areaHa} ha
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="mapa-caja"
      // Con el dedo se activa con un toque (clic), no al empezar a deslizar: así la página sigue bajando.
      onPointerDown={(e) => e.pointerType !== "touch" && setActivo(true)}
      onClick={() => setActivo(true)}
      onMouseLeave={() => !tactil.current && setActivo(false)}
      onWheel={() => !activo && setAviso(true)}
    >
      <div ref={el} className="mapa" role="application" aria-label="Mapa de incendios en Salta" />
      {!activo && (aviso || tactil.current) && (
        <div className="mapa-pista" aria-hidden="true">
          {tactil.current ? "Tocá el mapa para moverlo" : "Hacé clic en el mapa para usar la ruedita"}
        </div>
      )}
    </div>
  );
}
