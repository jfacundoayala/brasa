#!/usr/bin/env bash
# Despliega el v3 en Fuji con las MISMAS direcciones del v2 (oráculos, cuarteles, entidad y tesorería).
# Cambian solo el deployer y la federación (otra wallet, creada con crear-federacion.mjs).
# Las claves se leen de .env.local (no va a git) y nunca se imprimen.
#
#   cd contracts && bash scripts/desplegar-v3-fuji.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a && . ../.env.local && set +a

# Direcciones públicas del v2 (0xAABc…c72f), leídas de la cadena.
export ORACLE0_ADDRESS=0xd678ff8c716143515417883cb6dC3b7588a6B651   # Facundo, sensor 0 (NOAA-20)
export ORACLE1_ADDRESS=0x50D250E44fb164ba509f830503199696cfDEE779   # Gastón, sensor 1 (NOAA-21)
export TREASURY_ADDRESS=0x54e1524Ac29899aD01437545FE6e80D120875cda
export CUARTEL_A_ADDRESS=0x141222F065eD0001C5854213fE5a4A358b94b3CA
export CUARTEL_B_ADDRESS=0x9f22A4C28b923b69Bd3957D44799c16030CaDF5f
export ENTIDAD_ADDRESS=0xdE8e125ECE93651D683C4653C9E31e3D95C1d21B

NETWORK=fuji node scripts/deploy.mjs
