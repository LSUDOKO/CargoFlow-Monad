---
name: cargo-notes
description: Trade CargoFlow cargo notes (tokenised trade-finance credit on Monad testnet) through the MetaMask Agent Wallet `mm cargo` plugin. Use when the user asks about cargo notes, CargoFlow shipments as investments, trade-finance credit, or putting USDC to work in shipments gated by sensor evidence.
---

# cargo-notes (mm cargo)

A cargo note pays its holder principal + fee + undrawn capital when a shipment's importer settles.
Each note has an **evidence score** (0-100, from on-chain sensor epochs) and an on-chain **mark**:
undrawn capital at par, plus the drawn leg × (1 − 0.5% per point below 100), × 0.7 while PAUSED.

## Commands (always add `--json` and parse `data`; on failure read `error.code` and `error.hint`)

| Goal | Command |
| --- | --- |
| See the market | `mm cargo list --json` |
| Explain one note | `mm cargo quote <shipmentId> --json` (`whyThisMark` holds the reasoning) |
| Buy one note | `mm cargo buy <shipmentId> --max-price <usdc> [--min-score 75] [--max-premium-to-mark-bps 0] [--dry-run] --json` |
| Bid / cancel | `mm cargo bid <shipmentId> --price <usdc> [--min-score 75] --json`, `mm cargo cancel-bid <shipmentId> --json` |
| Deploy a budget | `mm cargo scan --budget <usdc> [--min-score 90] [--min-upside-bps 50] --json`, then add `--execute` |

## Rules for agents

1. **Plan, then execute.** Run `scan` without `--execute` (or `buy --dry-run`), show the user the
   picks, the rejections and the planned spend, and only add `--execute` after they confirm, unless
   they already gave an explicit budget and rules.
2. **Never loosen a limit to make a trade go through.** If a command fails with `CARGO_SCORE_TOO_LOW`,
   `CARGO_NOT_BUYABLE`, `CARGO_ASK_ABOVE_MARK`, `CARGO_ASK_ABOVE_MAX` or `CARGO_UPSIDE_TOO_LOW`,
   report the reason. Don't retry with a lower `--min-score`, a higher `--max-price` or a positive
   `--max-premium-to-mark-bps` unless the user asks for it.
3. **Amounts are USDC** (6 decimals) written as plain numbers like `3.01`. Upside and premiums are in
   basis points (100 bps = 1%).
4. **PAUSED means an open breach** (for example, the cargo got too warm). The plugin won't buy or bid
   on it. Explain the drop in the mark with `quote`.
5. **`CARGO_TX_PENDING` or an AWAITING_MFA notice** means MetaMask is waiting for the user's 2FA
   approval. Tell the user, and re-run once they've approved. Completed approvals are not repeated.
6. **`CARGO_API_UNAVAILABLE`:** the free-tier API is waking up. Retry after about 60s, or pass
   `--ids 0x…` to read notes straight from chain.
7. `AUTH_FAILED`: ask the user to run `mm login` (needs their phone or email), then `mm init`.

## Setup (once, by the human)

```bash
npm i -g @metamask/agent-wallet@latest
mm login && mm init --mode guard          # server wallet, Guard mode (2FA on every transaction)
git clone https://github.com/LSUDOKO/CargoFlow-Monad && cd CargoFlow-Monad/agent-wallet-plugin
npm i && npm run build                     # postinstall links the host's @metamask/agent-wallet
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
mm plugins install "file:$PWD" --accept-permissions
mm cargo list --json                       # should list the live notes
```

Fund the agent wallet (`mm wallet address`) on Monad Testnet (10143) with a little MON for gas and USDC
(`0x534b2f3A21130d7a60830c2Df862319e593943A3`). In Guard mode, allowlist the CargoNoteMarket
`0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d` and USDC.

**Monad Testnet and the Agent Wallet.** MetaMask's hosted RPC and gas-fee services don't serve chain 10143
yet. The plugin reads gas and EIP-1559 fees from Monad and sends `gas`, `maxFeePerGas` and
`maxPriorityFeePerGas` with every transaction, so `mm` skips its fee service. Add Monad Testnet with its own
RPC to `~/.metamask/wallets.json` → `data.customEvmChains` (back the file up first):

```json
{ "key": "0x279f", "caip2": "eip155:10143", "chainId": 10143, "name": "Monad Testnet",
  "rpcTarget": "https://testnet-rpc.monad.xyz" }
```

## Example: what an agent should do

User: *"Put up to 4 USDC into cargo notes with evidence 90 or better, only below their mark."*

1. `mm cargo scan --budget 4 --min-score 90 --min-upside-bps 50 --json`: show the picks (ref, price,
   mark, upside) and the rejected notes with their reasons.
2. After the user confirms, run `mm cargo scan --budget 4 --min-score 90 --min-upside-bps 50 --execute --json`.
3. If an AWAITING_MFA notice appears, tell the user to approve the email, then re-run. Afterwards,
   report the explorer links from `data.transactions` and the new holder from `mm cargo list`.

Live proof: on 14 October 2026 this plugin refused a PAUSED note (score 48) without signing anything,
then bought note `0xb508ee58…39ff` for 3.00564 USDC after the owner's 2FA. Approve tx
`0x10c178413612c177dffba0e71e12ca3cb8941c53b61b515de30504c80060519c`, buy tx
`0x55a0bf9840c9d028848cd0136e8a8cf0218c96aee1732b4cd0554f01e2ae357c` (Monad Testnet).
