// Íconos de línea propios (24 × 24, trazo 1.75), en lugar de emojis: se ven igual en todos los sistemas
// y siguen el color del texto (currentColor). Todos son decorativos: el texto de al lado dice lo mismo.
import type { ReactNode } from "react";

function Base({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

/** Satélite con sus paneles y la señal hacia abajo. */
export const IcoSatelite = ({ size }: P) => (
  <Base size={size}>
    <rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" />
    <path d="M7.8 7.8 4 4M16.2 7.8 20 4M5 7l-2 2 3 3 2-2M19 7l2 2-3 3-2-2" />
    <path d="M12 16.5v1.5M9 20.5a4.5 4.5 0 0 0 6 0" />
  </Base>
);

/** Calculadora: la cuenta pública. */
export const IcoCalculo = ({ size }: P) => (
  <Base size={size}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5v3M8.5 18h.01M12 18h.01" />
  </Base>
);

/** Cuartel de bomberos: casa con la sirena arriba. */
export const IcoCuartel = ({ size }: P) => (
  <Base size={size}>
    <path d="M4 10.5 12 5l8 5.5V20H4z" />
    <path d="M10 20v-5h4v5M12 2v1.5" />
  </Base>
);

/** Candado: el fondo no se puede retirar. */
export const IcoCandado = ({ size }: P) => (
  <Base size={size}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
  </Base>
);

/** Ojo: todo a la vista. */
export const IcoOjo = ({ size }: P) => (
  <Base size={size}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

/** Escudo con tilde: código verificado. */
export const IcoVerificado = ({ size }: P) => (
  <Base size={size}>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Base>
);

/** Corazón en una mano: donar. */
export const IcoDonar = ({ size }: P) => (
  <Base size={size}>
    <path d="M12 11.5S8 9.2 8 6.6A2.1 2.1 0 0 1 12 5.7a2.1 2.1 0 0 1 4 .9c0 2.6-4 4.9-4 4.9Z" />
    <path d="M3 15.5h3.5l3.2 2.5h4.8a1.5 1.5 0 0 0 0-3H11M14.5 15l4-2.2a1.6 1.6 0 0 1 2.1 2.3L16 20.5H6.5L3 19" />
  </Base>
);

/** Lupa: cualquiera lo comprueba. */
export const IcoLupa = ({ size }: P) => (
  <Base size={size}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m20 20-5.2-5.2M8 10.5l1.8 1.8L13.2 9" />
  </Base>
);

/** Flecha hacia afuera (link externo). */
export const IcoExterno = ({ size = 14 }: P) => (
  <Base size={size}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Base>
);

/** Matraz: esto es una prueba. */
export const IcoPrueba = ({ size = 16 }: P) => (
  <Base size={size}>
    <path d="M9 3h6M10 3v6l-5.2 9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9V3M7.5 15h9" />
  </Base>
);
