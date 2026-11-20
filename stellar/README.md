# brasa en Stellar

Contrato del fondo de emergencia, escrito en Rust para Stellar (Soroban).
Solo red de prueba. Sin auditoría externa.

## Qué hace

1. La federación crea una zona y da credenciales a cuarteles y entidades de asistencia.
2. Cualquiera dona USDC a la zona o directo a un cuartel.
3. Dos oráculos, uno por satélite, reportan los focos de la NASA. Cada uno autoriza solo su reporte.
4. Si los dos reportes son válidos y frescos, el contrato calcula la meta y libera el dinero a los cuarteles asignados al incendio.

No existe ninguna función para retirar el fondo.

## Diferencias con la versión de Avalanche

- Los oráculos son cuentas de Stellar que autorizan la llamada. La red evita que una firma se use dos veces.
- USDC en Stellar tiene 7 decimales.
- Un cuartel tiene que habilitar USDC en su cuenta para cobrar. Si no lo hizo, su parte queda en el fondo de la zona.
- Cada uso renueva la vigencia de los datos guardados.

## Probar

```bash
cargo test
```

## Compilar

```bash
stellar contract build
```

El resultado queda en `target/wasm32v1-none/release/brasa_fund.wasm`.

En Windows sin Visual Studio, usar el compilador GNU:

```bash
RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu cargo test
```
