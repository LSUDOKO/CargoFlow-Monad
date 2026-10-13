# Live run on Monad Testnet: CF-LIVE-1791911779438

One shipment end to end on Monad Testnet (chain 10143), on 13 October 2026, against the contracts in
[`contracts/deployments/monad-testnet.json`](../../contracts/deployments/monad-testnet.json). Every party signed
from its own wallet; the backend's worker, monitor and manager keys signed only what their roles allow. Testnet
scale: a 4 USDC facility in five milestones of 0.8 USDC against a 7 USDC invoice, 3% fee, settled in Circle USDC.

Shipment id `0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e`
([dashboard](https://cargoflow-monad.vercel.app/track/0x0353f55d82eb48314a58c34eab518cfe88999aaf6885e9cc41c9d10a042ac58e)).

| # | Step | Signed by | Transaction |
|---|---|---|---|
| 1 | Register shipment | exporter | [0x89160901…](https://testnet.monadvision.com/tx/0x8916090141214f8f29e91772e607758fc3a241ebad71b2b7cf6ede8a9c0e2586) |
| 2 | Set the cold-chain policy (2-8 °C, score ≥ 75) | exporter | [0xd7f300b2…](https://testnet.monadvision.com/tx/0xd7f300b255aed3193a59fdd9f796c87acbe1a4b84728a4828c4887c3fc479df0) |
| 3 | Create the facility (5 milestones) | exporter | [0x3b92b06b…](https://testnet.monadvision.com/tx/0x3b92b06bab456c53112c003a55c848724d745537e8802164ba41e38234436407) |
| 4 | Deposit 4 USDC into the vault | financier | [0x3e9c417b…](https://testnet.monadvision.com/tx/0x3e9c417bbe7fc30b33018ebc203d4f677ee233e8d23bdb69d653585a94c9fa39) |
| 5 | Start transit | exporter | [0x12eeb998…](https://testnet.monadvision.com/tx/0x12eeb998421d8cd500477da5a789c8790957a281a12946f829957a721cc57319) |
| 6 | Commit evidence epoch M1 (score 100) | worker | [0xb6c8d78b…](https://testnet.monadvision.com/tx/0xb6c8d78b8295fbcdccc7da2f09aaf1c5ef867e2825417155ad6277541e01a2db) |
| 7 | Release milestone 1 | manager | [0x47046b26…](https://testnet.monadvision.com/tx/0x47046b2617bbc23b86b24164d32dc793787928a2c8c31e3e994e778da748ebda) |
| 8 | Commit evidence epoch M2 (score 100) | worker | [0xd710b664…](https://testnet.monadvision.com/tx/0xd710b664014f89ae30466ec0241ba7bc7262d93e283766917456879e1c43d5c3) |
| 9 | Release milestone 2 | manager | [0xb9b6d736…](https://testnet.monadvision.com/tx/0xb9b6d736adf0e4aac7b911e69ea6a468972abf8e5de0ea7023f081dbbacd10e4) |
| 10 | Reefer fails, probe-1 reaches 11.7 °C: epoch M3 scores 48 | worker | [0x6618c4cf…](https://testnet.monadvision.com/tx/0x6618c4cf7fd93c2cb25ffa24aeadb6126922e6a1a409cb4a74ec7b0e8c73ec07) |
| 11 | Facility paused (SCORE_BELOW_THRESHOLD) | monitor | [0xeb5a604e…](https://testnet.monadvision.com/tx/0xeb5a604eb03db63c60be63b7806adba0fc1fbef752e22733fbba699e98a415a6) |
| 12 | Recovery epoch from probe-2 committed | worker | [0x1cb369c4…](https://testnet.monadvision.com/tx/0x1cb369c47dd893fcb15565ff3a4067b671f4129dd9adf0f11def6b753e86ed31) |
| 13 | Resume with a Groth16 proof, verified on chain | exporter | [0x0c2afd1c…](https://testnet.monadvision.com/tx/0x0c2afd1ccafcd8ff7ea120c5ed9b9114e4dcdf963dc76f613a755312388b3e62) |
| 14 | Release milestone 3 | exporter | [0x252656b1…](https://testnet.monadvision.com/tx/0x252656b11a0b6d8c1fff36bf29880745162d3d8b7c9d43149a1aa58d83856676) |
| 15 | **Cargo Note:** allow the market as the position's operator | financier | [0xb4a3bd09…](https://testnet.monadvision.com/tx/0xb4a3bd09962a5bd3b07d5a499d9da50279f37aacb1fa89df7f00c7c9de5af659) |
| 16 | **Cargo Note:** ask 4.006807 USDC (1% under the evidence mark of 4.04728; claim 4.072) | financier | [0xaf11f532…](https://testnet.monadvision.com/tx/0xaf11f532e73d82983fcc87db3eef622a567766b3cc7d157658121cdb7540b082) |
| 17 | **Cargo Note:** trader approves the market | trader | [0x089c264b…](https://testnet.monadvision.com/tx/0x089c264bd053f670f4a30044737d2d5f7d37cf7c986ccfa07c0e13f979b1c8f6) |
| 18 | **Cargo Note: bought.** The financier exits mid-voyage; the trader is now the financier of record | trader | [0x8525c279…](https://testnet.monadvision.com/tx/0x8525c279e19eec78ffffaf4f4bb62efa7f7169ba7a25f4d8032b91b10596a187) |
| 19 | Milestones 4 and 5 release on fresh evidence | worker / manager | see the dashboard's audit trail |
| 20 | Buyer confirms delivery | buyer | [0xd5d454b9…](https://testnet.monadvision.com/tx/0xd5d454b901ef4c87335a1fe5b69d3c65d68603cf50a6f253934e48fe6ef0ce21) |
| 21 | Buyer approves the vault | buyer | [0x43f82dd7…](https://testnet.monadvision.com/tx/0x43f82dd743d84fd89de9b47182fabfcaca0482f222f98ed48724d665b85821a6) |
| 22 | **Settle:** 7 USDC in; 4.12 USDC (principal + 3% fee) to the **note holder**, 2.88 USDC residual to the exporter | buyer | [0xbd203765…](https://testnet.monadvision.com/tx/0xbd203765ca9e55d24689bf7941f33f4f293f6e92750d75f19eb1037c61458c27) |

## Who ended up with what

| Party | USDC | Why |
|---|---|---|
| Original financier | +0.006807 net (4 in, 4.006807 out) | Sold the note mid-voyage instead of waiting for the buyer |
| Trader (note buyer) | +0.113193 net (4.006807 in, 4.12 out) | Bought a 4.072 claim for 4.0068 while the cargo's evidence was clean; was repaid in the buyer's settlement |
| Exporter | 6.88 | 4 USDC advanced across five milestones during the voyage, 2.88 residual at settlement |
| Buyer | -7 | Paid the invoice once; the vault split it |

Reproduce: `NOTE_TRADE=1 FACILITY_USDC=4 INVOICE_USDC=7 npx tsx frontend/scripts/testnet-lifecycle.ts <api url>`.

## Cargo Notes on Kuru: CF-LIVE-1791917840516

A second shipment (id `0xdfce8f865ac7e5f2f4d97e0d4cf3a5067a5b007a08415cee3eda23d4e5f6fa84`, 3 USDC facility, two
milestones released) was wrapped into a fungible note token and listed on Kuru's spot order book with
[`scripts/kuru-list-note.sh`](../../scripts/kuru-list-note.sh).

| Step | Signed by | Transaction |
|---|---|---|
| Deploy `CargoNoteWrapper` ([0xD176E4e0…](https://testnet.monadvision.com/address/0xD176E4e02f97F12462e68014F92B2A13A664552e), verified) | deployer | in the wrapper's creation tx |
| Allow the wrapper as the note's operator | financier | [0x6e68ed34…](https://testnet.monadvision.com/tx/0x6e68ed343ca07d6000d8743ffb031f7e79da7b7b990997b831cac8da9460c4f7) |
| Wrap: the note moves to `CargoNoteToken` cNOTE-0516 ([0x427c9617…](https://testnet.monadvision.com/address/0x427c9617808445509e2E1877655251A5CE4c6D1e), verified), 3.036 tokens minted = the note's claim | financier | [0xf130430c…](https://testnet.monadvision.com/tx/0xf130430ceadd960f220de6267dfb9fe8af68a11df3de2e2221a089c4b6f82e1c) |
| Create the cNOTE-0516/USDC market on Kuru's Router (`deployProxy`) → market [0x13f02ef0…](https://testnet.monadvision.com/address/0x13f02ef0c5CF7357267C52947709acfE52021520) | financier | [0x02a329a4…](https://testnet.monadvision.com/tx/0x02a329a4dfae4be2e5e8717493f7a892f1d05096fc9c3c459cc02451e0a6a18b) |
| Deposit 3 cNOTE into Kuru's MarginAccount | financier | [0x89c425ca…](https://testnet.monadvision.com/tx/0x89c425ca947690d789431de80eea34e5108e0153d3fe9287a729ed8814f3c63a) |
| Limit sell 3 cNOTE @ 0.99 USDC | financier | [0xbf442758…](https://testnet.monadvision.com/tx/0xbf4427583479344ec35e0709d3b996325cf4bc5a071c766fc17d31df9605d9b3) |
| Market buy with 1 USDC → 1.009090 cNOTE (10 bps taker fee) | trader | [0xade132a7…](https://testnet.monadvision.com/tx/0xade132a7524680c7e3b9270923ccbb61be845c026173d5e1f0cd13753bf4c01b) |

After the buyer settles, every cNOTE-0516 holder redeems pro-rata for the USDC the note received (`redeem`).

## An AI agent buys a Cargo Note: MetaMask Agent Wallet + the `cargo-notes` plugin

The MetaMask Agent Wallet (server wallet `0x4124348e51653cfe155494cabd671b2977a09407`, Guard mode) bought the live note
`CF-LIVE-1791912900798` (`0xb508ee58…39ff`) through the plugin in [`agent-wallet-plugin/`](../../agent-wallet-plugin):
`mm cargo buy 0xb508… --max-price 3.01`. The plugin checked the note first (ACTIVE, evidence score 100 ≥ 75, ask
3.00564 USDC ≤ max price and 1% under the on-chain mark of 3.036, upside 101 bps), then sent two transactions through
the agent wallet; each was held for the owner's email approval (2FA) before MetaMask broadcast it.

| Step | Transaction |
|---|---|
| Approve exactly 3.00564 USDC to CargoNoteMarket | [0x10c17841…](https://testnet.monadvision.com/tx/0x10c178413612c177dffba0e71e12ca3cb8941c53b61b515de30504c80060519c) |
| Buy the note at its ask (max price = the checked ask, so a raised ask would revert) | [0x55a0bf98…](https://testnet.monadvision.com/tx/0x55a0bf9840c9d028848cd0136e8a8cf0218c96aee1732b4cd0554f01e2ae357c) |

After the buy the controller's financier of record is the agent wallet; settlement, default payouts, the escrowed bill
of lading and any cover now pay it. The same plugin refused `mm cargo buy` on the paused note (`CARGO_NOT_BUYABLE`:
status PAUSED, score 48 below 75, ask above the mark) without signing anything.
