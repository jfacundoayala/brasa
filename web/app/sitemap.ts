import type { MetadataRoute } from "next";

const SITIO = process.env.SITIO_URL ?? "https://brasafund.vercel.app";

/** Las páginas del sitio: la portada, Fundamentos y los links. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITIO}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITIO}/fundamentos`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITIO}/links`, changeFrequency: "weekly", priority: 0.5 },
  ];
}
