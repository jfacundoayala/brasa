//! Fondo de emergencia por zona para incendios, en Stellar.
//!
//! Cuando dos sensores satelitales (dos cuentas de oráculo distintas) reportan fuego en una
//! zona, el contrato calcula la meta con una regla pública y libera USDC a los cuarteles y
//! entidades de asistencia con credencial. No hay ninguna función para retirar el fondo:
//! solo cobran destinatarios con credencial, que la federación da con una demora pública.
//!
//! Solo red de prueba. Sin auditoría externa.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::TokenClient, vec, Address, BytesN, Env, IntoVal, Vec,
};

mod test;

// ------------------------------------------------------------------ constantes
/// Hectáreas que se cuentan por foco de VIIRS (cota superior, no superficie quemada).
pub const HA_PER_HOTSPOT: i128 = 14;
/// Tope duro de la comisión: 5 %.
pub const MAX_FEE_BPS: u32 = 500;
const HOUR: u64 = 3600;
const DAY: u64 = 24 * HOUR;
pub const MAX_REPORT_AGE: u64 = 6 * HOUR;
pub const MAX_REPORT_SPREAD: u64 = 3 * HOUR;
/// El dato de NASA más nuevo que usa un reporte no puede tener más de 24 h.
pub const MAX_DATA_AGE: u64 = 24 * HOUR;
pub const MAX_RECIPIENTS_PER_GROUP: u32 = 25;
pub const MAX_COOLDOWN: u64 = 30 * DAY;
/// Tope de cordura: 1 millón de USDC por hectárea (USDC en Stellar tiene 7 decimales).
pub const MAX_COST_PER_HA: i128 = 1_000_000 * 10_000_000;
/// Una asignación de cuarteles a un incendio vale, como mucho, 30 días.
pub const MAX_ASSIGNMENT: u64 = 30 * DAY;
/// Tope para las dos demoras públicas (credenciales y rotación de oráculos).
pub const MAX_DELAY: u64 = 30 * DAY;
/// Piso de las dos demoras: sin él, una demora de cero dejaría la regla pública sin efecto.
pub const MIN_DELAY: u64 = HOUR;
/// Techo del tope por evento de una zona: 1.000.000 USDC (7 decimales). Supuesto del equipo.
pub const MAX_PER_EVENT: i128 = 1_000_000 * 10_000_000;
/// Plazo para aceptar un traspaso de federación. Pasado ese plazo hay que proponerlo de nuevo.
pub const FEDERATION_TRANSFER_WINDOW: u64 = 7 * DAY;
/// Una propuesta de clave de oráculo vence si no se aplica en este plazo.
pub const ORACLE_PROPOSAL_WINDOW: u64 = 7 * DAY;

// Vigencia de los datos guardados: cada uso la renueva.
const LEDGERS_PER_DAY: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * LEDGERS_PER_DAY;
const BUMP_TO: u32 = 120 * LEDGERS_PER_DAY;

// ------------------------------------------------------------------ tipos
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Federation,
    PendingFederation,
    Oracle(u32),
    PendingOracle(u32),
    LastOracleChange,
    EventCount,
    Zone(BytesN<32>),
    Recipient(BytesN<32>),
    Stations(BytesN<32>),
    Assistance(BytesN<32>),
    Responders(BytesN<32>),
}

/// Configuración fija desde el despliegue.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// Única moneda aceptada.
    pub usdc: Address,
    /// Cuenta que cobra la comisión. Es lo único que cobra brasa.
    pub treasury: Address,
    pub fee_bps: u32,
    pub min_donation: i128,
    /// Espera entre que la federación da una credencial y esa credencial cobra.
    pub recipient_delay: u64,
    /// Espera entre proponer una clave de oráculo nueva y que empiece a valer.
    pub oracle_delay: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Zone {
    /// Focos mínimos por sensor.
    pub min_hotspots: u32,
    /// Segundos entre liberaciones.
    pub cooldown: u64,
    pub last_release: u64,
    /// USDC donado a la zona y aún no liberado.
    pub balance: i128,
    pub total_donated: i128,
    pub total_released: i128,
    pub max_per_event: i128,
    pub cost_combat_per_ha: i128,
    pub cost_logistics_per_ha: i128,
    pub cost_assist_per_ha: i128,
    /// Huella del polígono de la zona (el mapa vive fuera de la cadena).
    pub polygon_hash: BytesN<32>,
    /// Hora del dato de NASA más nuevo de cada sensor que ya pagó: un mismo dato no paga dos veces.
    pub last_data_time0: u64,
    pub last_data_time1: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingFederation {
    pub account: Address,
    /// Hasta cuándo se puede aceptar el traspaso.
    pub valid_until: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PendingOracle {
    pub signer: Address,
    /// Desde cuándo se puede aplicar el cambio.
    pub active_from: u64,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Kind {
    /// Cuartel de bomberos.
    Station = 0,
    /// Entidad de asistencia.
    Assistance = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recipient {
    pub wallet: Address,
    pub kind: Kind,
    pub zone_id: BytesN<32>,
    pub active: bool,
    /// Desde cuándo puede cobrar.
    pub active_from: u64,
}

/// Lo que firma cada oráculo. Cada uno autoriza solo su propio reporte.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FireReport {
    pub zone_id: BytesN<32>,
    /// Huella del polígono con el que se contaron los focos: tiene que ser el de la zona.
    pub polygon_hash: BytesN<32>,
    /// 0 o 1.
    pub sensor: u32,
    pub hotspots: u32,
    /// Cuándo el oráculo armó el reporte.
    pub observed_at: u64,
    /// Hora de la última detección de NASA que se usó.
    pub data_time: u64,
    /// SHA-256 de los datos crudos usados.
    pub data_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub net: i128,
    pub fee: i128,
    pub total: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Target {
    pub area_ha: i128,
    pub target: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Assignment {
    pub ids: Vec<BytesN<32>>,
    pub valid_until: u64,
}

// ------------------------------------------------------------------ errores
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    BadConfig = 1,
    UnknownZone = 2,
    ZoneExists = 3,
    UnknownRecipient = 4,
    RecipientInactive = 5,
    TooManyRecipients = 6,
    BelowMinDonation = 7,
    BadReports = 8,
    StaleReport = 9,
    ReportsTooFarApart = 10,
    NotEnoughHotspots = 11,
    CooldownActive = 12,
    NotYetActive = 13,
    WrongPolygon = 14,
    NoResponders = 15,
    NothingPending = 16,
    ProposalExpired = 17,
    RotationInProgress = 18,
    NotInitialized = 19,
}

// ------------------------------------------------------------------ eventos
#[contractevent]
pub struct ZoneCreated {
    #[topic]
    pub zone_id: BytesN<32>,
    pub polygon_hash: BytesN<32>,
    pub cost_per_ha: i128,
    pub max_per_event: i128,
}

#[contractevent]
pub struct RecipientAdded {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub zone_id: BytesN<32>,
    pub kind: Kind,
    pub wallet: Address,
    pub active_from: u64,
}

#[contractevent]
pub struct RecipientRevoked {
    #[topic]
    pub id: BytesN<32>,
    #[topic]
    pub zone_id: BytesN<32>,
}

#[contractevent]
pub struct RespondersSet {
    #[topic]
    pub zone_id: BytesN<32>,
    pub ids: Vec<BytesN<32>>,
    pub valid_until: u64,
}

#[contractevent]
pub struct OracleProposed {
    #[topic]
    pub sensor: u32,
    pub signer: Address,
    pub active_from: u64,
}

#[contractevent]
pub struct OracleProposalCancelled {
    #[topic]
    pub sensor: u32,
}

#[contractevent]
pub struct OracleChanged {
    #[topic]
    pub sensor: u32,
    pub previous: Address,
    pub current: Address,
}

#[contractevent]
pub struct FederationTransferStarted {
    pub current: Address,
    pub pending: Option<Address>,
}

#[contractevent]
pub struct FederationChanged {
    pub previous: Address,
    pub current: Address,
}

#[contractevent]
pub struct Donated {
    #[topic]
    pub target_id: BytesN<32>,
    #[topic]
    pub donor: Address,
    pub net: i128,
    pub fee: i128,
    pub direct: bool,
}

#[contractevent]
pub struct FeeTaken {
    #[topic]
    pub treasury: Address,
    pub amount: i128,
}

#[contractevent]
pub struct FireEvent {
    #[topic]
    pub zone_id: BytesN<32>,
    #[topic]
    pub event_id: u64,
    pub hotspots: u32,
    pub area_ha: i128,
    pub target: i128,
    pub released: i128,
    pub data_hash0: BytesN<32>,
    pub data_hash1: BytesN<32>,
    pub data_time0: u64,
    pub data_time1: u64,
}

#[contractevent]
pub struct Released {
    #[topic]
    pub zone_id: BytesN<32>,
    #[topic]
    pub event_id: u64,
    #[topic]
    pub recipient_id: BytesN<32>,
    pub wallet: Address,
    pub amount: i128,
}

/// Un pago que falló (por ejemplo, una cuenta que todavía no habilitó USDC) vuelve al fondo
/// de la zona y no frena al resto.
#[contractevent]
pub struct PayoutFailed {
    #[topic]
    pub zone_id: BytesN<32>,
    #[topic]
    pub event_id: u64,
    #[topic]
    pub recipient_id: BytesN<32>,
    pub amount: i128,
}

// ------------------------------------------------------------------ guardado
fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn bump(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, BUMP_THRESHOLD, BUMP_TO);
}

fn config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn federation(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Federation)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn oracle(env: &Env, sensor: u32) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Oracle(sensor))
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
}

fn pending_oracle(env: &Env, sensor: u32) -> Option<PendingOracle> {
    env.storage().instance().get(&DataKey::PendingOracle(sensor))
}

fn load_zone(env: &Env, id: &BytesN<32>) -> Result<Zone, Error> {
    let key = DataKey::Zone(id.clone());
    let zone: Zone = env.storage().persistent().get(&key).ok_or(Error::UnknownZone)?;
    bump(env, &key);
    Ok(zone)
}

fn save_zone(env: &Env, id: &BytesN<32>, zone: &Zone) {
    let key = DataKey::Zone(id.clone());
    env.storage().persistent().set(&key, zone);
    bump(env, &key);
}

fn load_recipient(env: &Env, id: &BytesN<32>) -> Result<Recipient, Error> {
    let key = DataKey::Recipient(id.clone());
    let r: Recipient = env.storage().persistent().get(&key).ok_or(Error::UnknownRecipient)?;
    bump(env, &key);
    Ok(r)
}

fn save_recipient(env: &Env, id: &BytesN<32>, r: &Recipient) {
    let key = DataKey::Recipient(id.clone());
    env.storage().persistent().set(&key, r);
    bump(env, &key);
}

fn load_list(env: &Env, key: &DataKey) -> Vec<BytesN<32>> {
    match env.storage().persistent().get::<_, Vec<BytesN<32>>>(key) {
        Some(list) => {
            bump(env, key);
            list
        }
        None => Vec::new(env),
    }
}

fn save_list(env: &Env, key: &DataKey, list: &Vec<BytesN<32>>) {
    env.storage().persistent().set(key, list);
    bump(env, key);
}

fn load_assignment(env: &Env, zone_id: &BytesN<32>) -> Assignment {
    let key = DataKey::Responders(zone_id.clone());
    match env.storage().persistent().get::<_, Assignment>(&key) {
        Some(a) => {
            bump(env, &key);
            a
        }
        None => Assignment { ids: Vec::new(env), valid_until: 0 },
    }
}

fn group_key(kind: Kind, zone_id: &BytesN<32>) -> DataKey {
    match kind {
        Kind::Station => DataKey::Stations(zone_id.clone()),
        Kind::Assistance => DataKey::Assistance(zone_id.clone()),
    }
}

fn require_federation(env: &Env) {
    federation(env).require_auth();
}

fn fee_of(cfg: &Config, amount: i128) -> i128 {
    (amount * cfg.fee_bps as i128 + 9999) / 10000
}

fn split_of(cfg: &Config, amount: i128, cover_fee: bool) -> Result<Split, Error> {
    if amount <= 0 {
        return Err(Error::BelowMinDonation);
    }
    let fee = fee_of(cfg, amount);
    if cover_fee {
        Ok(Split { net: amount, fee, total: amount + fee })
    } else {
        if fee > amount {
            return Err(Error::BelowMinDonation);
        }
        Ok(Split { net: amount - fee, fee, total: amount })
    }
}

fn target_of(zone: &Zone, hotspots: u32) -> Target {
    let area_ha = hotspots as i128 * HA_PER_HOTSPOT;
    let per_ha = zone.cost_combat_per_ha + zone.cost_logistics_per_ha + zone.cost_assist_per_ha;
    Target { area_ha, target: area_ha * per_ha }
}

/// Los que tienen credencial vigente y ya pasaron la demora.
fn active_of(env: &Env, list: &Vec<BytesN<32>>) -> Vec<(BytesN<32>, Address)> {
    let now = env.ledger().timestamp();
    let mut out = Vec::new(env);
    for id in list.iter() {
        if let Ok(r) = load_recipient(env, &id) {
            if r.active && now >= r.active_from {
                out.push_back((id, r.wallet));
            }
        }
    }
    out
}

fn take_fee(env: &Env, cfg: &Config, token: &TokenClient, donor: &Address, fee: i128) {
    if fee == 0 {
        return;
    }
    token.transfer(donor, &cfg.treasury, &fee);
    FeeTaken { treasury: cfg.treasury.clone(), amount: fee }.publish(env);
}

fn pay(
    env: &Env,
    token: &TokenClient,
    zone_id: &BytesN<32>,
    event_id: u64,
    group: &Vec<(BytesN<32>, Address)>,
    amount: i128,
) -> i128 {
    let n = group.len();
    if n == 0 || amount == 0 {
        return 0;
    }
    let share = amount / n as i128;
    let dust = amount - share * n as i128;
    let me = env.current_contract_address();
    let mut failed = 0;
    for (i, (id, wallet)) in group.iter().enumerate() {
        let part = share + if i == 0 { dust } else { 0 };
        if part == 0 {
            continue;
        }
        if matches!(token.try_transfer(&me, &wallet, &part), Ok(Ok(()))) {
            Released { zone_id: zone_id.clone(), event_id, recipient_id: id, wallet, amount: part }.publish(env);
        } else {
            failed += part;
            PayoutFailed { zone_id: zone_id.clone(), event_id, recipient_id: id, amount: part }.publish(env);
        }
    }
    failed
}

/// La parte de combate y logística va a los cuarteles que la federación asignó al incendio;
/// la de asistencia, a las entidades. Sin asignación vigente falla: nada se libera "por las
/// dudas". Si no hay entidades de asistencia activas, todo va a los cuarteles asignados.
fn distribute(
    env: &Env,
    token: &TokenClient,
    zone_id: &BytesN<32>,
    zone: &Zone,
    event_id: u64,
    amount: i128,
) -> Result<i128, Error> {
    let assignment = load_assignment(env, zone_id);
    if env.ledger().timestamp() > assignment.valid_until {
        return Err(Error::NoResponders);
    }
    let stations = active_of(env, &assignment.ids);
    if stations.is_empty() {
        return Err(Error::NoResponders);
    }
    let assistance = active_of(env, &load_list(env, &DataKey::Assistance(zone_id.clone())));

    let station_part = if assistance.is_empty() {
        amount
    } else {
        let field = zone.cost_combat_per_ha + zone.cost_logistics_per_ha;
        amount * field / (field + zone.cost_assist_per_ha)
    };
    Ok(pay(env, token, zone_id, event_id, &stations, station_part)
        + pay(env, token, zone_id, event_id, &assistance, amount - station_part))
}

// ------------------------------------------------------------------ contrato
#[contract]
pub struct BrasaFund;

#[contractimpl]
impl BrasaFund {
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        usdc: Address,
        treasury: Address,
        fee_bps: u32,
        min_donation: i128,
        federation: Address,
        oracle0: Address,
        oracle1: Address,
        recipient_delay: u64,
        oracle_delay: u64,
    ) {
        if oracle0 == oracle1
            || fee_bps > MAX_FEE_BPS
            || min_donation <= 0
            || !(MIN_DELAY..=MAX_DELAY).contains(&recipient_delay)
            || !(MIN_DELAY..=MAX_DELAY).contains(&oracle_delay)
        {
            panic_with_error!(&env, Error::BadConfig);
        }
        let store = env.storage().instance();
        store.set(
            &DataKey::Config,
            &Config { usdc, treasury, fee_bps, min_donation, recipient_delay, oracle_delay },
        );
        store.set(&DataKey::Federation, &federation);
        store.set(&DataKey::Oracle(0), &oracle0);
        store.set(&DataKey::Oracle(1), &oracle1);
        store.set(&DataKey::EventCount, &0u64);
        bump_instance(&env);
    }

    // -------------------------------------------------------------- roles
    /// Primer paso del traspaso: la federación actual nombra a la nueva. Con `None` se cancela.
    pub fn transfer_federation(env: Env, next: Option<Address>) {
        require_federation(&env);
        bump_instance(&env);
        match &next {
            Some(n) => env.storage().instance().set(
                &DataKey::PendingFederation,
                &PendingFederation {
                    account: n.clone(),
                    valid_until: env.ledger().timestamp() + FEDERATION_TRANSFER_WINDOW,
                },
            ),
            None => env.storage().instance().remove(&DataKey::PendingFederation),
        }
        FederationTransferStarted { current: federation(&env), pending: next }.publish(&env);
    }

    /// Segundo paso: la cuenta nombrada acepta. Así el rol nunca queda en una cuenta que nadie maneja.
    pub fn accept_federation(env: Env) -> Result<(), Error> {
        let store = env.storage().instance();
        let pending: PendingFederation =
            store.get(&DataKey::PendingFederation).ok_or(Error::NothingPending)?;
        // Un traspaso que nadie aceptó a tiempo vence: no se acepta de sorpresa meses después.
        if env.ledger().timestamp() > pending.valid_until {
            return Err(Error::ProposalExpired);
        }
        let next = pending.account;
        next.require_auth();
        bump_instance(&env);
        let previous = federation(&env);
        store.set(&DataKey::Federation, &next);
        store.remove(&DataKey::PendingFederation);
        // La federación nueva no hereda propuestas de claves que no hizo ella.
        store.remove(&DataKey::PendingOracle(0));
        store.remove(&DataKey::PendingOracle(1));
        FederationChanged { previous, current: next }.publish(&env);
        Ok(())
    }

    /// Propone una cuenta nueva para un sensor. Queda pública y recién vale pasada la demora.
    /// Se rota de a una por vez: nadie reemplaza las dos de golpe.
    pub fn propose_oracle(env: Env, sensor: u32, signer: Address) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        if sensor > 1 || signer == oracle(&env, 0) || signer == oracle(&env, 1) {
            return Err(Error::BadConfig);
        }
        let cfg = config(&env);
        let now = env.ledger().timestamp();
        if let Some(other) = pending_oracle(&env, 1 - sensor) {
            if now <= other.active_from + ORACLE_PROPOSAL_WINDOW {
                return Err(Error::RotationInProgress);
            }
            // La propuesta del otro sensor ya venció: se limpia y no traba esta rotación.
            env.storage().instance().remove(&DataKey::PendingOracle(1 - sensor));
            OracleProposalCancelled { sensor: 1 - sensor }.publish(&env);
        }
        let last: u64 = env.storage().instance().get(&DataKey::LastOracleChange).unwrap_or(0);
        if last != 0 && now < last + cfg.oracle_delay {
            return Err(Error::RotationInProgress);
        }
        let active_from = now + cfg.oracle_delay;
        env.storage()
            .instance()
            .set(&DataKey::PendingOracle(sensor), &PendingOracle { signer: signer.clone(), active_from });
        OracleProposed { sensor, signer, active_from }.publish(&env);
        Ok(())
    }

    pub fn cancel_oracle(env: Env, sensor: u32) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        if sensor > 1 || pending_oracle(&env, sensor).is_none() {
            return Err(Error::NothingPending);
        }
        env.storage().instance().remove(&DataKey::PendingOracle(sensor));
        OracleProposalCancelled { sensor }.publish(&env);
        Ok(())
    }

    /// Aplica una propuesta que ya cumplió la demora. Lo puede llamar cualquiera: la decisión
    /// fue pública durante toda la espera.
    pub fn accept_oracle(env: Env, sensor: u32) -> Result<(), Error> {
        bump_instance(&env);
        if sensor > 1 {
            return Err(Error::NothingPending);
        }
        let p = pending_oracle(&env, sensor).ok_or(Error::NothingPending)?;
        let now = env.ledger().timestamp();
        if now < p.active_from {
            return Err(Error::NotYetActive);
        }
        // Una propuesta que nadie aplicó a tiempo vence: no se aplica de sorpresa meses después.
        if now > p.active_from + ORACLE_PROPOSAL_WINDOW {
            return Err(Error::ProposalExpired);
        }
        // Los dos sensores nunca pueden quedar con la misma cuenta.
        if p.signer == oracle(&env, 1 - sensor) {
            return Err(Error::BadConfig);
        }
        let store = env.storage().instance();
        let previous = oracle(&env, sensor);
        store.remove(&DataKey::PendingOracle(sensor));
        store.set(&DataKey::LastOracleChange, &now);
        store.set(&DataKey::Oracle(sensor), &p.signer);
        OracleChanged { sensor, previous, current: p.signer }.publish(&env);
        Ok(())
    }

    // -------------------------------------------------------------- credenciales y zonas
    /// Crea una zona. Sus parámetros no se pueden cambiar después (regla pública).
    #[allow(clippy::too_many_arguments)]
    pub fn create_zone(
        env: Env,
        zone_id: BytesN<32>,
        polygon_hash: BytesN<32>,
        min_hotspots: u32,
        cooldown: u64,
        max_per_event: i128,
        cost_combat_per_ha: i128,
        cost_logistics_per_ha: i128,
        cost_assist_per_ha: i128,
    ) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        if env.storage().persistent().has(&DataKey::Zone(zone_id.clone())) {
            return Err(Error::ZoneExists);
        }
        let in_range = |c: i128| (0..=MAX_COST_PER_HA).contains(&c);
        let cost_per_ha = cost_combat_per_ha + cost_logistics_per_ha + cost_assist_per_ha;
        if min_hotspots == 0
            || !(1..=MAX_PER_EVENT).contains(&max_per_event)
            || cooldown > MAX_COOLDOWN
            || !in_range(cost_combat_per_ha)
            || !in_range(cost_logistics_per_ha)
            || !in_range(cost_assist_per_ha)
            || cost_per_ha == 0
        {
            return Err(Error::BadConfig);
        }
        save_zone(
            &env,
            &zone_id,
            &Zone {
                min_hotspots,
                cooldown,
                last_release: 0,
                balance: 0,
                total_donated: 0,
                total_released: 0,
                max_per_event,
                cost_combat_per_ha,
                cost_logistics_per_ha,
                cost_assist_per_ha,
                polygon_hash: polygon_hash.clone(),
                last_data_time0: 0,
                last_data_time1: 0,
            },
        );
        ZoneCreated { zone_id, polygon_hash, cost_per_ha, max_per_event }.publish(&env);
        Ok(())
    }

    /// Da la credencial a un cuartel o a una entidad de asistencia de una zona.
    pub fn add_recipient(
        env: Env,
        id: BytesN<32>,
        zone_id: BytesN<32>,
        kind: Kind,
        wallet: Address,
    ) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        load_zone(&env, &zone_id)?;
        if env.storage().persistent().has(&DataKey::Recipient(id.clone())) {
            return Err(Error::BadConfig);
        }
        let key = group_key(kind, &zone_id);
        let mut list = load_list(&env, &key);
        if list.len() >= MAX_RECIPIENTS_PER_GROUP {
            return Err(Error::TooManyRecipients);
        }
        let active_from = env.ledger().timestamp() + config(&env).recipient_delay;
        save_recipient(
            &env,
            &id,
            &Recipient { wallet: wallet.clone(), kind, zone_id: zone_id.clone(), active: true, active_from },
        );
        list.push_back(id.clone());
        save_list(&env, &key, &list);
        // El alta queda pública con la hora desde la que cobra.
        RecipientAdded { id, zone_id, kind, wallet, active_from }.publish(&env);
        Ok(())
    }

    /// La federación dice qué cuarteles están combatiendo el incendio de la zona y hasta
    /// cuándo. Solo esos cobran la parte de combate. Con una lista vacía se borra la asignación.
    pub fn set_responders(
        env: Env,
        zone_id: BytesN<32>,
        ids: Vec<BytesN<32>>,
        valid_until: u64,
    ) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        load_zone(&env, &zone_id)?;
        if ids.len() > MAX_RECIPIENTS_PER_GROUP {
            return Err(Error::TooManyRecipients);
        }
        let now = env.ledger().timestamp();
        let valid_until = if ids.is_empty() {
            0
        } else if valid_until <= now || valid_until > now + MAX_ASSIGNMENT {
            return Err(Error::BadConfig);
        } else {
            valid_until
        };
        for (i, id) in ids.iter().enumerate() {
            let r = load_recipient(&env, &id)?;
            if !r.active {
                return Err(Error::RecipientInactive);
            }
            if r.zone_id != zone_id || r.kind != Kind::Station {
                return Err(Error::BadConfig);
            }
            // Sin repetidos: nadie cobra doble.
            if ids.iter().take(i).any(|other| other == id) {
                return Err(Error::BadConfig);
            }
        }
        let key = DataKey::Responders(zone_id.clone());
        env.storage().persistent().set(&key, &Assignment { ids: ids.clone(), valid_until });
        bump(&env, &key);
        RespondersSet { zone_id, ids, valid_until }.publish(&env);
        Ok(())
    }

    pub fn revoke_recipient(env: Env, id: BytesN<32>) -> Result<(), Error> {
        require_federation(&env);
        bump_instance(&env);
        let mut r = load_recipient(&env, &id)?;
        r.active = false;
        save_recipient(&env, &id, &r);
        // Libera el lugar en la lista para que las bajas no llenen el tope.
        let key = group_key(r.kind, &r.zone_id);
        let mut list = load_list(&env, &key);
        if let Some(i) = list.first_index_of(&id) {
            list.remove(i);
            save_list(&env, &key, &list);
        }
        RecipientRevoked { id, zone_id: r.zone_id }.publish(&env);
        Ok(())
    }

    // -------------------------------------------------------------- donar
    /// Cómo se reparte un aporte. Si `cover_fee` es falso, `amount` es lo que paga el donante
    /// y la comisión sale de ahí. Si es verdadero, `amount` es lo que llega y el donante suma
    /// la comisión. La comisión se redondea hacia arriba.
    pub fn quote_split(env: Env, amount: i128, cover_fee: bool) -> Result<Split, Error> {
        split_of(&config(&env), amount, cover_fee)
    }

    /// Dona al fondo de una zona.
    pub fn donate_to_zone(
        env: Env,
        donor: Address,
        zone_id: BytesN<32>,
        amount: i128,
        cover_fee: bool,
    ) -> Result<(), Error> {
        donor.require_auth();
        bump_instance(&env);
        let cfg = config(&env);
        let mut zone = load_zone(&env, &zone_id)?;
        let split = split_of(&cfg, amount, cover_fee)?;
        if split.net < cfg.min_donation {
            return Err(Error::BelowMinDonation);
        }
        let token = TokenClient::new(&env, &cfg.usdc);
        let me = env.current_contract_address();
        // Se acredita lo que de verdad llegó, no lo pedido.
        let before = token.balance(&me);
        token.transfer(&donor, &me, &split.net);
        let received = token.balance(&me) - before;
        zone.balance += received;
        zone.total_donated += received;
        save_zone(&env, &zone_id, &zone);
        take_fee(&env, &cfg, &token, &donor, split.fee);
        Donated { target_id: zone_id, donor, net: received, fee: split.fee, direct: false }.publish(&env);
        Ok(())
    }

    /// Dona directo a un cuartel o entidad con credencial. El dinero no pasa por el contrato.
    pub fn donate_to_recipient(
        env: Env,
        donor: Address,
        recipient_id: BytesN<32>,
        amount: i128,
        cover_fee: bool,
    ) -> Result<(), Error> {
        donor.require_auth();
        bump_instance(&env);
        let cfg = config(&env);
        let r = load_recipient(&env, &recipient_id)?;
        if !r.active {
            return Err(Error::RecipientInactive);
        }
        if env.ledger().timestamp() < r.active_from {
            return Err(Error::NotYetActive);
        }
        let split = split_of(&cfg, amount, cover_fee)?;
        if split.net < cfg.min_donation {
            return Err(Error::BelowMinDonation);
        }
        let token = TokenClient::new(&env, &cfg.usdc);
        token.transfer(&donor, &r.wallet, &split.net);
        take_fee(&env, &cfg, &token, &donor, split.fee);
        Donated { target_id: recipient_id, donor, net: split.net, fee: split.fee, direct: true }.publish(&env);
        Ok(())
    }

    // -------------------------------------------------------------- la función clave
    /// Meta de un incendio con `hotspots` focos en una zona (regla pública):
    /// superficie = focos × 14 ha; meta = superficie × (combate + logística + asistencia) por hectárea.
    pub fn preview_target(env: Env, zone_id: BytesN<32>, hotspots: u32) -> Result<Target, Error> {
        Ok(target_of(&load_zone(&env, &zone_id)?, hotspots))
    }

    /// Recibe dos reportes, uno por sensor, cada uno autorizado por la cuenta de su oráculo.
    /// Calcula la meta y libera min(saldo de la zona, meta, tope por evento) entre los
    /// destinatarios con credencial. Cualquiera puede enviarlo: lo que vale son las dos firmas.
    pub fn report_fire(env: Env, a: FireReport, b: FireReport) -> Result<u64, Error> {
        bump_instance(&env);
        if a.zone_id != b.zone_id || a.sensor == b.sensor || a.sensor > 1 || b.sensor > 1 {
            return Err(Error::BadReports);
        }
        let mut zone = load_zone(&env, &a.zone_id)?;

        // La firma prueba con qué polígono se contó: tiene que ser el registrado en la zona.
        if a.polygon_hash != zone.polygon_hash || b.polygon_hash != zone.polygon_hash {
            return Err(Error::WrongPolygon);
        }

        // Cada oráculo autoriza solo su reporte. La red evita que una firma se use dos veces.
        oracle(&env, a.sensor).require_auth_for_args(vec![&env, a.clone().into_val(&env)]);
        oracle(&env, b.sensor).require_auth_for_args(vec![&env, b.clone().into_val(&env)]);

        let now = env.ledger().timestamp();
        // Frescura y coincidencia temporal.
        if a.observed_at > now || b.observed_at > now {
            return Err(Error::StaleReport);
        }
        // El dato no puede ser posterior al reporte que lo usa.
        if a.data_time > a.observed_at || b.data_time > b.observed_at {
            return Err(Error::BadReports);
        }
        // Y no puede ser viejo: con datos guardados de otro día no se libera nada.
        if now - a.data_time > MAX_DATA_AGE || now - b.data_time > MAX_DATA_AGE {
            return Err(Error::StaleReport);
        }
        if now - a.observed_at > MAX_REPORT_AGE || now - b.observed_at > MAX_REPORT_AGE {
            return Err(Error::StaleReport);
        }
        if a.observed_at.abs_diff(b.observed_at) > MAX_REPORT_SPREAD {
            return Err(Error::ReportsTooFarApart);
        }

        // Los dos sensores tienen que ver fuego suficiente. La meta usa el menor (el más prudente).
        if a.hotspots < zone.min_hotspots || b.hotspots < zone.min_hotspots {
            return Err(Error::NotEnoughHotspots);
        }
        if zone.last_release != 0 {
            if now < zone.last_release + zone.cooldown {
                return Err(Error::CooldownActive);
            }
            // No se vuelve a contar una observación anterior a la última liberación.
            if a.observed_at <= zone.last_release || b.observed_at <= zone.last_release {
                return Err(Error::StaleReport);
            }
        }
        // Ni se paga dos veces con el mismo dato de NASA: tiene que haber una pasada nueva de
        // cada satélite.
        let (r0, r1) = if a.sensor == 0 { (&a, &b) } else { (&b, &a) };
        if (zone.last_data_time0 != 0 && r0.data_time <= zone.last_data_time0)
            || (zone.last_data_time1 != 0 && r1.data_time <= zone.last_data_time1)
        {
            return Err(Error::StaleReport);
        }

        let hotspots = a.hotspots.min(b.hotspots);
        let t = target_of(&zone, hotspots);
        let amount = zone.balance.min(t.target).min(zone.max_per_event);

        let event_id: u64 = env.storage().instance().get(&DataKey::EventCount).unwrap_or(0) + 1;
        env.storage().instance().set(&DataKey::EventCount, &event_id);

        let mut failed = 0;
        if amount > 0 {
            let token = TokenClient::new(&env, &config(&env).usdc);
            failed = distribute(&env, &token, &a.zone_id, &zone, event_id, amount)?;
            zone.balance -= amount - failed; // lo que no se pudo pagar queda en el fondo
            zone.total_released += amount - failed;
            // Si no se pagó nada, ni la espera ni el dato se gastan.
            if failed < amount {
                zone.last_release = now;
                zone.last_data_time0 = r0.data_time;
                zone.last_data_time1 = r1.data_time;
            }
            save_zone(&env, &a.zone_id, &zone);
        }

        FireEvent {
            zone_id: a.zone_id.clone(),
            event_id,
            hotspots,
            area_ha: t.area_ha,
            target: t.target,
            released: amount - failed,
            data_hash0: r0.data_hash.clone(),
            data_hash1: r1.data_hash.clone(),
            data_time0: r0.data_time,
            data_time1: r1.data_time,
        }
        .publish(&env);
        Ok(event_id)
    }

    // -------------------------------------------------------------- lecturas
    pub fn config(env: Env) -> Config {
        config(&env)
    }

    pub fn federation(env: Env) -> Address {
        federation(&env)
    }

    pub fn pending_federation(env: Env) -> Option<PendingFederation> {
        env.storage().instance().get(&DataKey::PendingFederation)
    }

    pub fn oracle(env: Env, sensor: u32) -> Result<Address, Error> {
        if sensor > 1 {
            return Err(Error::BadConfig);
        }
        Ok(oracle(&env, sensor))
    }

    pub fn pending_oracle(env: Env, sensor: u32) -> Option<PendingOracle> {
        pending_oracle(&env, sensor)
    }

    pub fn event_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::EventCount).unwrap_or(0)
    }

    pub fn zone(env: Env, zone_id: BytesN<32>) -> Result<Zone, Error> {
        load_zone(&env, &zone_id)
    }

    pub fn zone_balance(env: Env, zone_id: BytesN<32>) -> Result<i128, Error> {
        Ok(load_zone(&env, &zone_id)?.balance)
    }

    pub fn recipient(env: Env, id: BytesN<32>) -> Result<Recipient, Error> {
        load_recipient(&env, &id)
    }

    pub fn station_ids(env: Env, zone_id: BytesN<32>) -> Vec<BytesN<32>> {
        load_list(&env, &DataKey::Stations(zone_id))
    }

    pub fn assistance_ids(env: Env, zone_id: BytesN<32>) -> Vec<BytesN<32>> {
        load_list(&env, &DataKey::Assistance(zone_id))
    }

    /// Cuarteles asignados al incendio de la zona y hasta cuándo vale la asignación.
    pub fn responders(env: Env, zone_id: BytesN<32>) -> Assignment {
        load_assignment(&env, &zone_id)
    }
}
