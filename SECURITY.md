# Seguridad

> Hoy brasa corre en la red de prueba de Stellar, con USDC de prueba. El código es público y verificable. La auditoría externa es el paso previo a la red principal.

## Medidas aplicadas
- **El contrato no tiene función para retirar el fondo.** Solo paga a destinatarios con credencial, según una regla pública (focos confirmados × 14 ha × costo por hectárea). Los tests lo comprueban.
- **Dos oráculos para liberar:** cada pago necesita dos reportes de dos oráculos distintos, sobre dos satélites distintos. Cada oráculo es una cuenta de Stellar que autoriza solo su reporte, y la red impide repetir una autorización o usarla en otra red.
- **Un dato paga una sola vez:** el mismo dato de la NASA no puede liberar dos pagos.
- **Huella del dato:** cada pago guarda el hash de los datos de NASA FIRMS. Cualquiera lo recalcula: [`docs/tecnico/VERIFICAR-HUELLA.md`](docs/tecnico/VERIFICAR-HUELLA.md).
- **Cuartel asignado:** la parte de los bomberos va solo al cuartel que la federación asignó a ese incendio. Sin asignación, el fondo no paga.
- **Credenciales con demora pública:** una credencial nueva queda visible en la cadena antes de poder cobrar.
- **Oráculos con rotación controlada:** se cambian de a una, con propuesta pública y demora.
- **Comisión con tope fijo:** `MAX_FEE_BPS = 500` (5 %), fija al desplegar.
- **Contrato:** parámetros de zona que no se pueden editar; topes fijos para demoras, costos y pagos por incendio; las propuestas de cambio vencen solas. 32 tests. Oráculo: 63 tests.
- **Capas de detección:** el oráculo descarta fuentes fijas, focos sobre cultivos, focos sueltos y lo que no se ve en dos días distintos, antes de contar.
- **Claves fuera del repo:** `.gitignore` excluye `.env*`, claves y firmas. Un hook local (`.githooks/pre-commit`) y el CI (`.github/workflows/tests.yml`) buscan claves privadas en cada cambio. Ninguna clave de oráculo vive en un servidor ni en el CI.
- **Dependencias con versión exacta** y lockfiles en `stellar/`, `relayer/` y `web/`.

Qué se revisó y qué se corrigió en el contrato: [`docs/seguridad/LEEME.md`](docs/seguridad/LEEME.md). Qué frena cada ataque: [`docs/seguridad/MODELO-DE-AMENAZAS.md`](docs/seguridad/MODELO-DE-AMENAZAS.md).

## Hoy y paso siguiente

| Hoy | Paso siguiente |
|---|---|
| Los dos oráculos los opera el equipo: dos personas, dos cuentas, dos computadoras. Ninguna puede pagar sola | Un oráculo para la federación de bomberos y otro para un operador externo. El contrato ya lo permite, sin mover el fondo |
| La billetera "federación", que da credenciales y asigna cuarteles, la opera el equipo | La federación de bomberos, con firma de varias personas |
| Demoras públicas de 1 hora en la red de prueba | 72 h para credenciales y 48 h para oráculos en el piloto |
| Cualquiera recalcula la huella de los datos de cada pago | Red de oráculos de varios operadores independientes |
| Dos satélites de la NASA: VIIRS NOAA-20 y NOAA-21 | Un segundo proveedor de datos satelitales |
| Seis capas de detección: alta confianza, fuentes fijas, uso del suelo, agrupación, dos satélites y persistencia | Control posterior con imágenes de 10 m y registro de quemas autorizadas |
| 32 tests del contrato, 63 del oráculo y búsqueda de claves en cada cambio | Auditoría externa, fuzzing y análisis estático en el CI |

Plan completo: [`docs/producto/roadmap.md`](docs/producto/roadmap.md).

## Cómo reportar un problema
Escribí por privado a los mantenedores del repositorio (Juan Facundo Ayala o Gastón Persoglia), por GitHub. **No abras un issue público** con el detalle de una vulnerabilidad.
