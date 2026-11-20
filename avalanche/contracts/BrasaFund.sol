// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BrasaFund
/// @notice Fondo de emergencia por zona para incendios. Cuando dos sensores satelitales
///         (dos firmas distintas) detectan fuego en una zona, el contrato calcula la META
///         con una regla pública y libera plata a cuarteles y entidades de asistencia
///         con credencial. No hay ninguna función para retirar el fondo: solo cobran destinatarios
///         con credencial, que la federación da con una demora pública (`recipientDelay`).
///         En la demo, federación y oráculos son del equipo; en el piloto, de terceros. La comisión (feeBps) se descuenta del aporte
///         por defecto y va directo a la tesorería. El donante puede elegir cubrirla para que llegue el 100%.
///         Se ve en el evento FeeTaken.
///         v3: la federación asigna qué cuarteles combaten el incendio (solo esos cobran), las claves de los
///         oráculos se pueden rotar con una demora pública, el rol de federación se traspasa en dos pasos
///         y un mismo dato de NASA no puede pagar dos veces.
/// @dev    MVP del hackathon, solo testnet. Sin auditoría externa.
contract BrasaFund is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- constantes
    /// @notice Hectáreas que se cuentan por foco de VIIRS (cota superior, no superficie quemada).
    uint256 public constant HA_PER_HOTSPOT = 14;
    /// @notice Tope duro de la comisión: 5%.
    uint16 public constant MAX_FEE_BPS = 500;
    uint64 public constant MAX_REPORT_AGE = 6 hours;
    uint64 public constant MAX_REPORT_SPREAD = 3 hours;
    /// @notice El dato de NASA más nuevo que usa un reporte no puede tener más de 24 h: no se paga con datos viejos.
    uint64 public constant MAX_DATA_AGE = 24 hours;
    uint256 public constant MAX_RECIPIENTS_PER_GROUP = 25;
    uint64 public constant MAX_COOLDOWN = 30 days;
    uint256 public constant MAX_COST_PER_HA = 1_000_000e6; // tope de cordura: 1 millón de USDC por hectárea
    /// @notice Una asignación de cuarteles a un incendio vale, como mucho, 30 días.
    uint64 public constant MAX_ASSIGNMENT = 30 days;
    /// @notice Tope de cordura para las dos demoras públicas (carnets y rotación de oráculos).
    uint64 public constant MAX_DELAY = 30 days;
    /// @notice Una propuesta de clave de oráculo vence si no se aplica en este plazo desde que pudo aplicarse.
    uint64 public constant ORACLE_PROPOSAL_WINDOW = 7 days;

    bytes32 private constant FIRE_REPORT_TYPEHASH = keccak256(
        "FireReport(bytes32 zoneId,bytes32 polygonHash,uint8 sensor,uint16 hotspots,uint64 observedAt,uint64 dataTime,bytes32 dataHash,uint256 nonce)"
    );

    // ---------------------------------------------------------------- configuración fija
    /// @notice Única moneda aceptada.
    IERC20 public immutable usdc;
    /// @notice Wallet que cobra la comisión. Es lo único que cobra Brasa.
    address public immutable treasury;
    uint16 public immutable feeBps;
    uint256 public immutable minDonation;
    /// @notice Quien da el carnet a los destinatarios, crea zonas y asigna cuarteles (en la demo: wallet de prueba).
    ///         Se traspasa en dos pasos: `transferFederation` y `acceptFederation`.
    address public federation;
    address public pendingFederation;
    /// @notice Firmante autorizado del sensor 0 y del sensor 1. Se rotan con `proposeOracle` y `acceptOracle`.
    address public oracle0;
    address public oracle1;
    /// @notice Espera obligatoria entre proponer una clave de oráculo nueva y que empiece a valer.
    ///         En el piloto serían 48 h; en la demo es corta para poder mostrarla.
    uint64 public immutable oracleDelay;
    /// @notice Espera obligatoria entre que la federación da un carnet y ese carnet cobra (anti-autocredencial).
    ///         En el piloto serían 72 h; en la demo es corta para poder mostrarla.
    uint64 public immutable recipientDelay;

    // ---------------------------------------------------------------- estado
    struct Zone {
        bool exists;
        uint16 minHotspots; // focos mínimos por sensor
        uint64 cooldown; // segundos entre liberaciones
        uint64 lastRelease;
        uint256 balance; // USDC (6 decimales) donado a la zona y aún no liberado
        uint256 totalDonated; // todo lo que entró a la zona desde que existe (neto de comisión)
        uint256 totalReleased; // todo lo que se pagó a destinatarios desde que existe
        uint256 maxPerEvent;
        uint256 costCombatPerHa; // combustible, equipos, traslados, viáticos y alimentación
        uint256 costLogisticsPerHa;
        uint256 costAssistPerHa; // evacuados, afectados y víctimas
        bytes32 polygonHash; // huella del polígono de la zona (el mapa vive fuera de la cadena)
        // Hora del dato de NASA más nuevo de cada sensor que ya pagó: un mismo dato no paga dos veces.
        uint64 lastDataTime0;
        uint64 lastDataTime1;
    }

    struct PendingOracle {
        address signer;
        uint64 activeFrom; // desde cuándo se puede aplicar el cambio
    }

    enum Kind {
        Station, // cuartel de bomberos
        Assistance // entidad de asistencia
    }

    struct Recipient {
        address wallet;
        Kind kind;
        bytes32 zoneId;
        bool active;
        uint64 activeFrom; // desde cuándo puede cobrar
    }

    struct FireReport {
        bytes32 zoneId;
        bytes32 polygonHash; // huella del polígono con el que se contaron los focos: tiene que ser el de la zona
        uint8 sensor; // 0 o 1
        uint16 hotspots;
        uint64 observedAt; // cuándo el oráculo armó el reporte (la frescura se controla con esto)
        uint64 dataTime; // hora de la última detección de NASA que se usó: queda pública para ver de qué día es el dato
        bytes32 dataHash; // SHA-256 de los datos crudos usados
        uint256 nonce;
    }

    mapping(bytes32 => Zone) public zones;
    mapping(bytes32 => Recipient) public recipients;
    mapping(bytes32 => bytes32[]) private _stations; // zoneId => ids
    mapping(bytes32 => bytes32[]) private _assistance;
    /// @dev cuarteles que la federación asignó al incendio activo de la zona, y hasta cuándo vale la asignación.
    mapping(bytes32 => bytes32[]) private _responders;
    mapping(bytes32 => uint64) public respondersUntil;
    mapping(uint8 => PendingOracle) public pendingOracle;
    /// @notice Cuándo cambió por última vez una clave de oráculo (0 si nunca).
    uint64 public lastOracleChange;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;
    uint256 public eventCount;

    // ---------------------------------------------------------------- eventos
    event ZoneCreated(bytes32 indexed zoneId, bytes32 polygonHash, uint256 costPerHa, uint256 maxPerEvent);
    event RecipientAdded(bytes32 indexed id, bytes32 indexed zoneId, Kind kind, address wallet, uint64 activeFrom);
    event RecipientRevoked(bytes32 indexed id, bytes32 indexed zoneId);
    event RespondersSet(bytes32 indexed zoneId, bytes32[] ids, uint64 validUntil);
    event OracleProposed(uint8 indexed sensor, address indexed signer, uint64 activeFrom);
    event OracleProposalCancelled(uint8 indexed sensor);
    event OracleChanged(uint8 indexed sensor, address indexed previous, address indexed current);
    event FederationTransferStarted(address indexed current, address indexed pending);
    event FederationChanged(address indexed previous, address indexed current);
    event Donated(bytes32 indexed targetId, address indexed donor, uint256 net, uint256 fee, bool direct);
    event FeeTaken(address indexed treasury, uint256 amount);
    event FireEvent(
        bytes32 indexed zoneId,
        uint256 indexed eventId,
        uint256 hotspots,
        uint256 areaHa,
        uint256 target,
        uint256 released,
        bytes32 dataHash0,
        bytes32 dataHash1,
        uint64 dataTime0,
        uint64 dataTime1
    );
    event Released(bytes32 indexed zoneId, uint256 indexed eventId, bytes32 indexed recipientId, address wallet, uint256 amount);
    /// @dev Un pago que falló (por ejemplo una wallet bloqueada por el emisor del USDC) vuelve al fondo de la zona y no frena al resto.
    event PayoutFailed(bytes32 indexed zoneId, uint256 indexed eventId, bytes32 indexed recipientId, uint256 amount);

    // ---------------------------------------------------------------- errores
    error NotFederation();
    error BadConfig();
    error UnknownZone();
    error ZoneExists();
    error UnknownRecipient();
    error RecipientInactive();
    error TooManyRecipients();
    error BelowMinDonation();
    error BadReports();
    error BadSigner();
    error NonceUsed();
    error StaleReport();
    error ReportsTooFarApart();
    error NotEnoughHotspots();
    error CooldownActive();
    error NotYetActive();
    error WrongPolygon();
    error NoResponders();
    error NotPendingFederation();
    error NothingPending();
    error ProposalExpired();
    error RotationInProgress();

    modifier onlyFederation() {
        if (msg.sender != federation) revert NotFederation();
        _;
    }

    constructor(
        IERC20 usdc_,
        address treasury_,
        uint16 feeBps_,
        uint256 minDonation_,
        address federation_,
        address oracle0_,
        address oracle1_,
        uint64 recipientDelay_,
        uint64 oracleDelay_
    ) EIP712("BrasaFund", "3") {
        if (
            address(usdc_) == address(0) || treasury_ == address(0) || federation_ == address(0)
                || oracle0_ == address(0) || oracle1_ == address(0) || oracle0_ == oracle1_ || feeBps_ > MAX_FEE_BPS
                || minDonation_ == 0 || recipientDelay_ > MAX_DELAY || oracleDelay_ > MAX_DELAY
        ) revert BadConfig();
        usdc = usdc_;
        treasury = treasury_;
        feeBps = feeBps_;
        minDonation = minDonation_;
        federation = federation_;
        oracle0 = oracle0_;
        oracle1 = oracle1_;
        recipientDelay = recipientDelay_;
        oracleDelay = oracleDelay_;
    }

    // ---------------------------------------------------------------- roles
    /// @notice Primer paso del traspaso: la federación actual nombra a la nueva. Con address(0) se cancela.
    function transferFederation(address next) external onlyFederation {
        pendingFederation = next;
        emit FederationTransferStarted(federation, next);
    }

    /// @notice Segundo paso: la cuenta nombrada acepta. Así el rol nunca queda en una cuenta que nadie maneja.
    function acceptFederation() external {
        if (msg.sender != pendingFederation) revert NotPendingFederation();
        emit FederationChanged(federation, msg.sender);
        federation = msg.sender;
        pendingFederation = address(0);
        // La federación nueva no hereda propuestas de claves que no hizo ella.
        delete pendingOracle[0];
        delete pendingOracle[1];
    }

    /// @notice Propone una clave nueva para un sensor. Queda pública y recién vale pasada la demora (`oracleDelay`).
    ///         Se rota de a una clave por vez: no se puede proponer si el otro sensor tiene una propuesta pendiente
    ///         o si alguna clave cambió hace menos de `oracleDelay`. Así nadie reemplaza las dos de golpe.
    function proposeOracle(uint8 sensor, address signer) external onlyFederation {
        if (sensor > 1 || signer == address(0) || signer == oracle0 || signer == oracle1) revert BadConfig();
        if (pendingOracle[sensor == 0 ? 1 : 0].signer != address(0)) revert RotationInProgress();
        if (lastOracleChange != 0 && block.timestamp < uint256(lastOracleChange) + oracleDelay) revert RotationInProgress();
        uint64 activeFrom = uint64(block.timestamp) + oracleDelay;
        pendingOracle[sensor] = PendingOracle({signer: signer, activeFrom: activeFrom});
        emit OracleProposed(sensor, signer, activeFrom);
    }

    function cancelOracle(uint8 sensor) external onlyFederation {
        if (pendingOracle[sensor].signer == address(0)) revert NothingPending();
        delete pendingOracle[sensor];
        emit OracleProposalCancelled(sensor);
    }

    /// @notice Aplica una propuesta ya vencida. Lo puede llamar cualquiera: la decisión fue pública durante la demora.
    function acceptOracle(uint8 sensor) external {
        PendingOracle memory p = pendingOracle[sensor];
        if (p.signer == address(0)) revert NothingPending();
        if (block.timestamp < p.activeFrom) revert NotYetActive();
        // Una propuesta que nadie aplicó a tiempo vence: no se puede aplicar de sorpresa meses después.
        if (block.timestamp > uint256(p.activeFrom) + ORACLE_PROPOSAL_WINDOW) revert ProposalExpired();
        // Los dos sensores nunca pueden quedar con la misma clave.
        if (p.signer == (sensor == 0 ? oracle1 : oracle0)) revert BadConfig();
        delete pendingOracle[sensor];
        lastOracleChange = uint64(block.timestamp);
        if (sensor == 0) {
            emit OracleChanged(0, oracle0, p.signer);
            oracle0 = p.signer;
        } else {
            emit OracleChanged(1, oracle1, p.signer);
            oracle1 = p.signer;
        }
    }

    // ---------------------------------------------------------------- credenciales y zonas
    /// @notice Crea una zona. Sus parámetros no se pueden cambiar después (regla pública).
    function createZone(
        bytes32 zoneId,
        bytes32 polygonHash,
        uint16 minHotspots,
        uint64 cooldown,
        uint256 maxPerEvent,
        uint256 costCombatPerHa,
        uint256 costLogisticsPerHa,
        uint256 costAssistPerHa
    ) external onlyFederation {
        if (zones[zoneId].exists) revert ZoneExists();
        if (
            minHotspots == 0 || maxPerEvent == 0 || cooldown > MAX_COOLDOWN || costCombatPerHa > MAX_COST_PER_HA
                || costLogisticsPerHa > MAX_COST_PER_HA || costAssistPerHa > MAX_COST_PER_HA
                || costCombatPerHa + costLogisticsPerHa + costAssistPerHa == 0
        ) revert BadConfig();
        zones[zoneId] = Zone({
            exists: true,
            minHotspots: minHotspots,
            cooldown: cooldown,
            lastRelease: 0,
            balance: 0,
            totalDonated: 0,
            totalReleased: 0,
            maxPerEvent: maxPerEvent,
            costCombatPerHa: costCombatPerHa,
            costLogisticsPerHa: costLogisticsPerHa,
            costAssistPerHa: costAssistPerHa,
            polygonHash: polygonHash,
            lastDataTime0: 0,
            lastDataTime1: 0
        });
        emit ZoneCreated(zoneId, polygonHash, costCombatPerHa + costLogisticsPerHa + costAssistPerHa, maxPerEvent);
    }

    /// @notice Da el carnet a un cuartel o a una entidad de asistencia de una zona.
    function addRecipient(bytes32 id, bytes32 zoneId, Kind kind, address wallet) external onlyFederation {
        if (!zones[zoneId].exists) revert UnknownZone();
        if (wallet == address(0) || recipients[id].wallet != address(0)) revert BadConfig();
        bytes32[] storage list = kind == Kind.Station ? _stations[zoneId] : _assistance[zoneId];
        if (list.length >= MAX_RECIPIENTS_PER_GROUP) revert TooManyRecipients();
        uint64 activeFrom = uint64(block.timestamp) + recipientDelay;
        recipients[id] = Recipient({wallet: wallet, kind: kind, zoneId: zoneId, active: true, activeFrom: activeFrom});
        list.push(id);
        // La alta queda pública con la hora desde la que cobra: cualquiera la ve antes de que pueda recibir plata.
        emit RecipientAdded(id, zoneId, kind, wallet, activeFrom);
    }

    /// @notice La federación dice qué cuarteles están combatiendo el incendio de la zona y hasta cuándo.
    ///         Solo esos cobran la parte de combate. Sin asignación vigente no se libera nada.
    ///         Con una lista vacía se borra la asignación.
    function setResponders(bytes32 zoneId, bytes32[] calldata ids, uint64 validUntil) external onlyFederation {
        if (!zones[zoneId].exists) revert UnknownZone();
        if (ids.length > MAX_RECIPIENTS_PER_GROUP) revert TooManyRecipients();
        if (ids.length == 0) {
            validUntil = 0;
        } else if (validUntil <= block.timestamp || validUntil > block.timestamp + MAX_ASSIGNMENT) {
            revert BadConfig();
        }
        for (uint256 i = 0; i < ids.length; i++) {
            Recipient storage r = recipients[ids[i]];
            if (r.wallet == address(0)) revert UnknownRecipient();
            if (!r.active) revert RecipientInactive();
            if (r.zoneId != zoneId || r.kind != Kind.Station) revert BadConfig();
            for (uint256 j = 0; j < i; j++) {
                if (ids[j] == ids[i]) revert BadConfig(); // sin repetidos: nadie cobra doble
            }
        }
        _responders[zoneId] = ids;
        respondersUntil[zoneId] = validUntil;
        emit RespondersSet(zoneId, ids, validUntil);
    }

    function revokeRecipient(bytes32 id) external onlyFederation {
        Recipient storage r = recipients[id];
        if (r.wallet == address(0)) revert UnknownRecipient();
        r.active = false;
        // Libera el lugar en la lista (swap-and-pop) para que las bajas no llenen el tope de 25.
        bytes32[] storage list = r.kind == Kind.Station ? _stations[r.zoneId] : _assistance[r.zoneId];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == id) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        emit RecipientRevoked(id, r.zoneId);
    }

    // ---------------------------------------------------------------- donar
    /// @notice Comisión sobre un monto: ceil(monto * feeBps / 10.000).
    function quoteFee(uint256 net) public view returns (uint256) {
        return (net * feeBps + 9999) / 10000;
    }

    /// @notice Cómo se reparte un aporte. Si `coverFee` es falso, `amount` es lo que paga el donante y la comisión
    ///         sale de ahí (dona 100: paga 100, llegan 97 y 3 a la tesorería). Si es verdadero, `amount` es lo que
    ///         debe llegar y el donante suma la comisión (llegan 100, paga 103). La comisión se redondea hacia arriba.
    function quoteSplit(uint256 amount, bool coverFee) public view returns (uint256 net, uint256 fee, uint256 total) {
        fee = quoteFee(amount);
        if (coverFee) {
            net = amount;
            total = amount + fee;
        } else {
            if (fee > amount) revert BelowMinDonation();
            net = amount - fee;
            total = amount;
        }
    }

    /// @notice Dona al fondo de una zona. El donante debe haber aprobado `total` de USDC (ver `quoteSplit`).
    function donateToZone(bytes32 zoneId, uint256 amount, bool coverFee) external nonReentrant {
        Zone storage z = zones[zoneId];
        if (!z.exists) revert UnknownZone();
        (uint256 net, uint256 fee,) = quoteSplit(amount, coverFee);
        if (net < minDonation) revert BelowMinDonation();
        // Se acredita lo que de verdad llegó, no lo pedido: si el token cobrara al transferir
        // (USDC es un proxy actualizable), el saldo contable nunca queda por encima del real.
        uint256 before = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), net);
        uint256 received = usdc.balanceOf(address(this)) - before;
        z.balance += received;
        z.totalDonated += received;
        _takeFee(fee);
        emit Donated(zoneId, msg.sender, received, fee, false);
    }

    /// @notice Dona directo a un cuartel o entidad con credencial. La plata no pasa por el contrato.
    function donateToRecipient(bytes32 recipientId, uint256 amount, bool coverFee) external nonReentrant {
        Recipient storage r = recipients[recipientId];
        if (r.wallet == address(0)) revert UnknownRecipient();
        if (!r.active) revert RecipientInactive();
        if (block.timestamp < r.activeFrom) revert NotYetActive();
        (uint256 net, uint256 fee,) = quoteSplit(amount, coverFee);
        if (net < minDonation) revert BelowMinDonation();
        usdc.safeTransferFrom(msg.sender, r.wallet, net);
        _takeFee(fee);
        emit Donated(recipientId, msg.sender, net, fee, true);
    }

    function _takeFee(uint256 fee) private {
        if (fee == 0) return;
        usdc.safeTransferFrom(msg.sender, treasury, fee);
        emit FeeTaken(treasury, fee);
    }

    // ---------------------------------------------------------------- la función clave
    /// @notice Meta de plata de un incendio con `hotspots` focos en una zona (regla pública).
    /// @dev superficie = focos * 14 ha; meta = superficie * (combate + logística + asistencia) por hectárea.
    function previewTarget(bytes32 zoneId, uint256 hotspots) public view returns (uint256 areaHa, uint256 target) {
        Zone storage z = zones[zoneId];
        if (!z.exists) revert UnknownZone();
        areaHa = hotspots * HA_PER_HOTSPOT;
        target = areaHa * (z.costCombatPerHa + z.costLogisticsPerHa + z.costAssistPerHa);
    }

    /// @notice Recibe dos reportes firmados por dos sensores distintos, calcula la meta y libera
    ///         min(saldo de la zona, meta, tope por evento) entre los destinatarios con credencial.
    ///         Cualquiera puede enviarlo: lo que vale son las firmas.
    function reportFire(FireReport[2] calldata reports, bytes[2] calldata sigs) external nonReentrant {
        FireReport calldata a = reports[0];
        FireReport calldata b = reports[1];
        if (a.zoneId != b.zoneId || a.sensor == b.sensor || a.sensor > 1 || b.sensor > 1) revert BadReports();

        Zone storage z = zones[a.zoneId];
        if (!z.exists) revert UnknownZone();

        // La firma prueba con qué polígono se contó: tiene que ser el registrado en la zona.
        if (a.polygonHash != z.polygonHash || b.polygonHash != z.polygonHash) revert WrongPolygon();

        _verify(a, sigs[0]);
        _verify(b, sigs[1]);

        // Frescura y coincidencia temporal.
        if (a.observedAt > block.timestamp || b.observedAt > block.timestamp) revert StaleReport();
        // El dato no puede ser posterior al reporte que lo usa.
        if (a.dataTime > a.observedAt || b.dataTime > b.observedAt) revert BadReports();
        // Y no puede ser viejo: con datos guardados de otro día no se libera nada.
        if (block.timestamp - a.dataTime > MAX_DATA_AGE || block.timestamp - b.dataTime > MAX_DATA_AGE) revert StaleReport();
        if (block.timestamp - a.observedAt > MAX_REPORT_AGE || block.timestamp - b.observedAt > MAX_REPORT_AGE) {
            revert StaleReport();
        }
        uint64 spread = a.observedAt > b.observedAt ? a.observedAt - b.observedAt : b.observedAt - a.observedAt;
        if (spread > MAX_REPORT_SPREAD) revert ReportsTooFarApart();

        // Los dos sensores tienen que ver fuego suficiente. La meta usa el menor (el más prudente).
        if (a.hotspots < z.minHotspots || b.hotspots < z.minHotspots) revert NotEnoughHotspots();
        if (z.lastRelease != 0) {
            if (block.timestamp < uint256(z.lastRelease) + z.cooldown) revert CooldownActive();
            // No se vuelve a contar una observación anterior a la última liberación.
            if (a.observedAt <= z.lastRelease || b.observedAt <= z.lastRelease) revert StaleReport();
        }
        // Ni se paga dos veces con el mismo dato de NASA: tiene que haber una pasada nueva de cada satélite
        // (cada sensor se compara con su propio dato anterior).
        {
            (uint64 d0, uint64 d1) = a.sensor == 0 ? (a.dataTime, b.dataTime) : (b.dataTime, a.dataTime);
            if ((z.lastDataTime0 != 0 && d0 <= z.lastDataTime0) || (z.lastDataTime1 != 0 && d1 <= z.lastDataTime1)) {
                revert StaleReport();
            }
        }

        uint256 hotspots = a.hotspots < b.hotspots ? a.hotspots : b.hotspots;
        (uint256 areaHa, uint256 target) = previewTarget(a.zoneId, hotspots);

        uint256 amount = z.balance;
        if (target < amount) amount = target;
        if (z.maxPerEvent < amount) amount = z.maxPerEvent;

        // Efectos primero, transferencias después.
        uint256 eventId = ++eventCount;
        uint256 failed = 0;
        if (amount > 0) {
            // Efectos antes de transferir. Un reporte que no libera nada no arranca el cooldown.
            uint64 prevRelease = z.lastRelease;
            uint64 prev0 = z.lastDataTime0;
            uint64 prev1 = z.lastDataTime1;
            z.lastRelease = uint64(block.timestamp);
            (z.lastDataTime0, z.lastDataTime1) = a.sensor == 0 ? (a.dataTime, b.dataTime) : (b.dataTime, a.dataTime);
            z.balance -= amount;
            failed = _distribute(a.zoneId, z, eventId, amount);
            if (failed > 0) z.balance += failed; // lo que no se pudo pagar vuelve al fondo
            z.totalReleased += amount - failed;
            if (failed == amount) {
                // No se pagó nada (por ejemplo, todas las wallets bloqueadas): ni el cooldown ni el dato se gastan.
                z.lastRelease = prevRelease;
                z.lastDataTime0 = prev0;
                z.lastDataTime1 = prev1;
            }
        }

        emit FireEvent(
            a.zoneId, eventId, hotspots, areaHa, target, amount - failed, a.dataHash, b.dataHash, a.dataTime, b.dataTime
        );
    }

    function _verify(FireReport calldata r, bytes calldata sig) private {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    FIRE_REPORT_TYPEHASH, r.zoneId, r.polygonHash, r.sensor, r.hotspots, r.observedAt, r.dataTime, r.dataHash, r.nonce
                )
            )
        );
        address signer = ECDSA.recover(digest, sig);
        if (signer != (r.sensor == 0 ? oracle0 : oracle1)) revert BadSigner();
        if (nonceUsed[signer][r.nonce]) revert NonceUsed();
        nonceUsed[signer][r.nonce] = true;
    }

    /// @dev La parte de combate y logística va a los cuarteles que la federación asignó al incendio;
    ///      la de asistencia, a las entidades. Sin asignación vigente revierte (falla cerrado: nada se
    ///      libera "por las dudas", y una quema de campo sin bomberos no cobra). Si no hay entidades de
    ///      asistencia activas, todo va a los cuarteles asignados.
    function _distribute(bytes32 zoneId, Zone storage z, uint256 eventId, uint256 amount) private returns (uint256) {
        if (block.timestamp > respondersUntil[zoneId]) revert NoResponders();
        bytes32[] memory st = _active(_responders[zoneId]);
        if (st.length == 0) revert NoResponders();
        bytes32[] memory as_ = _active(_assistance[zoneId]);

        uint256 stationPart;
        if (as_.length == 0) {
            stationPart = amount;
        } else {
            uint256 total = z.costCombatPerHa + z.costLogisticsPerHa + z.costAssistPerHa;
            stationPart = (amount * (z.costCombatPerHa + z.costLogisticsPerHa)) / total;
        }
        return _pay(zoneId, eventId, st, stationPart) + _pay(zoneId, eventId, as_, amount - stationPart);
    }

    function _pay(bytes32 zoneId, uint256 eventId, bytes32[] memory ids, uint256 amount) private returns (uint256 failed) {
        if (ids.length == 0 || amount == 0) return 0;
        uint256 share = amount / ids.length;
        uint256 dust = amount - share * ids.length;
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 pay = share + (i == 0 ? dust : 0);
            address wallet = recipients[ids[i]].wallet;
            if (usdc.trySafeTransfer(wallet, pay)) {
                emit Released(zoneId, eventId, ids[i], wallet, pay);
            } else {
                failed += pay;
                emit PayoutFailed(zoneId, eventId, ids[i], pay);
            }
        }
    }

    function _active(bytes32[] storage list) private view returns (bytes32[] memory out) {
        uint256 n = 0;
        bytes32[] memory tmp = new bytes32[](list.length);
        for (uint256 i = 0; i < list.length; i++) {
            Recipient storage r = recipients[list[i]];
            if (r.active && block.timestamp >= r.activeFrom) tmp[n++] = list[i];
        }
        out = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) out[i] = tmp[i];
    }

    // ---------------------------------------------------------------- lecturas
    function zoneBalance(bytes32 zoneId) external view returns (uint256) {
        return zones[zoneId].balance;
    }

    /// @notice Todo lo que entró a la zona (neto de comisión) y todo lo que se pagó, desde que existe.
    function zoneTotals(bytes32 zoneId) external view returns (uint256 donated, uint256 released) {
        Zone storage z = zones[zoneId];
        return (z.totalDonated, z.totalReleased);
    }

    function stationIds(bytes32 zoneId) external view returns (bytes32[] memory) {
        return _stations[zoneId];
    }

    function assistanceIds(bytes32 zoneId) external view returns (bytes32[] memory) {
        return _assistance[zoneId];
    }

    /// @notice cuarteles asignados al incendio de la zona y hasta cuándo vale la asignación.
    function responders(bytes32 zoneId) external view returns (bytes32[] memory ids, uint64 validUntil) {
        return (_responders[zoneId], respondersUntil[zoneId]);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
