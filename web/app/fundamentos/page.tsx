import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Logo from "@/components/Logo";
import { IcoCalculo, IcoCandado, IcoOjo, IcoSatelite, IcoVerificado } from "@/components/Iconos";
import { COSTO_HA, HORA_AVION, AYUDA_VIVIENDA_ARS, RADIO_AFECTADOS_KM, FACTOR_AMBIENTE } from "@/lib/formula";
import { CASOS, REPARTO_CHILE_2023, calibracion, porHa } from "@/lib/referencias";

const cal = calibracion();
const totalChile = REPARTO_CHILE_2023.reduce((s, x) => s + x.usdM, 0);
/** Porcentaje del gasto real de Chile 2023 que suman esas categorías (por índice). */
const pct = (...i: number[]) => (i.reduce((s, k) => s + REPARTO_CHILE_2023[k].usdM, 0) / totalChile * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " %";

export const metadata: Metadata = {
  title: "Fundamentos · brasa",
  description: "Cómo funciona brasa por dentro: la fórmula, el fondo en Avalanche, los oráculos, los satélites y las billeteras.",
  alternates: { canonical: "/fundamentos" },
};

type Dep = { fund: string; usdc: string; chainId: number; feeBps?: number; federation?: string; recipientDelay?: number };

/** Se lee al construir la página: es el mismo archivo que usa la portada. */
function leerDeploy(): Dep | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "deployment.fuji.json"), "utf8"));
  } catch {
    return null;
  }
}

const SNOW = "https://build.avax.network/explorer/fuji/c-chain/address/";
const corto = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Fundamentos() {
  const d = leerDeploy();
  const fee = d?.feeBps != null ? d.feeBps / 100 : 5;
  return (
    <>
      <header className="barra">
        <div className="barra-in">
          <Link href="/" className="barra-logo" aria-label="Volver a brasa">
            <Logo height={40} />
          </Link>
          <nav className="menu" aria-label="Secciones">
            <Link href="/">Inicio</Link>
            <Link href="/#mapa">Mapa</Link>
            <Link href="/#donar" className="menu-cta">
              Donar
            </Link>
          </nav>
        </div>
      </header>
    <main className="fund">
      <p className="eyebrow">Cómo funciona por dentro</p>

      <h1 className="titular">Fundamentos</h1>
      <p className="bajada">
        Cómo funciona brasa por dentro. Cada parte empieza con una frase simple y después va el detalle para quien quiera
        revisarlo.
      </p>
      <ul className="fund-indice">
        <li><a href="#formula">La fórmula</a></li>
        <li><a href="#fondo">El fondo (contrato)</a></li>
        <li><a href="#oraculos">Los oráculos</a></li>
        <li><a href="#satelites">Los satélites</a></li>
        <li><a href="#billeteras">Billeteras y monedas</a></li>
        <li><a href="#avalanche">¿Por qué Avalanche?</a></li>
        <li><a href="#camino">Lo que sigue</a></li>
      </ul>

      <section id="formula">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoCalculo /></span>La fórmula de brasa</h2>
        <p className="simple">
          Combina dos cosas: lo que costó apagar los grandes incendios de la historia reciente y lo que ven los satélites en este
          momento. Con eso calcula cuánto dinero hace falta para cada incendio.
        </p>

        <h3>Capa 1 · La historia: {cal.casos} temporadas de grandes incendios</h3>
        <p>
          Reunimos los costos <b>oficiales</b> de respuesta a incendios de {cal.casos} temporadas y emergencias, con{" "}
          <b>{Math.round(cal.hectareas / 1e6).toLocaleString("es-AR")} millones de hectáreas</b> quemadas en total, y calculamos
          cuánto costó cada hectárea. La cuenta es la misma para todos: gasto de respuesta ÷ hectáreas quemadas.
        </p>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Dónde</th><th>Cuándo</th><th>Hectáreas</th><th>USD por ha</th><th>Fuente</th></tr>
            </thead>
            <tbody>
              {[...CASOS].sort((a, b) => porHa(a) - porHa(b)).map((c) => (
                <tr key={c.lugar + c.periodo}>
                  <td>{c.lugar}</td>
                  <td>{c.periodo}</td>
                  <td>{c.hectareas.toLocaleString("es-AR")}</td>
                  <td><b>{Math.round(porHa(c)).toLocaleString("es-AR")}</b></td>
                  <td><a href={c.url} target="_blank" rel="noreferrer">{c.fuente} ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          <li>
            Rango: de <b>{Math.round(cal.min)}</b> a <b>{Math.round(cal.max).toLocaleString("es-AR")}</b> USD por hectárea. Mediana
            de todas: <b>{Math.round(cal.mediana)}</b>.
          </li>
          <li>
            <b>Base de brasa: {COSTO_HA} USD por hectárea.</b> La base sale de fuentes oficiales de Chile y Estados
            Unidos. Le propusimos al Comandante Mayor del Cuartel de Bomberos Voluntarios de Salta subirla a 400 USD por
            hectárea. Estuvo de acuerdo: es una operación muy costosa. En
            Chile la hectárea costó de {Math.round(cal.latamMin)} a {Math.round(cal.latamMax)} USD. Salta se parece más a Chile
            que a Estados Unidos en sueldos, aviones o precios.
            {COSTO_HA < cal.mediana ? " Es una base prudente: está por debajo de la mediana mundial." : ""}
          </li>
          <li>
            En los incendios extremos, la Capa 2 multiplica esa base hasta unos{" "}
            <b>{Math.round(COSTO_HA * 1.8 * 1.55 * FACTOR_AMBIENTE.yungas).toLocaleString("es-AR")} USD por hectárea</b>: el
            nivel de los megaincendios de la tabla.
          </li>
        </ul>
        <p className="mini">
          Cómo leer la tabla: en Estados Unidos es el gasto federal de supresión dividido por todas las hectáreas del país (no
          suma lo que gastan los estados, así que es un piso), en dólares de cada año. Chile 2023 es el gasto fiscal directo de
          enero y febrero. Los datos están en <code>web/lib/referencias.ts</code> y cualquiera puede rehacer la cuenta.
        </p>

        <h3>Capa 2 · El espacio: lo que miden los satélites ahora</h3>
        <ul>
          <li>
            <b>Superficie:</b> cuántos focos ven los satélites NOAA-20 y NOAA-21 (cada foco ≈ 14 ha).
          </li>
          <li>
            <b>Fuerza del fuego:</b> la potencia que mide el satélite (de 1 a 1,8, con las clases de la guía VIIRS de NOAA).
          </li>
          <li>
            <b>Clima de ahora:</b> +0,15 por cada parte de la regla 30-30-30 (más de 30 °C, menos de 30 % de humedad, viento de
            más de 30 km/h) y +0,1 si no llovió en 7 días (Open-Meteo).
          </li>
          <li>
            <b>Hacia dónde avanza:</b> la dirección del viento en el lugar.
          </li>
          <li>
            <b>Qué se quema:</b> de {FACTOR_AMBIENTE.puna} en la Puna a {FACTOR_AMBIENTE.yungas} en las Yungas.
          </li>
          <li>
            <b>Avión hidrante:</b> 0, 2 o 6 horas según el nivel y la fuerza del fuego × {HORA_AVION.toLocaleString("es-AR")} USD
            por hora (entre 3.000 y 5.000 en Argentina, Infobae 2022).
          </li>
          <li>
            <b>Gente cerca:</b> casas a menos de {RADIO_AFECTADOS_KM} km (Censo 2022, 3,68 personas por hogar) × $
            {AYUDA_VIVIENDA_ARS.toLocaleString("es-AR")} por casa (Suplemento Único para la Reconstrucción).
          </li>
        </ul>

        <h3>Cómo se reparte cada hectárea</h3>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Parte</th><th>Por hectárea</th><th>Respaldo</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Apagar el fuego</td>
                <td>{Math.round(COSTO_HA * 0.7)} USDC (70 %)</td>
                <td>En Chile 2023 el combate fue el {pct(0)} del gasto real</td>
              </tr>
              <tr>
                <td>Traslados y comida</td>
                <td>{Math.round(COSTO_HA * 0.1)} USDC (10 %)</td>
                <td rowSpan={2}>
                  El resto fue {pct(1, 2, 3, 4)}: personas y reconstrucción {pct(1, 2, 3)}, combustible y viáticos {pct(4)}. Darle 10 %
                  a traslados o comida y 20 % a los vecinos es criterio nuestro. Se ajusta con las facturas de los cuarteles
                </td>
              </tr>
              <tr>
                <td>Ayuda a los vecinos</td>
                <td>{Math.round(COSTO_HA * 0.2)} USDC (20 %)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Qué paga hoy el fondo</h3>
        <p>
          El fondo en Avalanche usa la parte más firme de la fórmula: <b>focos confirmados × 14 ha × {COSTO_HA} USDC</b>. Ejemplo:
          14 focos confirmados = 196 ha → <b>{(196 * COSTO_HA).toLocaleString("es-AR")} USDC</b>. El techo de cada pago es esa meta. Si el fondo tiene menos, se
          envía lo que hay. La fórmula completa (Capa 2) hoy orienta al donante en la tarjeta de cada incendio. Pasarla al fondo
          es parte del roadmap.
        </p>

        <h3>Cómo sigue</h3>
        <ul>
          <li>Sumar más grandes incendios con costo oficial: Canadá 2023, Australia 2019-2020, Portugal 2017, Corrientes 2022.</li>
          <li>Sumar los gastos reales de los cuarteles de Salta, con sus tickets y facturas, para darles más peso que a los de afuera.</li>
          <li>Que el oráculo firme el resultado de la fórmula completa, para que el fondo pague con ella.</li>
        </ul>
      </section>

      <section id="fondo">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoCandado /></span>El fondo (contrato inteligente)</h2>
        <p className="simple">
          Es un programa público que guarda las donaciones y solo las envía cuando se cumple la regla. No tiene forma de sacar el dinero
          para otra cosa.
        </p>
        <ul>
          <li>Está escrito en <b>Solidity</b> y vive en la red <b>Avalanche</b> (hoy en Fuji).</li>
          <li><b>No tiene ninguna función para retirar el fondo.</b> Solo paga a cuarteles y damnificados verificados.</li>
          <li>Hacen falta <b>al menos 2 focos confirmados</b> y pasan <b>12 horas</b> entre un envío y el siguiente en la misma zona.</li>
          <li>
            Cada alta de un cuartel nuevo queda a la vista{" "}
            {d?.recipientDelay ? `${Math.round(d.recipientDelay / 60)} minutos` : "un tiempo"} antes de poder cobrar (en el piloto
            serán 72 horas), así cualquiera puede avisar si algo está mal.
          </li>
          <li>
            La comisión de brasa es del <b>{fee} %</b>, por la plataforma y la difusión. Es el máximo que permite el fondo y no
            se puede subir. Se ve separada antes de donar.
          </li>
          <li>
            El código está <b>verificado</b>: cualquiera puede leerlo y comprobar que es exactamente el que está publicado.
          </li>
        </ul>
        {d && (
          <div className="tabla-scroll">
            <table>
              <tbody>
                <tr>
                  <th>Fondo</th>
                  <td>
                    <a href={`https://sourcify.dev/server/repo-ui/43113/${d.fund}`} target="_blank" rel="noreferrer">{corto(d.fund)} · ver el código ↗</a>{" "}
                    · <a href={`https://repo.sourcify.dev/${d.chainId}/${d.fund}`} target="_blank" rel="noreferrer">Sourcify ↗</a>
                  </td>
                </tr>
                <tr>
                  <th>Moneda</th>
                  <td><a href={`${SNOW}${d.usdc}`} target="_blank" rel="noreferrer">USDC de Circle {corto(d.usdc)} ↗</a></td>
                </tr>
                {d.federation && (
                  <tr>
                    <th>Quién verifica cuarteles</th>
                    <td><a href={`${SNOW}${d.federation}`} target="_blank" rel="noreferrer">{corto(d.federation)} ↗</a> (hoy la opera el equipo; el contrato permite traspasarla a la federación)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="oraculos">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoOjo /></span>Los oráculos</h2>
        <p className="simple">
          El fondo no puede mirar el cielo. Un oráculo es quien le lleva el dato de la NASA, firmado. Hacen falta dos firmas
          distintas.
        </p>
        <ul>
          <li>Dos oráculos firman cada reporte por separado, cada uno con un satélite distinto. Con una sola firma no se paga nada.</li>
          <li>Las firmas no se pueden reutilizar ni usar en otra red (estándar EIP-712, con un número que no se repite).</li>
          <li>
            Cada envío guarda una <b>huella</b> de los datos de la NASA. Cualquiera puede bajar esos datos y comprobar que la huella
            coincide.
          </li>
          <li>
            Cada firma la pone un programa distinto, que baja el dato de la NASA por su cuenta. A cada programa lo opera
            una persona distinta, con su clave y en su computadora. Ninguna firma puede pagar sola. El contrato
            ya permite entregar cada firma a un operador externo, de a una y con demora pública, sin mover el fondo. La
            federación de bomberos tiene otra llave, la que acredita cuarteles: comprueba que cada cuartel exista y quién se
            hace cargo. Las llaves quedan separadas.
          </li>
        </ul>
      </section>

      <section id="satelites">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoSatelite /></span>Los satélites</h2>
        <p className="simple">Un satélite avisa rápido, otros dos confirman. Recién con la confirmación se mueven fondos.</p>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr><th>Satélite</th><th>Qué hace</th><th>Cada cuánto</th></tr>
            </thead>
            <tbody>
              <tr><td>GOES-19 (NOAA)</td><td>Aviso rápido de posible fuego, vía el programa Queimadas del INPE</td><td>Cada 10 minutos</td></tr>
              <tr><td>NOAA-20 y NOAA-21 (sensor VIIRS)</td><td>Confirman el fuego: tienen que verlo los dos a menos de 2 km</td><td>Cada satélite cubre todo el planeta cada 12 horas; la NASA publica el dato en unas 3 horas (FIRMS)</td></tr>
              <tr><td>MODIS (NASA)</td><td>Dato extra para el mapa</td><td>Todos los días (satélites Terra y Aqua)</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Los niveles 1, 2 y 3 se calculan con la cantidad de focos de cada incendio.
        </p>
      </section>

      <section id="billeteras">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoVerificado /></span>Billeteras y monedas</h2>
        <p className="simple">Una billetera digital es como una app del banco, pero tuya: nadie más puede mover lo que tenés.</p>
        <ul>
          <li>
            <b>USDC</b> es un dólar digital de la empresa Circle: 1 USDC vale 1 dólar. El fondo recibe y paga siempre en USDC, así el
            cuartel o el damnificado sabe exacto cuánto recibe.
          </li>
          <li>
            <b>AVAX</b> es la moneda propia de Avalanche. Si tenés AVAX, lo cambiás a USDC desde tu billetera (Core o LFJ) y después
            donás. Tu AVAX nunca pasa por brasa.
          </li>
          <li>
            <b>Core</b> es la billetera de Avalanche. También sirve MetaMask. Donar son dos firmas: una para autorizar el USDC y otra
            para enviarlo.
          </li>
          <li>
            Cada cuartel o damnificado recibe en su billetera y paga a proveedores o pasa a pesos con un proveedor registrado en la CNV.
          </li>
        </ul>
      </section>

      <section id="avalanche">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoVerificado /></span>¿Por qué Avalanche?</h2>
        <p className="simple">Porque el pago queda firme en un segundo, cuesta centavos y tiene USDC nativo, el dólar digital de Circle.</p>
        <ul>
          <li><b>Rápido:</b> una operación queda firme en cerca de 1 segundo en la C-Chain, la cadena de los contratos.</li>
          <li><b>Barato:</b> enviar una donación cuesta centavos de dólar, así casi todo llega a bomberos y damnificados.</li>
          <li><b>USDC nativo de Circle</b> y oráculos ya integrados (Chainlink, Pyth y otros) para crecer.</li>
          <li>
            <b>Una red propia a futuro:</b> Avalanche permite crear una cadena propia (L1), por ejemplo una de federaciones de
            bomberos que decidan quién valida, sin salir del ecosistema.
          </li>
          <li>
            <b>Todo a la vista:</b> cada donación y cada envío se ve en el explorador público, para siempre.
          </li>
        </ul>
        <p className="mini">
          Fuente: Avalanche Builder Hub (build.avax.network), consultado el 12/11/2026.
        </p>
      </section>

      <section id="camino">
        <h2 className="fund-h2"><span className="ico" aria-hidden="true"><IcoVerificado /></span>Camino a la red principal</h2>
        <p className="simple">Lo que ya funciona hoy, y el paso que sigue en cada frente.</p>
        <ul>
          <li><b>Red:</b> hoy corre en Avalanche Fuji, la red de prueba, con código público y verificable. Sigue la auditoría externa y la red principal.</li>
          <li><b>Firmas:</b> hoy las tienen dos personas distintas del equipo. Sigue entregar una a la federación de bomberos y otra a un operador de datos.</li>
          <li><b>Datos:</b> hoy confirman dos satélites de la NASA. Sigue sumar un segundo proveedor.</li>
          <li><b>Filtros:</b> hoy cuentan la alta confianza, los dos satélites y el cuartel asignado. Sigue el mapa de uso del suelo y el registro de quemas autorizadas.</li>
          <li><b>Pagos:</b> hoy el contrato paga directo al cuartel. Sigue el pago por tramos, con comprobantes.</li>
        </ul>
      </section>

      <footer className="fund-pie">
        <p>
          <Link href="/">← Volver a brasa</Link> · <Link href="/#donar">Donar</Link>
        </p>
      </footer>
    </main>
    </>
  );
}
