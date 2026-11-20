# Identidad del proyecto: nombre, personalidad y logo

## 1. El nombre
El nombre es **brasa**: el rescoldo que sigue vivo y que el viento puede reavivar. Es corto y se pronuncia igual en español y portugués. Funciona en toda Latinoamérica y es fácil de dibujar como logo. Siempre se escribe en minúscula.

## 2. Personalidad
La plataforma brasa es **la vecina que organiza la colecta y lleva la planilla al día**.
- **Cercana:** habla como alguien del barrio, no como un banco.
- **Seria con el dinero:** cada peso se puede seguir.
- **Calma ante la emergencia:** informa con calma, sin alarmas ni dramatismo.
- **Agradecida con los bomberos:** son los protagonistas, no el producto.

**Lo que no es:** una fintech fría, una ONG que pide lástima ni una app de "cripto".

## 3. Voz
- Usa "vos". Frases cortas.
- Dice **"dólar digital"** antes que "stablecoin", y **"carnet digital"** antes que "token soulbound".
- Muestra el número exacto: "Tu aporte de $5.000 llegó al cuartel de Cafayate el 14/7".
- Nunca promete más de lo que hace: "La plataforma brasa no apaga el fuego, hace que la ayuda llegue más rápido".

**Frase de cabecera:** *Ayuda a tiempo, recursos a la vista.*
**Alternativas:** "Donás hoy, llega cuando hace falta." · "El dinero de la comunidad, al cuartel de tu zona."

## 4. Logo
**Idea:** una llama en tres tonos, por los tres niveles de incendio, con el satélite que la detecta arriba a la derecha y el nombre escrito en Space Grotesk. Una sola figura, legible en tamaño de ícono.

| Archivo | Uso |
|---|---|
| [`logo-brasa.svg`](logo-brasa.svg) | Logo completo con nombre, sobre fondo claro. Es el que usa la web |
| [`logo-brasa-oscuro.svg`](logo-brasa-oscuro.svg) | Logo completo con nombre, sobre fondo oscuro |
| [`simbolo-brasa.svg`](simbolo-brasa.svg) | Ícono cuadrado para la app, el favicon y las redes |

## 5. Colores
La web, el deck y el resumen usan tonos claros con azul y verde: transmiten confianza y cuidado. El naranja queda para el logo y para los incendios en el mapa, que son el dato.

| Nombre | Hex | Uso |
|---|---|---|
| Papel | `#F3F7FB` | Fondo de la página |
| Tinta | `#101C2B` | Texto y bloques oscuros, como la ventana al espacio de la portada |
| Azul | `#1B5FAE` | Botones, enlaces y cifras |
| Celeste | `#8EC5FF` | Acentos sobre fondo oscuro |
| Verde | `#1F7A54` | Solo para lo confirmado y lo verificado |
| Línea | `#D5E0EC` | Bordes de tarjetas |
| Llama | `#FF5A1F` · `#FFB000` · `#FFE08A` | Solo en el logo. Los incendios del mapa van de amarillo a rojo según el nivel |

Que el verde sea solo para cosas confirmadas ayuda a que la gente lo asocie con confianza. Los tonos de la web están como variables en `web/app/globals.css`.

## 6. Tipografía
- **Logo y títulos:** Space Grotesk, en negrita.
- **Texto:** Geist.
- **Datos y números técnicos:** Geist Mono.
- Las tres se sirven desde el propio sitio.

## 7. Cómo se ve la web
- Fondo Papel, con tarjetas blancas.
- **Portada** oscura, como una ventana al espacio, con la Tierra en 3D y los satélites NOAA-20 y NOAA-21 en órbita.
- **Mapa satelital de Salta** con una llama por incendio: una, dos o tres según el nivel (leve, medio o grave).
- Cada incendio lleva su sello: *confirmado por dos satélites* (verde) o *lo ve un solo satélite*.
