# Por qué brasa no es un PSAV y de quién es el dinero en el contrato

> 13/11/2026. Es la posición del equipo y la forma de explicarla. La norma está leída en su texto oficial: **RG CNV 1172/2026**, Boletín Oficial del 15/10/2026, Capítulo III, art. 2° ([PDF](https://www.colegio-escribanos.org.ar/noticias/2026_10_15_CNV-Res-Gral-1172-26.pdf); aviso oficial: boletinoficial.gob.ar, detalle de norma 348986).

## 1. Qué es un PSAV, según la ley

La Ley 27.739 (art. 4° bis de la Ley 25.246) llama PSAV a quien, **como negocio y para o en nombre de otra persona**, hace alguna de estas cosas:
1. cambia cripto por pesos u otra moneda;
2. cambia una cripto por otra;
3. transfiere cripto;
4. custodia o administra cripto, o tiene "instrumentos que permitan el control" sobre ella;
5. presta servicios financieros a quien emite una cripto.

## 2. Por qué brasa no lo es

La plataforma brasa no hace ninguna de esas cinco cosas **para o en nombre de otros**. Así está diseñado:

| Actividad de un PSAV | Qué hace brasa | Dónde se ve |
|---|---|---|
| Cambiar cripto por pesos | No cambia nada. El donante llega con su USDC. El cuartel lo pasa a pesos con el proveedor que elija. | No hay ninguna función de cambio en el contrato ni en la web. |
| Transferir por cuenta de otro | El donante transfiere desde **su propia billetera**, con su firma. La liberación la ejecuta el contrato según la regla. **Cualquiera** puede enviarla con las dos firmas de los oráculos: no hace falta brasa. | `donateToZone` y `donateToRecipient` usan `msg.sender`. `reportFire` no exige quién la llama (`BrasaFund.sol:432`). |
| Custodiar o administrar | brasa no tiene llaves sobre el fondo. El contrato no tiene función de retiro. Los parámetros de cada zona no se pueden editar. | Test "la federación no tiene ninguna función para mover el fondo". |
| Control sobre los activos | Nadie puede sacar el saldo a mano: ni brasa, ni la federación, ni el donante. Solo sale por la regla pública. | Código verificado en Sourcify. |

Además, la RG 1172/2026 deja afuera, en forma expresa (art. 2°):
- **Inciso ii:** a quien recibe cripto "como contraprestación por la compraventa o prestación de sus productos o servicios, cualquiera sea el monto". Es nuestra comisión de 5 %: el pago por la plataforma y la difusión. El contrato la manda directo a la tesorería, a la vista.
- **Inciso iii:** a los "protocolos descentralizados", "siempre que no exista una persona humana o jurídica que, ejerciendo control o influencia suficiente sobre su funcionamiento, preste servicios comprendidos en la definición de PSAV".
- **Inciso iv:** a quien provee software de **autocustodia**, donde el usuario conserva el control de sus activos. La web de brasa funciona así: el donante firma con su billetera, y brasa nunca toca sus claves ni su dinero.

### La regla de diseño que nos deja afuera "sí o sí"

**En producción, brasa no tiene ningún rol con poder sobre el fondo.**
- **Oráculos:** los operan dos proveedores de datos independientes (por ejemplo, una universidad y un instituto), uno por satélite. Ni brasa ni la federación tienen una llave de oráculo.
- **Federación:** acredita a cada cuartel, con una billetera de varias firmas y una demora pública antes de cada alta. También audita la rendición de gastos (ver punto 5).
- **Envío de la liberación:** abierto a cualquiera. La plataforma brasa ofrece un relayer por comodidad, pero no es necesario.
- **Lo que le queda a brasa:** el software (la web y el código abierto) y la comisión como pago por su servicio.

**Hoy, en Fuji**, esos roles los opera el equipo, en una red de prueba sin dinero real. **Paso siguiente:** en el piloto pasan a terceros. El contrato v3 ya permite ese traspaso: la federación pasa en dos pasos (`transferFederation`) y las claves de oráculo rotan con demora pública.

## 3. De quién es el dinero mientras está en el contrato

**Respuesta corta:** desde que se dona, el dinero es de los destinatarios acreditados de la zona: cuarteles de bomberos y entidades que asisten a damnificados. El contrato solo decide **cuándo** se entrega y **cuánto le toca a cada uno**. No es de brasa ni de la federación. Tampoco vuelve al donante.

**Cómo encaja en el Código Civil y Comercial**
1. **Es una donación** (art. 1542). Es una donación manual de una cosa mueble no registrable: se perfecciona con la entrega (art. 1554), que es la transferencia en la cadena.
2. **El donatario son los destinatarios acreditados de la zona**, un grupo de terceros determinable (art. 1027, estipulación a favor de tercero). Quiénes son está publicado en la cadena, con su credencial.
3. **Los destinatarios aceptan por adelantado.** Al acreditarse ante la federación, cada cuartel o entidad acepta las donaciones que lleguen al fondo de su zona y el destino que tienen. Con esa aceptación previa, el donante ya no puede revocar (art. 1027).
4. **La donación tiene un cargo:** usar el dinero en combate del fuego, traslados y comida, y asistencia a damnificados (arts. 1562 y 1570). El reparto 70 / 10 / 20 está escrito en el contrato.
5. **La entrega está sujeta a una condición:** que dos satélites confirmen el fuego en la zona y dos firmas independientes lo avalen. Hasta entonces, el saldo queda afectado a ese destino y nadie lo puede usar para otra cosa.
6. **La plataforma brasa no es mandataria ni depositaria.** No recibe el dinero ni actúa en nombre del donante (arts. 1319 y 1356). Así lo dicen las condiciones que el donante ve antes de donar.

**También se puede donar directo a un cuartel.** `donateToRecipient` manda el USDC de la billetera del donante a la del cuartel en la misma transacción, sin pasar por el fondo. En ese caso, la donación es simple y directa (arts. 1542 y 1554).

## 4. En pocas palabras

**Sobre PSAV:** "No somos un proveedor de activos virtuales. La plataforma no cambia, no custodia y no transfiere dinero de nadie. El donante dona desde su billetera, el contrato reparte según una regla pública y nosotros cobramos solo la comisión por el servicio. La norma de la CNV deja afuera exactamente eso."

**Sobre de quién es el dinero:** "Desde que donás, el dinero es de los cuarteles y las entidades de la zona. El contrato solo decide cuándo llega y cuánto le toca a cada uno. Nadie lo puede desviar: ni nosotros, ni la federación."

## 5. El modelo: la federación acredita y audita

**Quién hace qué**

| Rol | Quién | Qué puede hacer | Qué no puede hacer |
|---|---|---|---|
| Federación de bomberos | La federación provincial (en Salta, la que nuclea a los cuarteles voluntarios) | Acreditar cuarteles y entidades, revocar credenciales, auditar la rendición de gastos | Mover el fondo, cambiar la regla, firmar que hay fuego |
| Oráculos | Dos operadores de datos independientes | Firmar que dos satélites vieron fuego | Elegir quién cobra, mover el fondo |
| Cuartel | La asociación civil de bomberos voluntarios | Cobrar lo que le toca, rendir cómo lo usó | Acreditarse solo |
| brasa | El equipo | Mantener el software y cobrar la comisión por el servicio | Mover el fondo, acreditar, firmar que hay fuego |
| Donante | Cualquier persona del mundo | Donar desde su billetera y seguir su donación | Recuperar lo donado o desviarlo |

**Qué controla la federación antes de acreditar un cuartel (sí o sí)**
1. **Que exista:** es una asociación de bomberos voluntarios con personería jurídica vigente (Ley 25.054). Además tiene cuartel físico, con dirección y zona de actuación.
2. **Que esté en regla:** tiene CUIT activo en ARCA y figura en el registro de la federación.
3. **Quién se hace cargo:** el acta de comisión directiva designa a dos responsables, presidente y tesorero, con nombre, DNI y cargo. Ellos firman la aceptación de las donaciones y del destino (punto 3 de este documento).
4. **De quién es la billetera:** la billetera es del cuartel, no de una persona. Usa varias firmas y los responsables la controlan juntos. La federación comprueba que la controlan con una firma de prueba.
5. **Publicación:** el alta queda en la cadena con una demora pública. Cualquiera la ve antes de que el cuartel pueda cobrar.

**Qué audita la federación después de cada pago**
- **Rendición:** el cuartel presenta en qué gastó: combustible, mangueras, comida, traslados. Puede hacerlo con fotos de facturas o con la planilla de la federación.
- **Publicación:** la federación publica un resumen por incendio y lo enlaza al pago en la cadena.
- **Sanción:** si un cuartel no rinde o deja de cumplir, la federación revoca su credencial (`revokeRecipient`). Desde ese momento no cobra más.

**Lo que ya hace el contrato hoy:**
- La credencial la da y la saca solo la federación (`addRecipient` y `revokeRecipient`, con `onlyFederation`).
- Hay una demora pública antes de cobrar (`recipientDelay`).
- La federación no tiene ninguna función para mover el fondo.

**Lo que se suma en el piloto:**
- El convenio con la federación y su billetera de varias firmas.
- La planilla de rendición y la publicación de los resúmenes.

## 6. Próximos pasos para el piloto
- Convenio con la federación: billetera de varias firmas, requisitos de acreditación del punto 5 y aceptación anticipada del punto 3.
- Planilla de rendición y publicación de resúmenes por incendio.
- Operadores de oráculo independientes.
- Condiciones de uso a la vista antes de donar, con las dos líneas separadas: donación y comisión.
- La comisión va a una entidad de brasa que la factura como servicio.
