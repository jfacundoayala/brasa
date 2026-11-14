"use client";
import { useEffect, useRef, useState } from "react";
import type { Aviso } from "@/lib/goes";
import "leaflet/dist/leaflet.css";
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

export default function Mapa({ focos, seleccionado, onFoco, onIncendio, onZona, avisos }: Props) {
  const mapaRef = useRef<import("leaflet").Map | null>(null);
  const [listo, setListo] = useState(0);
  // El mapa no "atrapa" la ruedita ni el dedo hasta que lo tocás: así la página baja normal.
  const [activo, setActivo] = useState(false);
  const [aviso, setAviso] = useState(false);
  const tactil = useRef(false);
  const el = useRef<HTMLDivElement>(null);
  const cb = useRef({ onFoco, onIncendio, onZona });
  cb.current = { onFoco, onIncendio, onZona };
  const sel = useRef<number | null>(seleccionado);
  sel.current = seleccionado;

  useEffect(() => {
    if (!el.current || !focos) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      const [w, s, e, n] = focos.zona.bbox;
      tactil.current = L.Browser.mobile;
      // Límite: Salta con un margen (norte argentino y vecinos). No se puede alejar al mapa del mundo.
      const limite = L.latLngBounds([[s - 3, w - 4], [n + 3, e + 4]]);
      map = L.map(el.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: !tactil.current,
        maxBounds: limite,
        maxBoundsViscosity: 1,
        worldCopyJump: false,
      }).fitBounds([[s, w], [n, e]], { padding: [10, 10] });
      map.setMinZoom(Math.max(4, map.getZoom() - 1));
      // Mapa de OpenStreetMap, oscurecido con un filtro CSS (clase .mapa .leaflet-tile-pane) para que el fuego se vea.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const estiloZona = { color: "#FF5A1F", weight: 2, fillOpacity: 0.04 };
      // Si hay polígono de la provincia lo dibuja; si no, el rectángulo.
      (focos.zona.poligono
        ? L.geoJSON(focos.zona.poligono as GeoJSON.GeoJsonObject, { style: estiloZona })
        : L.rectangle([[s, w], [n, e]], estiloZona)
      )
        .addTo(map)
        .on("click", () => cb.current.onZona());

      // Solo se dibuja el fuego (los incendios). Los focos sueltos de cada satélite no se muestran:
      // la fuente se nombra en la tarjeta de cada incendio.

      // Incendios: la llama del logo, tantas como el nivel (1 leve, 2 medio, 3 grave). Brillan y titilan.
      // Los más graves se dibujan arriba para que no los tape uno leve.
      (focos.incendios ?? []).forEach((x, i) => {
        const alto = 20 + x.nivel * 3;
        const ancho = Math.round(alto * 0.75) * x.nivel - 5 * (x.nivel - 1) + 4;
        const color = NIVEL_COLOR[x.nivel];
        const marca = sel.current === i ? " elegido" : "";
        const llamas = Array.from({ length: x.nivel }, () => llamaHtml(alto)).join("");
        const icon = L.divIcon({
          className: "",
          iconSize: [ancho, alto],
          iconAnchor: [ancho / 2, alto],
          html: `<span class="fuego n${x.nivel}${marca}" style="--c:${color}" aria-hidden="true">${llamas}</span>`,
        });
        L.marker([x.lat, x.lon], {
          icon,
          zIndexOffset: x.nivel * 1000,
          title: `Incendio ${x.id}: nivel ${x.nivel} de 3 (${GRAVEDAD[x.nivel]}), ~${x.areaHa} ha`,
          keyboard: true,
        })
          .addTo(map!)
          .on("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            cb.current.onIncendio(i);
          });
      });
      mapaRef.current = map;
      setListo((x) => x + 1);
    })();
    return () => {
      cancelled = true;
      mapaRef.current = null;
      map?.remove();
    };
  }, [focos]); // no se redibuja al elegir un incendio, para no perder el zoom

  // Capa aparte para los avisos GOES: se actualiza cada 10 min sin tocar el zoom.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map || !avisos?.length) return;
    let capa: import("leaflet").LayerGroup | undefined;
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado) return;
      capa = L.layerGroup(
        avisos.map((a) =>
          L.marker([a.lat, a.lon], {
            icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<span class="aviso-goes" aria-hidden="true"></span>` }),
            title: `Posible foco (GOES-19, ${a.hora} UTC): aviso temprano, sin confirmar`,
            zIndexOffset: -500,
          }),
        ),
      ).addTo(map);
    })();
    return () => {
      cancelado = true;
      capa?.remove();
    };
  }, [avisos, listo]);

  // Activar/desactivar la ruedita (y el arrastre con el dedo) según si la persona está usando el mapa.
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    if (activo) {
      map.scrollWheelZoom.enable();
      if (tactil.current) map.dragging.enable();
      setAviso(false);
    } else {
      map.scrollWheelZoom.disable();
      if (tactil.current) map.dragging.disable();
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

  return (
    <div
      className="mapa-caja"
      onPointerDown={() => setActivo(true)}
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
