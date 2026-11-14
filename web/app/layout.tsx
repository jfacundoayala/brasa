import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayuda a tiempo, recursos a la vista · brasa",
  description: "Focos de incendio reales. Un fondo para bomberos y damnificados. Ayuda a tiempo, recursos a la vista.",
  icons: { icon: "/simbolo-brasa.svg" },
  // Para que el link se vea bien en WhatsApp y LinkedIn. En Vercel se usa el dominio público brasafund.vercel.app.
  metadataBase: new URL(
    process.env.SITIO_URL ??
      (process.env.VERCEL ? "https://brasafund.vercel.app" : "http://localhost:3000"),
  ),
  openGraph: {
    title: "Ayuda a tiempo, recursos a la vista · brasa",
    description: "Cuando dos satélites de la NASA confirman un incendio, el fondo paga a los bomberos y a los damnificados. Piloto en Salta, en Avalanche Fuji.",
    images: [{ url: "/og-brasa.png", width: 1200, height: 630, alt: "brasa, fondo para bomberos y damnificados por incendios" }],
    locale: "es_AR",
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og-brasa.png"] },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14110F" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
