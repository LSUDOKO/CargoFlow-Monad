#!/usr/bin/env bash
# Lists a Cargo Note on Kuru's spot order book (Monad Testnet):
#   1. deploys CargoNoteWrapper once (WRAPPER=<addr> to reuse it)
#   2. the note's financier wraps the note into a CargoNoteToken (supply = the note's claim, 6 decimals)
#   3. creates a <note token>/USDC market through Kuru's permissionless Router.deployProxy
#   4. the financier posts a limit sell of the tokens on the book (MarginAccount deposit + addSellOrder)
#   5. the trader (TRADER_KEY, default the deployer) market-buys part of it straight from the wallet
# Usage: SHIPMENT=0x... [SYMBOL=cNOTE-0798] [ASK=0.99] [BUY_USDC=1] ./scripts/kuru-list-note.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CAST="${CAST:-cast}"; FORGE="${FORGE:-forge}"
set -a; . ./.env; set +a
RPC="${MONAD_RPC_URL:-https://testnet-rpc.monad.xyz}"
GAS=(--gas-price 102gwei --priority-gas-price 2gwei)
M=contracts/deployments/monad-testnet.json
get() { python3 -c "import json; d=json.load(open('$M')); print(d['contracts'].get('$1') or d.get('$1') or '')"; }
CTRL=$(get financingController); MARKET=$(get noteMarket); USDC=$(get usdg)
ROUTER=0x7EFbE105Ca7415dE98F96622173458ac1c054630
MARGIN=0xd029C2D98ff85D8F64799017fE00a59B1159CE02
DEPLOYER_KEY="0x${private_key#0x}"; FIN_KEY="0x${FINANCIER_KEY#0x}"; TRADER="0x${TRADER_KEY:-$private_key}"; TRADER="0x${TRADER#0x}"
FIN=$("$CAST" wallet address --private-key "$FIN_KEY"); TRA=$("$CAST" wallet address --private-key "$TRADER")
SHIPMENT="${SHIPMENT:?set SHIPMENT=<shipment id>}"; SYMBOL="${SYMBOL:-cNOTE-${SHIPMENT:62:4}}"
send() { local key=$1; shift; "$CAST" send "$@" --private-key "$key" --rpc-url "$RPC" "${GAS[@]}" --json | python3 -c "import json,sys; r=json.load(sys.stdin); assert r['status']=='0x1', r; print(r['transactionHash'])"; }

# 1. wrapper
if [ -z "${WRAPPER:-}" ]; then
  WRAPPER=$(get noteWrapper)
fi
if [ -z "$WRAPPER" ]; then
  out=$(cd contracts && "$FORGE" create src/CargoNoteToken.sol:CargoNoteWrapper --broadcast --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" "${GAS[@]}" --constructor-args "$CTRL" "$MARKET" 2>&1)
  WRAPPER=$(echo "$out" | sed -n 's/^Deployed to: //p')
  [ -n "$WRAPPER" ] || { echo "$out" >&2; exit 1; }
  echo "wrapper deployed: $WRAPPER"
  python3 - "$M" "$WRAPPER" <<'PY'
import json,sys; p,a=sys.argv[1:]; d=json.load(open(p)); d['contracts']['noteWrapper']=a; json.dump(d,open(p,'w'),indent=2); open(p,'a').write('\n')
PY
fi

# 2. wrap the note
TOKEN=$("$CAST" call "$WRAPPER" "tokenOf(bytes32)(address)" "$SHIPMENT" --rpc-url "$RPC")
if [ "$TOKEN" = 0x0000000000000000000000000000000000000000 ]; then
  echo "allow wrapper:   $(send "$FIN_KEY" "$CTRL" 'setPositionOperator(bytes32,address)' "$SHIPMENT" "$WRAPPER")"
  echo "wrap note:       $(send "$FIN_KEY" "$WRAPPER" 'wrap(bytes32,string)' "$SHIPMENT" "$SYMBOL" --gas-limit 2500000)"
  TOKEN=$("$CAST" call "$WRAPPER" "tokenOf(bytes32)(address)" "$SHIPMENT" --rpc-url "$RPC")
fi
SUPPLY=$("$CAST" call "$TOKEN" "totalSupply()(uint256)" --rpc-url "$RPC" | cut -d' ' -f1)
echo "note token:      $TOKEN ($SYMBOL, supply $SUPPLY)"

# 3. the Kuru market: 6-dec base / 6-dec USDC; price precision 1e4 (0.0001 USDC ticks), size precision 1e6
PP=10000; SP=1000000
args=(0 "$TOKEN" "$USDC" $SP $PP 1 1000000 1000000000000 10 0 30)
KMARKET=$("$CAST" call "$ROUTER" 'deployProxy(uint8,address,address,uint96,uint32,uint32,uint96,uint96,uint256,uint256,uint96)(address)' "${args[@]}" --from "$FIN" --rpc-url "$RPC" 2>/dev/null || true)
if [ -n "${KURU_MARKET:-}" ]; then KMARKET=$KURU_MARKET
else
  echo "create market:   $(send "$FIN_KEY" "$ROUTER" 'deployProxy(uint8,address,address,uint96,uint32,uint32,uint96,uint96,uint256,uint256,uint96)' "${args[@]}" --gas-limit 1600000)"
fi
echo "kuru market:     $KMARKET"

# 4. maker: deposit the tokens into Kuru's MarginAccount and post a limit sell
ASK="${ASK:-0.99}"; PRICE=$(python3 -c "print(round($ASK*$PP))")
SELL=$(python3 -c "print(($SUPPLY//1000000)*1000000)")      # whole tokens, size precision = token units
echo "approve margin:  $(send "$FIN_KEY" "$TOKEN" 'approve(address,uint256)' "$MARGIN" "$SELL")"
echo "deposit:         $(send "$FIN_KEY" "$MARGIN" 'deposit(address,address,uint256)' "$FIN" "$TOKEN" "$SELL")"
echo "limit sell:      $(send "$FIN_KEY" "$KMARKET" 'addSellOrder(uint32,uint96,bool)' "$PRICE" "$SELL" true --gas-limit 600000) ($SELL @ $ASK)"

# 5. taker: market-buy BUY_USDC worth from the wallet (the amount is in price-precision units)
BUY="${BUY_USDC:-1}"; Q=$(python3 -c "print(int($BUY*$PP))"); QRAW=$(python3 -c "print(int($BUY*1e6))")
echo "approve market:  $(send "$TRADER" "$USDC" 'approve(address,uint256)' "$KMARKET" "$QRAW")"
echo "market buy:      $(send "$TRADER" "$KMARKET" 'placeAndExecuteMarketBuy(uint96,uint256,bool,bool)' "$Q" 0 false false --gas-limit 800000)"
echo "trader holds:    $("$CAST" call "$TOKEN" 'balanceOf(address)(uint256)' "$TRA" --rpc-url "$RPC") $SYMBOL"
echo "best bid/ask:    $("$CAST" call "$KMARKET" 'bestBidAsk()(uint256,uint256)' --rpc-url "$RPC" | tr '\n' ' ')(1e18 precision)"
