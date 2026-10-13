# The Metropolis film

`video/out/CargoFlow-Monad-Metropolis.mp4`: 1920×1080, 30 fps, 168.6 s (5058 frames), burned-in captions,
voice-over and music. Upload it to YouTube (unlisted is fine) and paste the link as the technical demo video.

| Scene | Starts | Length | What it shows |
|---|---|---|---|
| A | 0:00 | 7.8 s | Cold open: the reefer at 5.2 °C, lenders see paperwork |
| B | 0:07 | 15.0 s | Daniel lends blind; ADB $2.5T gap (source on screen) |
| C | 0:22 | 8.5 s | The line: the cargo's evidence decides |
| D1 | 0:31 | 8.5 s | Facility and USDC escrow |
| D2 | 0:39 | 10.6 s | Signed readings, epochs, score |
| D3 | 0:50 | 10.6 s | Excursion, score 48, pause |
| D4 | 1:00 | 9.4 s | Zero-knowledge recovery |
| D5 | 1:10 | 10.6 s | Settlement and the bill of lading |
| E | 1:20 | 24.6 s | NEW: Cargo Notes (on-chain mark, order book, trade, settlement pays the holder, 400 ms blocks) |
| F | 1:45 | 27.9 s | Live app on Monad testnet: landing, fleet, settled shipment, audit trail, /notes recording, MonadVision ResumeWithProof and Settle |
| G | 2:13 | 24.2 s | Sponsor proofs from real terminal output: MetaMask Agent Wallet (refusal + 2FA buy), Kuru, Envio, Alchemy |
| H | 2:37 | 11.1 s | Sponsors board (8 LIVE), tests, contract, outro |

## How it is built

- Remotion project in [`video/`](../../video), composition `MonadFilm` ([`src/monad/MonadFilm.tsx`](../../video/src/monad/MonadFilm.tsx)).
- The explainer (A-D5) reuses the earlier CargoFlow film's illustrated scenes, relabelled for USDC and Monad and
  pre-rendered to `public/clips/` (`npx remotion render V2-<scene> …`), played at up to 1.8× to fit the new narration.
- Cargo Notes, the sponsor terminal cards, the sponsor board and the outro are new animations.
- Live footage was captured on 14 October 2026 from https://cargoflow-monad.vercel.app and MonadVision
  ([`video/scripts-capture.mjs`](../../video/scripts-capture.mjs)); the terminal cards reproduce real command output kept in
  [`video/proofs/`](../../video/proofs) and the buy transcript from the agent wallet run.
- Voice-over: Kokoro TTS (`am_fenrir`, the earlier film's voice), script in [`video/captions-monad.json`](../../video/captions-monad.json),
  laid out by [`video/voiceover/place.py`](../../video/voiceover/place.py) (writes the scene plan the composition follows).

Re-render: `cd video && npx remotion render MonadFilm out/CargoFlow-Monad-Metropolis.mp4 --codec=h264 --crf=18`
(needs the local `public/clips/`, `public/audio/monad-vo.wav` and `public/audio/music.wav`, which are not in git).
