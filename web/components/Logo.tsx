// Logo de Brasa: el mismo dibujo que docs/identidad/logo-brasa-oscuro.svg (llama en tres tonos, por los tres niveles de incendio, con el satélite que la detecta y "brasa" escrito).
// Va en línea (no como <img>) para que el texto use Space Grotesk, la letra que carga la página.
export default function Logo({ height = 48 }: { height?: number }) {
  return (
    <svg viewBox="0 0 420 120" height={height} role="img" aria-label="brasa">
      <g transform="translate(10,8) scale(1.04)">
        <path d="M53 4 C53 21 77 30 78 55 C79 75 66 90 50 90 C34 90 21 77 22 59 C23 47 30 40 35 30 C37 38 41 42 46 42 C43 29 46 14 53 4 Z" fill="#FF5A1F" />
        <path d="M51 42 C55 53 66 58 66 71 C66 81 59 88 50 88 C41 88 34 81 34 72 C34 64 38 60 42 55 C43 60 46 63 48 63 C47 56 48 49 51 42 Z" fill="#FFB000" /><path d="M50 66 C53 71 58 73 58 79 C58 84 54.5 87 50 87 C45.5 87 42 84 42 79.5 C42 76 44 74 46 71.5 C46.5 74 48 75 49 75 C48.5 72 49 69 50 66 Z" fill="#FFE08A" />
        <g transform="translate(91,17) rotate(45) scale(1.3)"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1.8" fill="#FFB000" /><rect x="-16" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000" /><rect x="-10.8" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000" /><rect x="6.5" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000" /><rect x="11.7" y="-3.4" width="4.3" height="6.8" rx="1" fill="#FFB000" /><rect x="-7" y="-0.8" width="14" height="1.6" fill="#FFB000" /><circle cx="0" cy="6.6" r="1.7" fill="#FFB000" /></g><path d="M84.7 31.7 A16 16 0 0 1 76.3 23.3" fill="none" stroke="#FFB000" strokeWidth="2.4" strokeLinecap="round" /><path d="M82.0 38.2 A23 23 0 0 1 69.8 26.0" fill="none" stroke="#FFB000" strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
      </g>
      <text
        x="139"
        y="82"
        fontFamily="'Space Grotesk Variable','Space Grotesk','Inter','Segoe UI',Arial,sans-serif"
        fontSize="68"
        fontWeight="700"
        fill="#FBF6EE"
        letterSpacing="-2"
      >
        brasa
      </text>
    </svg>
  );
}
