# Documentación de brasa

Todo lo que hace falta para entender brasa, comprobarlo y ver hacia dónde va.

## ¿Qué necesitás? Leé esto

| Necesitás… | Leé |
|---|---|
| Entender brasa en 2 minutos | [`entrega/ONE-PAGER.md`](entrega/ONE-PAGER.md) y el deck en [`presentacion/`](presentacion/) |
| Ver cómo validamos el problema con bomberos | [`producto/VALIDACION-BOMBEROS.md`](producto/VALIDACION-BOMBEROS.md) |
| Saber de dónde sale cada número | [`producto/FORMULA-BRASA.md`](producto/FORMULA-BRASA.md) y [`producto/DATOS-REALES-SALTA.md`](producto/DATOS-REALES-SALTA.md) |
| Saber cómo se separa un incendio de otro foco de calor | [`producto/FOCOS-QUE-NO-SON-INCENDIOS.md`](producto/FOCOS-QUE-NO-SON-INCENDIOS.md) |
| Ver hacia dónde va brasa | [`producto/roadmap.md`](producto/roadmap.md) y [`futuro/`](futuro/LEEME.md) |
| Entender el contrato vigente | [`tecnico/CONTRATO-V3.md`](tecnico/CONTRATO-V3.md) |
| Encontrar una dirección o una transacción | [`tecnico/DIRECCIONES.md`](tecnico/DIRECCIONES.md) |
| Comprobar que un pago usó datos reales de la NASA | [`tecnico/VERIFICAR-HUELLA.md`](tecnico/VERIFICAR-HUELLA.md) |
| Correrlo en local o desplegarlo en Fuji | [`tecnico/CORRER-EN-LOCAL.md`](tecnico/CORRER-EN-LOCAL.md) |
| Saber por qué brasa no es un PSAV y de quién es el dinero | [`legal/POSICION-PSAV-Y-FONDOS.md`](legal/POSICION-PSAV-Y-FONDOS.md) |
| Ver las medidas de seguridad y las revisiones del contrato | [`../SECURITY.md`](../SECURITY.md) y [`seguridad/`](seguridad/LEEME.md) |

## Carpetas

| Carpeta | Qué hay |
|---|---|
| [`entrega/`](entrega/LEEME.md) | Todo lo entregado y el resumen en una página |
| [`presentacion/`](presentacion/LEEME.md) | El deck y el resumen en PDF |
| [`identidad/`](identidad/IDENTIDAD.md) | El logo y los colores |
| [`producto/`](producto/) | La entrevista de validación, la fórmula, los datos de Salta y el roadmap |
| [`tecnico/`](tecnico/) | Contratos v2 y v3, direcciones, verificación de la huella y cómo correrlo |
| [`legal/`](legal/LEEME.md) | Por qué brasa no es un PSAV, de quién es el dinero y el papel de la federación |
| [`seguridad/`](seguridad/LEEME.md) | Revisiones del contrato: qué se corrigió y qué test lo comprueba |
| [`futuro/`](futuro/LEEME.md) | Lo que sigue: el relayer en Oracle Cloud |

Fuera de `docs/`: [`relayer/sample-data/`](../relayer/sample-data/LEEME.md) tiene los datos de la NASA para repetir las pruebas.

## Cómo trabajamos

- Cada cambio entra por pull request, con 100 tests automáticos y una búsqueda de claves privadas.
- Cada uno usa sus propias billeteras de prueba en su `.env.local`, que no se sube.
- El hook que frena claves privadas se activa con `git config core.hooksPath .githooks`.
- Antes de unir un cambio, desde la raíz: `npm test` (contrato y relayer) y `npm run enlaces`.
