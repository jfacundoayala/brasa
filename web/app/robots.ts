import type { MetadataRoute } from "next";

const SITIO = process.env.SITIO_URL ?? "https://brasafund.vercel.app";

/** Los buscadores pueden recorrer todo el sitio. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITIO}/sitemap.xml` };
}
