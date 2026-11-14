# Resumen de brasa en una página

**Cuando dos satélites de la NASA confirman un incendio, un contrato en Avalanche envía dólares digitales directo a bomberos y damnificados. Sin intermediarios. Con reglas públicas, a la vista de todos. Sirve en cualquier lugar del planeta; el piloto es Salta, Argentina.**

## El problema
Cuando hay un incendio grande, la ayuda llega tarde. Nadie sabe tres cosas: **cuánto dinero hace falta, a quién le llega y cuándo**. Los primeros días son los que más cuestan: justo cuando la ayuda más tarda. Quien dona no puede ver adónde llegó su aporte.

La escala es enorme, con datos oficiales:
- **Estados Unidos:** solo el gobierno federal gastó de **1.500 a 4.400 millones de dólares por año** en combatir incendios (NIFC, 2014–2023).
- **Chile:** unas **440 mil hectáreas** quemadas en 2023 (Hacienda de Chile). En 2017 fueron **570 mil** (CONAF).
- **Salta:** cerca de **95 mil hectáreas de bosque** afectadas en 2022 (Mongabay, con datos del Servicio Nacional de Manejo del Fuego). Otra vez incendios de semanas en 2025 (Infobae).
- **Bomberos voluntarios de Argentina, 2025:** un solo pago en febrero, después ninguno más (Chequeado).

**Lo validamos en el terreno.** Hicimos una entrevista de validación al Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta "Martín Miguel de Güemes" (ver [`VALIDACION-BOMBEROS.md`](../producto/VALIDACION-BOMBEROS.md)). En un solo incendio del área metropolitana se quemaron más de 700 hectáreas. Trabajaron unas 100 personas. Los bomberos salen en 5 a 10 minutos: lo que tarda es el dinero. Su cuartel rompió 3 mangueras, de alrededor de un millón de pesos cada una. El costo total de la operación nadie lo tiene calculado. Nos dijo que un fondo así los ayudaría mucho: mejores herramientas, trajes y equipamiento nuevo. El fondo calcula ese costo y lo cubre con donaciones.

## Qué hace brasa: cuatro herramientas en una
- **Detecta y confirma el fuego** con satélites de la NASA. Dos tienen que ver el mismo fuego, así se filtran las falsas alarmas.
- **Calcula el daño y cuánto hace falta** para cada incendio (fórmula de brasa). Ejemplo real: un incendio de nivel 3 en Rivadavia, Salta, de 210 ha, necesita **≈ 208.500 USDC** (combate 181.440 + avión hidrante 24.000 + damnificados 3.060).
- **Envía directo a bomberos y damnificados**, sin intermediarios que retengan o repartan mal.
- **Todo trazable:** cada dólar se ve desde la billetera del donante hasta su destino. El fondo no tiene función de retiro.

## Cómo funciona (y ya funciona)
1. **Detecta:** baja focos reales de NASA FIRMS dentro del polígono de la zona. Solo cuentan los que **los dos satélites (NOAA-20 y NOAA-21) ven en el mismo lugar, a menos de 2 km**. El contrato pide un mínimo de **2 focos cruzados**. El satélite GOES-19 da un aviso temprano cada 10 minutos, pero no mueve fondos.
2. **Firma:** dos oráculos firman el dato por separado, cada uno con su clave en su computadora. Con una sola firma no se paga nada.
3. **Calcula:** una regla pública, escrita en el contrato: `focos × 14 ha × 400 USD por hectárea`. Ejemplo con datos reales de FIRMS del 10 y 11/11: **14 focos cruzados = 196 ha = meta de 78.400 USDC**. La base sale de los costos oficiales de 12 temporadas de grandes incendios (unos 29 millones de hectáreas). Le propusimos subir la base a 400 USD por hectárea. El Comandante Mayor de Bomberos Voluntarios de Salta estuvo de acuerdo: es una operación muy costosa.
4. **Paga:** el contrato libera USDC, hasta la meta. Reparto: 70 % para combatir el fuego, 10 % para traslados y comida, 20 % para los damnificados. La parte de los bomberos va solo a los **cuarteles que la federación asignó a ese incendio**. **El contrato no tiene función para retirar el fondo** (hay tests que lo prueban).

## Por qué es mundial
Los satélites no tienen fronteras: **NASA FIRMS cubre todo el planeta, gratis**. Sumar una zona es una llamada más al contrato (`createZone`), con su polígono, sus reglas y sus cuarteles. La moneda (USDC) es la misma en todos lados. No depende del banco local. Lo hicimos en Chaco para el mundo: Salta es el piloto, no el límite.

## Por qué blockchain, y no una base de datos común
En una base de datos, quien la administra puede cambiar la regla, mover el dinero o borrar el historial. El donante tiene que creerle. Acá:
- **No hay función para sacar el fondo a una dirección cualquiera:** solo cobran damnificados con credencial y cuarteles asignados al incendio. Hoy la credencial y la asignación las da una wallet del equipo. Paso siguiente: que las dé la federación de bomberos.
- **La regla es pública y no se cambia en silencio:** cualquiera puede leerla para recalcular la meta.
- **El dato es verificable:** cada reporte guarda la huella del dato de NASA. Cualquiera la verifica con `verificar-hash`.
- **Si el dato miente,** hay límites: dos satélites que vean fuego en el mismo lugar, dos firmas, mínimo de 2 focos cruzados, la meta como techo de cada pago, 12 h entre liberaciones. Un mismo dato no paga dos veces.
- **Si una clave de firma se pierde,** se cambia a la vista de todos, con demora pública. Se rotan de a una, nunca las dos juntas.

## Funciona hoy
- **Contrato v3** en Avalanche Fuji, la red de prueba de Avalanche, con el código verificado en Sourcify (coincidencia exacta). Recibió **dos donaciones**: una de 0,01 USDC y otra de 9,9 USDC. Se dona desde un centavo.
- Con datos en vivo, **los dos oráculos se niegan a firmar si hay menos de 2 focos cruzados**: la regla funciona.
- **La regla ya pagó en vivo (12/11, versión anterior del contrato):** dos satélites de la NASA confirmaron 10 focos. Los dos oráculos firmaron por separado. El contrato envió 9,5 USDC a dos cuarteles y a la asistencia de damnificados. La huella de los datos coincide.
- **USDC es el dinero que llega; AVAX es el combustible:** cada operación paga su gas en AVAX, la moneda de Avalanche. Cuesta centavos.
- 100 tests en verde: 62 del contrato, 38 del oráculo. Web en **brasafund.vercel.app**: mapa con incendios de nivel 1, 2 y 3. Al tocar uno muestra cuánto hace falta, en USDC y en pesos, con el cuartel de referencia. Donación desde la web, con la comisión visible antes de confirmar.

## A quién le sirve (y por qué lo va a pedir)
- **Bomberos voluntarios y brigadas:** cobran cuando el fuego está confirmado, no días después. Cada pago les queda anotado para rendir cuentas.
- **Damnificados:** una parte fija de cada meta (80 de cada 400 USD por hectárea, el 20 %) les llega directo, sin intermediarios.
- **Donantes de cualquier país:** ayudan en minutos a un incendio lejano. Ven adónde fue cada dólar.
- **Empresas:** muestran a dónde fue su aporte, con un registro público.
- **Federaciones, gobiernos y organismos:** un registro público y verificable. Las reglas se conocen de antemano.

## Cómo se sostiene brasa
**5 % por plataforma y difusión** (el máximo que permite el contrato; no se puede subir). Se descuenta del aporte, o lo cubre el donante para que llegue el 100 %. **No depende de cómo se use el dinero.** Se ve en el explorador. El contrato no tiene función para retirar el fondo.

## Camino a la red principal
- **Costo por hectárea:** parte de datos oficiales de Chile y Estados Unidos, con el acuerdo de un Comandante de bomberos de Salta. Paso siguiente: calibrarlo con los gastos reales de los cuarteles de cada zona.
- **Firmas y credenciales:** cada pago necesita dos firmas: dos personas, dos claves, dos computadoras. Ninguna puede pagar sola. Cada destinatario nuevo queda a la vista antes de cobrar. Paso siguiente: una firma para la federación de bomberos y otra para un operador externo. La federación da las credenciales con firma de varias personas y 72 h de demora. El v3 ya trae las funciones para traspasar esos roles sin desplegar otro contrato.
- **Quién cobra:** solo el cuartel que la federación asigna al incendio. Así el fondo paga a quien combate.
- **Datos:** dos satélites de la NASA confirman cada foco. Paso siguiente: sumar un segundo proveedor de datos satelitales.
- **Velocidad:** el dinero sale **en segundos desde que el dato llega a la cadena**. Paso siguiente: bajar a menos de 1 hora la demora de FIRMS, hoy de unas 3 horas.
- **Seguridad:** código público y verificable, con 100 tests en verde. Auditoría externa en el roadmap (ver [`LEEME.md`](../seguridad/LEEME.md)).
- **Lo que sigue:** red principal con la federación de bomberos y pago por tramos contra comprobantes.

## Hacia dónde va
Salta → NOA y NEA → Argentina → Latinoamérica → **el mundo**. Las mismas reglas públicas, con una red de oráculos de varios operadores independientes.

**Ayuda a tiempo, recursos a la vista: eso es brasa.**
*Datos: NASA FIRMS, GOES-19 (INPE), Open-Meteo, OpenStreetMap · Hecho en Chaco por Juan Facundo Ayala y Gastón Persoglia.*
*Web: brasafund.vercel.app · Código: github.com/jfacundoayala/brasa*
