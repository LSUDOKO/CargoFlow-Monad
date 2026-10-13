#!/usr/bin/env bash
# Deploys CargoFlow to Monad Testnet using the deployer key in .env and a separate wallet per
# operational role (generate them with scripts/testnet-keys.sh). Dry run by default; BROADCAST=1 sends the
# transactions and writes contracts/deployments/monad-testnet.json.
set -euo pipefail
cd "$(dirname "$0")/.."
CAST="${CAST:-cast}"; FORGE="${FORGE:-forge}"
set -a; . ./.env; set +a
export MONAD_RPC_URL="${MONAD_RPC_URL:-https://testnet-rpc.monad.xyz}"
export USDG_ADDRESS="${USDG_ADDRESS:-0x534b2f3A21130d7a60830c2Df862319e593943A3}"
addr() { "$CAST" wallet address --private-key "$1"; }
for v in WORKER_KEY MONITOR_KEY MANAGER_KEY ARBITER_KEY; do
  [ -n "${!v:-}" ] || { echo "$v is missing: run scripts/testnet-keys.sh" >&2; exit 1; }
done
export WORKER_ADDRESS=$(addr "$WORKER_KEY") MONITOR_ADDRESS=$(addr "$MONITOR_KEY")
export MANAGER_ADDRESS=$(addr "$MANAGER_KEY") ARBITER_ADDRESS=$(addr "$ARBITER_KEY")
[ "$("$CAST" chain-id --rpc-url "$MONAD_RPC_URL")" = 10143 ] || { echo "RPC is not Monad Testnet (10143)" >&2; exit 1; }
flags=(--rpc-url monad_testnet --with-gas-price "${GAS_PRICE:-102gwei}" --priority-gas-price "${PRIORITY_GAS_PRICE:-2gwei}" --slow)
if [ "${BROADCAST:-0}" = 1 ]; then flags+=(--broadcast); else echo "dry run (set BROADCAST=1 to send)"; fi
cd contracts && "$FORGE" script script/Deploy.s.sol "${flags[@]}"
