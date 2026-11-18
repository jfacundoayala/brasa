// Copia el worker de MapLibre a public/ para que el mapa lo cargue desde el mismo sitio.
// Corre antes de "dev" y de "build", en cualquier sistema operativo.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
