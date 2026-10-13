# mm-plugin-cargo-notes

A [MetaMask Agent Wallet](https://docs.metamask.io/agent-wallet/) plugin that lets an AI agent trade
**CargoFlow cargo notes** on Monad testnet (chain `10143`), with limits it can't talk its way around.

A cargo note is the financier's position in a live CargoFlow trade-finance facility: it pays
principal + fee + undrawn capital when the importer settles. Sensors on the container stream
evidence on chain (temperature, route, shocks). That evidence sets each note's **evidence score**,
and the market contract turns the score into an on-chain **mark price**.

The plugin adds one capability to the agent: **credit trading that reads the evidence before
spending.** The agent can scan every live note, keep the ones whose shipment is healthy, whose
evidence score clears a bar, and whose ask sits at or below the evidence mark with enough upside to
the claim, then fill a USDC budget. Every buy goes through MetaMask's policy engine (Guard Mode
allowlists, 24h outflow limit, 2FA).

```
mm cargo list                         # every live note: status, score, claim, mark, ask, bid, upside
mm cargo quote <shipmentId>           # one note, and why its mark is what it is
mm cargo buy <shipmentId> --max-price 3.01 [--min-score 75] [--max-premium-to-mark-bps 0] [--dry-run]
mm cargo bid <shipmentId> --price 2.95 [--min-score 75] [--dry-run]
mm cargo cancel-bid <shipmentId>
mm cargo scan --budget 10 [--min-score 90] [--min-upside-bps 50] [--max-premium-to-mark-bps 0] [--execute]
```

All commands accept the host flags `--json`, `--format`, `--toon` and `--verbose`.

## Why the mark matters

`CargoNoteMarket.markPrice` (mirrored in [`src/lib/rules.ts`](src/lib/rules.ts) as `explainMark`):

- **Undrawn** capital is still in escrow, so it is marked at par.
- The **drawn leg** (drawn principal + fee) is marked at `1 − 0.5% × (100 − score)`.
- While the facility is **PAUSED** (an open breach), the drawn leg is multiplied by a further `0.7`.
- **DELIVERED** notes mark the drawn leg at par: only the buyer's payment is left.

`mm cargo quote` prints this step by step and checks that the plugin's calculation matches the chain
(`markMatchesChain: true`).

## Agent-safe limits

There are two layers of limits. The plugin refuses first, and MetaMask enforces policy on whatever
gets past it.

**1. Plugin rules (pure code in `src/lib/rules.ts`, unit-tested).** `buy` and `scan` throw a
`CommandError` and submit nothing when any of these fail:

| Code | Rule |
| --- | --- |
| `CARGO_NOT_BUYABLE` | Status must be FINANCED, ACTIVE or DELIVERED. PAUSED notes trade on chain, but the agent never buys into an open breach. |
| `CARGO_SCORE_TOO_LOW` | Evidence score below `--min-score` (default 75 for buy and bid, 90 for scan). |
| `CARGO_ASK_ABOVE_MAX` | Ask above `--max-price` (scan: above the remaining budget). |
| `CARGO_ASK_ABOVE_MARK` | Ask above the evidence mark by more than `--max-premium-to-mark-bps` (default 0). |
| `CARGO_ASK_ABOVE_CLAIM` | The ask is more than the note pays at settlement. |
| `CARGO_UPSIDE_TOO_LOW` | Scan only: return to claim below `--min-upside-bps` (default 50). |
| `CARGO_STALE_ASK`, `CARGO_OWN_NOTE`, `CARGO_NO_ASK` | Asks that can't fill, or that would buy from yourself. |
| `CARGO_INSUFFICIENT_USDC` | The wallet doesn't hold enough USDC (checked before approving). |

Bids are refused on unhealthy notes, low scores and prices above the claim (`CARGO_BID_ABOVE_CLAIM`).
The buy passes the checked ask as the contract's `maxPrice`, so if the seller raises the ask between
the check and the fill, the buy reverts. `scan --execute` reads each note again right before buying
and applies every rule a second time.

**2. MetaMask policy (server wallet, Guard Mode).** Every transaction goes through
`ctx.walletExecutor` and is checked against the wallet policy:

- **Network allowlist:** Monad Testnet `10143`.
- **Address allowlist:** only these two contracts:
  - CargoNoteMarket `0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d`
  - USDC (Circle testnet) `0x534b2f3A21130d7a60830c2Df862319e593943A3`
- **Rolling 24h outflow limit**, for example 25 USDC. Anything above it needs 2FA on MetaMask
  Mobile or email.

Run `mm wallet policy template` to see the YAML for your CLI version, add the network and the two
addresses, then apply it with `mm wallet policy set --policy "$(cat policy.yaml)"`. Applying the
policy needs 2FA. The outflow limit is requested on your first transaction.

**3. Plugin capabilities, granted at install.** `cargo:list` asks for none: it reads public chain
data over the public Monad RPC. `cargo:quote` asks for `wallet-read`. `cargo:buy`, `cargo:bid`,
`cargo:cancel-bid` and `cargo:scan` ask for `wallet-read` and `wallet-submit`. Every command sets
`targetChains: [10143]`, and the plugin-wide `capabilities` list is empty. The plugin never sees
the session, the CLI token or the recovery phrase.

USDC approvals are exact: the plugin approves only the amount the next call pulls, and skips the
approval when the allowance already covers it. There is no unlimited approval.

## Install (local)

Requires Node >= 22.18 and `@metamask/agent-wallet` >= 6.2 (tested with 7.2.0).

```bash
cd agent-wallet-plugin
npm install
npm run build            # tsc + oclif manifest
npm test                 # vitest: rules for marks, buys, bids and scans

# use the global mm, or the dev copy with `npx mm`
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
mm plugins install "file:$PWD" --accept-permissions

mm cargo list            # works signed out
```

To trade, sign in and set up the wallet:

```bash
mm login                                     # MetaMask Mobile / email 2FA
mm init --wallet server-wallet --mode guard
mm wallet address                            # fund this address on Monad testnet with MON (gas) and USDC
```

Environment overrides: `CARGOFLOW_RPC_URL` (default `https://testnet-rpc.monad.xyz`),
`CARGOFLOW_API_URL` (default `https://cargoflow-monad-api.onrender.com`) and
`CARGOFLOW_API_TIMEOUT_MS` (default 90000). The API is on a free tier and can take about 60s to
wake up. If it is down, pass `--ids 0x…,0x…` to `list` or `scan` to read notes straight from chain.

## Example agent prompts

- "What cargo notes are trading right now, and which ones are healthy?" → `mm cargo list --json`
- "Why is the paused Singapore note marked so low?" → `mm cargo quote 0xe278…e7dc --json`
- "Buy the Mumbai→Singapore note if its evidence score is at least 90 and the ask is at or below
  the mark. Don't pay more than 3.01 USDC." →
  `mm cargo buy 0xb508…39ff --max-price 3.01 --min-score 90 --json`
- "Put 10 USDC to work in cargo credit: only shipments scoring 90+, at least 0.5% to claim, never
  above the mark. Show me the plan first." →
  `mm cargo scan --budget 10 --min-score 90 --min-upside-bps 50 --json`, then the same with `--execute`.
- "Bid 2.95 on that note, and pull the bid if the score drops." →
  `mm cargo bid … --price 2.95 --min-score 90`, then `mm cargo cancel-bid …`

See [SKILL.md](SKILL.md) for the agent-facing usage note.

## Example output

`mm cargo scan --budget 10 --min-score 90 --min-upside-bps 50 --json` (live data, 2026-10-14):

```json
{
  "ok": true,
  "data": {
    "action": "scan",
    "executed": false,
    "rules": { "budgetUsdc": "10", "minScore": 90, "minUpsideBps": 50, "maxPremiumToMarkBps": 0 },
    "scanned": 2,
    "selected": [
      {
        "shipmentId": "0xb508ee5803f1531f5ef62d9df7e7760c091555550471dd98643f7114021239ff",
        "ref": "CF-LIVE-1791912900798",
        "status": "ACTIVE",
        "evidenceScore": 100,
        "claimUsdc": "3.036",
        "markUsdc": "3.036",
        "askUsdc": "3.00564",
        "bestBidUsdc": "2.94492",
        "upsideAtAskBps": 101,
        "askVsMarkBps": -100,
        "priceUsdc": "3.00564",
        "upsideBps": 101
      }
    ],
    "overBudget": [],
    "rejected": [
      {
        "shipmentId": "0xe27855155eae78aeb39aca53e5f50a861f503e0e7cd87730add2bf093f27e7dc",
        "ref": "CF-LIVE-1791912775389",
        "status": "PAUSED",
        "reasons": [
          "Status is PAUSED; agents only buy FINANCED, ACTIVE or DELIVERED notes.",
          "Evidence score 48 is below the minimum 90.",
          "Ask is 49 bps above the evidence mark 2.440248 USDC; allowed premium is 0 bps."
        ]
      }
    ],
    "plannedSpendUsdc": "3.00564",
    "bought": [],
    "skipped": []
  },
  "hint": "Scanned 2 note(s) … would buy CF-LIVE-1791912900798 at 3.00564 (score 100, upside 101 bps) …"
}
```

(The selected entry is abridged: the full output also has `askSeller`, `bestBidder` and `holder`.)

`mm cargo quote 0xe278…e7dc` explains the paused note's mark:

```
Claim at settlement = committed 3 + fee on drawn 0.036 (300 bps) = 3.036 USDC.
Undrawn 1.8 USDC is still in escrow and is marked at par.
Evidence score 48/100: drawn leg 1.236 x (1 - 0.5% x 52 pts) = x74.00%.
Facility is PAUSED (a breach is open): drawn leg further x70% -> x51.80%.
Mark = 1.8 + 0.640248 = 2.440248 USDC.
```

A refusal looks like this (exit code non-zero, nothing submitted):

```json
{ "ok": false, "error": { "code": "CARGO_NOT_BUYABLE",
  "message": "Refusing to buy this note: Status is PAUSED; agents only buy FINANCED, ACTIVE or DELIVERED notes. Evidence score 48 is below the minimum 75. …",
  "hint": "These limits come from your flags (--max-price, --min-score, --max-premium-to-mark-bps). Run `mm cargo quote <id>` to see the evidence and mark." } }
```

## Demo checklist

1. `npm run build && npm test`: build succeeds and 17 tests pass.
2. Install the plugin (above). `mm plugins` lists `mm-plugin-cargo-notes`. `mm cargo --help` shows six commands.
3. `mm cargo list`: shows the ACTIVE note (score 100) and the PAUSED note (score 48).
4. `mm cargo quote <paused id>`: walks through the haircut and the pause factor.
5. `mm login`, then `mm init --wallet server-wallet --mode guard`. Set the policy (Monad testnet,
   the market and USDC allowlisted, 24h outflow limit). Fund the agent wallet with MON and about 5 USDC.
6. `mm cargo buy <paused id> --max-price 3`: refused with `CARGO_NOT_BUYABLE`, and nothing is signed.
7. `mm cargo scan --budget 10 --min-score 90 --min-upside-bps 50`: a dry run that picks the ACTIVE note.
8. Run the same scan with `--execute`. Approve the USDC and buy transactions (2FA if above the
   outflow limit), then open the explorer links.
9. `mm cargo list`: the note's holder is now the agent wallet, and its ask is gone.
10. Optional: `mm cargo bid <id> --price 2 --min-score 90`, then `mm cargo cancel-bid <id>` to get the refund.

## Layout

```
src/lib/rules.ts       pure decision logic (mark, upside, buy/bid/scan rules), no I/O
src/lib/chain.ts       viem reads of controller, vault, market, USDC (public Monad RPC fallback)
src/lib/api.ts         live shipment discovery from the CargoFlow API
src/lib/host.ts        mm glue: inputs, CommandError refusals, wallet executor submission
src/commands/cargo/*   the six commands
test/rules.test.ts     vitest unit tests (run without mm)
```

`oclif.manifest.json` is generated by `npm run build` and ships with the package.
