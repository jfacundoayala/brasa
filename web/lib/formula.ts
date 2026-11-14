// Fórmula Brasa: cuánto dinero hace falta para un incendio.
// Se explica en docs/producto/FORMULA-BRASA.md. Cada número tiene su fuente; los factores son la calibración de Brasa
// sobre esas fuentes, y se ajustan con los costos reales que nos den los cuarteles.
//
//   Combate     = superficie × costo por ha × intensidad × clima × ambiente
//   Aéreo       = horas de avión hidrante × costo por hora           (solo si el fuego es fuerte)
//   Asistencia  = viviendas cerca × ayuda por vivienda               (gente afectada)
//   TOTAL       = Combate + Aéreo + Asistencia

import { AMBIENTE, DEPTOS, type Ambiente } from "./zonas";

/**
 * Costo por hectárea, solo como respaldo: la web usa el que lee del contrato.
 * La base de 320 USD sale de fuentes oficiales de Chile y Estados Unidos. El Comandante Mayor de Bomberos
 * Voluntarios de Salta la validó y estuvo de acuerdo en subirla a 400.
 */
export const COSTO_HA = 400;
/** Hora de avión hidrante en Argentina: entre 3.000 y 5.000 USD (Infobae, 2022). Se usa el medio. */
export const HORA_AVION = 4000;
/** Ayuda por vivienda afectada: Suplemento Único para la Reconstrucción, $800.000 por vivienda (AFE, 2025). */
export const AYUDA_VIVIENDA_ARS = 800_000;
/** Personas por hogar en Salta: 3,68 (INDEC, EPH 3er trimestre 2022). */
export const PERSONAS_POR_HOGAR = 3.68;
/** Radio en el que se cuentan viviendas afectadas. */
export const RADIO_AFECTADOS_KM = 2;

/** Intensidad por potencia del fuego (FRP en MW), con las clases de la guía VIIRS de NOAA/CIRA. */
export function factorIntensidad(frp: number | undefined): { f: number; clase: string } {
  if (!frp || frp <= 10) return { f: 1, clase: "baja (hasta 10 MW)" };
  if (frp <= 35) return { f: 1.15, clase: "moderada (11 a 35 MW)" };
  if (frp <= 100) return { f: 1.3, clase: "alta (36 a 100 MW)" };
  if (frp <= 350) return { f: 1.5, clase: "muy alta (101 a 350 MW)" };
  return { f: 1.8, clase: "extrema (más de 350 MW)" };
}

export type Clima = { temp: number; humedad: number; viento: number; lluvia7d: number; vientoDesde: number };

/** Clima de hoy en el lugar: regla 30-30-30 (más de 30 °C, menos de 30 % de humedad, viento de más de 30 km/h) y sequía. */
export function factorClima(c: Clima | null): { f: number; detalle: string[] } {
  if (!c) return { f: 1, detalle: [] };
  const d: string[] = [];
  let f = 1;
  if (c.temp > 30) { f += 0.15; d.push(`calor (${Math.round(c.temp)} °C)`); }
  if (c.humedad < 30) { f += 0.15; d.push(`aire seco (${Math.round(c.humedad)} %)`); }
  if (c.viento > 30) { f += 0.15; d.push(`viento fuerte (${Math.round(c.viento)} km/h)`); }
  if (c.lluvia7d < 1) { f += 0.1; d.push("sin lluvia en 7 días"); }
  return { f: Math.round(f * 100) / 100, detalle: d };
}

/** Ambiente: el bosque nativo tiene más combustible y más valor que la estepa. */
export const FACTOR_AMBIENTE: Record<Ambiente, number> = { yungas: 1.25, chaco: 1.2, yungasChaco: 1.2, monte: 1, puna: 0.8 };

/** Horas de avión hidrante según el nivel y la intensidad. */
export function horasAvion(nivel: 1 | 2 | 3, frp: number | undefined): number {
  if (nivel === 3 || (frp ?? 0) > 350) return 6;
  if (nivel === 2 || (frp ?? 0) > 100) return 2;
  return 0;
}

export type Calculo = {
  ha: number;
  intensidad: ReturnType<typeof factorIntensidad>;
  clima: ReturnType<typeof factorClima>;
  ambiente: { nombre: string; f: number } | null;
  combate: number;
  horas: number;
  aereo: number;
  viviendas: number;
  asistencia: number;
  total: number;
};

/** Todo en USD (= USDC). `dolar`: pesos por dólar, para pasar la ayuda por vivienda a dólares. */
export function calcular(p: {
  areaHa: number;
  nivel: 1 | 2 | 3;
  frpMax?: number;
  depto: string | null;
  clima: Clima | null;
  dolar: number | null;
  /** Costo por hectárea leído del contrato (USD). Sin dato, COSTO_HA. */
  costoHa?: number;
}): Calculo {
  const intensidad = factorIntensidad(p.frpMax);
  const clima = factorClima(p.clima);
  const d = p.depto ? DEPTOS[p.depto] : null;
  const ambiente = d ? { nombre: AMBIENTE[d.ambiente].nombre, f: FACTOR_AMBIENTE[d.ambiente] } : null;
  const combate = p.areaHa * (p.costoHa ?? COSTO_HA) * intensidad.f * clima.f * (ambiente?.f ?? 1);
  const horas = horasAvion(p.nivel, p.frpMax);
  const aereo = horas * HORA_AVION;
  let viviendas = 0;
  if (d) {
    const km2 = Math.PI * RADIO_AFECTADOS_KM ** 2 + p.areaHa / 100;
    viviendas = Math.max(1, Math.round(((d.poblacion / d.km2) * km2) / PERSONAS_POR_HOGAR));
  }
  const asistencia = p.dolar ? (viviendas * AYUDA_VIVIENDA_ARS) / p.dolar : 0;
  const r = (x: number) => Math.round(x / 10) * 10;
  return {
    ha: p.areaHa,
    intensidad,
    clima,
    ambiente,
    combate: r(combate),
    horas,
    aereo,
    viviendas,
    asistencia: r(asistencia),
    total: r(combate) + aereo + r(asistencia),
  };
}

/** Clima actual y lluvia de los últimos 7 días en el punto (Open-Meteo, sin clave). */
export async function climaEn(lat: number, lon: number): Promise<Clima | null> {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&daily=precipitation_sum&past_days=7&forecast_days=1";
  try {
    const j = await (await fetch(u)).json();
    const lluvias: number[] = (j.daily?.precipitation_sum ?? []).slice(0, 7);
    return {
      temp: j.current.temperature_2m,
      humedad: j.current.relative_humidity_2m,
      viento: j.current.wind_speed_10m,
      lluvia7d: lluvias.reduce((a, x) => a + (x ?? 0), 0),
      vientoDesde: j.current.wind_direction_10m,
    };
  } catch {
    return null;
  }
}
