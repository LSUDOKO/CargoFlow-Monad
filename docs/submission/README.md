# Monad Metropolis submission kit

**Primary track:** Track 01 · Onchain Finance & Trading
**Optional bounty fit:** Kuru · "Bring New Assets and Markets to Kuru" (Cargo Notes are a new tradeable asset class; next step lists them on Kuru's book)

## Form fields

| Field | Value |
|---|---|
| Project name | CargoFlow: Cargo Notes |
| One-liner | Trade-finance positions that trade mid-voyage, priced on chain by the cargo's own sensor evidence. |
| Logo | [`cargoflow-logo.png`](cargoflow-logo.png) (1200×1200, 64 KB) · wordmark: [`cargoflow-wordmark.png`](cargoflow-wordmark.png) |
| GitHub | https://github.com/LSUDOKO/CargoFlow-Monad (give read access to `metropolis@hackathon.monad.xyz` if private) |
| Live product | https://cargoflow-monad.vercel.app (trading: `/notes`) |
| API | https://cargoflow-monad-api.onrender.com/v1/health |
| Network | Monad Testnet (10143); contracts in [`contracts/deployments/monad-testnet.json`](../../contracts/deployments/monad-testnet.json), all verified on MonadVision |
| Proof of usage | [`docs/runs/monad-testnet.md`](../runs/monad-testnet.md): 22 linked transactions incl. a ZK recovery and a Cargo Note trade; two live notes with asks and bids on the book |

### Access instructions for judges (paste into the form)

> No login or test credentials needed: every action is signed from your own wallet.
> 1. Add Monad Testnet (chain 10143, RPC https://testnet-rpc.monad.xyz). Get MON at https://faucet.monad.xyz and USDC at https://faucet.circle.com (pick Monad Testnet).
> 2. Open https://cargoflow-monad.vercel.app/notes. Two live Cargo Notes are listed: one ACTIVE (evidence score 100) and one PAUSED after a reefer failure (score 48, mark haircut). Click one and place a bid: approve, then "Place bid". Your USDC is escrowed by the market and can be cancelled any time.
> 3. Open any shipment from the Fleet page to see its evidence epochs, releases, pause, recovery and audit trail, each linked to MonadVision.
> 4. Optional: create your own shipment at /exporter, fund it at /financier, pay it at /buyer.
> The API runs on Render's free tier: if a page shows skeletons, the first request is waking it (about a minute).

## Technical demo video (max 3:00): shot list

Record the live site, not slides. Have two browser profiles: financier (0x2198…6414) and a trader wallet with test USDC.

| Time | Screen | Say |
|---|---|---|
| 0:00-0:15 | Landing page, then `/notes` | "CargoFlow turns a trade-finance position into a Cargo Note: an asset you can trade mid-voyage, priced on chain by the cargo's own sensor evidence. This is live on Monad testnet." |
| 0:15-0:45 | Fleet → the settled shipment's dashboard: Evidence tab, then Audit trail | "A financier escrowed USDC. Each milestone released only when the container's signed readings cleared the on-chain policy. Here the reefer failed: probe-1 hit 11.7 °C, the score fell to 48 and the facility paused automatically. A Groth16 proof from the second probe resumed it, verified on chain." |
| 0:45-1:05 | MonadVision: the `buy` transaction, then the `settle` transaction's transfers | "Mid-voyage, the financier sold the note 1% under its evidence mark. When the buyer paid, the vault paid principal plus fee to the note holder, not the original lender." |
| 1:05-1:40 | `/notes`: point at the block counter, mark, ask, bid, upside; show the paused note's haircut | "The book re-reads every block. The mark is computed by the contract: undrawn escrow at par, the drawn leg discounted by the evidence score, 30% off while paused. When a container goes out of range, the price moves within a block." |
| 1:40-2:20 | Trader wallet: place a bid on the active note (approve + place bid, toasts with explorer links) | "Anyone can bid; USDC is escrowed by the market contract. Sub-second finality means the fill is final before the next sensor reading lands." |
| 2:20-2:45 | Financier wallet: "Sell into best bid" → holder changes in the panel | "The holder sells into the bid; the position moves atomically with the payment. Settlement, default recovery, the bill of lading and insurance cover now follow the new holder." |
| 2:45-3:00 | `/deployments` page | "Eleven contracts, verified on MonadVision; 379 contract tests. CargoFlow on Monad." |

Tip: before recording, refresh the active note with `STOP=active FACILITY_USDC=3 INVOICE_USDC=5 npx tsx frontend/scripts/testnet-lifecycle.ts https://cargoflow-monad-api.onrender.com` (needs ~3 USDC on the financier and some MON on each role key).

## Pitch video (max 2:00): script

1. **Who (10 s):** "I'm Arpit, a CS student at NIT Hamirpur; I build trade-finance infrastructure on chain."
2. **Problem (30 s):** "Trade finance has a $2.5 trillion gap; 41% of SME applications are rejected. In India, exporters wait 52 days to be paid. Lenders can't see the cargo they lend against, and once they lend, their money is locked until the buyer pays. No exit, no price, so capital stays scarce and expensive."
3. **Solution (35 s):** "CargoFlow releases working capital milestone by milestone, only when the container's own signed sensor evidence clears an on-chain policy, with zero-knowledge recovery when something goes wrong. On Monad we added Cargo Notes: the lender's position becomes a tradeable asset with an on-chain price that follows the evidence, block by block."
4. **Why Monad (15 s):** "Marking a fleet of positions to live evidence and trading them needs cheap updates and sub-second finality. That's Monad."
5. **First users and next step (25 s):** "Our first user is an NBFC funding Indian pharma exporters (a $30 billion, temperature-controlled export market), with credit funds buying the notes for short, self-liquidating USDC yield. Next: a pilot of 10 shipments with one exporter and one lender, Kuru listings for notes, then audit and mainnet. Target: $1M in notes outstanding six months after mainnet."
6. **Close (5 s):** "CargoFlow: capital that moves with your cargo."

## Product ad (optional, max 0:30)

Hook "Your loan is stuck at sea." → container + temperature graph → "Now it trades." → `/notes` book ticking → "Cargo Notes on Monad."
