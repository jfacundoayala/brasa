# Relayer en Oracle Cloud (VM Always Free)
> Resumen. La guía completa, paso a paso, está en [`../docs/futuro/ORACLE-PASO-A-PASO.md`](../../docs/futuro/ORACLE-PASO-A-PASO.md). La VM solo baja datos y sirve la web; las claves de oráculo no van ahí.

> Propuesta para el piloto. Todo es testnet.

## 1. Crear la VM (a mano, por consola de Oracle)
- Cuenta Always Free, región *home* (la que elegiste al registrarte), alerta de gasto activada.
- Forma `VM.Standard.E2.1.Micro` (o Ampere A1 si hay capacidad). Ubuntu 24.04. Abrí solo el puerto 22.
- Una clave SSH tuya. **Nunca** subas esa clave al repo.

## 2. Instalar
```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
git clone https://github.com/jfacundoayala/brasa.git brasa && cd brasa/relayer && npm ci
```
El relayer usa `contracts/artifacts/.../BrasaFund.json` (el ABI). En la VM corré antes `cd contracts && npm ci && npx hardhat compile`, o copiá solo ese JSON.

## 3. Variables (no van al repo)
Archivo `/home/ubuntu/relayer.env` con permisos `600`:
```
MAP_KEY=...               # clave gratis de NASA FIRMS
```

## 4. Cron (cada 3 horas, FIRMS demora ~3 h)
Ver `crontab.txt`. El relayer **falla cerrado**: si FIRMS no responde o si hay menos focos que el mínimo, no envía nada. El contrato además rechaza datos de más de 24 h y tiene cooldown y nonce único.

## 5. Evitar que Oracle recupere una VM ociosa
Always Free puede reclamar instancias con CPU baja durante 7 días. Revisá el estado de la VM cada semana.
