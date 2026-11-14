// Verificación pública de un reporte: cualquiera puede recalcular, con los datos de FIRMS, la huella (dataHash),
// la cantidad de focos confirmados, la hora del dato y la huella del polígono, y compararlas con lo que quedó en la
// cadena. No necesita claves ni confiar en el relayer.
//
// Definición exacta de la huella (dataHash), para reproducirla en cualquier lenguaje:
//   1. Leer el CSV de FIRMS del sensor (cabecera en la primera línea, valores como texto, sin convertir).
//   2. Quedarse con las filas dentro del polígono de Salta (sample-data/salta-provincia.geojson) y de alta confianza
//      (VIIRS "high" o "h"; MODIS con confianza numérica >= 80), en el mismo orden del CSV.
//   3. Convertir esa lista a JSON sin espacios: cada fila es un objeto con las columnas en el orden de la cabecera.
//   4. dataHash = "0x" + SHA-256 (hex) de ese texto en UTF-8.
// Focos del reporte (v2): de esas filas, las que tienen un foco de alta confianza del OTRO satélite a menos de 2 km.
// dataTime (v2): la hora (acq_date + acq_time, UTC) más nueva de esas filas de alta confianza.
// polygonHash (v2): keccak256 del GeoJSON del polígono con saltos de línea LF.
import { Interface, verifyTypedData } from "ethers";
import { SENSORES, huellaPoligono } from "./firms.mjs";
import { TIPOS, dominio } from "./reporte.mjs";

const TUPLA =
  "(bytes32 zoneId,bytes32 polygonHash,uint8 sensor,uint16 hotspots,uint64 observedAt,uint64 dataTime,bytes32 dataHash,uint256 nonce)";

// Formato del contrato v1 (el de la primera liberación, 12/11/2026): sin polígono ni hora del dato, y los focos son
// los de alta confianza de cada satélite (sin cruce). Se acepta solo para verificar la huella de esos reportes.
const TUPLA_V1 = "(bytes32 zoneId,uint8 sensor,uint16 hotspots,uint64 observedAt,bytes32 dataHash,uint256 nonce)";
export const ABI_V1 = new Interface([`function reportFire(${TUPLA_V1}[2] reports, bytes[2] sigs)`]);

// ABI mínima: no depende de que el contrato esté compilado.
export const ABI_VERIFICACION = new Interface([
  `function reportFire(${TUPLA}[2] reports, bytes[2] sigs)`,
  "event FireEvent(bytes32 indexed zoneId, uint256 indexed eventId, uint256 hotspots, uint256 areaHa, uint256 target, uint256 released, bytes32 dataHash0, bytes32 dataHash1, uint64 dataTime0, uint64 dataTime1)",
]);

/** Saca los dos reportes y sus firmas de los datos de una transacción a reportFire. */
export function decodificarReportFire(data) {
  const leer = (abi) => {
    try {
      const t = abi.parseTransaction({ data });
      return t?.name === "reportFire" ? t : null;
    } catch {
      return null;
    }
  };
  const tx = leer(ABI_VERIFICACION);
  if (!tx) {
    const v1 = leer(ABI_V1);
    if (!v1) throw new Error("La transacción no es una llamada a reportFire (ni del contrato v2 ni del v1).");
    const [reports, sigs] = v1.args;
    return reports.map((r, i) => ({
      reporte: {
        formato: "v1",
        zoneId: r.zoneId,
        sensor: Number(r.sensor),
        hotspots: Number(r.hotspots),
        observedAt: Number(r.observedAt),
        dataHash: r.dataHash,
        nonce: r.nonce,
      },
      firma: sigs[i],
    }));
  }
  const [reports, sigs] = tx.args;
  return reports.map((r, i) => ({
    reporte: {
      zoneId: r.zoneId,
      polygonHash: r.polygonHash,
      sensor: Number(r.sensor),
      hotspots: Number(r.hotspots),
      observedAt: Number(r.observedAt),
      dataTime: Number(r.dataTime),
      dataHash: r.dataHash,
      nonce: r.nonce,
    },
    firma: sigs[i],
  }));
}

/** Busca el FireEvent en los logs de un recibo (si la tx liberó o registró el evento). */
export function eventoDelRecibo(logs) {
  for (const l of logs ?? []) {
    try {
      const e = ABI_VERIFICACION.parseLog(l);
      if (e?.name === "FireEvent") {
        return {
          eventId: Number(e.args.eventId),
          dataHash0: e.args.dataHash0,
          dataHash1: e.args.dataHash1,
          dataTime0: Number(e.args.dataTime0),
          dataTime1: Number(e.args.dataTime1),
        };
      }
    } catch {
      // log de otro contrato (por ejemplo el USDC): se ignora
    }
  }
  return null;
}

/**
 * Compara cada reporte de la cadena con los datos recalculados.
 * `datos` es { [clave del sensor]: resumen } ya pasado por cruzarSensores (tiene `confirmados`).
 * `chainId` y `fondo` solo hacen falta para mostrar el firmante. `poligono` es la huella local del polígono.
 * `horaSimulada`: true si el reporte se armó en la cadena local con hora simulada (no se compara la hora).
 */
export function verificarReportes(reportes, datos, { chainId, fondo, poligono = huellaPoligono(), horaSimulada = false } = {}) {
  return reportes.map(({ reporte, firma }) => {
    const s = SENSORES.find((x) => x.id === reporte.sensor);
    if (!s) return { sensor: reporte.sensor, nombre: `sensor ${reporte.sensor}`, error: "Sensor desconocido" };
    const r = datos[s.clave];
    if (!r) return { sensor: s.id, nombre: s.nombre, error: `Faltan los datos de ${s.nombre}` };
    if (r.confirmados === undefined) return { sensor: s.id, nombre: s.nombre, error: "Faltan los datos del otro satélite para el cruce" };
    const v1 = reporte.formato === "v1";
    let firmante = null;
    if (firma && chainId && fondo && !v1) {
      try {
        firmante = verifyTypedData(dominio(chainId, fondo), TIPOS, reporte, firma);
      } catch {
        firmante = null;
      }
    }
    const huellaOk = r.dataHash.toLowerCase() === String(reporte.dataHash).toLowerCase();
    // v1: los focos eran los de alta confianza (sin cruce) y no había hora del dato ni polígono en el reporte.
    const focosOk = (v1 ? r.altaConfianza : r.confirmados) === reporte.hotspots;
    const horaOk = v1 || horaSimulada || r.ultimaDeteccionUtc === reporte.dataTime;
    const poligonoOk = v1 || String(poligono).toLowerCase() === String(reporte.polygonHash).toLowerCase();
    return {
      formato: v1 ? "v1" : "v2",
      sensor: s.id,
      nombre: s.nombre,
      dataHashCadena: reporte.dataHash,
      dataHashRecalculado: r.dataHash,
      huellaOk,
      focosCadena: reporte.hotspots,
      focosRecalculados: v1 ? r.altaConfianza : r.confirmados,
      focosAltaConfianza: r.altaConfianza,
      focosOk,
      horaCadena: reporte.dataTime,
      horaRecalculada: r.ultimaDeteccionUtc,
      horaOk,
      poligonoCadena: reporte.polygonHash,
      poligonoLocal: poligono,
      poligonoOk,
      firmante,
      ok: huellaOk && focosOk && horaOk && poligonoOk,
    };
  });
}
