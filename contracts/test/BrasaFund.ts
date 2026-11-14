import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();

const U = (n: number) => BigInt(Math.round(n * 1e6)); // USDC con 6 decimales
const id = (s: string) => ethers.encodeBytes32String(s);
const ZONA = id("salta");
const COMBATE = U(300);
const LOGISTICA = U(50);
const ASISTENCIA = U(150); // 500 USDC por hectárea en total

const TYPES = {
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

async function deploy() {
  const [fed, treasury, o0, o1, donor, st1, st2, as1, outsider] = await ethers.getSigners();
  const usdc = await ethers.deployContract("MockUSDC");
  const fund = await ethers.deployContract("BrasaFund", [
    await usdc.getAddress(),
    treasury.address,
    300, // 3%
    U(2),
    fed.address,
    o0.address,
    o1.address,
    0, // demora de carnet: 0 en los tests (hay un test aparte con demora)
    0, // demora de rotación de oráculos: 0 en los tests (hay tests aparte con demora)
  ]);
  await usdc.mint(donor.address, U(1_000_000));
  await usdc.connect(donor).approve(await fund.getAddress(), ethers.MaxUint256);

  await fund.createZone(ZONA, id("poligono"), 3, 12 * 3600, U(10_000_000), COMBATE, LOGISTICA, ASISTENCIA);
  await fund.addRecipient(id("cuartel-1"), ZONA, 0, st1.address);
  await fund.addRecipient(id("cuartel-2"), ZONA, 0, st2.address);
  await fund.addRecipient(id("cruzroja"), ZONA, 1, as1.address);
  // La federación asigna los dos cuarteles al incendio (v3): sin asignación no se libera nada.
  const ahora = (await ethers.provider.getBlock("latest"))!.timestamp;
  await fund.setResponders(ZONA, [id("cuartel-1"), id("cuartel-2")], ahora + 29 * 24 * 3600);
  return { usdc, fund, fed, treasury, o0, o1, donor, st1, st2, as1, outsider };
}

type Mundo = Awaited<ReturnType<typeof deploy>>;

/** La federación asigna cuarteles al incendio de una zona por `dias` días. */
async function asignar(fund: any, zona: string, ids: string[], dias = 29) {
  const ahora = (await ethers.provider.getBlock("latest"))!.timestamp;
  await fund.setResponders(zona, ids, ahora + dias * 24 * 3600);
}

async function firmar(m: Mundo, signer: any, sensor: number, hotspots: number, nonce: number, observedAt?: number, zona = ZONA) {
  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const zonaInfo = await m.fund.zones(zona);
  const report = {
    zoneId: zona,
    polygonHash: zonaInfo.exists ? zonaInfo.polygonHash : ethers.ZeroHash,
    sensor,
    hotspots,
    observedAt: observedAt ?? now - 3600,
    dataTime: (observedAt ?? now - 3600) - 1800, // el dato de NASA es anterior a la lectura
    dataHash: ethers.keccak256(ethers.toUtf8Bytes(`datos-${sensor}-${nonce}`)),
    nonce,
  };
  const domain = {
    name: "BrasaFund",
    version: "3",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await m.fund.getAddress(),
  };
  const sig = await signer.signTypedData(domain, TYPES, report);
  return { report, sig };
}

async function par(m: Mundo, h0: number, h1: number, nonce = 1, obs0?: number, obs1?: number) {
  const a = await firmar(m, m.o0, 0, h0, nonce, obs0);
  const b = await firmar(m, m.o1, 1, h1, nonce, obs1);
  return { reports: [a.report, b.report] as const, sigs: [a.sig, b.sig] as const };
}

describe("BrasaFund", () => {
  describe("comisión del 3% y donaciones", () => {
    it("quoteFee redondea para arriba", async () => {
      const { fund } = await networkHelpers.loadFixture(deploy);
      expect(await fund.quoteFee(U(100))).to.equal(U(3));
      expect(await fund.quoteFee(U(2))).to.equal(60_000n);
      expect(await fund.quoteFee(1_000_001n)).to.equal(30_001n); // ceil(30000.03)
    });

    it("cubriendo la comisión: el fondo recibe el 100% y la tesorería el 3% aparte", async () => {
      const { fund, usdc, donor, treasury } = await networkHelpers.loadFixture(deploy);
      const antes = await usdc.balanceOf(donor.address);
      await expect(fund.connect(donor).donateToZone(ZONA, U(100), true))
        .to.emit(fund, "FeeTaken")
        .withArgs(treasury.address, U(3));
      expect(await fund.zoneBalance(ZONA)).to.equal(U(100));
      expect(await usdc.balanceOf(await fund.getAddress())).to.equal(U(100));
      expect(await usdc.balanceOf(treasury.address)).to.equal(U(3));
      expect(antes - (await usdc.balanceOf(donor.address))).to.equal(U(103));
    });

    it("por defecto la comisión se descuenta: dona 100, paga 100, llegan 97 y 3 a la tesorería", async () => {
      const { fund, usdc, donor, treasury } = await networkHelpers.loadFixture(deploy);
      const antes = await usdc.balanceOf(donor.address);
      await expect(fund.connect(donor).donateToZone(ZONA, U(100), false))
        .to.emit(fund, "Donated")
        .withArgs(ZONA, donor.address, U(97), U(3), false);
      expect(await fund.zoneBalance(ZONA)).to.equal(U(97));
      expect(await usdc.balanceOf(treasury.address)).to.equal(U(3));
      expect(antes - (await usdc.balanceOf(donor.address))).to.equal(U(100));
    });

    it("quoteSplit muestra los dos modos y no deja que la comisión supere el monto", async () => {
      const { fund } = await networkHelpers.loadFixture(deploy);
      const d = await fund.quoteSplit(U(100), false);
      expect([d[0], d[1], d[2]]).to.deep.equal([U(97), U(3), U(100)]);
      const c = await fund.quoteSplit(U(100), true);
      expect([c[0], c[1], c[2]]).to.deep.equal([U(100), U(3), U(103)]);
      // el neto más la comisión siempre da el total
      const x = await fund.quoteSplit(1_000_001n, false);
      expect(x[0] + x[1]).to.equal(1_000_001n);
    });

    it("el mínimo se mide sobre lo que llega (neto), no sobre lo que paga el donante", async () => {
      const { fund, donor } = await networkHelpers.loadFixture(deploy);
      // mínimo de la fixture: 2 USDC; pagar 2 deja 1,94 netos (se rechaza); pagar 2 y cubrir la comisión deja 2
      await expect(fund.connect(donor).donateToZone(ZONA, U(2), false)).to.be.revertedWithCustomError(fund, "BelowMinDonation");
      await fund.connect(donor).donateToZone(ZONA, U(2), true);
    });

    it("donar directo a un cuartel: le llega el 100% y el dinero no pasa por el contrato", async () => {
      const { fund, usdc, donor, st1, treasury } = await networkHelpers.loadFixture(deploy);
      await fund.connect(donor).donateToRecipient(id("cuartel-1"), U(50), true);
      expect(await usdc.balanceOf(st1.address)).to.equal(U(50));
      expect(await usdc.balanceOf(await fund.getAddress())).to.equal(0n);
      expect(await usdc.balanceOf(treasury.address)).to.equal(U(1.5));
    });

    it("rechaza donaciones bajo el mínimo, a zonas inexistentes y a credenciales revocadas", async () => {
      const { fund, donor } = await networkHelpers.loadFixture(deploy);
      await expect(fund.connect(donor).donateToZone(ZONA, U(1), true)).to.be.revertedWithCustomError(fund, "BelowMinDonation");
      await expect(fund.connect(donor).donateToZone(id("otra"), U(10), true)).to.be.revertedWithCustomError(fund, "UnknownZone");
      await fund.revokeRecipient(id("cuartel-1"));
      await expect(fund.connect(donor).donateToRecipient(id("cuartel-1"), U(10), true)).to.be.revertedWithCustomError(
        fund,
        "RecipientInactive",
      );
    });

    it("el tope de comisión es 5% y no hay función para cambiarla", async () => {
      const { usdc, fed, treasury, o0, o1 } = await networkHelpers.loadFixture(deploy);
      // Con la factory real: el objeto armado a mano dejaba escapar el rechazo y cortaba toda la corrida de tests.
      const factory = await ethers.getContractFactory("BrasaFund");
      await expect(
        factory.deploy(await usdc.getAddress(), treasury.address, 501, U(2), fed.address, o0.address, o1.address, 0, 0),
      ).to.be.revertedWithCustomError(factory, "BadConfig");
    });

    it("el mínimo de donación no puede ser 0 (evita aportes vacíos o que son solo comisión)", async () => {
      const { usdc, fed, treasury, o0, o1 } = await networkHelpers.loadFixture(deploy);
      const factory = await ethers.getContractFactory("BrasaFund");
      await expect(
        factory.deploy(await usdc.getAddress(), treasury.address, 300, 0, fed.address, o0.address, o1.address, 0, 0),
      ).to.be.revertedWithCustomError(factory, "BadConfig");
    });

    it("con comisión 0 no se cobra nada ni se emite FeeTaken", async () => {
      const { usdc, fed, treasury, o0, o1, donor } = await networkHelpers.loadFixture(deploy);
      const sinComision = await ethers.deployContract("BrasaFund", [
        await usdc.getAddress(), treasury.address, 0, U(2), fed.address, o0.address, o1.address, 0, 0,
      ]);
      await sinComision.createZone(ZONA, id("poligono"), 3, 12 * 3600, U(10_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await usdc.connect(donor).approve(await sinComision.getAddress(), ethers.MaxUint256);
      const antes = await usdc.balanceOf(treasury.address);
      await expect(sinComision.connect(donor).donateToZone(ZONA, U(100), false)).to.not.emit(sinComision, "FeeTaken");
      await expect(sinComision.connect(donor).donateToZone(ZONA, U(100), true)).to.not.emit(sinComision, "FeeTaken");
      expect(await sinComision.zoneBalance(ZONA)).to.equal(U(200));
      expect(await usdc.balanceOf(treasury.address)).to.equal(antes);
    });

    it("con un token que cobra al transferir, la zona acredita lo que llegó de verdad", async () => {
      const { fed, treasury, o0, o1, donor } = await networkHelpers.loadFixture(deploy);
      const token = await ethers.deployContract("MockFeeToken"); // se queda con el 1% de cada transferencia
      const f = await ethers.deployContract("BrasaFund", [
        await token.getAddress(), treasury.address, 300, U(2), fed.address, o0.address, o1.address, 0, 0,
      ]);
      await f.createZone(ZONA, id("poligono"), 3, 12 * 3600, U(10_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await token.mint(donor.address, U(1_000));
      await token.connect(donor).approve(await f.getAddress(), ethers.MaxUint256);
      // Dona 100 sin cubrir: se piden 97 al fondo, llegan 96,03 (el token se queda con el 1%).
      await expect(f.connect(donor).donateToZone(ZONA, U(100), false))
        .to.emit(f, "Donated").withArgs(ZONA, donor.address, U(96.03), U(3), false);
      expect(await f.zoneBalance(ZONA)).to.equal(U(96.03));
      expect(await f.zoneBalance(ZONA)).to.equal(await token.balanceOf(await f.getAddress()));
    });
  });

  describe("reportFire", () => {
    it("calcula la meta con la regla pública y libera min(saldo, meta)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(10_000), true);
      // 4 focos * 14 ha = 56 ha * 500 USDC/ha = 28.000 USDC de meta; el saldo (10.000) es menor
      const { reports, sigs } = await par(m, 5, 4);
      const [area, target] = await m.fund.previewTarget(ZONA, 4);
      expect(area).to.equal(56n);
      expect(target).to.equal(U(28_000));
      await expect(m.fund.reportFire(reports, sigs)).to.emit(m.fund, "FireEvent");
      expect(await m.fund.zoneBalance(ZONA)).to.equal(0n);
    });

    it("si el fondo supera la meta, libera solo la meta y el resto queda en reserva", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const { reports, sigs } = await par(m, 3, 3); // 42 ha * 500 = 21.000
      await m.fund.reportFire(reports, sigs);
      expect(await m.fund.zoneBalance(ZONA)).to.equal(U(79_000));
    });

    it("reparte: combate+logística a los cuarteles, asistencia a las entidades", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const { reports, sigs } = await par(m, 3, 3); // meta 21.000: 70% cuarteles (14.700), 30% asistencia (6.300)
      await m.fund.reportFire(reports, sigs);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(7_350));
      expect(await m.usdc.balanceOf(m.st2.address)).to.equal(U(7_350));
      expect(await m.usdc.balanceOf(m.as1.address)).to.equal(U(6_300));
      expect(await m.usdc.balanceOf(await m.fund.getAddress())).to.equal(U(79_000));
    });

    it("respeta el tope por evento", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.createZone(id("chica"), id("p"), 1, 0, U(1_000), COMBATE, LOGISTICA, ASISTENCIA);
      await m.fund.addRecipient(id("c-chica"), id("chica"), 0, m.st1.address);
      await asignar(m.fund, id("chica"), [id("c-chica")]);
      await m.fund.connect(m.donor).donateToZone(id("chica"), U(50_000), true);
      const a = await firmar(m, m.o0, 0, 5, 1, undefined, id("chica"));
      const b = await firmar(m, m.o1, 1, 5, 1, undefined, id("chica"));
      await m.fund.reportFire([a.report, b.report], [a.sig, b.sig]);
      expect(await m.fund.zoneBalance(id("chica"))).to.equal(U(49_000));
    });

    it("la meta usa el menor de los dos sensores (el más prudente)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(500_000), true);
      const { reports, sigs } = await par(m, 10, 3);
      await m.fund.reportFire(reports, sigs);
      expect(await m.fund.zoneBalance(ZONA)).to.equal(U(500_000) - U(21_000));
    });

    it("rechaza una firma que no es del oráculo autorizado", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const a = await firmar(m, m.outsider, 0, 5, 1); // cuenta ajena firma el sensor 0
      const b = await firmar(m, m.o1, 1, 5, 1);
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "BadSigner");
    });

    it("rechaza dos reportes del mismo sensor", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const a = await firmar(m, m.o0, 0, 5, 1);
      const b = await firmar(m, m.o0, 0, 5, 2);
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "BadReports");
    });

    it("rechaza cambiar el contenido después de firmar", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const { reports, sigs } = await par(m, 5, 5);
      const alterado = [{ ...reports[0], hotspots: 500 }, reports[1]] as const;
      await expect(m.fund.reportFire(alterado, sigs)).to.be.revertedWithCustomError(m.fund, "BadSigner");
    });

    it("no se puede reusar el mismo reporte (nonce) ni liberar dos veces dentro del cooldown", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const p = await par(m, 3, 3, 1);
      await m.fund.reportFire(p.reports, p.sigs);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.be.revertedWithCustomError(m.fund, "NonceUsed");
      const q = await par(m, 3, 3, 2); // reporte nuevo, pero dentro del cooldown de 12 h
      await expect(m.fund.reportFire(q.reports, q.sigs)).to.be.revertedWithCustomError(m.fund, "CooldownActive");
      await networkHelpers.time.increase(13 * 3600);
      const r = await par(m, 3, 3, 3);
      await m.fund.reportFire(r.reports, r.sigs); // pasado el cooldown, vale
    });

    it("rechaza reportes viejos, del futuro o muy separados en el tiempo", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const viejo = await par(m, 5, 5, 1, now - 7 * 3600, now - 3600);
      await expect(m.fund.reportFire(viejo.reports, viejo.sigs)).to.be.revertedWithCustomError(m.fund, "StaleReport");
      const futuro = await par(m, 5, 5, 2, now + 3600, now - 3600);
      await expect(m.fund.reportFire(futuro.reports, futuro.sigs)).to.be.revertedWithCustomError(m.fund, "StaleReport");
      const lejos = await par(m, 5, 5, 3, now - 5 * 3600, now - 1 * 3600);
      await expect(m.fund.reportFire(lejos.reports, lejos.sigs)).to.be.revertedWithCustomError(m.fund, "ReportsTooFarApart");
    });

    it("rechaza si algún sensor no llega al mínimo de focos", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const p = await par(m, 10, 2);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.be.revertedWithCustomError(m.fund, "NotEnoughHotspots");
    });

    it("un reporte firmado para este contrato no sirve en otro (dominio EIP-712)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const otro = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 300, U(2), m.fed.address, m.o0.address, m.o1.address, 0, 0,
      ]);
      await otro.createZone(ZONA, id("poligono"), 3, 0, U(1_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      const p = await par(m, 5, 5);
      await expect(otro.reportFire(p.reports, p.sigs)).to.be.revertedWithCustomError(otro, "BadSigner");
    });

    it("sin credenciales activas revierte (falla cerrado) y no se pierde el saldo", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.createZone(id("vacia"), id("p"), 1, 0, U(1_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await m.fund.connect(m.donor).donateToZone(id("vacia"), U(1_000), true);
      const a = await firmar(m, m.o0, 0, 5, 1, undefined, id("vacia"));
      const b = await firmar(m, m.o1, 1, 5, 1, undefined, id("vacia"));
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "NoResponders");
      expect(await m.fund.zoneBalance(id("vacia"))).to.equal(U(1_000));
    });

    it("una credencial revocada no cobra", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.fund.revokeRecipient(id("cuartel-2"));
      const p = await par(m, 3, 3);
      await m.fund.reportFire(p.reports, p.sigs);
      expect(await m.usdc.balanceOf(m.st2.address)).to.equal(0n);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(14_700));
    });
  });

  describe("poderes de la federación", () => {
    it("solo la federación crea zonas y da o quita credenciales", async () => {
      const { fund, outsider } = await networkHelpers.loadFixture(deploy);
      await expect(fund.connect(outsider).createZone(id("x"), id("p"), 1, 0, 1, 1, 1, 1)).to.be.revertedWithCustomError(fund, "NotFederation");
      await expect(fund.connect(outsider).addRecipient(id("y"), ZONA, 0, outsider.address)).to.be.revertedWithCustomError(fund, "NotFederation");
      await expect(fund.connect(outsider).revokeRecipient(id("cuartel-1"))).to.be.revertedWithCustomError(fund, "NotFederation");
    });

    it("la federación no tiene ninguna función para mover el fondo (ni siquiera ella)", async () => {
      const { fund } = await networkHelpers.loadFixture(deploy);
      const nombres = fund.interface.fragments
        .filter((f) => f.type === "function")
        .map((f: any) => f.name as string);
      for (const n of ["withdraw", "sweep", "rescue", "transfer", "setTreasury", "setFee", "setFeeBps", "pause"]) {
        expect(nombres).to.not.include(n);
      }
    });

    it("no se puede redefinir una zona", async () => {
      const { fund } = await networkHelpers.loadFixture(deploy);
      await expect(fund.createZone(ZONA, id("p"), 1, 0, 1, 1, 1, 1)).to.be.revertedWithCustomError(fund, "ZoneExists");
    });
  });

  describe("arreglos de la auditoría", () => {
    it("un carnet nuevo no cobra hasta pasada la demora (anti-autocredencial)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const lento = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 300, U(2), m.fed.address, m.o0.address, m.o1.address, 72 * 3600, 0,
      ]);
      await lento.createZone(ZONA, id("p"), 3, 0, U(1_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await lento.addRecipient(id("yo-mismo"), ZONA, 0, m.fed.address); // la federación se da carnet a sí misma
      await asignar(lento, ZONA, [id("yo-mismo")]); // y se asigna al incendio: igual no cobra antes de la demora
      await m.usdc.connect(m.donor).approve(await lento.getAddress(), ethers.MaxUint256);
      await lento.connect(m.donor).donateToZone(ZONA, U(10_000), true);
      await expect(lento.connect(m.donor).donateToRecipient(id("yo-mismo"), U(10), true)).to.be.revertedWithCustomError(lento, "NotYetActive");
      const dom = { name: "BrasaFund", version: "3", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await lento.getAddress() };
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const mk = async (signer: any, sensor: number, nonce: number) => {
        const report = { zoneId: ZONA, polygonHash: id("p"), sensor, hotspots: 5, observedAt: now - 600, dataTime: now - 2400, dataHash: ethers.ZeroHash, nonce };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const a = await mk(m.o0, 0, 1);
      const b = await mk(m.o1, 1, 1);
      await expect(lento.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(lento, "NoResponders");
    });

    it("un pago que falla (wallet bloqueada) no frena al resto y el dinero vuelve al fondo", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.usdc.setBlocked(m.st1.address, true);
      const p = await par(m, 3, 3);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.emit(m.fund, "PayoutFailed");
      expect(await m.usdc.balanceOf(m.st2.address)).to.equal(U(7_350));
      expect(await m.usdc.balanceOf(m.as1.address)).to.equal(U(6_300));
      // el saldo de la zona = lo que sobraba + lo que no se pudo pagar
      expect(await m.fund.zoneBalance(ZONA)).to.equal(U(79_000) + U(7_350));
    });

    it("revocar libera el lugar en la lista (el tope de 25 no se llena con bajas)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.createZone(id("z2"), id("p"), 1, 0, U(1_000), COMBATE, LOGISTICA, ASISTENCIA);
      for (let i = 0; i < 25; i++) await m.fund.addRecipient(id(`c${i}`), id("z2"), 0, m.outsider.address);
      await expect(m.fund.addRecipient(id("c25"), id("z2"), 0, m.outsider.address)).to.be.revertedWithCustomError(m.fund, "TooManyRecipients");
      await m.fund.revokeRecipient(id("c0"));
      await m.fund.addRecipient(id("c25"), id("z2"), 0, m.outsider.address); // ahora entra
      expect((await m.fund.stationIds(id("z2"))).length).to.equal(25);
    });

    it("un reporte que libera 0 no arranca el cooldown", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const vacio = await par(m, 3, 3, 1); // la zona no tiene saldo
      await m.fund.reportFire(vacio.reports, vacio.sigs);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(10_000), true);
      const real = await par(m, 3, 3, 2);
      await m.fund.reportFire(real.reports, real.sigs); // no hay CooldownActive
      expect(await m.fund.zoneBalance(ZONA)).to.equal(0n);
    });

    it("no se vuelve a contar una observación anterior a la última liberación", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.createZone(id("rapida"), id("p"), 1, 0, U(1_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await m.fund.addRecipient(id("c-rap"), id("rapida"), 0, m.st1.address);
      await asignar(m.fund, id("rapida"), [id("c-rap")]);
      await m.fund.connect(m.donor).donateToZone(id("rapida"), U(50_000), true);
      const a1 = await firmar(m, m.o0, 0, 3, 1, undefined, id("rapida"));
      const b1 = await firmar(m, m.o1, 1, 3, 1, undefined, id("rapida"));
      await m.fund.reportFire([a1.report, b1.report], [a1.sig, b1.sig]);
      const viejo = (await ethers.provider.getBlock("latest"))!.timestamp - 7200; // anterior a la liberación, pero dentro de 6 h
      const a2 = await firmar(m, m.o0, 0, 3, 2, viejo, id("rapida"));
      const b2 = await firmar(m, m.o1, 1, 3, 2, viejo, id("rapida"));
      await expect(m.fund.reportFire([a2.report, b2.report], [a2.sig, b2.sig])).to.be.revertedWithCustomError(m.fund, "StaleReport");
    });

    it("createZone pone cotas de cordura (cooldown y costos)", async () => {
      const { fund } = await networkHelpers.loadFixture(deploy);
      await expect(fund.createZone(id("x1"), id("p"), 1, 31 * 24 * 3600, 1, 1, 1, 1)).to.be.revertedWithCustomError(fund, "BadConfig");
      await expect(fund.createZone(id("x2"), id("p"), 1, 0, 1, ethers.MaxUint256 / 4n, 1, 1)).to.be.revertedWithCustomError(fund, "BadConfig");
    });
  });

  describe("v2: polígono, hora real del dato y totales", () => {
    // Firma un reporte armado a mano (para probar casos que firmar() no deja armar).
    async function firmarCon(m: Mundo, signer: any, campos: Record<string, any>, version = "3") {
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const report = {
        zoneId: ZONA,
        polygonHash: id("poligono"),
        sensor: 0,
        hotspots: 5,
        observedAt: now - 600,
        dataTime: now - 3600,
        dataHash: ethers.ZeroHash,
        nonce: 1,
        ...campos,
      };
      const domain = { name: "BrasaFund", version, chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await m.fund.getAddress() };
      return { report, sig: await signer.signTypedData(domain, TYPES, report) };
    }

    it("un reporte contado con otro polígono revierte", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const a = await firmarCon(m, m.o0, { sensor: 0, polygonHash: id("otro-poligono") });
      const b = await firmarCon(m, m.o1, { sensor: 1, polygonHash: id("otro-poligono") });
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "WrongPolygon");
    });

    it("las firmas con el dominio del v1 no sirven en el v2", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const a = await firmarCon(m, m.o0, { sensor: 0 }, "1");
      const b = await firmarCon(m, m.o1, { sensor: 1 }, "1");
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "BadSigner");
    });

    it("un dato posterior al reporte revierte", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const a = await firmarCon(m, m.o0, { sensor: 0, dataTime: now - 300 }); // observedAt = now - 600
      const b = await firmarCon(m, m.o1, { sensor: 1 });
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "BadReports");
    });

    it("con datos de NASA de hace más de 24 h no se libera nada", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const viejo = now - 25 * 3600; // como los datos guardados de otro día, con hora de reporte fresca
      const a = await firmarCon(m, m.o0, { sensor: 0, dataTime: viejo });
      const b = await firmarCon(m, m.o1, { sensor: 1, dataTime: viejo });
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "StaleReport");
    });

    it("la liberación publica la hora real del dato de cada sensor", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const a = await firmarCon(m, m.o0, { sensor: 0, dataTime: now - 4000 });
      const b = await firmarCon(m, m.o1, { sensor: 1, dataTime: now - 7000 });
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig]))
        .to.emit(m.fund, "FireEvent")
        .withArgs(ZONA, 1n, 5n, 70n, U(70 * 500), U(1_000), ethers.ZeroHash, ethers.ZeroHash, now - 4000, now - 7000);
    });

    it("zoneTotals suma lo donado y lo pagado, y cierra con el saldo", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), false); // llegan 970
      const p = await par(m, 3, 3); // meta 21.000
      await m.fund.reportFire(p.reports, p.sigs);
      const [donado, pagado] = await m.fund.zoneTotals(ZONA);
      expect(donado).to.equal(U(100_970));
      expect(pagado).to.equal(U(21_000));
      expect(donado - pagado).to.equal(await m.fund.zoneBalance(ZONA));
    });

    it("lo que no se pudo pagar no cuenta como pagado", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.usdc.setBlocked(m.st1.address, true);
      const p = await par(m, 3, 3);
      await m.fund.reportFire(p.reports, p.sigs);
      const [, pagado] = await m.fund.zoneTotals(ZONA);
      expect(pagado).to.equal(U(21_000) - U(7_350));
    });

    it("hotspots en el límite (65.535): calcula sin desbordar y respeta el saldo", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(500_000), true);
      const [area, meta] = await m.fund.previewTarget(ZONA, 65535);
      expect(area).to.equal(65535n * 14n);
      expect(meta).to.equal(65535n * 14n * U(500));
      const p = await par(m, 65535, 65535);
      await m.fund.reportFire(p.reports, p.sigs);
      const [, pagado] = await m.fund.zoneTotals(ZONA);
      expect(pagado).to.equal(U(500_000)); // todo el saldo, porque la meta y el tope de la fixture son mayores
    });

    it("el alta publica desde cuándo cobra (activeFrom) y la baja dice de qué zona era", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const lento = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 300, U(2), m.fed.address, m.o0.address, m.o1.address, 6 * 3600, 0,
      ]);
      await lento.createZone(ZONA, id("p"), 3, 0, U(1_000), COMBATE, LOGISTICA, ASISTENCIA);
      const tx = await lento.addRecipient(id("nuevo"), ZONA, 0, m.st1.address);
      const t = (await ethers.provider.getBlock(tx.blockNumber!))!.timestamp;
      await expect(tx).to.emit(lento, "RecipientAdded").withArgs(id("nuevo"), ZONA, 0, m.st1.address, t + 6 * 3600);
      await expect(lento.revokeRecipient(id("nuevo"))).to.emit(lento, "RecipientRevoked").withArgs(id("nuevo"), ZONA);
    });

    it("invariantes con operaciones al azar: el contrato tiene lo que dicen las zonas, la comisión no pasa el 5 % y nadie sin carnet cobra", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      let semilla = 12345;
      const azar = (n: number) => {
        semilla = (semilla * 1103515245 + 12345) % 2147483648;
        return semilla % n;
      };
      const fondo = await m.fund.getAddress();
      let nonce = 100;
      for (let i = 0; i < 40; i++) {
        const op = azar(3);
        if (op === 0) {
          const monto = U(3 + azar(50_000));
          const antesTes = await m.usdc.balanceOf(m.treasury.address);
          await m.fund.connect(m.donor).donateToZone(ZONA, monto, azar(2) === 0);
          const comision = (await m.usdc.balanceOf(m.treasury.address)) - antesTes;
          // la comisión se calcula sobre `amount` y redondea hacia arriba: como mucho 5 % más una unidad mínima
          expect(comision * 10_000n <= monto * 500n + 10_000n).to.equal(true);
        } else if (op === 1) {
          await networkHelpers.time.increase(13 * 3600); // pasa el cooldown de 12 h
          const h = 3 + azar(30);
          const p = await par(m, h, h + azar(5), nonce++);
          try {
            await m.fund.reportFire(p.reports, p.sigs);
          } catch {
            // un reporte que no corresponde puede revertir: los invariantes se chequean igual
          }
        } else {
          await networkHelpers.time.increase(azar(3600));
        }
        const enContrato = await m.usdc.balanceOf(fondo);
        const enZona = await m.fund.zoneBalance(ZONA);
        expect(enContrato >= enZona).to.equal(true);
        const [donado, pagado] = await m.fund.zoneTotals(ZONA);
        expect(donado - pagado).to.equal(enZona);
        expect(await m.usdc.balanceOf(m.outsider.address)).to.equal(0n);
      }
    });
  });

  describe("v3: cuartel asignado, rotación de claves, traspaso y dato nuevo", () => {
    it("solo cobran los cuarteles que la federación asignó al incendio", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await asignar(m.fund, ZONA, [id("cuartel-2")]);
      const p = await par(m, 3, 3);
      await m.fund.reportFire(p.reports, p.sigs);
      // 3 focos × 14 ha × 500 = 21.000: 14.700 de combate y logística, 6.300 de asistencia
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(0n);
      expect(await m.usdc.balanceOf(m.st2.address)).to.equal(U(14_700));
      expect(await m.usdc.balanceOf(m.as1.address)).to.equal(U(6_300));
    });

    it("sin asignación no se libera nada, y el mismo reporte sirve cuando la federación asigna", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.fund.setResponders(ZONA, [], 0); // la federación borra la asignación
      const p = await par(m, 3, 3);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.be.revertedWithCustomError(m.fund, "NoResponders");
      expect(await m.fund.zoneBalance(ZONA)).to.equal(U(100_000));
      await asignar(m.fund, ZONA, [id("cuartel-1")]);
      await m.fund.reportFire(p.reports, p.sigs);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(14_700));
    });

    it("una asignación vencida no vale", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await asignar(m.fund, ZONA, [id("cuartel-1")], 1);
      await networkHelpers.time.increase(2 * 24 * 3600);
      const p = await par(m, 3, 3);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.be.revertedWithCustomError(m.fund, "NoResponders");
    });

    it("sin entidades de asistencia, todo va a los cuarteles asignados", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.fund.revokeRecipient(id("cruzroja"));
      await asignar(m.fund, ZONA, [id("cuartel-1")]);
      const p = await par(m, 3, 3);
      await m.fund.reportFire(p.reports, p.sigs);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(21_000));
    });

    it("setResponders: solo la federación, solo cuarteles activos de esa zona, sin repetidos y con plazo válido", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const ahora = (await ethers.provider.getBlock("latest"))!.timestamp;
      const plazo = ahora + 24 * 3600;
      await expect(m.fund.connect(m.outsider).setResponders(ZONA, [id("cuartel-1")], plazo)).to.be.revertedWithCustomError(m.fund, "NotFederation");
      await expect(m.fund.setResponders(id("no-existe"), [id("cuartel-1")], plazo)).to.be.revertedWithCustomError(m.fund, "UnknownZone");
      await expect(m.fund.setResponders(ZONA, [id("nadie")], plazo)).to.be.revertedWithCustomError(m.fund, "UnknownRecipient");
      await expect(m.fund.setResponders(ZONA, [id("cruzroja")], plazo)).to.be.revertedWithCustomError(m.fund, "BadConfig"); // no es cuartel
      await expect(m.fund.setResponders(ZONA, [id("cuartel-1"), id("cuartel-1")], plazo)).to.be.revertedWithCustomError(m.fund, "BadConfig");
      await expect(m.fund.setResponders(ZONA, [id("cuartel-1")], ahora)).to.be.revertedWithCustomError(m.fund, "BadConfig"); // plazo vencido
      await expect(m.fund.setResponders(ZONA, [id("cuartel-1")], ahora + 31 * 24 * 3600)).to.be.revertedWithCustomError(m.fund, "BadConfig"); // más de 30 días
      await m.fund.createZone(id("otra"), id("p"), 1, 0, U(1_000), COMBATE, LOGISTICA, ASISTENCIA);
      await expect(m.fund.setResponders(id("otra"), [id("cuartel-1")], plazo)).to.be.revertedWithCustomError(m.fund, "BadConfig"); // es de otra zona
      await m.fund.revokeRecipient(id("cuartel-2"));
      await expect(m.fund.setResponders(ZONA, [id("cuartel-2")], plazo)).to.be.revertedWithCustomError(m.fund, "RecipientInactive");
      await expect(m.fund.setResponders(ZONA, [id("cuartel-1")], plazo)).to.emit(m.fund, "RespondersSet").withArgs(ZONA, [id("cuartel-1")], plazo);
      const [ids, hasta] = await m.fund.responders(ZONA);
      expect(ids).to.deep.equal([id("cuartel-1")]);
      expect(hasta).to.equal(BigInt(plazo));
    });

    it("un mismo dato de NASA no paga dos veces, aunque pase el cooldown", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const t0 = (await ethers.provider.getBlock("latest"))!.timestamp;
      const dato = t0 - 600; // la pasada del satélite
      const dom = { name: "BrasaFund", version: "3", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await m.fund.getAddress() };
      const mk = async (signer: any, sensor: number, nonce: number, observedAt: number, dataTime: number) => {
        const report = { zoneId: ZONA, polygonHash: id("poligono"), sensor, hotspots: 3, observedAt, dataTime, dataHash: ethers.ZeroHash, nonce };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const a1 = await mk(m.o0, 0, 1, t0 - 60, dato);
      const b1 = await mk(m.o1, 1, 1, t0 - 60, dato);
      await m.fund.reportFire([a1.report, b1.report], [a1.sig, b1.sig]);
      await networkHelpers.time.increase(13 * 3600); // pasa el cooldown de 12 h; el dato tiene 13 h, todavía menos de 24
      const t1 = (await ethers.provider.getBlock("latest"))!.timestamp;
      const a2 = await mk(m.o0, 0, 2, t1 - 60, dato);
      const b2 = await mk(m.o1, 1, 2, t1 - 60, dato);
      await expect(m.fund.reportFire([a2.report, b2.report], [a2.sig, b2.sig])).to.be.revertedWithCustomError(m.fund, "StaleReport");
      // con una pasada nueva de los dos satélites sí paga
      const a3 = await mk(m.o0, 0, 3, t1 - 60, t1 - 300);
      const b3 = await mk(m.o1, 1, 3, t1 - 60, t1 - 300);
      await m.fund.reportFire([a3.report, b3.report], [a3.sig, b3.sig]);
      expect((await m.fund.zones(ZONA)).lastDataTime0).to.equal(BigInt(t1 - 300));
      expect((await m.fund.zones(ZONA)).lastDataTime1).to.equal(BigInt(t1 - 300));
    });

    it("rotar una clave de oráculo: propuesta pública, demora y recién después vale", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const [, , , , , , , , , nuevo] = await ethers.getSigners();
      const lento = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 300, U(2), m.fed.address, m.o0.address, m.o1.address, 0, 48 * 3600,
      ]);
      await lento.createZone(ZONA, id("poligono"), 3, 0, U(10_000_000), COMBATE, LOGISTICA, ASISTENCIA);
      await lento.addRecipient(id("cuartel-1"), ZONA, 0, m.st1.address);
      await asignar(lento, ZONA, [id("cuartel-1")]);
      await m.usdc.connect(m.donor).approve(await lento.getAddress(), ethers.MaxUint256);
      await lento.connect(m.donor).donateToZone(ZONA, U(100_000), true);

      await expect(lento.connect(m.outsider).proposeOracle(0, nuevo.address)).to.be.revertedWithCustomError(lento, "NotFederation");
      await expect(lento.proposeOracle(2, nuevo.address)).to.be.revertedWithCustomError(lento, "BadConfig");
      await expect(lento.proposeOracle(0, ethers.ZeroAddress)).to.be.revertedWithCustomError(lento, "BadConfig");
      await expect(lento.proposeOracle(0, m.o1.address)).to.be.revertedWithCustomError(lento, "BadConfig"); // ya es el otro sensor
      await expect(lento.acceptOracle(0)).to.be.revertedWithCustomError(lento, "NothingPending");
      await expect(lento.proposeOracle(0, nuevo.address)).to.emit(lento, "OracleProposed");
      await expect(lento.acceptOracle(0)).to.be.revertedWithCustomError(lento, "NotYetActive");
      expect(await lento.oracle0()).to.equal(m.o0.address); // durante la demora sigue valiendo la clave vieja

      await networkHelpers.time.increase(48 * 3600 + 1);
      await expect(lento.connect(m.outsider).acceptOracle(0)).to.emit(lento, "OracleChanged").withArgs(0, m.o0.address, nuevo.address);
      expect(await lento.oracle0()).to.equal(nuevo.address);

      const dom = { name: "BrasaFund", version: "3", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await lento.getAddress() };
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const mk = async (signer: any, sensor: number, nonce: number) => {
        const report = { zoneId: ZONA, polygonHash: id("poligono"), sensor, hotspots: 3, observedAt: now - 60, dataTime: now - 600, dataHash: ethers.ZeroHash, nonce };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const vieja = await mk(m.o0, 0, 1);
      const b = await mk(m.o1, 1, 1);
      await expect(lento.reportFire([vieja.report, b.report], [vieja.sig, b.sig])).to.be.revertedWithCustomError(lento, "BadSigner");
      const nueva = await mk(nuevo, 0, 1);
      await lento.reportFire([nueva.report, b.report], [nueva.sig, b.sig]);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(21_000));
    });

    it("los dos sensores nunca quedan con la misma clave, y una propuesta se puede cancelar", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const [, , , , , , , , , nuevo] = await ethers.getSigners();
      await m.fund.proposeOracle(0, nuevo.address);
      await m.fund.acceptOracle(0);
      await expect(m.fund.proposeOracle(1, nuevo.address)).to.be.revertedWithCustomError(m.fund, "BadConfig"); // ya es el sensor 0
      await m.fund.proposeOracle(1, m.outsider.address);
      await expect(m.fund.connect(m.outsider).cancelOracle(1)).to.be.revertedWithCustomError(m.fund, "NotFederation");
      await expect(m.fund.cancelOracle(1)).to.emit(m.fund, "OracleProposalCancelled").withArgs(1);
      await expect(m.fund.acceptOracle(1)).to.be.revertedWithCustomError(m.fund, "NothingPending");
      await expect(m.fund.cancelOracle(1)).to.be.revertedWithCustomError(m.fund, "NothingPending");
      expect(await m.fund.oracle1()).to.equal(m.o1.address);
    });

    it("las claves se rotan de a una: no se pueden reemplazar las dos de golpe", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const [, , , , , , , , , x, y] = await ethers.getSigners();
      const lento = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 300, U(2), m.fed.address, m.o0.address, m.o1.address, 0, 48 * 3600,
      ]);
      await lento.proposeOracle(0, x.address);
      await expect(lento.proposeOracle(1, y.address)).to.be.revertedWithCustomError(lento, "RotationInProgress"); // hay una pendiente
      await networkHelpers.time.increase(48 * 3600 + 1);
      await lento.acceptOracle(0);
      await expect(lento.proposeOracle(1, y.address)).to.be.revertedWithCustomError(lento, "RotationInProgress"); // cambió hace menos de 48 h
      await networkHelpers.time.increase(48 * 3600 + 1);
      await lento.proposeOracle(1, y.address); // recién ahora, y todavía le falta su propia demora
      await expect(lento.acceptOracle(1)).to.be.revertedWithCustomError(lento, "NotYetActive");
    });

    it("una propuesta de clave vence a los 7 días y no sobrevive al traspaso de la federación", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const [, , , , , , , , , x] = await ethers.getSigners();
      await m.fund.proposeOracle(0, x.address);
      await networkHelpers.time.increase(7 * 24 * 3600 + 60);
      await expect(m.fund.acceptOracle(0)).to.be.revertedWithCustomError(m.fund, "ProposalExpired");
      await m.fund.cancelOracle(0);
      // la federación saliente deja una propuesta y traspasa: la nueva no la hereda
      await m.fund.proposeOracle(0, x.address);
      await m.fund.transferFederation(m.outsider.address);
      await m.fund.connect(m.outsider).acceptFederation();
      await expect(m.fund.acceptOracle(0)).to.be.revertedWithCustomError(m.fund, "NothingPending");
      expect(await m.fund.oracle0()).to.equal(m.o0.address);
    });

    it("las demoras tienen tope de 30 días", async () => {
      const { usdc, treasury, fed, o0, o1 } = await networkHelpers.loadFixture(deploy);
      const factory = await ethers.getContractFactory("BrasaFund");
      const d = 31 * 24 * 3600;
      await expect(factory.deploy(await usdc.getAddress(), treasury.address, 500, U(2), fed.address, o0.address, o1.address, d, 0)).to.be.revertedWithCustomError(factory, "BadConfig");
      await expect(factory.deploy(await usdc.getAddress(), treasury.address, 500, U(2), fed.address, o0.address, o1.address, 0, d)).to.be.revertedWithCustomError(factory, "BadConfig");
    });

    it("cada sensor se compara con su propio dato anterior (horas distintas no frenan un pago legítimo)", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const dom = { name: "BrasaFund", version: "3", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await m.fund.getAddress() };
      const mk = async (signer: any, sensor: number, nonce: number, observedAt: number, dataTime: number) => {
        const report = { zoneId: ZONA, polygonHash: id("poligono"), sensor, hotspots: 3, observedAt, dataTime, dataHash: ethers.ZeroHash, nonce };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const t0 = (await ethers.provider.getBlock("latest"))!.timestamp;
      // primer pago: el sensor 0 trae un dato de hace 8 h y el sensor 1 uno de hace 10 min
      const a1 = await mk(m.o0, 0, 1, t0 - 60, t0 - 8 * 3600);
      const b1 = await mk(m.o1, 1, 1, t0 - 60, t0 - 600);
      await m.fund.reportFire([a1.report, b1.report], [a1.sig, b1.sig]);
      await networkHelpers.time.increase(13 * 3600);
      const t1 = (await ethers.provider.getBlock("latest"))!.timestamp;
      // segundo pago: el sensor 0 tiene una pasada nueva, pero ANTERIOR al dato viejo del sensor 1. Vale igual.
      const a2 = await mk(m.o0, 0, 2, t1 - 60, t0 - 3600);
      const b2 = await mk(m.o1, 1, 2, t1 - 60, t1 - 600);
      await m.fund.reportFire([b2.report, a2.report], [b2.sig, a2.sig]); // en cualquier orden
      const z = await m.fund.zones(ZONA);
      expect(z.lastDataTime0).to.equal(BigInt(t0 - 3600));
      expect(z.lastDataTime1).to.equal(BigInt(t1 - 600));
    });

    it("si no se pudo pagar nada, no se gastan ni el cooldown ni el dato", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      await m.fund.revokeRecipient(id("cruzroja"));
      await asignar(m.fund, ZONA, [id("cuartel-1")]);
      await m.usdc.setBlocked(m.st1.address, true); // el emisor del USDC bloqueó la única wallet asignada
      const p = await par(m, 3, 3);
      await expect(m.fund.reportFire(p.reports, p.sigs)).to.emit(m.fund, "PayoutFailed");
      const z = await m.fund.zones(ZONA);
      expect(z.lastRelease).to.equal(0n);
      expect(z.lastDataTime0).to.equal(0n);
      expect(await m.fund.zoneBalance(ZONA)).to.equal(U(100_000));
      // la federación reasigna y el pago sale enseguida, sin esperar el cooldown
      await asignar(m.fund, ZONA, [id("cuartel-2")]);
      const q = await par(m, 3, 3, 2);
      await m.fund.reportFire(q.reports, q.sigs);
      expect(await m.usdc.balanceOf(m.st2.address)).to.equal(U(21_000));
    });

    it("traspaso de la federación en dos pasos: la nueva acepta y la vieja pierde el rol", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await expect(m.fund.connect(m.outsider).transferFederation(m.outsider.address)).to.be.revertedWithCustomError(m.fund, "NotFederation");
      await expect(m.fund.transferFederation(m.outsider.address)).to.emit(m.fund, "FederationTransferStarted").withArgs(m.fed.address, m.outsider.address);
      expect(await m.fund.federation()).to.equal(m.fed.address); // hasta que acepte, no cambia nada
      await expect(m.fund.connect(m.donor).acceptFederation()).to.be.revertedWithCustomError(m.fund, "NotPendingFederation");
      await expect(m.fund.connect(m.outsider).acceptFederation()).to.emit(m.fund, "FederationChanged").withArgs(m.fed.address, m.outsider.address);
      expect(await m.fund.federation()).to.equal(m.outsider.address);
      expect(await m.fund.pendingFederation()).to.equal(ethers.ZeroAddress);
      await expect(m.fund.addRecipient(id("x"), ZONA, 0, m.st1.address)).to.be.revertedWithCustomError(m.fund, "NotFederation");
      await m.fund.connect(m.outsider).addRecipient(id("x"), ZONA, 0, m.st1.address);
    });

    it("el traspaso se puede cancelar antes de que la nueva acepte", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.transferFederation(m.outsider.address);
      await m.fund.transferFederation(ethers.ZeroAddress);
      await expect(m.fund.connect(m.outsider).acceptFederation()).to.be.revertedWithCustomError(m.fund, "NotPendingFederation");
      expect(await m.fund.federation()).to.equal(m.fed.address);
    });

    it("las firmas con el dominio del v2 no sirven en el v3", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      await m.fund.connect(m.donor).donateToZone(ZONA, U(1_000), true);
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const dom = { name: "BrasaFund", version: "2", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await m.fund.getAddress() };
      const mk = async (signer: any, sensor: number) => {
        const report = { zoneId: ZONA, polygonHash: id("poligono"), sensor, hotspots: 5, observedAt: now - 60, dataTime: now - 600, dataHash: ethers.ZeroHash, nonce: 1 };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const a = await mk(m.o0, 0);
      const b = await mk(m.o1, 1);
      await expect(m.fund.reportFire([a.report, b.report], [a.sig, b.sig])).to.be.revertedWithCustomError(m.fund, "BadSigner");
    });

    it("con el mínimo de 0,01 USDC se puede donar un centavo y la comisión se cobra igual", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const micro = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 500, 10_000n, m.fed.address, m.o0.address, m.o1.address, 0, 0,
      ]);
      await micro.createZone(ZONA, id("poligono"), 2, 12 * 3600, U(10_000_000), U(280), U(40), U(80));
      await m.usdc.connect(m.donor).approve(await micro.getAddress(), ethers.MaxUint256);
      await expect(micro.connect(m.donor).donateToZone(ZONA, 10_000n, true)).to.emit(micro, "FeeTaken").withArgs(m.treasury.address, 500n);
      expect(await micro.zoneBalance(ZONA)).to.equal(10_000n);
      await expect(micro.connect(m.donor).donateToZone(ZONA, 9_999n, true)).to.be.revertedWithCustomError(micro, "BelowMinDonation");
    });

    it("con 400 USD por hectárea y reparto 80 / 20: 320 a los cuarteles asignados y 80 a la asistencia", async () => {
      const m = await networkHelpers.loadFixture(deploy);
      const v3 = await ethers.deployContract("BrasaFund", [
        await m.usdc.getAddress(), m.treasury.address, 500, 10_000n, m.fed.address, m.o0.address, m.o1.address, 0, 0,
      ]);
      await v3.createZone(ZONA, id("poligono"), 2, 12 * 3600, U(10_000_000), U(280), U(40), U(80));
      await v3.addRecipient(id("cuartel-1"), ZONA, 0, m.st1.address);
      await v3.addRecipient(id("cruzroja"), ZONA, 1, m.as1.address);
      await asignar(v3, ZONA, [id("cuartel-1")]);
      await m.usdc.connect(m.donor).approve(await v3.getAddress(), ethers.MaxUint256);
      await v3.connect(m.donor).donateToZone(ZONA, U(100_000), true);
      const [areaHa, meta] = await v3.previewTarget(ZONA, 10);
      expect(areaHa).to.equal(140n);
      expect(meta).to.equal(U(56_000)); // 10 focos × 14 ha × 400
      const dom = { name: "BrasaFund", version: "3", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await v3.getAddress() };
      const now = (await ethers.provider.getBlock("latest"))!.timestamp;
      const mk = async (signer: any, sensor: number) => {
        const report = { zoneId: ZONA, polygonHash: id("poligono"), sensor, hotspots: 10, observedAt: now - 60, dataTime: now - 600, dataHash: ethers.ZeroHash, nonce: 1 };
        return { report, sig: await signer.signTypedData(dom, TYPES, report) };
      };
      const a = await mk(m.o0, 0);
      const b = await mk(m.o1, 1);
      await v3.reportFire([a.report, b.report], [a.sig, b.sig]);
      expect(await m.usdc.balanceOf(m.st1.address)).to.equal(U(44_800)); // 80 %
      expect(await m.usdc.balanceOf(m.as1.address)).to.equal(U(11_200)); // 20 %
    });
  });
});
