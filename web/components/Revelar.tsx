"use client";
// Entrada suave al bajar: el bloque sube unos píxeles y aparece una sola vez. Respeta "reducir movimiento".
import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string; demora?: number; como?: "div" | "li" };

export default function Revelar({ children, className, demora = 0, como = "div" }: Props) {
  const Etiqueta = como === "li" ? motion.li : motion.div;
  return (
    <Etiqueta
      className={className}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay: demora, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Etiqueta>
  );
}
