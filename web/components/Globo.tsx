"use client";
// La Tierra en 3D con los satélites que ven el fuego. Las órbitas son reales (SGP4 con el TLE del día);
// el tiempo corre acelerado y el satélite está fuera de escala para que se vea.
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, Line, PerformanceMonitor, Stars } from "@react-three/drei";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SatRec } from "satellite.js";
import { NIVEL_COLOR } from "@/lib/chain";
import { anillo, distanciaKm, estado, gmst, latLon, satrec, type Estado, type Tle } from "@/lib/orbita";

export type Punto = { lat: number; lon: number; nivel: 1 | 2 | 3 };
export type EstadoSat = Estado & { nombre: string; sobreSalta: boolean };

export const SALTA = { lat: -24.8, lon: -65.4 };
/** El satélite "ve" Salta cuando pasa a menos de esto (la franja de VIIRS mide unos 3000 km). */
const RADIO_VISTA_KM = 1500;

type Props = {
  tles: Tle[];
  puntos: Punto[];
  aceleracion: number;
  activo: boolean;
  quieto: boolean;
  onEstado?: (e: EstadoSat) => void;
};
/** Lo que Globo decide una vez y reparte a la escena. */
type Montaje = { liviano: boolean; portal: React.RefObject<HTMLElement> };

/** En celular se dibuja más liviano: menos píxeles, menos estrellas y la textura de 2K. */
const esLiviano = () => window.matchMedia("(pointer: coarse), (max-width: 979px)").matches;

function Globo(props: Props) {
  // Se decide al montar: girar la pantalla no vuelve a bajar texturas ni recrea las estrellas.
  const [liviano] = useState(esLiviano);
  // Si el equipo no llega a dibujar fluido, baja la resolución en vez de trabarse.
  const [tope, setTope] = useState(liviano ? 1 : 2);
  const dpr = useMemo<[number, number]>(() => [1, tope], [tope]);
  // Capa propia para las etiquetas: si drei elige el contenedor por su cuenta, puede cambiarlo entre renders y perder una.
  const [capa, setCapa] = useState<HTMLDivElement | null>(null);
  const portal = useMemo(() => ({ current: capa }) as React.RefObject<HTMLElement>, [capa]);
  return (
    <>
      <div ref={setCapa} className="globo-capa" aria-hidden="true" />
      {capa && (
        <Canvas
          camera={{ position: [0, 0, 3.7], fov: 36 }}
          dpr={dpr}
          frameloop={props.activo ? "always" : "never"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          aria-hidden="true"
        >
          <PerformanceMonitor onDecline={() => setTope(1)} />
          <Escena {...props} liviano={liviano} portal={portal} />
        </Canvas>
      )}
    </>
  );
}

// Con memo, el panel de telemetría se actualiza sin volver a renderizar la escena.
export default memo(Globo);

function Escena({ tles, puntos, aceleracion, quieto, onEstado, liviano, portal }: Props & Montaje) {
  const inclinacion = useRef<THREE.Group>(null);
  const giro = useRef<THREE.Group>(null);
  const puntero = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (quieto) return;
    const mover = (e: PointerEvent) => {
      puntero.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      puntero.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", mover, { passive: true });
    return () => window.removeEventListener("pointermove", mover);
  }, [quieto]);

  // Salta mirando a la cámara, un poco por debajo del centro.
  const baseY = (-(SALTA.lon + 90) * Math.PI) / 180;
  const baseX = -0.36;
  useFrame((state, dt) => {
    if (!inclinacion.current || !giro.current) return;
    const t = state.clock.elapsedTime;
    const vaiven = quieto ? 0 : Math.sin(t * 0.12) * 0.12;
    const objY = baseY + vaiven + puntero.current.x * 0.12;
    const objX = baseX + puntero.current.y * 0.06;
    const k = 1 - Math.exp(-dt * 2.5);
    giro.current.rotation.y += (objY - giro.current.rotation.y) * k;
    inclinacion.current.rotation.x += (objX - inclinacion.current.rotation.x) * k;
  });

  return (
    <>
      <Stars radius={80} depth={40} count={liviano ? 1200 : 2600} factor={3.2} saturation={0} fade speed={quieto ? 0 : 0.4} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[SOL.x * 5, SOL.y * 5, SOL.z * 5]} intensity={2.2} />
      <group ref={inclinacion} rotation={[baseX, 0, 0]}>
        <group ref={giro} rotation={[0, baseY, 0]}>
          <Tierra liviano={liviano} />
          <Fuegos puntos={puntos} quieto={quieto} portal={portal} />
          {tles.map((t, i) => (
            <Satelite key={t.id} tle={t} principal={i === 0} aceleracion={aceleracion} onEstado={i === 0 ? onEstado : undefined} portal={portal} />
          ))}
        </group>
      </group>
      <Atmosfera />
    </>
  );
}

const SOL = new THREE.Vector3(-0.55, 0.35, 0.76).normalize();

function Tierra({ liviano }: Pick<Montaje, "liviano">) {
  const max = useThree((s) => s.gl.capabilities.maxTextureSize);
  const [dia, noche, relieve] = useLoader(THREE.TextureLoader, [
    !liviano && max >= 4096 ? "/tierra/dia-4k.webp" : "/tierra/dia.webp",
    "/tierra/noche.webp",
    "/tierra/relieve.webp",
  ]);
  const anis = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const material = useMemo(() => {
    dia.colorSpace = THREE.SRGBColorSpace;
    noche.colorSpace = THREE.SRGBColorSpace;
    for (const t of [dia, noche, relieve]) t.anisotropy = Math.min(8, anis);
    return new THREE.ShaderMaterial({
      uniforms: { dia: { value: dia }, noche: { value: noche }, relieve: { value: relieve }, sol: { value: SOL } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vPos = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D dia; uniform sampler2D noche; uniform sampler2D relieve; uniform vec3 sol;
        varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
        void main() {
          vec3 n = normalize(vN);
          // relieve: inclina la normal según la pendiente del mapa de alturas
          vec2 px = vec2(1.0 / 2048.0, 1.0 / 1024.0);
          float h0 = texture2D(relieve, vUv).r;
          float hx = texture2D(relieve, vUv + vec2(px.x, 0.0)).r;
          float hy = texture2D(relieve, vUv + vec2(0.0, px.y)).r;
          float luz = dot(n, sol);
          float sombra = clamp(1.0 + ((h0 - hx) + (h0 - hy)) * 4.0, 0.7, 1.3);
          float d = smoothstep(-0.18, 0.28, luz);
          vec3 cDia = texture2D(dia, vUv).rgb * (0.06 + 1.15 * max(luz, 0.0)) * sombra;
          vec3 cNoche = texture2D(noche, vUv).rgb * vec3(1.0, 0.62, 0.32) * 1.8;
          vec3 v = normalize(cameraPosition - vPos);
          vec3 c = mix(cNoche + cDia * 0.25, cDia, d);
          float borde = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          c += vec3(0.30, 0.55, 1.0) * borde * (0.25 + 0.75 * d);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }, [dia, noche, relieve]);
  return (
    <mesh material={material}>
      <sphereGeometry args={[1, 128, 128]} />
    </mesh>
  );
}

function Atmosfera() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vN;
          void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec3 vN;
          void main() {
            float i = pow(max(0.68 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 2.6);
            gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * i * 2.2, i);
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={material} scale={1.13}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

/** Textura de un brillo redondo, para los fuegos y el satélite. */
function useBrillo() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.15, "rgba(255,255,255,.65)");
    r.addColorStop(0.45, "rgba(255,255,255,.12)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Fuegos({ puntos, quieto, portal }: { puntos: Punto[]; quieto: boolean } & Pick<Montaje, "portal">) {
  const brillo = useBrillo();
  const onda = useRef<THREE.Mesh>(null);
  const grupo = useRef<THREE.Group>(null);
  const salta = useMemo(() => new THREE.Vector3(...latLon(SALTA.lat, SALTA.lon, 1.002)), []);
  const orientacion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), salta.clone().normalize()), [salta]);

  useFrame(({ clock }) => {
    if (quieto) return;
    const t = clock.elapsedTime;
    if (onda.current) {
      const f = (t * 0.6) % 1;
      onda.current.scale.setScalar(0.02 + f * 0.09);
      (onda.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - f);
    }
    grupo.current?.children.forEach((s, i) => {
      const b = 1 + Math.sin(t * 3 + i * 1.7) * 0.18;
      s.scale.setScalar((s.userData.base as number) * b);
    });
  });

  return (
    <>
      <mesh ref={onda} position={salta} quaternion={orientacion} scale={0.06}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#FF8A4C" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={grupo}>
        {puntos.map((p, i) => {
          const base = 0.035 + p.nivel * 0.012;
          return (
            <sprite key={i} position={latLon(p.lat, p.lon, 1.006)} scale={base} userData={{ base }}>
              <spriteMaterial map={brillo} color={NIVEL_COLOR[p.nivel]} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
            </sprite>
          );
        })}
      </group>
      <Html portal={portal} position={latLon(SALTA.lat + 1.2, SALTA.lon + 1.5, 1.01)} center zIndexRange={[20, 0]} className="globo-etiqueta-caja">
        <span className="globo-etiqueta">
          <i aria-hidden="true" /> Salta{puntos.length > 0 && ` · ${puntos.length} ${puntos.length === 1 ? "incendio" : "incendios"}`}
        </span>
      </Html>
    </>
  );
}

/** ¿La Tierra (radio 1, en el origen) tapa el punto p visto desde la cámara c? */
function tapaLaTierra(p: THREE.Vector3, c: THREE.Vector3): boolean {
  const largo = p.distanceTo(c);
  if (largo === 0) return false;
  // Distancia, sobre la línea de vista, hasta el punto que pasa más cerca del centro.
  const t = (c.lengthSq() - c.dot(p)) / largo;
  return t > 0 && t < largo && c.lengthSq() - t * t < 1;
}

function Satelite({
  tle,
  principal,
  aceleracion,
  onEstado,
  portal,
}: { tle: Tle; principal: boolean; aceleracion: number; onEstado?: (e: EstadoSat) => void } & Pick<Montaje, "portal">) {
  const s: SatRec = useMemo(() => satrec(tle), [tle]);
  const inicio = useMemo(() => Date.now(), []);
  const puntos = useMemo(() => anillo(s, new Date(inicio)), [s, inicio]);
  const sat = useRef<THREE.Group>(null);
  const orbita = useRef<THREE.Group>(null);
  const haz = useRef<THREE.Mesh>(null);
  const etiqueta = useRef<HTMLSpanElement>(null);
  const mundo = useMemo(() => new THREE.Vector3(), []);
  const ultimoAviso = useRef(0);
  // Reloj propio: el del renderer vuelve a cero cada vez que el globo se pausa.
  const reloj = useRef(0);
  const brillo = useBrillo();
  const centro = useMemo(() => new THREE.Vector3(), []);
  const color = principal ? "#FFB000" : "#7cc4ff";

  const geoHaz = useMemo(() => {
    const alto = 0.13;
    const g = new THREE.ConeGeometry(0.17, alto, 48, 1, true);
    g.translate(0, -alto / 2, 0);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame(({ camera }, dt) => {
    reloj.current += Math.min(dt, 0.1);
    // Sin aceleración se usa la hora real, que no se atrasa cuando el globo se pausa.
    const ahora = aceleracion === 1 ? new Date() : new Date(inicio + reloj.current * 1000 * aceleracion);
    const e = estado(s, ahora);
    if (!e || !sat.current) return;
    sat.current.position.set(...e.pos);
    sat.current.parent?.localToWorld(centro.set(0, 0, 0));
    sat.current.lookAt(centro);
    if (orbita.current) orbita.current.rotation.y = -gmst(ahora);
    if (etiqueta.current) {
      // Del otro lado del planeta el satélite no se ve: su nombre tampoco.
      const ver = tapaLaTierra(sat.current.getWorldPosition(mundo), camera.position) ? "hidden" : "visible";
      if (etiqueta.current.style.visibility !== ver) etiqueta.current.style.visibility = ver;
    }
    const dist = distanciaKm(e.lat, e.lon, SALTA.lat, SALTA.lon);
    const sobreSalta = dist < RADIO_VISTA_KM;
    if (haz.current) {
      const m = haz.current.material as THREE.MeshBasicMaterial;
      const obj = sobreSalta ? 0.28 : 0.08;
      m.opacity += (obj - m.opacity) * 0.08;
    }
    if (onEstado && reloj.current - ultimoAviso.current > 0.25) {
      ultimoAviso.current = reloj.current;
      onEstado({ ...e, nombre: tle.nombre, sobreSalta });
    }
  });

  return (
    <>
      <group ref={orbita}>
        <Line points={puntos} color={color} lineWidth={principal ? 1.2 : 0.8} transparent opacity={principal ? 0.5 : 0.25} dashed={!principal} dashSize={0.02} gapSize={0.015} />
      </group>
      <group ref={sat}>
        <group scale={principal ? 0.045 : 0.03}>
          <Nave />
        </group>
        <sprite scale={principal ? 0.08 : 0.05}>
          <spriteMaterial map={brillo} color={color} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.45} />
        </sprite>
        {principal && (
          <mesh ref={haz} geometry={geoHaz}>
            <meshBasicMaterial color="#FF8A4C" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        )}
        {principal && (
          <Html portal={portal} center position={[0, 0.07, 0]} zIndexRange={[20, 0]} className="globo-etiqueta-caja">
            <span ref={etiqueta} className="globo-sat">
              {tle.nombre}
            </span>
          </Html>
        )}
      </group>
    </>
  );
}

/** Un satélite tipo JPSS: cuerpo con manta dorada, un ala solar y el sensor VIIRS mirando a la Tierra (+z). */
function Nave() {
  const panel = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0d1f3f";
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = "#5d8fd6";
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) g.strokeRect(x, 0, 32, 64);
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(256, 32);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh>
        <boxGeometry args={[1, 1, 1.4]} />
        <meshStandardMaterial color="#d8a93a" metalness={0.85} roughness={0.32} emissive="#3a2500" />
      </mesh>
      <mesh position={[0, 0, 0.85]}>
        <cylinderGeometry args={[0.28, 0.34, 0.3, 24]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.65, -0.3]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#9aa0aa" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.6, -0.3]}>
        <boxGeometry args={[1.5, 3.6, 0.05]} />
        <meshStandardMaterial map={panel} metalness={0.4} roughness={0.35} emissive="#0a1a3a" emissiveIntensity={0.6} />
      </mesh>
      <pointLight intensity={2} distance={4} color="#ffd9a0" />
    </group>
  );
}
