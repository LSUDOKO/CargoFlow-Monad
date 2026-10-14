import React from "react";
import { P } from "../assets/palette";
import { F } from "../theme";
import { Browser, Chip, CodeCard, CoBrand, EndCard, Lower, Paper, Scene, Shot, SponsorFilm, TC, Terminal, TitleCard, TLine, cueAt, fadeIn, rise, useCurrentFrame, SHADOW } from "./kit";
import plan from "./plan-al.json";
import words from "../../public/audio/sp-al.words.json";
import { failover, failoverRT, maxRange } from "./snippets";

/**
 * Alchemy as the hosted API's primary Monad RPC. Terminal output is real (proofs/sponsors/alchemy-*.txt), with the
 * API key masked; code cards are verbatim excerpts of backend/ (scripts-snippets.py).
 */

const STEPS = 5;
const step = (n: number) => `${String(n).padStart(2, "0")} / ${STEPS}`;

const IntroScene: React.FC<{ s: Scene }> = () => (
  <TitleCard
    sponsor="Alchemy"
    kicker="Best Projects using Alchemy"
    title={<>Alchemy is the <span style={{ color: P.signal }}>primary Monad RPC</span> behind CargoFlow</>}
    sub="Every chain read, evidence commit, milestone release and pause of the hosted API goes through Alchemy's Monad Testnet endpoint."
    chips={["monad-testnet.g.alchemy.com", "failover to the public RPC", "10-block log windows"]}
  />
);

const HEALTH: TLine[] = [
  { cmd: "curl -s https://cargoflow-monad-api.onrender.com/v1/health" },
  { t: '{"status":"ok","database":"ok","chainId":10143,"headBlock":70989913,"rpc":"primary"}', c: TC.green, b: true },
  { cmd: "curl -s https://api.render.com/v1/services/srv-db76…/env-vars -H 'Authorization: Bearer ••••' | jq …" },
  { t: "RPC_URL=https://monad-testnet.g.alchemy.com/v2/••••", c: TC.blue, b: true },
  { t: "RPC_FALLBACK_URL=https://testnet-rpc.monad.xyz" },
  { t: "INDEXER_MAX_RANGE=10" },
  { t: "CHAIN_ID=10143" },
  { cmd: "render logs -r srv-db76jvnf3r2c73dcp5k0 --limit 300 -o text | grep -m1 starting" },
  { t: '2026-10-14 14:24:17  {"level":"INFO","msg":"starting","config":"config{http=:8080 chain=10143', dim: true },
  { t: "  rpc=https://monad-testnet.g.alchemy.com/… rpcFallback=https://testnet-rpc.monad.xyz", c: TC.blue },
  { t: '  deployment=/app/deployments/monad-testnet.json confirmations=1 poll=2s …}"}', dim: true },
];

const HealthScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <CoBrand sponsor="Alchemy" />
    <Lower step={step(1)} title="RPC: primary" sub="the live API's health check, its Render config and its startup log" />
    <Terminal title="CargoFlow API · Render · Monad Testnet" lines={HEALTH} at={8} cps={80} rows={12} fontSize={20} marks={[{ line: 1, at: 60 }, { line: 3, at: 150 }, { line: 9, at: 250 }]} />
  </Paper>
);

const FailoverScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      <CoBrand sponsor="Alchemy" />
      <Lower step={step(2)} title="A failover client, Alchemy first" sub="backend/internal/chain/failover.go" />
      <CodeCard path={failover.path} code={failover.code} firstLine={failover.first} lang="go" at={8} fontSize={18} y={160} marks={[{ from: 26, to: 28, at: 50 }, { from: 28, to: 29, at: 200 }, { from: 29, to: 30, at: t2 }]} />
      <CodeCard path={`${failoverRT.path} · RoundTrip`} code={failoverRT.code} firstLine={failoverRT.first} lang="go" at={110} fontSize={18} y={456} marks={[{ from: 148, to: 148, at: 150 }, { from: 149, to: 152, at: t2 + 10 }]} />
      <div style={{ position: "absolute", right: 120, top: 120, display: "flex", gap: 14, opacity: fadeIn(f, t2) }}>
        <Chip text="5xx · 429 · unreachable → fallback" tone="amber" size={22} />
        <Chip text="reverts → never fail over" tone="lime" size={22} />
      </div>
    </Paper>
  );
};

const WindowScene: React.FC<{ s: Scene }> = () => {
  const f = useCurrentFrame();
  const item = (at: number): React.CSSProperties => ({ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 14, 20)}px)` });
  return (
    <Paper>
      <CoBrand sponsor="Alchemy" />
      <Lower step={step(3)} title="Tuned for Alchemy on Monad" sub="the free tier serves eth_getLogs over 10 blocks; the indexer follows it" />
      <CodeCard path={maxRange.path} code={maxRange.code} firstLine={maxRange.first} lang="go" at={8} fontSize={24} y={170} marks={[{ from: 278, to: 278, at: 40 }]} />
      <div style={{ position: "absolute", left: 160, top: 450, display: "flex", gap: 28, alignItems: "center" }}>
        {[
          ["INDEXER_MAX_RANGE", "10 blocks per call"],
          ["Monad block time", "400 ms"],
          ["≈ calls per second", "2.5 getLogs"],
        ].map(([k, v], i) => (
          <div key={k} style={{ ...item(60 + i * 18), padding: "26px 30px", borderRadius: 24, background: P.white, boxShadow: SHADOW, minWidth: 420 }}>
            <div style={{ fontFamily: F.body, fontSize: 22, color: P.slate }}>{k}</div>
            <div style={{ marginTop: 6, fontFamily: F.mono, fontWeight: 700, fontSize: 46, color: P.ink }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 160, top: 640, ...item(130) }}>
        <Chip text="watched after the switch: one failover at the startup burst, then stable on the primary" tone="lime" size={24} />
      </div>
    </Paper>
  );
};

const RunsScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const half = Math.round(s.frames * 0.5);
  return (
    <Paper>
      {f < half ? (
        <>
          <Browser url="cargoflow-monad.vercel.app/track/0x0353f55d…c58e" at={0}>
            <Shot src="track-overview.png" zooms={[{ at: 10, cx: 800, cy: 330, scale: 1.12 }]} />
          </Browser>
          <Lower step={step(4)} title="What runs through Alchemy" sub="evidence commits · milestone releases · pause · ZK recovery · settlement" at={0} />
        </>
      ) : (
        <>
          <Browser url="cargoflow-monad.vercel.app/track/0x0353f55d…c58e · Audit trail" at={half}>
            <Shot src="track-audit2.png" zooms={[{ at: half + 8, cx: 800, cy: 560, scale: 1.18 }]} />
          </Browser>
          <Lower step={step(4)} title="Each step, read and written through the API" sub="the audit trail: every chain event and role-key transaction" at={half} />
        </>
      )}
    </Paper>
  );
};

const ProductScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <Browser url="cargoflow-monad.vercel.app/notes" at={0}>
      <Shot src="notes-top.png" zooms={[{ at: 20, cx: 780, cy: 470, scale: 1.08 }]} />
    </Browser>
    <Lower step={step(5)} title="Live on Monad, through Alchemy" sub="dashboards · evidence-gated money · the Cargo Note market" />
  </Paper>
);

const OutroScene: React.FC<{ s: Scene }> = () => (
  <EndCard
    sponsor="Alchemy"
    line={<>CargoFlow on Monad, <span style={{ color: P.signal }}>powered by Alchemy</span></>}
    links={["cargoflow-monad.vercel.app", "cargoflow-monad-api.onrender.com/v1/health", "github.com/LSUDOKO/CargoFlow-Monad · backend/"]}
  />
);

export const AL_FRAMES = plan.totalFrames;
export const AlchemyFilm: React.FC<{ captions?: boolean }> = ({ captions = true }) => (
  <SponsorFilm plan={plan} words={words} vo="audio/sp-al-vo.wav" captions={captions} scenes={{ intro: IntroScene, health: HealthScene, failover: FailoverScene, window: WindowScene, runs: RunsScene, product: ProductScene, outro: OutroScene }} />
);
