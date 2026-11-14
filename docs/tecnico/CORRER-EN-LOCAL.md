# Correr brasa en local y en Fuji

## En un nodo local

```bash
# 1) nodo local
cd contracts && npm install && npx hardhat compile && npx hardhat node

# 2) desplegar, preparar el mapa y simular la pasada del satélite
cd contracts && NETWORK=local node scripts/deploy.mjs
cd ../relayer && npm install && node src/index.mjs preparar
cd ../relayer && LOCAL_DEMO=1 node src/index.mjs reportar

# 3) la web
cd web && npm install && npm run dev
```

Tests desde la raíz: `npm run instalar` una vez y después `npm test`.

## Verificar un reporte

Cualquiera puede hacerlo:

```bash
cd relayer
node src/index.mjs verificar-hash --tx <hash de la tx reportFire> --datos <carpeta con los datos de ese día>
```

Lee el reporte de la cadena, recalcula la huella (`dataHash`) con los datos de NASA FIRMS y dice si coincide. Sin `--tx` muestra las huellas. `--rpc <url>` usa otra red; por defecto, Fuji. Cómo se calcula la huella: [`VERIFICAR-HUELLA.md`](VERIFICAR-HUELLA.md).

## En Fuji

1. Billeteras **descartables** (deployer, tesorería, dos oráculos, dos cuarteles, una entidad) y AVAX de prueba del faucet. **Nunca** una billetera con fondos reales.
2. Copiá `.env.example` a `.env.local`, completalo y exportá las variables solo en tu terminal. No se sube al repo.
3. `cd contracts && NETWORK=fuji node scripts/deploy.mjs`. Usa el USDC de Fuji y escribe `web/public/deployment.json`.
4. Conseguí USDC de prueba (faucet de Circle) y doná a la zona desde la web.
5. Oráculo: `ORACLE0_PRIVATE_KEY=… ORACLE1_PRIVATE_KEY=… node src/index.mjs reportar`.

Direcciones y datos de la red: [`DIRECCIONES.md`](DIRECCIONES.md).
