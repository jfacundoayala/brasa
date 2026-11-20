// Lista cerrada de a dónde puede conectarse la página: si se suma un servicio externo, hay que agregarlo acá.
const DATOS = [
  "https://api.avax-test.network", // lectura del contrato en Fuji
  "https://api.routescan.io", // historial de donaciones y envíos
  "https://dolarapi.com", // dólar oficial, de referencia
  "https://api.coingecko.com", // precio de AVAX, de referencia
  "https://raw.githubusercontent.com", // focos de la NASA, de la rama "datos" del repo
  "https://dataserver-coids.inpe.br", // aviso rápido (GOES-19)
  "https://celestrak.org", // órbitas de NOAA-20 y NOAA-21
  "https://tle.ivanstanojevic.me", // órbitas, de respaldo
  "https://api.open-meteo.com", // clima en el incendio
  "https://server.arcgisonline.com", // imagen satelital del mapa
  "https://s3.amazonaws.com", // relieve del mapa
  "https://soroban-testnet.stellar.org", // lectura y envío al contrato de Stellar (red de prueba)
];
// next dev necesita eval para recargar en caliente; en producción no se permite.
const DEV = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://stellar.creit.tech", // íconos de las billeteras de Stellar
  "font-src 'self' data:",
  `connect-src 'self' ${DATOS.join(" ")}${DEV ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
// Las texturas del globo y las fotos no cambian: si alguna se reemplaza, va con otro nombre de archivo.
const CACHE_LARGA = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // La dirección vieja (brasa-psi-three.vercel.app) manda a la nueva: brasafund.vercel.app
  // Cabeceras de seguridad para todas las páginas
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      { source: "/tierra/:path*", headers: CACHE_LARGA },
      { source: "/fotos/:path*", headers: CACHE_LARGA },
    ];
  },
  async redirects() {
    const REPO = "https://github.com/jfacundoayala/brasa";
    const FONDO = "CAE23TYOONXIZEHOYY4GZARITWVOFQBENRWHK7MCFM4Q7NRUJSVGVQR6";
    const EXPLORADOR = "https://stellar.expert/explorer/testnet";
    // Links cortos para compartir: brasafund.vercel.app/deck, /repo, /contrato, etc.
    const cortos = [
      ["/video", "https://youtu.be/Kv2nUGe9D3A"],
      ["/one-pager", "/one-pager.pdf"],
      ["/deck", "/deck.pdf"],
      ["/repo", REPO],
      ["/contrato", `${EXPLORADOR}/contract/${FONDO}`],
      ["/codigo", `${REPO}/tree/main/stellar`],
      ["/comprobante", `${EXPLORADOR}/tx/9789094c217e84c3aeb28836751057e77f98bc36a7056af1fd72b3fc445dd532`],
      ["/entrevista", `${REPO}/blob/main/docs/producto/VALIDACION-BOMBEROS.md`],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
    return [
      ...cortos,
      {
        source: "/:path*",
        has: [{ type: "host", value: "brasa-psi-three.vercel.app" }],
        destination: "https://brasafund.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
