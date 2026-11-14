// Construcción y firma (EIP-712) del reporte de un sensor. Formato del contrato v2.
import { Wallet } from "ethers";
import { randomBytes } from "node:crypto";

export const TIPOS = {
  FireReport: [
    { name: "zoneId", type: "bytes32" },
    { name: "polygonHash", type: "bytes32" },
    { name: "sensor", type: "uint8" },
    { name: "hotspots", type: "uint16" },
    { name: "observedAt", type: "uint64" },
    { name: "dataTime", type: "uint64" },
    { name: "dataHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

/** Dominio EIP-712 del contrato v2. Las firmas del v1 (versión "1") no sirven acá. */
export function dominio(chainId, fondo) {
  return { name: "BrasaFund", version: "3", chainId, verifyingContract: fondo };
}

export const MAX_FOCOS = 65535; // lo que entra en uint16

/**
 * Firma el reporte de un sensor. `clave` es la clave privada del oráculo de ese sensor (nunca se guarda).
 * `polygonHash`: huella del polígono con el que se contaron los focos. `dataTime`: hora real (UTC, segundos)
 * de la detección más nueva de NASA que se usó. `observedAt`: cuándo se armó el reporte.
 */
export async function firmarReporte({ clave, chainId, fondo, zoneId, polygonHash, sensor, hotspots, observedAt, dataTime, dataHash, nonce }) {
  if (!Number.isInteger(hotspots) || hotspots < 0 || hotspots > MAX_FOCOS) {
    // Antes se recortaba en silencio; ahora se corta: un conteo que no entra es un error, no un dato.
    throw new Error(`Cantidad de focos fuera de rango (${hotspots}): el reporte admite de 0 a ${MAX_FOCOS}. No firmo.`);
  }
  if (!(dataTime <= observedAt)) throw new Error("La hora del dato no puede ser posterior a la del reporte. No firmo.");
  const wallet = new Wallet(clave);
  const reporte = { zoneId, polygonHash, sensor, hotspots, observedAt, dataTime, dataHash, nonce };
  const firma = await wallet.signTypedData(dominio(chainId, fondo), TIPOS, reporte);
  return { reporte, firma, firmante: wallet.address };
}

/** Nonce único por ejecución: el contrato rechaza repetirlo, así un reintento no libera dos veces. */
export function nuevoNonce() {
  return BigInt("0x" + randomBytes(16).toString("hex")); // 128 bits al azar: no se repite ni entre ejecuciones simultáneas
}
