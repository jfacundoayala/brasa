// Calibración de la Fórmula Brasa con los grandes incendios del mundo.
// Cada caso es una temporada o emergencia con costo oficial publicado. La cuenta es simple y se puede repetir:
//   costo por hectárea = gasto de respuesta (USD) / hectáreas quemadas
// Se explica en docs/producto/FORMULA-BRASA.md y en la página /fundamentos.

export type Caso = {
  lugar: string;
  periodo: string;
  hectareas: number;
  gastoUsd: number;
  /** Qué incluye el gasto, en pocas palabras. */
  incluye: string;
  fuente: string;
  url: string;
};

const NIFC = "https://www.nifc.gov/fire-information/statistics/suppression-costs";
const ACRE = 0.404686;
/** EE.UU.: gasto federal de supresión sobre el total de acres del país (piso: no suma gasto estatal). Dólares de cada año. */
const eeuu = (anio: number, acres: number, total: number): Caso => ({
  lugar: "Estados Unidos",
  periodo: String(anio),
  hectareas: Math.round(acres * ACRE),
  gastoUsd: total,
  incluye: "Supresión federal (Forest Service e Interior)",
  fuente: "NIFC, Federal Firefighting Costs (Suppression Only)",
  url: NIFC,
});

export const CASOS: Caso[] = [
  {
    lugar: "Chile",
    periodo: "2023 (febrero)",
    hectareas: 440_000,
    gastoUsd: 110_300_000,
    incluye: "Gasto fiscal directo de enero y febrero: combate, reconstrucción, ayuda a personas",
    fuente: "Ministerio de Hacienda de Chile con datos de DIPRES, informe al 3/4/2023",
    url: "https://www.hacienda.cl/areas-de-trabajo/politicas-macroeconomicas/informes/informe-de-costos-de-incendios-forestales-al-3-de-abril",
  },
  {
    lugar: "Chile",
    periodo: "2017 (tormenta de fuego)",
    hectareas: 570_000,
    gastoUsd: 362_200_000,
    incluye: "Costos del Estado en la temporada, según CONAF",
    fuente: "CONAF, citado por CR2 (2020) y por el informe de Hacienda de Chile (nota 8)",
    url: "https://www.hacienda.cl/areas-de-trabajo/politicas-macroeconomicas/informes/informe-de-costos-de-incendios-forestales-al-3-de-abril",
  },
  eeuu(2014, 3_595_613, 1_522_149_000),
  eeuu(2015, 10_125_149, 2_130_543_000),
  eeuu(2016, 5_503_538, 1_975_545_000),
  eeuu(2017, 10_026_086, 2_918_165_000),
  eeuu(2018, 8_767_492, 3_143_256_000),
  eeuu(2019, 4_664_364, 1_590_000_000),
  eeuu(2020, 10_122_336, 2_274_000_000),
  eeuu(2021, 7_125_643, 4_389_000_000),
  eeuu(2022, 7_577_183, 3_549_000_000),
  eeuu(2023, 2_693_910, 3_166_300_000),
];

export const porHa = (c: Caso) => c.gastoUsd / c.hectareas;

export function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Resumen de la calibración: cuántos casos, cuántas hectáreas, rango y mediana del costo por hectárea. */
export function calibracion(casos: Caso[] = CASOS) {
  const valores = casos.map(porHa);
  const latam = casos.filter((c) => c.lugar === "Chile").map(porHa);
  return {
    casos: casos.length,
    hectareas: casos.reduce((s, c) => s + c.hectareas, 0),
    min: Math.min(...valores),
    max: Math.max(...valores),
    mediana: mediana(valores),
    latamMin: Math.min(...latam),
    latamMax: Math.max(...latam),
  };
}

/** Gasto real de Chile 2023 por categoría (DIPRES): de acá sale que 70 % de la meta sea apagar el fuego. */
export const REPARTO_CHILE_2023 = [
  { categoria: "Combate", usdM: 76.6 },
  { categoria: "Reconstrucción", usdM: 16.6 },
  { categoria: "Apoyo a personas", usdM: 9.4 },
  { categoria: "Apoyo a sectores productivos", usdM: 0.3 },
  { categoria: "Otros (combustible, caminos, ropa de protección, viáticos)", usdM: 7.5 },
];
