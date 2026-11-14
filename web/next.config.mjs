/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // La dirección vieja (brasa-psi-three.vercel.app) manda a la nueva: brasafund.vercel.app
  // Cabeceras de seguridad básicas para todas las páginas
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    const REPO = "https://github.com/jfacundoayala/brasa";
    const FONDO = "0x96b950d62Cae3eE39c5325144c78d0CBDA9d6057";
    // El pago y el contrato abren en el explorador oficial de Avalanche, que carga directo.
    // Links cortos para compartir: brasafund.vercel.app/deck, /repo, /contrato, etc.
    const cortos = [
      ["/video", "https://youtu.be/Kv2nUGe9D3A"],
      ["/one-pager", "/one-pager.pdf"],
      ["/deck", "/deck.pdf"],
      ["/repo", REPO],
      ["/contrato", `https://build.avax.network/explorer/fuji/c-chain/address/${FONDO}`],
      ["/codigo", `https://sourcify.dev/server/repo-ui/43113/${FONDO}`],
      ["/pago", "https://build.avax.network/explorer/fuji/c-chain/tx/0xd35e6748a10d21081a05998893f4b3d8d2f42d2d89d438bcd22944d7edded4a3"],
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
