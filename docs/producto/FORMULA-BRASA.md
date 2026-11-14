# Fórmula brasa y alerta temprana

> Qué calcula la web cuando tocás un incendio, de dónde sale cada número y qué agrega el satélite GOES-19.
> Código: `web/lib/formula.ts`, `web/lib/zonas.ts` y `web/lib/goes.ts`.

## 1. La fórmula

```
Combate     = hectáreas × 400 USDC × intensidad × clima × ambiente
Avión       = horas de avión hidrante × 4.000 USDC
Vecinos     = viviendas a menos de 2 km × $800.000 (pasado a USDC al dólar oficial)
TOTAL       = Combate + Avión + Vecinos
```

| Pieza | Valor | De dónde sale |
|---|---|---|
| Hectáreas | focos × 14 ha | Cada foco VIIRS es un píxel de unos 375 m; brasa toma 14 ha por foco |
| Costo por hectárea | 400 USDC | Base de 320: Chile, Ministerio de Hacienda, emergencia 2023 (US$ 140 M sobre unas 440 mil ha). El Comandante Mayor de Bomberos Voluntarios de Salta dijo que 320 está bien y que 400 es mejor: el contrato v3 usa 400 |
| Intensidad | 1 a 1,8 | Potencia del fuego (FRP, en MW) que mide el satélite, en las clases de la guía VIIRS de NOAA/CIRA: hasta 10, 11 a 35, 36 a 100, 101 a 350, más de 350 MW |
| Clima | 1 a 1,55 | Open-Meteo en el punto del incendio. Suma 0,15 por cada parte de la regla 30-30-30 (más de 30 °C, menos de 30 % de humedad, viento de más de 30 km/h) y 0,1 si no llovió en 7 días |
| Ambiente | 0,8 a 1,25 | Yungas 1,25; Chaco 1,2; monte 1; puna 0,8. El bosque nativo tiene más combustible que la estepa |
| Avión hidrante | 0, 2 o 6 h | Nivel 2 o más de 100 MW: 2 h. Nivel 3 o más de 350 MW: 6 h. La hora cuesta USD 3.000 a 5.000 (Infobae 2022); se usa 4.000 |
| Vecinos | $800.000 por vivienda | Suplemento Único para la Reconstrucción (AFE). Viviendas = personas en 2 km ÷ 3,68 personas por hogar (INDEC, EPH 2022). Personas con la densidad del departamento, Censo 2022 |

**Ejemplo (incendio de nivel 3 en Rivadavia, 210 ha, 1.219 MW):**
combate 210 × 400 × 1,8 × 1,2 = 181.440; avión 6 h × 4.000 = 24.000; vecinos 6 viviendas = 3.060. **Total ≈ 208.500 USDC.**

**Cómo se usa:** la fórmula muestra al donante cuánto hace falta en cada incendio. Hoy: el contrato libera con la regla
pública de la zona (focos confirmados × 14 ha × 400 USDC). Paso siguiente: que el oráculo firme el monto de la fórmula.
Los factores se calibran con los costos reales de los cuarteles (combustible, viáticos, equipos).

### Capa 1: calibración con grandes incendios
La base de costo por hectárea sale de 12 temporadas y emergencias con costo oficial (Chile 2017 y 2023, Estados Unidos 2014–2023; unas 29 millones de ha). Cuenta: gasto de respuesta ÷ hectáreas. Rango 251 a 2.904 USD/ha, mediana ~864. La base de partida fue 320, el costo latinoamericano (Chile, entre 251 y 635), porque los precios de Salta se parecen más a los de Chile. Con el acuerdo del Comandante Mayor de Bomberos Voluntarios de Salta, el contrato v3 usa 400. En incendios extremos la Capa 2 (intensidad × clima × ambiente) lleva la base hasta ~1.116 USD/ha. Datos y fuentes en `web/lib/referencias.ts` (EE.UU.: [NIFC, Federal Firefighting Costs](https://www.nifc.gov/fire-information/statistics/suppression-costs), gasto federal sobre todas las hectáreas del país: es un piso). Paso siguiente: sumar más temporadas con costo oficial y los gastos reales de los cuarteles de Salta.

### Capa 2: lo que miden los satélites ahora
Superficie (focos × 14 ha), fuerza del fuego (FRP), clima (30-30-30 y lluvia), viento, ambiente y gente cerca. Ver la sección 1.

### De dónde sale el reparto (280 / 40 / 80 en el v3; 224 / 48 / 48 en el v2)
[Informe de Hacienda de Chile al 3/4/2023](https://www.hacienda.cl/areas-de-trabajo/politicas-macroeconomicas/informes/informe-de-costos-de-incendios-forestales-al-3-de-abril), sección III (datos de DIPRES), gasto directo de enero y febrero de 2023:

| Categoría | US$ M | % |
|---|---|---|
| Combate | 76,6 | 69,4 % |
| Reconstrucción | 16,6 | 15,0 % |
| Apoyo a personas | 9,4 | 8,5 % |
| Apoyo a sectores productivos | 0,3 | 0,3 % |
| Otros (combustible, caminos, ropa de protección, viáticos) | 7,5 | 6,8 % |
| **Total** | **110,3** | 100 % |

- **Combate 70 %** (280 de 400 en el v3; 224 de 320 en el v2): respaldado por el 69,4 %.
- **En el v3, logística 10 % y asistencia 20 %.** El 30 % que no es combate coincide con el 30,6 % oficial. Chile gastó más en personas (23,8 %) que en "otros" (6,8 %), y por eso la asistencia pesa más. En el v2 era 15 % y 15 %. Se recalibra con los tickets y facturas de los cuarteles de Salta.
- **320 USD/ha** queda entre ~251 (2023, solo gasto directo sobre ~440 mil ha) y 635 (2017, CONAF, citado en la nota 8 del informe). Con el costo fiscal total de 2023 (139,8 M, directo e indirecto) da ~318.

## 2. Alerta temprana con GOES-19

- **Qué es:** un satélite geoestacionario de NOAA que mira toda Sudamérica **cada 10 minutos**. Los NOAA-20 y 21 pasan solo unas
  2 veces por día cada uno.
- **De dónde lo sacamos:** el programa Queimadas del INPE (Brasil) publica los focos GOES cada 10 minutos en archivos abiertos:
  `dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/`. La web los lee directo, sin clave.
- **Qué muestra:** un círculo amarillo que late en el mapa ("posible foco, sin confirmar") y un aviso arriba del mapa con
  cuántos hubo en Salta en la última hora.
- **Por qué no mueve fondos:** el píxel de GOES es grande (unos 2 km). Sirve para avisar rápido. Los fondos se mueven
  solo cuando los dos VIIRS de la NASA confirman.

**GOES avisa en minutos, la NASA confirma en horas, Avalanche libera en segundos.**

## 3. Hacia dónde avanza

Con la dirección del viento de Open-Meteo, la tarjeta dice hacia dónde lo empuja el viento (por ejemplo "hacia el suroeste a
11 km/h"). Es una guía simple: el relieve y el combustible también cuentan.

## 4. Referencias en AVAX y en $

Los montos se muestran en USDC y, como referencia, en AVAX (precio de CoinGecko) y en $ (dólar oficial de venta de DolarApi).
Al fondo siempre llega USDC.
