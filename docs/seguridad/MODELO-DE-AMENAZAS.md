# Modelo de amenazas

Qué partes tiene brasa, en quién confía cada una, qué hay que proteger y qué frena cada ataque. Complementa a [`SECURITY.md`](../../SECURITY.md), que lista las medidas, y a [`LEEME.md`](LEEME.md), que lista las revisiones del contrato.

Hoy corre en la red de prueba de Stellar, con USDC de prueba.

## Componentes

| Parte | Código | Qué hace |
|---|---|---|
| Contrato | `avalanche/contracts/BrasaFund.sol` | Guarda el fondo, verifica las firmas y libera el dinero. No tiene función de retiro |
| Oráculo | `relayer/src/` | Baja los focos de NASA FIRMS, cruza los dos satélites, calcula la huella y firma los reportes |
| Buzón de firmas | `relayer/src/buzon.mjs` | Cada firmante publica su firma y quien envía junta el par |
| Web | `web/` | Mapa público y donación desde la billetera del visitante. Está alojada en Vercel |
| Scripts | `avalanche/scripts/` | Despliegue, alta de la federación y asignación de cuarteles |
| Hook local | `.githooks/` | Frena un commit que tenga una clave privada |

## Quién puede hacer qué

- **Cualquiera:** donar (`donateToZone`, `donateToRecipient`) y enviar un par de reportes ya firmados (`reportFire`).
- **Federación:** crear zonas, acreditar y dar de baja destinatarios, asignar cuarteles a un incendio, proponer o cancelar el cambio de una clave de firma y traspasar su rol. No puede mover el fondo.
- **Dos firmantes,** uno por satélite: firmar reportes. Ninguno puede liberar solo.
- **Visitante de la web:** solo lee. Firma sus donaciones con su propia billetera.

## Qué hay que proteger

1. El saldo en USDC de cada zona.
2. Que el dinero llegue solo a los cuarteles asignados y a las entidades de asistencia acreditadas, con la regla pública.
3. Las claves de los dos firmantes y la de la federación.
4. La dirección del contrato que usa la web (`web/public/deployment.json`).

## Amenazas y qué las frena

| Qué intenta alguien | Qué lo frena |
|---|---|
| Enviar a `report_fire` un reporte inventado | El contrato exige que cada reporte lo autorice la cuenta del oráculo de ese satélite. Son dos cuentas y dos satélites distintos |
| Usar la clave robada de un oráculo | Un solo reporte no libera nada. La federación cambia ese oráculo con una propuesta pública y una demora |
| Repetir un reporte, o usarlo en otra red o en otro contrato | Cada autorización vale una sola vez, para esa red y ese contrato. Un mismo dato de la NASA libera una sola vez |
| Liberar con datos viejos | El reporte vale 6 horas, el dato 24 horas y los dos satélites tienen que haber visto el fuego con menos de 3 horas de diferencia |
| Cobrar de más | La meta es el techo: `focos × 14 ha × costo por hectárea`, con el menor de los dos conteos. Hay un tope por incendio y una espera entre liberaciones |
| Acreditarse justo antes de un incendio para cobrar | Una credencial nueva queda visible en la cadena y recién cobra pasada la demora |
| Desviar la parte de los bomberos a otro cuartel | Cobran solo los cuarteles que la federación asignó a ese incendio. Sin asignación, el fondo no libera |
| Cambiar la regla de una zona después de recibir donaciones | Los parámetros de la zona y la comisión quedan fijos al crearse |
| Publicar una firma falsa en el buzón | El buzón acepta solo a los firmantes, y el contrato comprueba cada firma contra las dos claves registradas |
| Alterar los datos externos que muestra la web | Solo cambia lo que se ve. La meta que libera el contrato sale de los reportes firmados |
| Cambiar la dirección del contrato en la web | El archivo entra por pull request con tests. La dirección está publicada y la billetera la muestra antes de firmar |
| Trabar todos los pagos con una cuenta que no puede cobrar | Ese monto queda en el fondo y los demás destinatarios cobran igual |
| Reentrar al contrato durante un pago | La red no permite reentradas, y el contrato usa un único token, fijado al desplegar |
| Cobrar por una quema de campo o una chimenea | Las capas de detección descartan fuentes fijas, focos sobre cultivos, focos sueltos y lo que no persiste dos días |
| Subir una clave privada al repo | `.gitignore`, un hook local y el CI buscan claves en cada cambio. Las claves de firma no están en ningún servidor |
| Comprometer una dependencia | Versiones exactas y lockfiles en `stellar/`, `relayer/` y `web/` |

## Servicios externos de la web

El navegador consulta NASA FIRMS (a través de un archivo que genera el CI), el servidor de focos GOES-19 del INPE, Open-Meteo, dolarapi.com, el nodo público de la red de prueba de Stellar, las imágenes satelitales de Esri, el relieve de AWS y un servicio de datos de órbita, con una copia de respaldo en el repo. Ninguno de esos datos entra al contrato.

## Límites de esta etapa

Hoy el equipo opera las dos claves de firma y la federación. Qué cambia en el piloto: tabla "Hoy y paso siguiente" de [`SECURITY.md`](../../SECURITY.md#hoy-y-paso-siguiente). La auditoría externa es el paso previo a la red principal.
