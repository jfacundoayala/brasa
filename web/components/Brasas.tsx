"use client";
// Brasas que suben despacio por el fondo de la portada. Canvas 2D liviano; se frena fuera de pantalla
// y no se mueve si la persona pidió menos movimiento.
import { useEffect, useRef } from "react";

type Chispa = { x: number; y: number; r: number; vy: number; vx: number; fase: number; vida: number };

export default function Brasas({ cantidad = 70 }: { cantidad?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const medir = () => {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    const nueva = (abajo: boolean): Chispa => ({
      x: Math.random() * w,
      y: abajo ? h + Math.random() * 40 : Math.random() * h,
      r: 0.6 + Math.random() * 1.8,
      vy: 12 + Math.random() * 30,
      vx: -6 + Math.random() * 12,
      fase: Math.random() * Math.PI * 2,
      vida: 0.4 + Math.random() * 0.6,
    });
    const chispas = Array.from({ length: cantidad }, () => nueva(false));
    let visible = true;
    let raf = 0;
    let antes = performance.now();
    const dibujar = (ahora: number) => {
      const dt = Math.min((ahora - antes) / 1000, 0.05);
      antes = ahora;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      for (const p of chispas) {
        if (!quieto) {
          p.fase += dt * 2;
          p.y -= p.vy * dt;
          p.x += (p.vx + Math.sin(p.fase) * 8) * dt;
          if (p.y < -10) Object.assign(p, nueva(true));
        }
        const alto = Math.max(0, Math.min(1, p.y / h));
        const a = p.vida * (0.25 + 0.75 * alto) * (0.7 + 0.3 * Math.sin(p.fase * 3));
        const r = p.r * 4;
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, `rgba(255,214,140,${a})`);
        grad.addColorStop(0.35, `rgba(255,106,43,${a * 0.6})`);
        grad.addColorStop(1, "rgba(255,60,20,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fill();
      }
      if (visible && !quieto) raf = requestAnimationFrame(dibujar);
    };
    raf = requestAnimationFrame(dibujar);
    const io = new IntersectionObserver((lote) => {
      const antesVisible = visible;
      // Si llegan varios avisos juntos, vale el último.
      visible = lote[lote.length - 1].isIntersecting;
      if (visible && !antesVisible && !quieto) {
        antes = performance.now();
        // Nunca dos bucles a la vez: se corta el cuadro pendiente antes de pedir otro.
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(dibujar);
      }
    });
    io.observe(c);
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [cantidad]);

  return <canvas ref={ref} className="brasas" aria-hidden="true" />;
}
