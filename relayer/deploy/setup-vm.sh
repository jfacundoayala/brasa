#!/usr/bin/env bash
# Prepara una VM Ubuntu 24.04 de Oracle Cloud para Brasa (pasos 4 a 10 de docs/futuro/ORACLE-PASO-A-PASO.md).
# Uso, dentro de la VM y con el repo ya clonado en ~/brasa:
#   bash ~/brasa/relayer/deploy/setup-vm.sh
# No pide ni guarda claves de oráculo. MAP_KEY es opcional: si falta, la web usa los datos guardados.
set -euo pipefail

REPO="$HOME/brasa"
FUND="0x014fFD4e42580Cb0a0C2336BaF24A2bfCA174764"

echo "== 1. Paquetes del sistema"
sudo apt-get update -y
sudo apt-get install -y git curl iptables-persistent
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2
node -v

echo "== 2. Dependencias"
cd "$REPO/relayer" && npm ci
cd "$REPO/web" && npm ci

echo "== 3. deployment.json (no se sube a git)"
cat > "$REPO/web/public/deployment.json" <<EOF
{"network":"fuji","chainId":43113,"rpc":"https://api.avax-test.network/ext/bc/C/rpc","explorer":"https://explorer-test.avax.network/c-chain","fund":"$FUND","usdc":"0x5425890298aed601595a70AB815c96711a31Bc65","zoneId":"0x73616c7461000000000000000000000000000000000000000000000000000000","zoneName":"Salta","feeBps":500}
EOF

echo "== 4. Datos de NASA"
touch "$HOME/relayer.env" && chmod 600 "$HOME/relayer.env"
if grep -q PRIVATE_KEY "$HOME/relayer.env"; then
  echo "ERROR: ~/relayer.env tiene claves de oráculo. Sacalas: en la VM solo va MAP_KEY." >&2
  exit 1
fi
if grep -q '^MAP_KEY=.\+' "$HOME/relayer.env"; then
  set -a; . "$HOME/relayer.env"; set +a
  (cd "$REPO/relayer" && node src/index.mjs preparar --live) || echo "AVISO: preparar --live falló; sigue con datos guardados."
else
  echo "AVISO: sin MAP_KEY en ~/relayer.env; la web muestra los datos guardados."
fi

echo "== 5. Build y web en el puerto 3000"
# SITIO_URL hace que el link se vea bien al compartirlo (imagen og-brasa.png con la IP real).
IP_PUBLICA="${IP_PUBLICA:-$(curl -s --max-time 5 https://ifconfig.me || echo localhost)}"
cd "$REPO/web" && SITIO_URL="http://$IP_PUBLICA:3000" npm run build
pm2 delete brasa-web >/dev/null 2>&1 || true
pm2 start npm --name brasa-web -- start -- -p 3000
pm2 save
sudo env PATH="$PATH" "$(command -v pm2)" startup systemd -u "$USER" --hp "$HOME" >/dev/null

echo "== 6. Firewall del sistema"
if ! sudo iptables -C INPUT -p tcp --dport 3000 -m state --state NEW -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
fi
sudo netfilter-persistent save

echo "== 7. Cron cada 3 horas (solo si hay MAP_KEY)"
if grep -q '^MAP_KEY=.\+' "$HOME/relayer.env"; then
  LINE="7 */3 * * * set -a; . $HOME/relayer.env; set +a; cd $REPO/relayer && $(command -v node) src/index.mjs preparar --live >> $HOME/relayer.log 2>&1 && $(command -v pm2) restart brasa-web >> $HOME/relayer.log 2>&1"
  (crontab -l 2>/dev/null | grep -v 'preparar --live'; echo "$LINE") | crontab -
fi

echo "== Listo. Probá: curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000 || true
