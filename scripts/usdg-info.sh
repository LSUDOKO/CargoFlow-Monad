#!/usr/bin/env bash
# CF-002/CF-003: verify the chain and read USDC metadata from chain rather than assuming it.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }
RPC="${MONAD_RPC_URL:-https://testnet-rpc.monad.xyz}"
USDC="${USDG_ADDRESS:-0x534b2f3A21130d7a60830c2Df862319e593943A3}"
CAST="${CAST:-cast}"  # `make usdg-info` passes the real Foundry cast

echo "chain id : $($CAST chain-id --rpc-url "$RPC") (expected ${MONAD_CHAIN_ID:-10143})"
echo "USDC     : $USDC"
echo "name     : $($CAST call "$USDC" 'name()(string)' --rpc-url "$RPC")"
echo "symbol   : $($CAST call "$USDC" 'symbol()(string)' --rpc-url "$RPC")"
echo "decimals : $($CAST call "$USDC" 'decimals()(uint8)' --rpc-url "$RPC")"
if [ -n "${private_key:-${PRIVATE_KEY:-}}" ]; then
  K="${PRIVATE_KEY:-$private_key}"; K="${K#0x}"
  ADDR=$($CAST wallet address --private-key "0x$K")
  echo "deployer : $ADDR"
  echo "ETH      : $($CAST balance "$ADDR" --rpc-url "$RPC" --ether)"
  echo "USDC     : $($CAST call "$USDC" 'balanceOf(address)(uint256)' "$ADDR" --rpc-url "$RPC") (raw, 6 decimals)"
fi
