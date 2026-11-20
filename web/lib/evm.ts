// La red anterior (contratos EVM en Avalanche). Se carga solo si el despliegue no es de Stellar,
// así la librería ethers no pesa en la portada.
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { ERC20_ABI, FUND_ABI, V1_ZONES_ABI, V2_ZONES_ABI } from "./abi";
import { FUJI_ID, bytes32Label, esV2, esV3, fmtUsdc, getEth, type Deployment, type EventoLog, type Reparto, type ZoneData } from "./chain";

export const readProvider = (d: Deployment) => new JsonRpcProvider(d.rpc, d.chainId, { staticNetwork: true });

export async function loadZoneEvm(d: Deployment, hotspots: number): Promise<ZoneData> {
  const p = readProvider(d);
  const c = new Contract(d.fund, FUND_ABI, p);
  // El v1 tiene otra forma de zones(): se lee con su propio fragmento. Los campos se leen por nombre, no por posición.
  // El v3 agregó un campo al final de zones(), así que el v2 también usa su propio fragmento.
  const zonas = esV3(d) ? c : new Contract(d.fund, esV2(d) ? V2_ZONES_ABI : V1_ZONES_ABI, p);
  const [prev, z, balance, stations, assist, totales] = await Promise.all([
    c.getFunction("previewTarget")(d.zoneId, BigInt(hotspots)),
    zonas.getFunction("zones")(d.zoneId),
    c.getFunction("zoneBalance")(d.zoneId),
    c.getFunction("stationIds")(d.zoneId),
    c.getFunction("assistanceIds")(d.zoneId),
    esV2(d) ? c.getFunction("zoneTotals")(d.zoneId) : Promise.resolve(null),
  ]);
  // Lecturas extra: si fallan, la zona se muestra igual.
  const [resp, minDon] = await Promise.all([
    esV3(d)
      ? c.getFunction("responders")(d.zoneId).then(
          (r) => ({ ids: [...(r[0] as string[])], hasta: Number(r[1] as bigint) }),
          () => null,
        )
      : Promise.resolve(null),
    esV2(d) ? c.getFunction("minDonation")().then((v) => v as bigint, () => null) : Promise.resolve(null),
  ]);
  const areaHa = prev[0] as bigint;
  const ids: { id: string; kind: "station" | "assistance" }[] = [
    ...(stations as string[]).map((id) => ({ id, kind: "station" as const })),
    ...(assist as string[]).map((id) => ({ id, kind: "assistance" as const })),
  ];
  const recipients = await Promise.all(
    ids.map(async ({ id, kind }) => {
      const r = await c.getFunction("recipients")(id);
      return {
        id,
        label: bytes32Label(id),
        wallet: r.wallet as string,
        kind,
        active: r.active as boolean,
        activeFrom: Number(r.activeFrom as bigint),
      };
    }),
  );

  // Un movimiento del contrato, venga del RPC o del explorador.
  type Crudo = { nombre: string; args: Record<string, unknown>; tx: string; bloque: number };
  const aEvento = (l: Crudo): EventoLog => {
    const a = l.args;
    const tipo = l.nombre as EventoLog["tipo"];
    const donante = String(a.donor ?? "");
    const texto =
      tipo === "FireEvent"
        ? `Evento #${a.eventId}: ${a.hotspots} ${a.hotspots === 1n ? "foco" : "focos"}, liberó ${fmtUsdc(a.released as bigint)} USDC`
        : tipo === "Released"
          ? `Evento #${a.eventId}: ${fmtUsdc(a.amount as bigint)} USDC a ${bytes32Label(a.recipientId as string)}`
          : `Donación: ${fmtUsdc(a.net as bigint)} USDC al fondo (de ${donante.slice(0, 6)}…${donante.slice(-4)})`;
    return { tipo, texto, tx: l.tx, bloque: l.bloque };
  };
  let crudos: Crudo[] = [];
  try {
    const latest = await p.getBlockNumber();
    const from = Math.max(0, latest - 2000);
    const [fires, rels, dons] = await Promise.all([
      c.queryFilter(c.filters.FireEvent(d.zoneId), from),
      c.queryFilter(c.filters.Released(d.zoneId), from),
      c.queryFilter(c.filters.Donated(d.zoneId), from), // donaciones al fondo de la zona
    ]);
    crudos = [...fires, ...rels, ...dons].map((l) => {
      const el = l as unknown as { args: Record<string, unknown>; fragment: { name: string } };
      return { nombre: el.fragment.name, args: el.args, tx: l.transactionHash, bloque: l.blockNumber };
    });
  } catch {
    // El RPC público de Fuji limita el rango de logs. En ese caso se leen del explorador, que los tiene indexados.
    try {
      if (d.chainId === FUJI_ID) {
        const url = `https://api.routescan.io/v2/network/testnet/evm/${FUJI_ID}/etherscan/api?module=logs&action=getLogs&address=${d.fund}&fromBlock=${d.deployBlock ?? 0}&toBlock=latest`;
        const j = (await (await fetch(url)).json()) as {
          result?: { topics: string[]; data: string; transactionHash: string; blockNumber: string }[];
        };
        for (const l of Array.isArray(j.result) ? j.result : []) {
          const pl = c.interface.parseLog({ topics: l.topics, data: l.data });
          if (!pl || !["FireEvent", "Released", "Donated"].includes(pl.name)) continue;
          if (String(l.topics[1]).toLowerCase() !== String(d.zoneId).toLowerCase()) continue; // solo la zona que se muestra
          crudos.push({
            nombre: pl.name,
            args: pl.args as unknown as Record<string, unknown>,
            tx: l.transactionHash,
            bloque: Number(l.blockNumber),
          });
        }
      }
    } catch {
      crudos = []; // sin historial la web sigue andando: los totales salen del contrato
    }
  }
  const eventos: EventoLog[] = crudos
    .map(aEvento)
    .sort((x, y) => y.bloque - x.bloque)
    .slice(0, 6);

  return {
    areaHa,
    target: prev[1] as bigint,
    combate: areaHa * (z.costCombatPerHa as bigint),
    logistica: areaHa * (z.costLogisticsPerHa as bigint),
    asistencia: areaHa * (z.costAssistPerHa as bigint),
    maxPerEvent: z.maxPerEvent as bigint,
    costoHa: (z.costCombatPerHa as bigint) + (z.costLogisticsPerHa as bigint) + (z.costAssistPerHa as bigint),
    costosHa: {
      combate: z.costCombatPerHa as bigint,
      logistica: z.costLogisticsPerHa as bigint,
      asistencia: z.costAssistPerHa as bigint,
    },
    balance: balance as bigint,
    totalDonated: totales ? (totales[0] as bigint) : null,
    totalReleased: totales ? (totales[1] as bigint) : null,
    hotspots,
    minHotspots: Number(z.minHotspots),
    recipients,
    responders: resp?.ids ?? [],
    respondersUntil: resp?.hasta ?? 0,
    minDonation: minDon,
    eventos,
  };
}

export async function quoteSplitEvm(d: Deployment, amount: bigint, coverFee: boolean): Promise<Reparto> {
  const c = new Contract(d.fund, FUND_ABI, readProvider(d));
  const [net, fee, total] = (await c.getFunction("quoteSplit")(amount, coverFee)) as [bigint, bigint, bigint];
  return { net, fee, total };
}

export async function usdcBalanceEvm(d: Deployment, who: string): Promise<bigint> {
  const u = new Contract(d.usdc, ERC20_ABI, readProvider(d));
  return (await u.getFunction("balanceOf")(who)) as bigint;
}

/** approve(total) y donateToZone(monto, coverFee). Avisa cada paso con onStep. */
export async function donarEvm(
  d: Deployment,
  amount: bigint,
  coverFee: boolean,
  total: bigint,
  onStep: (s: { paso: "approve" | "donar"; hash: string }) => void,
): Promise<string> {
  const eth = getEth();
  if (!eth) throw new Error("No hay billetera");
  const signer = await new BrowserProvider(eth).getSigner();
  const who = await signer.getAddress();
  const usdc = new Contract(d.usdc, ERC20_ABI, signer);
  const need = total;
  const have = (await usdc.getFunction("allowance")(who, d.fund)) as bigint;
  if (have < need) {
    const tx = await usdc.getFunction("approve")(d.fund, need);
    onStep({ paso: "approve", hash: tx.hash });
    await tx.wait();
  }
  const fund = new Contract(d.fund, FUND_ABI, signer);
  const tx = await fund.getFunction("donateToZone")(d.zoneId, amount, coverFee);
  onStep({ paso: "donar", hash: tx.hash });
  await tx.wait();
  return tx.hash as string;
}
