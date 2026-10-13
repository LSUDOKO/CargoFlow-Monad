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

## Videos

The full shot lists, voice-over, captions and the clips to record are in **[`VIDEO-SCRIPT.md`](VIDEO-SCRIPT.md)**:

- **Technical demo (≤ 3:00):** re-rendered scenes from the original CargoFlow film (now USDC on Monad) plus new Monad
  recordings: the `/notes` book ticking per block, a bid and its acceptance, the settled dashboard, and MonadVision
  transactions for the ZK resume, the note buy and the settlement paid to the note holder.
- **Pitch (≤ 2:00):** team, problem (sourced), Cargo Notes, why Monad, first users, next steps.
- **Product ad (≤ 0:30, optional).**
