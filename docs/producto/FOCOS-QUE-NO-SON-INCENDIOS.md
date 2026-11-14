# Focos de calor que no son incendios: cuánto pesan en Salta

> Análisis del 13/11/2026 con datos oficiales de NASA FIRMS. Se puede repetir con [`relayer/analisis/persistencia.mjs`](../../relayer/analisis/persistencia.mjs).

## La pregunta

Un foco de calor es un píxel donde el satélite ve algo muy caliente. Puede ser un incendio. También puede ser una antorcha de gas, una chimenea o una quema de campo. ¿Puede algo así liberar un pago?

## Qué medimos

- **Datos:** el producto estándar de NASA FIRMS para los satélites NOAA-20 y NOAA-21. Es la versión revisada de los datos, y trae el atributo `type`, que marca las fuentes fijas.
- **Período:** del 1/8 al 29/10 de 2025, 90 días de la temporada seca.
- **Lugar:** el mismo polígono de Salta que usa el oráculo.
- **Regla:** la misma del oráculo. Solo focos de alta confianza, vistos por los dos satélites a menos de 2 km, con un mínimo de 2 por satélite.

## Resultados

| Medida | Resultado |
|---|---|
| Detecciones en Salta (NOAA-20 / NOAA-21) | 7.291 / 7.094 |
| De alta confianza | 620 / 594. Es el 8 % |
| Marcadas por la NASA como fuente fija (`type` 2) | **0** |
| Lugares de 1 km con detecciones | 2.735 |
| Lugares que se repiten 10 días o más | 16. Es el 0,6 % |
| Días con datos | 88 |
| Días que cumplen la regla de pago | **31** |
| Focos cruzados en esos días | 623 |
| Focos cruzados en lugares que se repiten | 37. Es el 6 % |
| Días que cumplen la regla solo por lugares que se repiten | **1 de 31** |
| Focos cruzados por día de pago | mínimo 2, mediana 5, máximo 15 |

**Lugares conocidos** (coordenadas aproximadas, radio de 5 km):

| Lugar | Detecciones | Días | Alta confianza |
|---|---|---|---|
| Refinería de Campo Durán | 12 | 8 | 1 |
| Ingenio El Tabacal | 196 | 23 | 13 |
| Ingenio San Isidro | 9 | 7 | 0 |

**Últimos 30 días** (datos en vivo, del 15/10 al 13/11 de 2026): 11 días con focos de alta confianza. La regla se cumplió 3 días: 22/10, 10/11 y 12/11.

## Conclusiones

1. **Las fuentes industriales fijas pesan poco.** La NASA no marcó ninguna en Salta en ese período. La refinería casi no da focos de alta confianza. Los dos filtros del oráculo, alta confianza y cruce de dos satélites, dejan afuera a casi todas.
2. **La quema de campo se resuelve en tierra.** La zona del ingenio El Tabacal tuvo 196 detecciones en 23 días. Para el satélite, una quema de caña se ve como un incendio. Por eso cuenta la confirmación de la federación, junto con el uso del suelo y el registro de quemas autorizadas.
3. **Los lugares que se repiten se identifican con la federación.** Los más repetidos están en el este de la provincia, en zona de desmonte y agricultura.
4. **La regla se cumple seguido.** En temporada seca, uno de cada tres días. La mayoría son fuegos chicos, de 2 a 5 focos. Por eso el pago necesita también la asignación del cuartel que salió.

## Cómo lo resuelve el diseño

- **La federación confirma quién combate cada incendio.** Los satélites dicen dónde hay fuego. La federación dice qué cuartel salió. El dinero va al cuartel que trabaja. Una quema de campo sin bomberos no cobra. Ya está en el contrato v3 (ver [`../tecnico/CONTRATO-V3.md`](../tecnico/CONTRATO-V3.md)).
- **Un mismo dato no paga dos veces.** El contrato v3 exige una pasada nueva de cada satélite, posterior al último pago.
- **Lista de lugares que se repiten.** Paso siguiente: que el oráculo descuente los focos de los lugares que aparecen 10 días o más en una temporada.

## Alcance del análisis

- Las coordenadas de la refinería y de los ingenios son aproximadas.
- El análisis cubre una temporada. Paso siguiente: repetirlo con más años.
