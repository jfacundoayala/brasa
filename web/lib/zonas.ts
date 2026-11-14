// Datos de cada departamento de Salta para la tarjeta del incendio.
// - Límites: geoBoundaries ARG ADM2 (IGN y OCHA, licencia abierta), recortados a Salta en /salta-departamentos.geojson.
// - Población: Censo 2022 (INDEC, datos definitivos), por departamento: https://telencuestas.com/censos-de-poblacion/argentina/2022/salta
// - Superficie: https://es.wikipedia.org/wiki/Anexo:Departamentos_de_la_provincia_de_Salta
// - Ambiente: ecorregión que predomina en el departamento (aproximado: un departamento puede tener más de una).
// Todo es una estimación para dimensionar, no un parte oficial.

export type Ambiente = "yungas" | "chaco" | "yungasChaco" | "monte" | "puna";

/** Flora y fauna que el fuego pone en riesgo en cada ambiente. Solo especies nombradas en la fuente de cada uno. */
export const AMBIENTE: Record<
  Ambiente,
  { nombre: string; bosque: string; flora: string; mamiferos: string; aves: string; fuente: string; url: string }
> = {
  yungas: {
    nombre: "Yungas (selva de montaña)",
    bosque: "Selva y bosque nativo de montaña",
    flora: "cedro salteño, lapacho, cebil, aliso y pino del cerro",
    mamiferos: "yaguareté, tapir, pecarí, mono caí, ocelote y taruca",
    aves: "tucán grande, pava de monte y picaflores",
    fuente: "Parques Nacionales Baritú y Calilegua",
    url: "https://es.wikipedia.org/wiki/Parque_nacional_Barit%C3%BA",
  },
  chaco: {
    nombre: "Chaco Seco",
    bosque: "Bosque nativo chaqueño",
    flora: "quebracho colorado, algarrobo, palo santo, mistol y yuchán (palo borracho)",
    mamiferos: "tatú carreta, chancho quimilero, oso hormiguero y pecarí",
    aves: "ñandú y loro hablador",
    fuente: "Parques Nacionales Copo y El Impenetrable (Chaco Seco)",
    url: "https://es.wikipedia.org/wiki/Parque_nacional_El_Impenetrable",
  },
  yungasChaco: {
    nombre: "Yungas y Chaco serrano",
    bosque: "Bosque nativo de transición entre la selva y el monte chaqueño",
    flora: "palo blanco, tipa, cebil colorado, horco cebil, nogal criollo y pacará",
    mamiferos: "corzuela parda, pecarí de collar, mono caí, oso melero, tapir y puma",
    aves: "tucán grande, pava de monte, picaflores y garzas",
    fuente: "Parque Nacional El Rey (Salta)",
    url: "https://es.wikipedia.org/wiki/Parque_nacional_El_Rey",
  },
  monte: {
    nombre: "Monte de Sierras y Bolsones (Valles Calchaquíes)",
    bosque: "Monte y cardonales, sin selva",
    flora: "cardón y churqui",
    mamiferos: "guanaco, chinchillón, zorro colorado y gato del pajonal",
    aves: "cóndor andino, bandurritas y canasteros",
    fuente: "Parque Nacional Los Cardones (Salta)",
    url: "https://es.wikipedia.org/wiki/Parque_nacional_Los_Cardones",
  },
  puna: {
    nombre: "Puna y Altos Andes",
    bosque: "Estepa de altura, sin bosque",
    flora: "tola, yareta y pastos de altura",
    mamiferos: "vicuña, taruca, puma y gato andino",
    aves: "flamencos (parinas) y cóndor andino",
    fuente: "Puna de Atacama",
    url: "https://es.wikipedia.org/wiki/Puna_de_Atacama",
  },
};

/** Censo 2022 y ambiente predominante, por nombre de departamento (como viene en geoBoundaries). */
export const DEPTOS: Record<string, { poblacion: number; km2: number; cabecera: string; ambiente: Ambiente }> = {
  Capital: { poblacion: 627477, km2: 1722, cabecera: "Salta", ambiente: "yungasChaco" },
  "Orán": { poblacion: 160642, km2: 11892, cabecera: "San Ramón de la Nueva Orán", ambiente: "yungas" },
  "General José de San Martín": { poblacion: 178004, km2: 16257, cabecera: "Tartagal", ambiente: "yungasChaco" },
  Anta: { poblacion: 70170, km2: 21945, cabecera: "Joaquín V. González", ambiente: "chaco" },
  "General Güemes": { poblacion: 56166, km2: 2365, cabecera: "General Güemes", ambiente: "yungasChaco" },
  "Metán": { poblacion: 48245, km2: 5235, cabecera: "San José de Metán", ambiente: "yungasChaco" },
  "Rosario de Lerma": { poblacion: 51028, km2: 5110, cabecera: "Rosario de Lerma", ambiente: "yungasChaco" },
  Cerrillos: { poblacion: 55949, km2: 640, cabecera: "Cerrillos", ambiente: "yungasChaco" },
  Rivadavia: { poblacion: 38086, km2: 25951, cabecera: "Rivadavia", ambiente: "chaco" },
  "Rosario de la Frontera": { poblacion: 33809, km2: 5402, cabecera: "Rosario de la Frontera", ambiente: "yungasChaco" },
  Chicoana: { poblacion: 24729, km2: 910, cabecera: "Chicoana", ambiente: "yungasChaco" },
  Cafayate: { poblacion: 17829, km2: 1570, cabecera: "Cafayate", ambiente: "monte" },
  "Santa Victoria": { poblacion: 9413, km2: 3912, cabecera: "Santa Victoria Oeste", ambiente: "yungas" },
  "La Caldera": { poblacion: 12299, km2: 867, cabecera: "La Caldera", ambiente: "yungas" },
  "La Viña": { poblacion: 8900, km2: 2152, cabecera: "La Viña", ambiente: "yungasChaco" },
  Cachi: { poblacion: 8948, km2: 2925, cabecera: "Cachi", ambiente: "monte" },
  "San Carlos": { poblacion: 7798, km2: 5125, cabecera: "San Carlos", ambiente: "monte" },
  "Los Andes": { poblacion: 7182, km2: 25636, cabecera: "San Antonio de los Cobres", ambiente: "puna" },
  Iruya: { poblacion: 6118, km2: 3515, cabecera: "Iruya", ambiente: "yungas" },
  "La Candelaria": { poblacion: 7205, km2: 1525, cabecera: "La Candelaria", ambiente: "yungasChaco" },
  Molinos: { poblacion: 5820, km2: 3600, cabecera: "Molinos", ambiente: "monte" },
  Guachipas: { poblacion: 3491, km2: 2785, cabecera: "Guachipas", ambiente: "yungasChaco" },
  "La Poma": { poblacion: 1789, km2: 4447, cabecera: "La Poma", ambiente: "puna" },
};

type Geo = { features: { properties: { nombre: string }; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon }[] };
let cache: Promise<Geo> | null = null;
const cargar = () => (cache ??= fetch("/salta-departamentos.geojson").then((r) => r.json() as Promise<Geo>));

function dentro(x: number, y: number, ring: number[][]): boolean {
  let c = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
    const [xi, yi] = ring[i];
    const [xk, yk] = ring[k];
    if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) c = !c;
  }
  return c;
}

/** Nombre del departamento de Salta donde cae el punto, o null si cae afuera. */
export async function departamentoDe(lat: number, lon: number): Promise<string | null> {
  const g = await cargar();
  for (const f of g.features) {
    const polis = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polis.some((p) => dentro(lon, lat, p[0]) && !p.slice(1).some((h) => dentro(lon, lat, h)))) return f.properties.nombre.normalize("NFC");
  }
  return null;
}

/** Radio alrededor del fuego para contar gente cerca. */
export const RADIO_KM = 5;

/** Personas que viven a menos de RADIO_KM, con la densidad promedio del departamento (estimación gruesa). */
export function genteCerca(depto: string, areaHa: number): number | null {
  const d = DEPTOS[depto.normalize("NFC")];
  if (!d) return null;
  const km2 = Math.PI * RADIO_KM * RADIO_KM + areaHa / 100;
  const n = (d.poblacion / d.km2) * km2;
  return n < 100 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100;
}

/** Una cancha de fútbol de 105 × 68 m tiene unas 0,714 ha. */
export const canchas = (ha: number) => Math.round(ha / 0.714);
