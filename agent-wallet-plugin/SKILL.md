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
