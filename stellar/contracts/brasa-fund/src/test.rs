#![cfg(test)]
extern crate std;

use crate::*;
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{storage::Persistent as _, Address as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::StellarAssetClient,
    Address, BytesN, Env, IntoVal, Vec,
};

const USDC: i128 = 10_000_000; // 7 decimales
const T0: u64 = 1_800_000_000;
const DELAY: u64 = 3600;

fn id(env: &Env, n: u8) -> BytesN<32> {
    BytesN::from_array(env, &[n; 32])
}

struct Ctx {
    env: Env,
    fund: BrasaFundClient<'static>,
    fund_id: Address,
    token: TokenClient<'static>,
    mint: StellarAssetClient<'static>,
    treasury: Address,
    federation: Address,
    oracle0: Address,
    oracle1: Address,
    donor: Address,
    zone: BytesN<32>,
    polygon: BytesN<32>,
}

fn base(mock: bool) -> Ctx {
    let env = Env::default();
    if mock {
        env.mock_all_auths();
    }
    env.ledger().set_timestamp(T0);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let treasury = Address::generate(&env);
    let federation = Address::generate(&env);
    let oracle0 = Address::generate(&env);
    let oracle1 = Address::generate(&env);
    let donor = Address::generate(&env);
    let fund_id = env.register(
        BrasaFund,
        (
            sac.address(),
            treasury.clone(),
            500u32,
            USDC,
            federation.clone(),
            oracle0.clone(),
            oracle1.clone(),
            DELAY,
            DELAY,
        ),
    );
    Ctx {
        fund: BrasaFundClient::new(&env, &fund_id),
        token: TokenClient::new(&env, &sac.address()),
        mint: StellarAssetClient::new(&env, &sac.address()),
        zone: id(&env, 1),
        polygon: id(&env, 9),
        env,
        fund_id,
        treasury,
        federation,
        oracle0,
        oracle1,
        donor,
    }
}

/// Zona con 2 cuarteles (uno asignado al incendio) y 1 entidad de asistencia, ya con la
/// demora cumplida y 1.000 USDC donados.
fn ready() -> (Ctx, Address, Address, Address) {
    let c = base(true);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &(500 * USDC), &(2 * USDC), &USDC, &USDC);
    let (s1, s2, a1) = (Address::generate(&c.env), Address::generate(&c.env), Address::generate(&c.env));
    c.fund.add_recipient(&id(&c.env, 11), &c.zone, &Kind::Station, &s1);
    c.fund.add_recipient(&id(&c.env, 12), &c.zone, &Kind::Station, &s2);
    c.fund.add_recipient(&id(&c.env, 21), &c.zone, &Kind::Assistance, &a1);
    c.env.ledger().set_timestamp(T0 + DELAY);
    c.fund.set_responders(&c.zone, &Vec::from_array(&c.env, [id(&c.env, 11)]), &(T0 + DAY));
    c.mint.mint(&c.donor, &(10_000 * USDC));
    c.fund.donate_to_zone(&c.donor, &c.zone, &(1_000 * USDC), &true);
    (c, s1, s2, a1)
}

fn report(c: &Ctx, sensor: u32, hotspots: u32) -> FireReport {
    let now = c.env.ledger().timestamp();
    FireReport {
        zone_id: c.zone.clone(),
        polygon_hash: c.polygon.clone(),
        sensor,
        hotspots,
        observed_at: now,
        data_time: now - 60,
        data_hash: id(&c.env, 100 + sensor as u8),
    }
}

// ------------------------------------------------------------------ configuración
#[test]
fn guarda_la_configuracion() {
    let c = base(true);
    let cfg = c.fund.config();
    assert_eq!(cfg.fee_bps, 500);
    assert_eq!(cfg.treasury, c.treasury);
    assert_eq!(c.fund.federation(), c.federation);
    assert_eq!(c.fund.oracle(&0), c.oracle0);
    assert_eq!(c.fund.oracle(&1), c.oracle1);
    assert_eq!(c.fund.event_count(), 0);
}

#[test]
#[should_panic]
fn no_acepta_comision_mayor_al_5_por_ciento() {
    let env = Env::default();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    env.register(BrasaFund, (a.clone(), a.clone(), 501u32, USDC, a.clone(), a.clone(), b, DELAY, DELAY));
}

#[test]
#[should_panic]
fn no_acepta_dos_oraculos_iguales() {
    let env = Env::default();
    let a = Address::generate(&env);
    env.register(BrasaFund, (a.clone(), a.clone(), 500u32, USDC, a.clone(), a.clone(), a.clone(), DELAY, DELAY));
}

// ------------------------------------------------------------------ zonas y credenciales
#[test]
fn crea_zona_una_sola_vez_y_valida() {
    let c = base(true);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &(500 * USDC), &USDC, &0, &0);
    assert_eq!(c.fund.zone(&c.zone).min_hotspots, 3);
    assert_eq!(
        c.fund.try_create_zone(&c.zone, &c.polygon, &3, &3600, &USDC, &USDC, &0, &0),
        Err(Ok(Error::ZoneExists))
    );
    let otra = id(&c.env, 2);
    for (min, cooldown, max, cost) in [
        (0u32, 3600u64, USDC, USDC),
        (3, MAX_COOLDOWN + 1, USDC, USDC),
        (3, 3600, 0, USDC),
        (3, 3600, MAX_PER_EVENT + 1, USDC),
        (3, 3600, USDC, 0),
        (3, 3600, USDC, -1),
        (3, 3600, USDC, MAX_COST_PER_HA + 1),
    ] {
        assert_eq!(
            c.fund.try_create_zone(&otra, &c.polygon, &min, &cooldown, &max, &cost, &0, &0),
            Err(Ok(Error::BadConfig))
        );
    }
}

#[test]
fn solo_la_federacion_crea_zonas() {
    let c = base(false);
    assert!(c.fund.try_create_zone(&c.zone, &c.polygon, &3, &3600, &USDC, &USDC, &0, &0).is_err());
}

#[test]
fn credenciales_alta_tope_y_baja() {
    let c = base(true);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &USDC, &USDC, &0, &0);
    let w = Address::generate(&c.env);
    assert_eq!(
        c.fund.try_add_recipient(&id(&c.env, 50), &id(&c.env, 2), &Kind::Station, &w),
        Err(Ok(Error::UnknownZone))
    );
    for n in 0..MAX_RECIPIENTS_PER_GROUP as u8 {
        c.fund.add_recipient(&id(&c.env, 50 + n), &c.zone, &Kind::Station, &w);
    }
    assert_eq!(
        c.fund.try_add_recipient(&id(&c.env, 50), &c.zone, &Kind::Station, &w),
        Err(Ok(Error::BadConfig))
    );
    assert_eq!(
        c.fund.try_add_recipient(&id(&c.env, 200), &c.zone, &Kind::Station, &w),
        Err(Ok(Error::TooManyRecipients))
    );
    assert_eq!(c.fund.recipient(&id(&c.env, 50)).active_from, T0 + DELAY);
    // La baja libera el lugar.
    c.fund.revoke_recipient(&id(&c.env, 50));
    assert!(!c.fund.recipient(&id(&c.env, 50)).active);
    assert_eq!(c.fund.station_ids(&c.zone).len(), MAX_RECIPIENTS_PER_GROUP - 1);
    c.fund.add_recipient(&id(&c.env, 200), &c.zone, &Kind::Station, &w);
    assert_eq!(c.fund.try_revoke_recipient(&id(&c.env, 250)), Err(Ok(Error::UnknownRecipient)));
}

#[test]
fn asignacion_de_cuarteles_valida() {
    let (c, ..) = ready();
    let now = c.env.ledger().timestamp();
    let lista = |ids: &[u8]| {
        let mut v = Vec::new(&c.env);
        for n in ids {
            v.push_back(id(&c.env, *n));
        }
        v
    };
    assert_eq!(c.fund.try_set_responders(&c.zone, &lista(&[11]), &now), Err(Ok(Error::BadConfig)));
    assert_eq!(
        c.fund.try_set_responders(&c.zone, &lista(&[11]), &(now + MAX_ASSIGNMENT + 1)),
        Err(Ok(Error::BadConfig))
    );
    assert_eq!(c.fund.try_set_responders(&c.zone, &lista(&[11, 11]), &(now + 10)), Err(Ok(Error::BadConfig)));
    // Una entidad de asistencia no es un cuartel.
    assert_eq!(c.fund.try_set_responders(&c.zone, &lista(&[21]), &(now + 10)), Err(Ok(Error::BadConfig)));
    assert_eq!(c.fund.try_set_responders(&c.zone, &lista(&[99]), &(now + 10)), Err(Ok(Error::UnknownRecipient)));
    c.fund.revoke_recipient(&id(&c.env, 12));
    assert_eq!(c.fund.try_set_responders(&c.zone, &lista(&[12]), &(now + 10)), Err(Ok(Error::RecipientInactive)));
    c.fund.set_responders(&c.zone, &lista(&[]), &0);
    assert_eq!(c.fund.responders(&c.zone).valid_until, 0);
}

// ------------------------------------------------------------------ donar
#[test]
fn reparto_de_la_comision() {
    let c = base(true);
    assert_eq!(c.fund.quote_split(&(100 * USDC), &false), Split { net: 95 * USDC, fee: 5 * USDC, total: 100 * USDC });
    assert_eq!(c.fund.quote_split(&(100 * USDC), &true), Split { net: 100 * USDC, fee: 5 * USDC, total: 105 * USDC });
    // Redondea hacia arriba.
    assert_eq!(c.fund.quote_split(&1, &true).fee, 1);
    assert_eq!(c.fund.try_quote_split(&0, &true), Err(Ok(Error::BelowMinDonation)));
    assert_eq!(c.fund.try_quote_split(&-5, &true), Err(Ok(Error::BelowMinDonation)));
}

#[test]
fn donar_a_la_zona_mueve_el_dinero() {
    let (c, ..) = ready();
    assert_eq!(c.fund.zone_balance(&c.zone), 1_000 * USDC);
    assert_eq!(c.token.balance(&c.fund_id), 1_000 * USDC);
    assert_eq!(c.token.balance(&c.treasury), 50 * USDC);
    assert_eq!(c.token.balance(&c.donor), (10_000 - 1_050) * USDC);
    // Sin cubrir la comisión, sale del aporte.
    c.fund.donate_to_zone(&c.donor, &c.zone, &(100 * USDC), &false);
    let z = c.fund.zone(&c.zone);
    assert_eq!(z.balance, 1_095 * USDC);
    assert_eq!(z.total_donated, 1_095 * USDC);
    assert_eq!(c.token.balance(&c.treasury), 55 * USDC);
}

#[test]
fn donar_valida_minimo_y_zona() {
    let (c, ..) = ready();
    assert_eq!(c.fund.try_donate_to_zone(&c.donor, &c.zone, &(USDC - 1), &true), Err(Ok(Error::BelowMinDonation)));
    assert_eq!(c.fund.try_donate_to_zone(&c.donor, &c.zone, &USDC, &false), Err(Ok(Error::BelowMinDonation)));
    assert_eq!(c.fund.try_donate_to_zone(&c.donor, &id(&c.env, 2), &USDC, &true), Err(Ok(Error::UnknownZone)));
}

#[test]
fn nadie_dona_en_nombre_de_otro() {
    let c = base(true);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &USDC, &USDC, &0, &0);
    c.mint.mint(&c.donor, &(100 * USDC));
    c.env.set_auths(&[]);
    assert!(c.fund.try_donate_to_zone(&c.donor, &c.zone, &(10 * USDC), &true).is_err());
    assert_eq!(c.token.balance(&c.donor), 100 * USDC);
}

#[test]
fn donar_directo_a_un_cuartel() {
    let (c, s1, ..) = ready();
    c.fund.donate_to_recipient(&c.donor, &id(&c.env, 11), &(100 * USDC), &true);
    assert_eq!(c.token.balance(&s1), 100 * USDC);
    assert_eq!(c.token.balance(&c.fund_id), 1_000 * USDC);
    assert_eq!(c.token.balance(&c.treasury), 55 * USDC);
    c.fund.revoke_recipient(&id(&c.env, 11));
    assert_eq!(
        c.fund.try_donate_to_recipient(&c.donor, &id(&c.env, 11), &(100 * USDC), &true),
        Err(Ok(Error::RecipientInactive))
    );
    // Una credencial nueva no cobra hasta cumplir la demora.
    c.fund.add_recipient(&id(&c.env, 13), &c.zone, &Kind::Station, &s1);
    assert_eq!(
        c.fund.try_donate_to_recipient(&c.donor, &id(&c.env, 13), &(100 * USDC), &true),
        Err(Ok(Error::NotYetActive))
    );
}

// ------------------------------------------------------------------ reportar y liberar
#[test]
fn meta_publica() {
    let (c, ..) = ready();
    // 5 focos × 14 ha × 4 USDC por hectárea.
    assert_eq!(c.fund.preview_target(&c.zone, &5), Target { area_ha: 70, target: 280 * USDC });
}

#[test]
fn libera_y_reparte_entre_cuartel_asignado_y_asistencia() {
    let (c, s1, s2, a1) = ready();
    // Usa el menor de los dos sensores: 5 focos → meta 280 USDC.
    let evento = c.fund.report_fire(&report(&c, 0, 8), &report(&c, 1, 5));
    assert_eq!(evento, 1);
    // 3/4 a cuarteles (combate + logística), 1/4 a asistencia.
    assert_eq!(c.token.balance(&s1), 210 * USDC);
    assert_eq!(c.token.balance(&s2), 0); // tiene credencial pero no fue asignado
    assert_eq!(c.token.balance(&a1), 70 * USDC);
    let z = c.fund.zone(&c.zone);
    assert_eq!(z.balance, 720 * USDC);
    assert_eq!(z.total_released, 280 * USDC);
    assert_eq!(z.last_release, T0 + DELAY);
    assert_eq!(c.token.balance(&c.fund_id), 720 * USDC);
}

#[test]
fn respeta_el_tope_por_evento_y_el_saldo() {
    let (c, s1, _, a1) = ready();
    // 100 focos → meta 5.600 USDC, tope 500.
    c.fund.report_fire(&report(&c, 1, 100), &report(&c, 0, 100));
    assert_eq!(c.token.balance(&s1) + c.token.balance(&a1), 500 * USDC);
    assert_eq!(c.fund.zone_balance(&c.zone), 500 * USDC);
}

#[test]
fn sin_asistencia_todo_va_a_los_cuarteles() {
    let (c, s1, ..) = ready();
    c.fund.revoke_recipient(&id(&c.env, 21));
    c.fund.report_fire(&report(&c, 0, 5), &report(&c, 1, 5));
    assert_eq!(c.token.balance(&s1), 280 * USDC);
}

#[test]
fn rechaza_reportes_mal_formados() {
    let (c, ..) = ready();
    let a = report(&c, 0, 5);
    assert_eq!(c.fund.try_report_fire(&a, &report(&c, 0, 5)), Err(Ok(Error::BadReports)));
    assert_eq!(c.fund.try_report_fire(&a, &report(&c, 2, 5)), Err(Ok(Error::BadReports)));
    let mut b = report(&c, 1, 5);
    b.zone_id = id(&c.env, 2);
    assert_eq!(c.fund.try_report_fire(&a, &b), Err(Ok(Error::BadReports)));
    let mut b = report(&c, 1, 5);
    b.polygon_hash = id(&c.env, 8);
    assert_eq!(c.fund.try_report_fire(&a, &b), Err(Ok(Error::WrongPolygon)));
    let mut b = report(&c, 1, 5);
    b.data_time = b.observed_at + 1;
    assert_eq!(c.fund.try_report_fire(&a, &b), Err(Ok(Error::BadReports)));
    assert_eq!(c.fund.try_report_fire(&a, &report(&c, 1, 2)), Err(Ok(Error::NotEnoughHotspots)));
}

#[test]
fn rechaza_datos_viejos_o_del_futuro() {
    let (c, ..) = ready();
    let a = report(&c, 0, 5);
    let now = c.env.ledger().timestamp();
    let con = |f: &dyn Fn(&mut FireReport)| {
        let mut b = report(&c, 1, 5);
        f(&mut b);
        c.fund.try_report_fire(&a, &b)
    };
    assert_eq!(con(&|b| b.observed_at = now + 1), Err(Ok(Error::StaleReport)));
    assert_eq!(con(&|b| b.data_time = now - MAX_DATA_AGE - 1), Err(Ok(Error::StaleReport)));
    assert_eq!(
        con(&|b| {
            b.observed_at = now - MAX_REPORT_AGE - 1;
            b.data_time = b.observed_at;
        }),
        Err(Ok(Error::StaleReport))
    );
    assert_eq!(
        con(&|b| {
            b.observed_at = now - MAX_REPORT_SPREAD - 1;
            b.data_time = b.observed_at;
        }),
        Err(Ok(Error::ReportsTooFarApart))
    );
}

#[test]
fn espera_entre_pagos_y_dato_nuevo() {
    let (c, s1, ..) = ready();
    c.fund.report_fire(&report(&c, 0, 5), &report(&c, 1, 5));
    let viejo0 = report(&c, 0, 5);
    let viejo1 = report(&c, 1, 5);
    assert_eq!(c.fund.try_report_fire(&viejo0, &viejo1), Err(Ok(Error::CooldownActive)));
    c.env.ledger().set_timestamp(T0 + DELAY + 3600);
    // Pasó la espera, pero la observación es anterior al último pago.
    assert_eq!(c.fund.try_report_fire(&viejo0, &viejo1), Err(Ok(Error::StaleReport)));
    // Reporte nuevo con el mismo dato de NASA de uno de los sensores: no paga dos veces.
    let mut repetido = report(&c, 1, 5);
    repetido.data_time = viejo1.data_time;
    assert_eq!(c.fund.try_report_fire(&report(&c, 0, 5), &repetido), Err(Ok(Error::StaleReport)));
    // Con pasada nueva de los dos satélites, paga.
    assert_eq!(c.fund.report_fire(&report(&c, 0, 5), &report(&c, 1, 5)), 2);
    assert_eq!(c.token.balance(&s1), 420 * USDC);
}

#[test]
fn sin_asignacion_vigente_no_libera() {
    let (c, s1, ..) = ready();
    c.fund.set_responders(&c.zone, &Vec::new(&c.env), &0);
    assert_eq!(c.fund.try_report_fire(&report(&c, 0, 5), &report(&c, 1, 5)), Err(Ok(Error::NoResponders)));
    // Asignación vencida.
    c.fund.set_responders(&c.zone, &Vec::from_array(&c.env, [id(&c.env, 11)]), &(T0 + DELAY + 10));
    c.env.ledger().set_timestamp(T0 + DELAY + 11);
    assert_eq!(c.fund.try_report_fire(&report(&c, 0, 5), &report(&c, 1, 5)), Err(Ok(Error::NoResponders)));
    // Cuartel asignado y después dado de baja.
    c.fund.set_responders(&c.zone, &Vec::from_array(&c.env, [id(&c.env, 11)]), &(T0 + DAY));
    c.fund.revoke_recipient(&id(&c.env, 11));
    assert_eq!(c.fund.try_report_fire(&report(&c, 0, 5), &report(&c, 1, 5)), Err(Ok(Error::NoResponders)));
    assert_eq!(c.token.balance(&s1), 0);
    assert_eq!(c.fund.zone_balance(&c.zone), 1_000 * USDC);
    assert_eq!(c.fund.event_count(), 0);
}

#[test]
fn zona_sin_fondos_registra_el_evento_y_no_gasta_la_espera() {
    let c = base(true);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &(500 * USDC), &USDC, &0, &0);
    assert_eq!(c.fund.report_fire(&report(&c, 0, 5), &report(&c, 1, 5)), 1);
    assert_eq!(c.fund.zone(&c.zone).last_release, 0);
}

// ------------------------------------------------------------------ firmas de los oráculos
fn auth<'a>(c: &'a Ctx, quien: &'a Address, r: &FireReport) -> MockAuth<'a> {
    let invoke = std::boxed::Box::leak(std::boxed::Box::new(MockAuthInvoke {
        contract: &c.fund_id,
        fn_name: "report_fire",
        args: (r.clone(),).into_val(&c.env),
        sub_invokes: &[],
    }));
    MockAuth { address: quien, invoke }
}

#[test]
fn hacen_falta_las_dos_firmas() {
    let (c, s1, ..) = ready();
    let (a, b) = (report(&c, 0, 5), report(&c, 1, 5));

    c.env.set_auths(&[]);
    assert!(c.fund.try_report_fire(&a, &b).is_err());

    // Solo un oráculo.
    c.env.mock_auths(&[auth(&c, &c.oracle0, &a)]);
    assert!(c.fund.try_report_fire(&a, &b).is_err());

    // El oráculo 0 no puede firmar por el sensor 1.
    c.env.mock_auths(&[auth(&c, &c.oracle0, &a), auth(&c, &c.oracle0, &b)]);
    assert!(c.fund.try_report_fire(&a, &b).is_err());

    // Una firma no sirve para un reporte con otros números.
    let inflado = FireReport { hotspots: 500, ..b.clone() };
    c.env.mock_auths(&[auth(&c, &c.oracle0, &a), auth(&c, &c.oracle1, &b)]);
    assert!(c.fund.try_report_fire(&a, &inflado).is_err());
    assert_eq!(c.token.balance(&s1), 0);

    // Cada uno firma lo suyo: paga. No hace falta la federación ni nadie más.
    c.env.mock_auths(&[auth(&c, &c.oracle0, &a), auth(&c, &c.oracle1, &b)]);
    assert_eq!(c.fund.report_fire(&a, &b), 1);
    assert_eq!(c.token.balance(&s1), 210 * USDC);
}

// ------------------------------------------------------------------ pagos que fallan
#[contracttype]
enum MockKey {
    Balance(Address),
    Blocked(Address),
}

/// Moneda de prueba que rechaza los envíos a una cuenta bloqueada, como pasa en Stellar
/// cuando el destinatario todavía no habilitó USDC.
#[contract]
struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = MockKey::Balance(to);
        let now: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(now + amount));
    }

    pub fn block(env: Env, who: Address) {
        env.storage().persistent().set(&MockKey::Blocked(who), &true);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&MockKey::Balance(id)).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if env.storage().persistent().has(&MockKey::Blocked(to.clone())) {
            panic!("destinatario bloqueado");
        }
        let from_key = MockKey::Balance(from);
        let have: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if have < amount {
            panic!("saldo insuficiente");
        }
        env.storage().persistent().set(&from_key, &(have - amount));
        Self::mint(env, to, amount);
    }
}

fn con_moneda_de_prueba() -> (Ctx, MockTokenClient<'static>, Address, Address) {
    let mut c = base(true);
    let token_id = c.env.register(MockToken, ());
    let mock = MockTokenClient::new(&c.env, &token_id);
    c.fund_id = c.env.register(
        BrasaFund,
        (
            token_id.clone(),
            c.treasury.clone(),
            500u32,
            USDC,
            c.federation.clone(),
            c.oracle0.clone(),
            c.oracle1.clone(),
            DELAY,
            DELAY,
        ),
    );
    c.fund = BrasaFundClient::new(&c.env, &c.fund_id);
    c.token = TokenClient::new(&c.env, &token_id);
    c.fund.create_zone(&c.zone, &c.polygon, &3, &3600, &(500 * USDC), &USDC, &0, &0);
    let (s1, s2) = (Address::generate(&c.env), Address::generate(&c.env));
    c.fund.add_recipient(&id(&c.env, 11), &c.zone, &Kind::Station, &s1);
    c.fund.add_recipient(&id(&c.env, 12), &c.zone, &Kind::Station, &s2);
    c.env.ledger().set_timestamp(T0 + DELAY); // la demora de las credenciales ya se cumplió
    c.fund.set_responders(&c.zone, &Vec::from_array(&c.env, [id(&c.env, 11), id(&c.env, 12)]), &(T0 + DAY));
    mock.mint(&c.donor, &(10_000 * USDC));
    c.fund.donate_to_zone(&c.donor, &c.zone, &(1_000 * USDC), &true);
    (c, mock, s1, s2)
}

#[test]
fn un_pago_que_falla_vuelve_al_fondo_y_no_frena_al_resto() {
    let (c, mock, s1, s2) = con_moneda_de_prueba();
    mock.block(&s2);
    // 10 focos × 14 ha × 1 USDC = 140 USDC, mitad para cada cuartel.
    c.fund.report_fire(&report(&c, 0, 10), &report(&c, 1, 10));
    assert_eq!(c.token.balance(&s1), 70 * USDC);
    assert_eq!(c.token.balance(&s2), 0);
    let z = c.fund.zone(&c.zone);
    assert_eq!(z.balance, 930 * USDC);
    assert_eq!(z.total_released, 70 * USDC);
    assert_eq!(c.token.balance(&c.fund_id), 930 * USDC);
    assert_eq!(z.last_release, T0 + DELAY);
}

#[test]
fn si_fallan_todos_no_se_gasta_la_espera_ni_el_dato() {
    let (c, mock, s1, s2) = con_moneda_de_prueba();
    mock.block(&s1);
    mock.block(&s2);
    let (a, b) = (report(&c, 0, 10), report(&c, 1, 10));
    c.fund.report_fire(&a, &b);
    let z = c.fund.zone(&c.zone);
    assert_eq!(z.balance, 1_000 * USDC);
    assert_eq!(z.total_released, 0);
    assert_eq!(z.last_release, 0);
    assert_eq!(z.last_data_time0, 0);
}

// ------------------------------------------------------------------ roles
#[test]
fn traspaso_de_federacion_en_dos_pasos() {
    let c = base(true);
    let nueva = Address::generate(&c.env);
    assert_eq!(c.fund.try_accept_federation(), Err(Ok(Error::NothingPending)));
    c.fund.transfer_federation(&Some(nueva.clone()));
    assert_eq!(c.fund.federation(), c.federation);
    assert_eq!(
        c.fund.pending_federation(),
        Some(PendingFederation { account: nueva.clone(), valid_until: T0 + FEDERATION_TRANSFER_WINDOW })
    );
    c.fund.propose_oracle(&0, &Address::generate(&c.env));
    c.fund.accept_federation();
    assert_eq!(c.fund.federation(), nueva);
    assert_eq!(c.fund.pending_federation(), None);
    // La federación nueva no hereda propuestas de claves.
    assert_eq!(c.fund.pending_oracle(&0), None);
    // Y se puede cancelar un traspaso.
    c.fund.transfer_federation(&Some(c.federation.clone()));
    c.fund.transfer_federation(&None);
    assert_eq!(c.fund.try_accept_federation(), Err(Ok(Error::NothingPending)));
}

#[test]
fn un_traspaso_de_federacion_vence() {
    let c = base(true);
    let nueva = Address::generate(&c.env);
    c.fund.transfer_federation(&Some(nueva.clone()));
    c.env.ledger().set_timestamp(T0 + FEDERATION_TRANSFER_WINDOW + 1);
    assert_eq!(c.fund.try_accept_federation(), Err(Ok(Error::ProposalExpired)));
    assert_eq!(c.fund.federation(), c.federation);
    // Proponerlo de nuevo abre otro plazo.
    c.fund.transfer_federation(&Some(nueva.clone()));
    c.fund.accept_federation();
    assert_eq!(c.fund.federation(), nueva);
}

#[test]
fn una_propuesta_vencida_no_traba_la_rotacion_del_otro_sensor() {
    let c = base(true);
    c.fund.propose_oracle(&1, &Address::generate(&c.env));
    // Mientras está vigente, traba.
    c.env.ledger().set_timestamp(T0 + DELAY + ORACLE_PROPOSAL_WINDOW);
    assert_eq!(c.fund.try_propose_oracle(&0, &Address::generate(&c.env)), Err(Ok(Error::RotationInProgress)));
    // Vencida, se limpia sola al proponer para el otro sensor.
    c.env.ledger().set_timestamp(T0 + DELAY + ORACLE_PROPOSAL_WINDOW + 1);
    let nuevo = Address::generate(&c.env);
    c.fund.propose_oracle(&0, &nuevo);
    assert_eq!(c.fund.pending_oracle(&1), None);
    assert_eq!(c.fund.pending_oracle(&0).unwrap().signer, nuevo);
}

#[test]
fn las_demoras_tienen_piso_y_techo() {
    for (rd, od) in [(MIN_DELAY - 1, DELAY), (DELAY, MIN_DELAY - 1), (0, 0), (MAX_DELAY + 1, DELAY), (DELAY, MAX_DELAY + 1)] {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            env.register(BrasaFund, (a.clone(), a.clone(), 500u32, USDC, a.clone(), a.clone(), b.clone(), rd, od));
        }));
        assert!(r.is_err(), "aceptó demoras {rd} y {od}");
    }
    let env = Env::default();
    let a = Address::generate(&env);
    let b = Address::generate(&env);
    env.register(BrasaFund, (a.clone(), a.clone(), 500u32, USDC, a.clone(), a.clone(), b, MIN_DELAY, MAX_DELAY));
}

#[test]
fn rotacion_de_oraculos_con_demora() {
    let c = base(true);
    let nuevo = Address::generate(&c.env);
    assert_eq!(c.fund.try_propose_oracle(&2, &nuevo), Err(Ok(Error::BadConfig)));
    assert_eq!(c.fund.try_propose_oracle(&0, &c.oracle1), Err(Ok(Error::BadConfig)));
    assert_eq!(c.fund.try_accept_oracle(&0), Err(Ok(Error::NothingPending)));
    c.fund.propose_oracle(&0, &nuevo);
    // De a una por vez.
    assert_eq!(c.fund.try_propose_oracle(&1, &Address::generate(&c.env)), Err(Ok(Error::RotationInProgress)));
    assert_eq!(c.fund.try_accept_oracle(&0), Err(Ok(Error::NotYetActive)));
    c.env.ledger().set_timestamp(T0 + DELAY);
    c.fund.accept_oracle(&0);
    assert_eq!(c.fund.oracle(&0), nuevo);
    // Tras un cambio hay que esperar otra demora para proponer el siguiente.
    assert_eq!(c.fund.try_propose_oracle(&1, &Address::generate(&c.env)), Err(Ok(Error::RotationInProgress)));
    c.env.ledger().set_timestamp(T0 + 2 * DELAY);
    c.fund.propose_oracle(&1, &Address::generate(&c.env));
    c.fund.cancel_oracle(&1);
    assert_eq!(c.fund.try_cancel_oracle(&1), Err(Ok(Error::NothingPending)));
}

#[test]
fn una_propuesta_de_oraculo_vence() {
    let c = base(true);
    c.fund.propose_oracle(&1, &Address::generate(&c.env));
    c.env.ledger().set_timestamp(T0 + DELAY + ORACLE_PROPOSAL_WINDOW + 1);
    assert_eq!(c.fund.try_accept_oracle(&1), Err(Ok(Error::ProposalExpired)));
    assert_eq!(c.fund.oracle(&1), c.oracle1);
}

#[test]
fn solo_la_federacion_maneja_roles_y_credenciales() {
    let (c, s1, ..) = ready();
    c.env.set_auths(&[]);
    assert!(c.fund.try_transfer_federation(&Some(s1.clone())).is_err());
    assert!(c.fund.try_propose_oracle(&0, &s1).is_err());
    assert!(c.fund.try_add_recipient(&id(&c.env, 77), &c.zone, &Kind::Station, &s1).is_err());
    assert!(c.fund.try_revoke_recipient(&id(&c.env, 11)).is_err());
    assert!(c.fund.try_set_responders(&c.zone, &Vec::new(&c.env), &0).is_err());
}

// ------------------------------------------------------------------ vigencia de los datos
#[test]
fn cada_uso_renueva_la_vigencia_de_la_zona() {
    let (c, ..) = ready();
    let ttl = c.env.as_contract(&c.fund_id, || {
        c.env.storage().persistent().get_ttl(&DataKey::Zone(c.zone.clone()))
    });
    assert!(ttl >= 100 * 17_280, "vigencia de {ttl} ledgers");
}
