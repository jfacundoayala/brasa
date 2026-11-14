# Roadmap: de Salta al mundo

> Hoy: **contrato v3 funcionando en Avalanche Fuji (testnet), con Salta como primera zona**. Paso siguiente: piloto en red principal. Lo que sigue es el plan. Actualizada el 13/11/2026.

## Visión
**Que cualquier persona del mundo pueda ayudar, en minutos, a los bomberos y a la gente afectada por un incendio, en cualquier lugar.**
Empezamos por Salta y el objetivo final son los incendios de todo el mundo.

## Metas a largo plazo
1. **Avisar antes.** Detección temprana de focos con satélites que miran cada pocos minutos (hoy GOES-19), confirmación con la NASA y, después, más fuentes: cámaras, sensores en el terreno, avisos de vecinos y brigadistas.
2. **Ayudar a combatirlo mejor.** Darles a bomberos y brigadas datos útiles: hacia dónde avanza el fuego, clima, potencia del fuego, gente cerca, cuartel más cercano.
3. **Que el dinero llegue a tiempo.** Donaciones desde cualquier país, con cualquier moneda de Avalanche, que llegan en segundos y a la vista a cuarteles verificados.
4. **Cuidar a la gente.** Ayuda a evacuados y afectados: vivienda, comida, ropa, salud, junto con las autoridades.
5. **Coordinar, no competir.** Trabajar con Defensa Civil, la federación de bomberos, el Servicio Nacional de Manejo del Fuego, ayuda humanitaria y organizaciones de donaciones. La plataforma brasa suma datos y fondos; la decisión en el terreno es de ellos.
6. **Mover a la comunidad.** Campañas en nuestras redes para juntar fondos, ropa y alimentos, y contar historias reales de bomberos y vecinos (con su permiso), siempre de la mano de las autoridades.

## Por qué escala (lo que ya está en el diseño)
| Pieza | Hoy (Salta) | Para otra región |
|---|---|---|
| Datos | NASA FIRMS, cubre todo el planeta, gratis | Mismo dato, otro rectángulo y polígono |
| Zona | `createZone("salta", …)` en el contrato | Otra llamada a `createZone` (otra provincia, país o región) |
| Polígono | `sample-data/salta-provincia.geojson` | Un GeoJSON por zona (límites oficiales de cada país) |
| Reglas | Focos mínimos, cooldown, tope, costo por hectárea | Parámetros por zona, cargados por la federación local |
| Destinatarios | Cuarteles y entidades con credencial | Cada país carga los suyos (bomberos voluntarios, defensa civil, ONG) |
| Moneda | USDC | La misma en todos lados; no depende del banco local |

**Qué se ajusta en cada lugar:** los costos por hectárea, que se miden con la federación local. También la normativa de donaciones de cada país y las listas de quemas agrícolas autorizadas.

## Etapas
| Etapa | Alcance | Qué hace falta |
|---|---|---|
| 0. Hackathon | Salta, testnet, USDC de prueba | Lo que hay en este repo |
| 1. Piloto Salta | Salta, red principal, montos chicos | Convenio con la federación de bomberos, auditoría externa, multisig y timelock, límites del IGN, costos medidos con los cuarteles |
| 2. NOA y NEA | Jujuy, Tucumán, Catamarca, Santiago del Estero, La Rioja (NOA); Chaco, Formosa, Misiones, Corrientes (NEA) | Una zona y un polígono por provincia, convenios con cada federación y Defensa Civil provincial |
| 3. Argentina | Todo el país (Córdoba, Patagonia, Delta, etc.) | Convenios provinciales y con el Servicio Nacional de Manejo del Fuego |
| 4. Latinoamérica | Chile, Bolivia, Paraguay, Brasil, Colombia y más | Marco legal por país, federaciones locales, idioma, polígonos oficiales |
| 5. Mundial | Incendios de todo el mundo | Red de oráculos de varios operadores, gobernanza de zonas, quizás una L1 propia |

## Qué cambia con la escala
- **Oráculos:** hoy dos claves que opera el equipo, sobre dos sensores de NASA. A escala: varios operadores independientes (universidades, ONG, institutos de cada país) y un quórum. Es el patrón "varios relayers" del track.
- **Otras fuentes:** otros satélites (por ejemplo GOES), datos meteorológicos y sismos, para sumar otros desastres.
- **Agrupar focos en incendios**, en vez de contar focos sueltos por zona.
- **Zonas más chicas** (departamentos, parques) para que la ayuda llegue al lugar exacto.
- **Rendición de gastos con pago por tramos.** El fondo no se libera todo junto. El contrato paga un primer tramo y libera el siguiente cuando el cuartel sube a la red la huella de sus comprobantes: facturas y tickets de compra. Tres reglas:
  - **Libera el contrato, no brasa.** El equipo no tiene ninguna llave sobre el fondo, igual que hoy.
  - **Audita un tercero.** El guardián o gestor de pagos revisa cada comprobante y puede frenar el tramo siguiente.
  - **El donante lo ve.** Cada comprobante queda ligado al pago que lo cubrió, en el registro público. El documento no se publica: solo su huella.
- **Costos y gas:** Avalanche C-Chain alcanza para empezar; con miles de zonas se evalúa una L1 propia.

## Próxima versión del contrato
Las etapas A y B ya están desplegadas en el v3 (detalle en [`../tecnico/CONTRATO-V3.md`](../tecnico/CONTRATO-V3.md)) (mínimo de 0,01 USDC, 400 USD por hectárea, reparto 80 / 20, cuartel asignado por la federación, rotación de claves). Queda la etapa C: compromisos, completar la meta con lo donado después, donar con una sola firma y donar desde un exchange, además de con la billetera conectada.

## Próximos pasos decididos
Cada paso lleva la fecha en que se decidió.

| Qué | Por qué | Costo o condición | Anotado |
|---|---|---|---|
| **Comprar el dominio `brasa.fund`** y apuntarlo a la web | Hoy la web está en `brasafund.vercel.app`. `brasa.fund` es más corto y dice lo que es | USD 15,99 el primer año y USD 65 por año la renovación (precio de Vercel al 12/11/2026) | 12/11/2026 |
| **Oracle Cloud** para lo que necesita una máquina siempre prendida | Nodos validadores de una L1 de brasa (federaciones y proveedores de datos como validadores) y un relayer propio de cada federación | Créditos de Oracle del premio | 12/11/2026 |
| **Chainlink CRE** como oráculo de terceros | Que el dato lo lleve a la cadena una red que no somos nosotros | Pedir acceso para desplegar workflows (`cre account access`) | 12/11/2026 |
| **Federación real con multisig** y demora de 72 h para credenciales nuevas | Que el equipo no pueda dar de alta una wallet propia | Convenio con una federación de bomberos | 12/11/2026 |
| **Rotación de oráculos con timelock** | Hoy: el v3 rota las claves de a una, con demora pública. Paso siguiente: que la rotación la apruebe la federación con varias firmas | Demora larga y evento público | 12/11/2026 |
| **Donar con cualquier moneda de Avalanche** (AVAX, USDT y otras) | Que cualquiera done con lo que tiene en su wallet. Un exchange de Avalanche (LFJ u otro) cambia la moneda a USDC en el momento y al fondo llega siempre USDC | El cambio lo hace el donante desde su propia billetera, en un exchange descentralizado. Así la plataforma sigue fuera del régimen de PSAV (ver [`../legal/POSICION-PSAV-Y-FONDOS.md`](../legal/POSICION-PSAV-Y-FONDOS.md)). Auditar el contrato de cambio | 12/11/2026 |
| **Donar en AVAX** (primer paso de la fila anterior) | Guiño a Avalanche: se recibe AVAX y se cambia a USDC justo antes de pagar al cuartel | Mismo diseño; precio con un oráculo de precios (por ejemplo Chainlink AVAX/USD) y límite de deslizamiento | 12/11/2026 |
| **Core, la wallet de Avalanche**, como wallet recomendada | Botón "Creá tu wallet en Core" para donantes y cuarteles que no tienen una | Sin costo | 12/11/2026 |
| **Oráculo profesional** | Hoy: cada oráculo corre en la computadora de un integrante del equipo. Para el piloto: servidores dedicados siempre prendidos, claves en un módulo de hardware (HSM o KMS), varios operadores independientes, monitoreo y alertas | Costo mensual de servidores y del servicio de claves; parte puede salir de los créditos de Oracle Cloud | 12/11/2026 |
| **El oráculo informa el monto de la Fórmula brasa** | Hoy el contrato libera focos × 14 ha × costo por ha; la fórmula completa (intensidad, clima, ambiente, avión, ayuda a vecinos) se muestra en la web. Paso siguiente: que el oráculo firme ese monto | Nueva versión del contrato y auditoría | 12/11/2026 |
| **Wallets oficiales con insignia de la federación** | Nadie carga su propia wallet: brasa y la federación dan de alta solo cuarteles reales y comprobados, y la web muestra la insignia | Convenio con la federación y alta de cada cuartel | 12/11/2026 |
| **Entrevistas y relatos** de bomberos y de vecinos afectados | Que el donante conozca a quién ayuda, con testimonios reales y con permiso | Grabarlas con consentimiento de cada persona | 12/11/2026 |
| **Más satélites y señales para avisar antes** | Hoy: GOES-19 cada 10 min (aviso) y VIIRS NOAA-20/21 (confirmación). Sumar: Sentinel-2 y Landsat para ver el área quemada en detalle, Sentinel-3, satélites de detección de incendios como FireSat, rayos (GLM de GOES), índice de peligro de incendio (FWI), cámaras en torres y avisos de brigadistas | Cada fuente con su licencia y su atribución | 12/11/2026 |
| **Bajar la demora de 3 horas** (prioridad para el piloto) | Hoy la NASA publica la confirmación (FIRMS, VIIRS) unas 3 horas después de que pasa el satélite. Eso atrasa el pago. Caminos: 1) confirmar con dos fuentes rápidas, por ejemplo GOES-19 cada 10 minutos más un segundo sensor geoestacionario o una cámara en torre; 2) recibir el dato directo del satélite con una antena propia o de un socio (estación de recepción directa en Argentina); 3) sumar constelaciones privadas de detección térmica que prometen avisos en minutos (FireSat, OroraTech u otras); 4) que el oráculo corra solo cada 10 minutos y firme apenas haya dato. Meta: pagar en menos de 1 hora desde la primera detección | Convenios de datos (CONAE, INPE u operadores privados) y una versión del contrato que acepte las nuevas fuentes. Cada fuente con su licencia | 12/11/2026 |
| **Campañas en redes** con autoridades | Juntar fondos, ropa y alimentos para evacuados; contar historias reales | Coordinado con Defensa Civil y organizaciones de ayuda | 12/11/2026 |
| **Excluir quemas agrícolas** | Que una quema autorizada no libere un pago | Capas de uso del suelo y registro de quemas autorizadas de la provincia | 12/11/2026 |
| **Separar las llaves** | Las dos llaves de oráculo ("hay fuego") las tienen dos operadores de datos independientes (universidad o instituto); la de credenciales ("este cuartel es real"), la federación de bomberos, que además audita la rendición. La plataforma brasa no tiene ninguna llave | Convenios con esos operadores y con la federación | 12/11/2026 |
| **Fondo de preparación** | Que los cuarteles puedan usar el fondo aunque no haya incendio, para prevención y preparación (equipos, combustible, capacitación), con un pedido público y la aprobación de la federación. Lo donado no se devuelve. Es lo que pidió el Comandante Mayor de Bomberos Voluntarios de Salta en la entrevista del 12/11: mejores herramientas, trajes y equipamiento nuevo (ver [`VALIDACION-BOMBEROS.md`](VALIDACION-BOMBEROS.md)) | Nueva versión del contrato | 12/11/2026 |
| **Reparto según la distancia** | Hoy: el v3 paga solo a los cuarteles que la federación asigna al incendio. Paso siguiente: que además cobre más el cuartel más cercano | Nueva versión del contrato | 12/11/2026 |
| **Donar con una sola firma y con tarjeta** | Hoy hacen falta dos transacciones (autorizar y donar). Con permit (EIP-2612) es una sola; con un proveedor de pagos, sin cripto | Proveedor regulado para tarjeta | 12/11/2026 |
| **Fuzzing, invariantes y análisis estático en el CI** | Sumar pruebas automáticas a los 62 tests del contrato. Código público y verificable; auditoría externa en el roadmap | Tiempo de desarrollo | 12/11/2026 |
| **Validar en Chaco, después de Argentina Space** | El equipo es de Chaco. Validar brasa en su provincia suma una segunda zona, con bomberos que el equipo conoce | Ya tomamos contacto con un bombero de la ciudad de Resistencia. Sigue la entrevista de validación | 13/11/2026 |
| **Medir los costos reales con el cuartel de Salta** | Los 400 USD por hectárea parten de datos oficiales de Chile y Estados Unidos, con el acuerdo del Comandante Mayor de Bomberos Voluntarios de Salta (12/11). Paso siguiente: calibrarlos con gastos medidos | Planilla de gastos del cuartel "Martín Miguel de Güemes" | 13/11/2026 |
| **Filtrar fuentes de calor fijas** | Una antorcha de gas o una industria también marcan un foco de calor. Se excluyen con una lista de puntos fijos | Medido el 13/11: pesan poco, 1 día de pago de cada 31 (ver [`FOCOS-QUE-NO-SON-INCENDIOS.md`](FOCOS-QUE-NO-SON-INCENDIOS.md)). La asignación de la federación cubre la quema de campo | 13/11/2026 |
| **Firma automática de los oráculos** | Hoy dos personas corren un comando para firmar. Con cada operador en su servidor, la firma sale sola apenas hay dato | Servidores de cada operador, con su clave protegida | 13/11/2026 |
| **Fondos por incendio** | Hoy: el fondo es de toda la provincia y el v3 paga a los cuarteles que la federación asigna al incendio. Paso siguiente: que el aporte quede ligado al incendio que el donante elige en el mapa | Zonas más chicas. Nueva versión del contrato | 13/11/2026 |
| **Convertir a pesos al recibir** | El cuartel recibe USDC y sus gastos son en pesos. La plataforma termina al llegar al cuartel; hay que dejarle una guía simple para cambiar | Guía con proveedores regulados en Argentina | 13/11/2026 |

## Riesgos de escalar
- Cada país tiene reglas distintas sobre donaciones, cripto y comprobantes. Cada zona nueva arranca con el marco legal de ese país ya definido y documentado.
- Con más dinero en juego, la clave de oráculo y la federación pasan a ser un blanco: multisig, rotación con timelock y auditoría externa son condición, no opcional.
- La plataforma brasa no custodia fondos y no es un seguro: la meta es un techo calculado con supuestos declarados.
