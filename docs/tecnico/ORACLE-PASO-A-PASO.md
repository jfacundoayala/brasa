# Oracle Cloud paso a paso: la web y los datos de NASA siempre al día

> Propuesta para el piloto. Hoy la web corre en Vercel. Paso siguiente: una VM de Oracle Cloud (Always Free) siempre prendida, que baja los focos de NASA cada 3 horas y sirve la web. Más adelante puede alojar el relayer de una federación.

> **No confundir:** en el track, "Oracle" es **la empresa Oracle** y su nube. El **oráculo** de blockchain es otra cosa: es quien le lleva el dato de NASA al contrato, y en brasa ya existe (dos firmantes, `firmar` y `enviar`). Esta guía es para **alojar la web** en Oracle Cloud.
> Atajo: con el repo clonado en la VM, `bash ~/brasa/deploy/setup-vm.sh` hace los pasos 4 a 10.

> **Objetivo:** que la web de brasa tenga un **link público** y muestre **datos de NASA en vivo**, corriendo en una VM de Oracle Cloud. Todo es testnet.
> Complementa [`../../relayer/deploy/ORACLE-VM.md`](../../relayer/deploy/ORACLE-VM.md). **Si hay diferencias, vale esta guía.**

## Lo que Oracle hace y lo que no
- **Sí:** aloja la web y corre el comando que baja los focos de NASA FIRMS cada 3 horas.
- **No:** no se conecta al satélite en tiempo real (FIRMS demora ~3 h) y **no firma reportes**. Las claves de los oráculos **no van en la VM**: así cada oráculo sigue en manos de un operador distinto. La firma sigue siendo manual con `firmar` y `enviar`.

## Paso 1. Clave de NASA FIRMS (5 minutos)
1. Entrá a `https://firms.modaps.eosdis.nasa.gov/api/map_key/` y pedí la **MAP_KEY** con tu email.
2. Te llega por correo. Guardala; no va al repo ni a ningún chat.

## Paso 2. Crear la VM en la consola de Oracle
1. Consola de Oracle Cloud → **Compute → Instances → Create instance**.
2. Nombre: `brasa`. Imagen: **Canonical Ubuntu 24.04**.
3. Forma (*Shape*): `VM.Standard.E2.1.Micro` (Always Free). Si hay capacidad, `VM.Standard.A1.Flex` (Ampere, también Always Free, más potente).
4. Red: subred **pública** y **asignar IP pública** activado.
5. Clave SSH: en tu compu corré `ssh-keygen -t ed25519 -f brasa_oracle` y subí el archivo `brasa_oracle.pub` en "Add SSH keys". **La clave sin `.pub` es privada: nunca al repo.**
6. **Create.** Esperá a que diga *Running* y copiá la **IP pública**.

## Paso 3. Abrir el puerto de la web (3000)
1. En la VM: **Networking → Virtual Cloud Network → tu VCN → Subnet → Security List → Add Ingress Rules**.
2. Origen `0.0.0.0/0`, protocolo TCP, puerto destino **3000**. Guardá.
3. Dentro de la VM (paso 4) hay que abrir también el firewall del sistema (ver paso 9). Es el error más común: sin eso, la web no abre desde afuera.

## Paso 4. Entrar y preparar la VM
```bash
ssh -i brasa_oracle ubuntu@<IP-PUBLICA>
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
node -v   # debe decir v22.x
```

## Paso 5. Traer el código
El repo es público. En la VM:
```bash
git clone https://github.com/jfacundoayala/brasa.git
cd brasa
```

## Paso 6. Instalar y configurar
```bash
cd ~/brasa/relayer && npm ci
cd ~/brasa/web && npm ci
```
La web publicada lee `web/public/deployment.fuji.json`, que ya apunta al contrato vigente. Para que el relayer use el mismo, copialo como `deployment.json` (no se sube a git):
```bash
cp ~/brasa/web/public/deployment.fuji.json ~/brasa/web/public/deployment.json
```

Archivo con la clave de FIRMS, **solo con esa clave**:
```bash
cat > ~/relayer.env <<'EOF'
MAP_KEY=pegá_acá_tu_clave
EOF
chmod 600 ~/relayer.env
```
**No pongas `ORACLE0_PRIVATE_KEY` ni `ORACLE1_PRIVATE_KEY` en este archivo.**

## Paso 7. Probar la descarga en vivo
```bash
set -a; . ~/relayer.env; set +a
cd ~/brasa/relayer && node src/index.mjs preparar --live
```
Debe terminar sin errores y actualizar `web/public/focos.json`. Si dice que falta `MAP_KEY` o FIRMS no responde, revisá la clave.

## Paso 8. Levantar la web
```bash
cd ~/brasa/web && SITIO_URL=http://<IP-PUBLICA>:3000 npm run build   # la IP hace que el link se vea bien al compartirlo
pm2 start npm --name brasa-web -- start -- -p 3000
pm2 save
pm2 startup     # copiá y corré el comando que imprime (con sudo)
```
Next.js sirve `public/` como estaba al arrancar. Por eso el cron del paso 10 **reinicia** la web después de bajar datos nuevos.

## Paso 9. Abrir el firewall del sistema
Las imágenes de Oracle traen reglas que bloquean el puerto:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt install -y iptables-persistent   # contestá que sí a guardar
sudo netfilter-persistent save
```
Probá desde tu compu: `http://<IP-PUBLICA>:3000`.

## Paso 10. Datos frescos solos (cron cada 3 horas)
```bash
crontab -e
```
Pegá (reemplaza la línea de `deploy/crontab.txt`, que usa `reportar` con claves de oráculo y **no hay que usar**):
```
7 */3 * * * set -a; . /home/ubuntu/relayer.env; set +a; cd /home/ubuntu/brasa/relayer && /usr/bin/node src/index.mjs preparar --live >> /home/ubuntu/relayer.log 2>&1 && /usr/bin/pm2 restart brasa-web >> /home/ubuntu/relayer.log 2>&1
```
Si más adelante hacés `git pull` en la VM y falla por `focos.json`, corré antes `git checkout web/public/focos.json`.

## Paso 11. Cómo saber que quedó bien (verificación)
- [ ] `http://<IP>:3000` abre el mapa de Salta.
- [ ] **No** dice "Datos guardados" y la hora de actualización es de hoy.
- [ ] La dirección del contrato es la de [`../tecnico/DIRECCIONES.md`](../tecnico/DIRECCIONES.md).
- [ ] `pm2 status` muestra `brasa-web` en *online*.
- [ ] `tail ~/relayer.log` no tiene errores.
- [ ] En la VM no hay claves de oráculo: `grep -c PRIVATE_KEY ~/relayer.env` da **0**.

## Cuidados
- **Always Free puede reclamar VMs inactivas** (poca CPU durante 7 días). Revisá el estado de la VM cada semana.
- La web va por HTTP. Paso siguiente: un dominio con certificado. Nunca pidas ni muestres claves en esa página.
