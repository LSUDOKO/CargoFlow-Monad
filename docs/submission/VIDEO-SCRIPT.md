# Video script: Monad Metropolis edition

Two videos, cut from the existing CargoFlow film (Remotion, `../CargoFlow/video`, composition `FullV2`) plus a few
new screen recordings on Monad. Nothing from the earlier chain edition (Robinhood Chain, USDG, Paxos, Arbitrum
Sepolia, Stylus, Fhenix, GMX, the Colosseum card) appears on screen.

| Video | Length | Judged? | Where it goes |
|---|---|---|---|
| A. Technical demo | ≤ 3:00 | yes: must show the live product | YouTube / Loom (unlisted is fine) |
| B. Pitch | ≤ 2:00 | yes: team, problem, why you | YouTube / Loom |
| C. Product ad (optional) | ≤ 0:30 | no | social |

## 0. Re-render the reusable scenes for Monad (10 minutes)

The film's illustrated scenes have the token and chain name baked in. Render Monad/USDC copies without touching the
original repo (the same procedure re-rendered this README's GIFs):

```bash
W=/tmp/cf-video && mkdir -p $W && cd ~/Desktop/hackathon_projects/CargoFlow/video
cp -r src package.json remotion.config.ts tsconfig.json $W/ && ln -s $PWD/node_modules $W/node_modules && ln -s $PWD/public $W/public
cd $W
grep -rl "USDG\|Robinhood\|ROBINHOOD\|Paxos\|46630" src | xargs perl -pi -e 's/Robinhood Chain Testnet/Monad Testnet/g; s/Robinhood Chain/Monad/g; s/Robinhood/Monad/g; s/ROBINHOOD/MONAD/g; s/Paxos/Circle/g; s/USDG/USDC/g; s/\b46630\b/10143/g'
mv src/scenes/S5WhyRobinhood.tsx src/scenes/S5WhyMonad.tsx
npx remotion bundle --out-dir out/b
for s in S00 S01 S02 S03 S05a S05b S05c S05d S05e S05f S05g S11; do npx remotion render out/b V2-$s out/$s.mp4 --muted --crf=18; done
```

Use only those renders (muted: you record a new voice-over). **Do not reuse** `V2-S06` (website demo: recorded on
the old chain), `V2-S07` (claude.ai footage shows chain 46630), `V2-S09` (old sponsor board), `V2-S10` (old explorer),
or `S11Outro`'s closing card text (it names the old hackathon): use S11 for the logo animation only, then cut to the
Monad end card (shot A12 / B6).

## 1. Record these clips first (Monad, 1920×1080, 30 fps)

Use two browser profiles: **Financier** (`0x2198…6414`, holds the active note) and **Trader** (any wallet with test MON
and USDC). Wake the API first (open https://cargoflow-monad-api.onrender.com/v1/health and wait for `ok`).

- [ ] **M1 · /notes book** · https://cargoflow-monad.vercel.app/notes: 10 s idle on the book so the block counter ticks;
      then click the PAUSED note so the panel shows the haircut.
- [ ] **M2 · bid** · Trader profile: click the ACTIVE note, type a bid, *Approve bid amount*, *Place bid*; keep the
      success toast with its MonadVision link on screen.
- [ ] **M3 · accept** · Financier profile: *Allow the market* (if needed), *Sell into best bid*; the panel's holder
      changes to the trader.
- [ ] **M4 · settled dashboard** · https://cargoflow-monad.vercel.app/track/0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e:
      header (Settled), then the *Money* tab and the *Audit trail* tab scrolling.
- [ ] **M5 · MonadVision: the note buy** · https://testnet.monadvision.com/tx/0x8525c279e19eec78ffffaf4f4bb62efa7f7169ba7a25f4d8032b91b10596a187
- [ ] **M6 · MonadVision: settlement paid to the note holder** · https://testnet.monadvision.com/tx/0xbd203765ca9e55d24689bf7941f33f4f293f6e92750d75f19eb1037c61458c27
      (scroll to the token transfers: 4.12 USDC vault → `0xA6C0…911b`, the note's buyer; 2.88 to the exporter)
- [ ] **M7 · MonadVision: the Groth16 resume** · https://testnet.monadvision.com/tx/0x0c2afd1ccafcd8ff7ea120c5ed9b9114e4dcdf963dc76f613a755312388b3e62
- [ ] **M8 · /deployments** · https://cargoflow-monad.vercel.app/deployments, slow scroll over the verified contracts
- [ ] **M9 · terminal** · `cd contracts && forge test --match-contract CargoNoteMarket` (13 passing), then
      `mm cargo scan` from `agent-wallet-plugin/` and one GraphQL query against the Envio indexer (from `indexer/`),
      if those are running
- [ ] **M10 · exporter wizard** (optional) · https://cargoflow-monad.vercel.app/exporter, the Pharma template step

## A. Technical demo (≤ 3:00)

Captions in lime-on-ink lower thirds (the film's `kit.tsx` caption style). VO at ~150 words a minute.

| # | Time | Picture (reuse / record) | Cut | VO | On-screen caption |
|---|---|---|---|---|---|
| A1 | 0:00-0:10 | `V2-S00` cold open (reefer, LCD 5.2 °C, the lender's screen) | — | "A container of vaccines is at sea. Its lender sees paperwork, not the container." | `CargoFlow · Monad Testnet` |
| A2 | 0:10-0:22 | `V2-S04` the line + `docs/assets/v3/banner.png` | the README screenshot inside S04 if it shows the old badge row | "CargoFlow releases USDC to the exporter only when the cargo's own signed evidence clears an on-chain policy. On Monad, the lender's position becomes a tradeable Cargo Note." | `Evidence decides. Then it trades.` |
| A3 | 0:22-0:40 | `V2-S05a` facility (re-rendered, USDC) → `V2-S05b` evidence (first 6 s) | the "Reference numbers" chip is fine | "The exporter opens a facility; the financier escrows USDC in the vault. The logger signs every reading; each eight-reading epoch is scored and committed on chain." | `commitEpoch · score 100` |
| A4 | 0:40-0:55 | `V2-S05d` excursion → `V2-S05e` recovery (re-rendered) | — | "When a probe overheats, the score falls to 48 and the facility pauses itself. A Groth16 proof over the other probe's hidden readings resumes it." | `paused · score 48` → `Groth16 verified on chain` |
| A5 | 0:55-1:02 | **M7** MonadVision resume tx | — | "That proof was verified on Monad, here." | `resumeWithProof · Monad Testnet` |
| A6 | 1:02-1:30 | **M1** /notes book, block counter ticking; click the paused note | — | "Now the new part. Every funded facility is a Cargo Note: it pays principal, fee and undrawn capital at settlement. The contract marks it to the latest evidence: undrawn escrow at par, the drawn leg discounted by the score, thirty percent off while paused. The book re-reads every block." | `markPrice · on chain` · `400 ms blocks` |
| A7 | 1:30-1:55 | **M2** trader bids (approve → place bid → toast) | — | "Anyone can bid. The USDC is escrowed by the market contract and can be withdrawn at any time." | `placeBid · escrowed` |
| A8 | 1:55-2:15 | **M3** financier sells into the bid; holder changes | — | "The financier exits mid-voyage: one transaction pays them and moves the position. Settlement, the bill of lading on default and insurance cover now follow the new holder." | `acceptBid · holder changed` |
| A9 | 2:15-2:35 | **M4** settled dashboard (Money tab) → **M6** MonadVision transfers | — | "In our live run the note was sold one percent under its mark. When the buyer paid, the vault sent 4.12 USDC to the note's new holder and the rest to the exporter." | `settle → note holder 4.12 USDC` |
| A10 | 2:35-2:48 | **M9** terminal: note tests, `mm cargo scan`, Envio query | skip any segment that is not running | "The same notes are an ERC-20 on Kuru's order book, indexed by Envio, and tradeable by an agent through a MetaMask Agent Wallet plugin." | `Kuru · Envio · MetaMask Agent Wallet` |
| A11 | 2:48-2:55 | **M8** /deployments | — | "Eleven contracts, source-verified on MonadVision; 379 contract tests." | `11 verified · 379 tests` |
| A12 | 2:55-3:00 | `V2-S11` logo animation only, then a static end card | the old closing card text | "CargoFlow: capital that moves with your cargo." | `cargoflow-monad.vercel.app · Monad Metropolis · Track 01` |

Total VO ≈ 330 words.

## B. Pitch (≤ 2:00)

Face camera for B1 and B5 (or VO over the cast). The rest reuses illustrated scenes.

| # | Time | Picture | VO |
|---|---|---|---|
| B1 | 0:00-0:12 | You on camera, or `docs/assets/v3/cast.png` | "I'm Arpit, a computer-science student at NIT Hamirpur. I build trade-finance infrastructure on chain, and this is CargoFlow." |
| B2 | 0:12-0:45 | `V2-S01` (Meera, 52 days, Atradius page) → `V2-S02` (Daniel, BLIND / DECLINED, ADB page) | "Trade finance has a two-and-a-half-trillion-dollar gap; forty-one percent of small exporters are rejected. In India they wait fifty-two days to be paid. Lenders can't see the cargo they lend against, and once they lend, the money is locked until the buyer pays. No exit, no price, so capital stays scarce and expensive." |
| B3 | 0:45-1:10 | `V2-S05c` release → **M1** /notes book | "CargoFlow releases working capital milestone by milestone, only when the container's own signed sensor evidence clears an on-chain policy. On Monad we turned the lender's position into a Cargo Note: a tradeable asset whose price the contract computes from that evidence, block by block." |
| B4 | 1:10-1:25 | `docs/assets/v3/architecture.png` (slow push) | "Marking a fleet of positions to live evidence, and trading them, needs near-free updates and sub-second finality. That is why this is built on Monad, with markets on Kuru and an agent plugin for MetaMask." |
| B5 | 1:25-1:52 | `docs/assets/v3/measured.png` → **M6** settlement tx | "It runs end to end today: a shipment financed, paused, recovered with a zero-knowledge proof, its note sold mid-voyage and repaid to the new holder, all on Monad testnet. Our first users are NBFCs funding Indian pharma exporters and credit funds buying the notes. Next: a ten-shipment pilot, audit, and mainnet, targeting a million dollars of notes outstanding." |
| B6 | 1:52-2:00 | `V2-S11` logo animation, end card | "CargoFlow: capital that moves with your cargo." |

## C. Product ad (≤ 0:30, optional)

`V2-S00` reefer (0-4 s, caption *Your loan is stuck at sea.*) → `V2-S05d` pause (4-9 s) → **M1** book ticking
(9-20 s, *Now it trades.*) → **M3** holder changes (20-26 s) → end card (26-30 s, *Cargo Notes on Monad*).

## Assembly

Any editor works (DaVinci Resolve, CapCut, or ffmpeg concat). Order the renders and recordings as in the tables, add
the VO track, burn the captions, export 1080p H.264. The film's music bed (`../CargoFlow/video/public/audio`, if
present) can sit under both at -20 dB.
