import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { P } from "../assets/palette";
import { Logo } from "../components/Logo";
import { F } from "../theme";
import { MonadCaptions } from "./Captions";
import plan from "./plan.json";

/**
 * CargoFlow · Monad Metropolis film. The explainer reuses the v2 film's scenes (pre-rendered to public/clips,
 * USDC and Monad labels) played at the speed that spans the new narration; everything after them is new:
 * Cargo Notes, the live app on Monad testnet, sponsor proofs from real terminal output, proof and outro.
 * Timing comes from src/monad/plan.json (voiceover/place.py), so every beat follows the voice-over.
 */

type Cue = { id: string; text: string; start: number; end: number };
type Scene = { id: string; kind: string; clip: string | null; from: number; frames: number; speed: number; cues: Cue[] };
const SCENES = plan.scenes as Scene[];
export const MONAD_FILM_FRAMES = plan.totalFrames;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SHADOW = "0 2px 0 rgba(11,27,43,0.06), 0 40px 80px -28px rgba(11,27,43,0.38)";
const fadeIn = (f: number, at: number, d = 12) => interpolate(f, [at, at + d], [0, 1], clamp);
const rise = (f: number, at: number, d = 16) => (1 - fadeIn(f, at, d)) * 24;
/** Scene-relative frame of cue i's start. */
const cueAt = (s: Scene, i: number) => (s.cues[Math.min(i, s.cues.length - 1)]?.start ?? s.from) - s.from;

const Paper: React.FC<{ children?: React.ReactNode; tone?: "paper" | "navy" }> = ({ children, tone = "paper" }) => (
  <AbsoluteFill
    style={{
      background: tone === "navy" ? `linear-gradient(135deg, ${P.ink} 0%, ${P.ink2} 100%)` : P.paper,
      backgroundImage: tone === "paper" ? "radial-gradient(rgba(11,27,43,0.05) 1.4px, transparent 1.4px)" : undefined,
      backgroundSize: tone === "paper" ? "24px 24px" : undefined,
    }}
  >
    {children}
  </AbsoluteFill>
);

const Chip: React.FC<{ text: string; tone?: "ink" | "lime" | "green" | "amber"; size?: number; style?: React.CSSProperties }> = ({ text, tone = "ink", size = 22, style }) => {
  const bg = { ink: P.ink, lime: P.signal, green: P.verified, amber: P.alert }[tone];
  const fg = tone === "ink" ? P.white : P.ink;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, background: bg, color: fg, fontFamily: F.body, fontWeight: 700, fontSize: size, ...style }}>
      {text}
    </span>
  );
};

/** Lower third used over footage and terminal cards. */
const Lower: React.FC<{ title: string; sub?: string; at: number }> = ({ title, sub, at }) => {
  const f = useCurrentFrame();
  const k = fadeIn(f, at, 10);
  return (
    <div style={{ position: "absolute", left: 80, top: 54, opacity: k, transform: `translateY(${(1 - k) * -12}px)`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, color: P.ink, letterSpacing: -0.6 }}>{title}</div>
      {sub ? <div style={{ fontFamily: F.mono, fontSize: 20, color: P.slate }}>{sub}</div> : null}
    </div>
  );
};

// ---------------------------------------------------------------- explainer clips

const ClipScene: React.FC<{ s: Scene }> = ({ s }) => {
  const clipFrames = (s.clip === "S00" ? 315 : s.clip === "S02" ? 810 : s.clip === "S04" ? 360 : s.clip === "S05a" ? 450 : s.clip === "S05c" ? 360 : s.clip === "S05e" ? 510 : 570) - 4;
  const f = useCurrentFrame();
  // hold the last frame if the narration outlasts the clip at its minimum speed
  const hold = f * s.speed >= clipFrames;
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      {hold ? (
        <OffthreadVideo src={staticFile(`clips/${s.clip}.mp4`)} startFrom={clipFrames - 1} muted playbackRate={0.0001} />
      ) : (
        <OffthreadVideo src={staticFile(`clips/${s.clip}.mp4`)} muted playbackRate={s.speed} />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Cargo Notes (new)

const markFor = (score: number, paused: boolean) => {
  const committed = 40000, drawn = 16000, fee = 0.03;
  const undrawn = committed - drawn;
  const drawnLeg = drawn * (1 + fee);
  let factor = 1 - (100 - score) * 0.005;
  if (paused) factor *= 0.7;
  return { undrawn, drawnLeg, factor, mark: undrawn + drawnLeg * factor, claim: committed + drawn * fee };
};
const usd = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

const NotesScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t1 = cueAt(s, 1), t2 = cueAt(s, 2), t3 = cueAt(s, 3), t4 = cueAt(s, 4);
  // score: 100 until t2, falls to 48 by t2+50, paused from t2+60
  const score = Math.round(interpolate(f, [t2 + 8, t2 + 50, t3 - 4, t3 + 26], [100, 48, 48, 100], clamp));
  const paused = f >= t2 + 60 && f < t3 + 14;
  const m = markFor(score, paused);
  const pop = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const traded = f >= t3 + 40;
  const settled = f >= t3 + 85;
  return (
    <Paper>
      <div style={{ position: "absolute", left: 120, top: 90, transform: `scale(${0.9 + pop * 0.1})`, transformOrigin: "0 0", opacity: pop }}>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: P.slate }}>NEW ON MONAD</div>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 92, color: P.ink, letterSpacing: -2, lineHeight: 1.05 }}>
          Cargo <span style={{ background: P.signal, borderRadius: 14, padding: "0 14px" }}>Notes</span>
        </div>
        <div style={{ marginTop: 10, fontFamily: F.body, fontSize: 30, color: P.ink2, maxWidth: 820 }}>The financier&apos;s position, priced by the cargo&apos;s own evidence.</div>
      </div>

      {/* the note card with its on-chain mark */}
      <div style={{ position: "absolute", left: 120, top: 400, width: 820, padding: 34, borderRadius: 28, background: P.white, boxShadow: SHADOW, opacity: fadeIn(f, t1), transform: `translateY(${rise(f, t1)}px)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: F.mono, fontSize: 24, color: P.slate }}>NOTE · CF-2026-SG01</div>
          <Chip text={paused ? "PAUSED" : "ACTIVE"} tone={paused ? "amber" : "green"} size={20} />
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 22 }}>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 22, color: P.slate }}>Evidence score</div>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 64, color: score < 75 ? P.danger : P.ink }}>{score}</div>
          </div>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 22, color: P.slate }}>Claim at settlement</div>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 64, color: P.ink }}>{usd(m.claim)}</div>
          </div>
          <div>
            <div style={{ fontFamily: F.body, fontSize: 22, color: P.slate }}>On-chain mark</div>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 64, color: P.ink, background: P.limeSoft, borderRadius: 10, padding: "0 8px" }}>{usd(m.mark)}</div>
          </div>
        </div>
        <div style={{ marginTop: 26, fontFamily: F.mono, fontSize: 24, color: P.ink2, opacity: fadeIn(f, t2) }}>
          mark = undrawn <b>{usd(m.undrawn)}</b> at par + drawn leg <b>{usd(m.drawnLeg)}</b> × <b>{m.factor.toFixed(3)}</b>
        </div>
        <div style={{ marginTop: 8, fontFamily: F.body, fontSize: 22, color: P.slate, opacity: fadeIn(f, t2 + 10) }}>−0.5% per score point below 100 · ×0.7 while paused · computed by CargoNoteMarket</div>
      </div>

      {/* order book */}
      <div style={{ position: "absolute", left: 1030, top: 400, width: 770, padding: 30, borderRadius: 28, background: P.white, boxShadow: SHADOW, opacity: fadeIn(f, t3), transform: `translateY(${rise(f, t3)}px)` }}>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 26, color: P.ink }}>Order book · USDC</div>
        {[
          { side: "ASK", who: "Daniel", px: 39_200, tone: P.danger },
          { side: "BID", who: "Credit desk", px: 38_600, tone: P.verified },
        ].map((r, i) => (
          <div key={r.side} style={{ display: "flex", justifyContent: "space-between", marginTop: 16, padding: "14px 18px", borderRadius: 14, background: P.mist, opacity: fadeIn(f, t3 + 8 + i * 8), fontFamily: F.mono, fontSize: 28 }}>
            <span style={{ color: r.tone, fontWeight: 700 }}>{r.side}</span>
            <span style={{ color: P.ink }}>{r.who}</span>
            <span style={{ color: P.ink, fontWeight: 700 }}>{usd(r.px)}</span>
          </div>
        ))}
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 16, opacity: fadeIn(f, t3 + 40) }}>
          <Chip text={traded ? "TRADED · holder: credit desk" : "matching…"} tone={traded ? "green" : "ink"} size={22} />
        </div>
        <div style={{ marginTop: 16, opacity: fadeIn(f, t3 + 85) }}>
          <Chip text={settled ? "Buyer pays → settlement pays the holder" : ""} tone="lime" size={22} />
        </div>
      </div>

      <div style={{ position: "absolute", right: 120, top: 140, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, opacity: fadeIn(f, t4) }}>
        <Chip text="400 ms blocks" tone="ink" size={30} />
        <Chip text="800 ms finality" tone="ink" size={30} />
        <Chip text="every mark live" tone="lime" size={30} />
      </div>
    </Paper>
  );
};

// ---------------------------------------------------------------- live app (new footage)

const Browser: React.FC<{ url: string; children: React.ReactNode; k?: number }> = ({ url, children, k = 1 }) => (
  <div style={{ position: "absolute", left: 160, top: 150, width: 1600, height: 900 * 0.86 + 56, borderRadius: 24, overflow: "hidden", background: P.white, boxShadow: SHADOW, opacity: k, transform: `translateY(${(1 - k) * 20}px)` }}>
    <div style={{ height: 56, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", background: "#F1F3EF", borderBottom: `1px solid ${P.line}` }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: "#C9D0C6" }} />
      ))}
      <span style={{ marginLeft: 18, padding: "8px 18px", borderRadius: 999, background: P.white, fontFamily: F.mono, fontSize: 20, color: P.ink2 }}>{url}</span>
    </div>
    <div style={{ position: "relative", width: 1600, height: 900 * 0.86, overflow: "hidden" }}>{children}</div>
  </div>
);

/** A still screenshot (1920x1080 at 1.2 dpr = 1600x900 css) with a slow push and optional scroll. */
const Shot: React.FC<{ src: string; dur: number; scrollTo?: number; full?: boolean }> = ({ src, dur, scrollTo = 0, full }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [1, 1.04], clamp);
  const y = interpolate(f, [dur * 0.25, dur * 0.9], [0, scrollTo], clamp);
  return <Img src={staticFile(`live/${src}`)} style={{ width: 1600, height: full ? "auto" : 900, transform: `translateY(${-y}px) scale(${z})`, transformOrigin: "50% 0" }} />;
};

type Beat = { at: number; url: string; title: string; sub?: string; node: (dur: number) => React.ReactNode };

const DemoScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const c = (i: number) => cueAt(s, i);
  const beats: Beat[] = [
    { at: 0, url: "cargoflow-monad.vercel.app", title: "Live on Monad Testnet", sub: "cargoflow-monad.vercel.app", node: (d) => <Shot src="landing.png" dur={d} /> },
    { at: c(1), url: "cargoflow-monad.vercel.app/shipments", title: "The fleet", sub: "every financed shipment, live", node: (d) => <Shot src="fleet.png" dur={d} /> },
    { at: c(1) + 55, url: "cargoflow-monad.vercel.app/track/0x0353f55d…c58e", title: "A settled shipment", sub: "evidence · releases · pause · proof", node: (d) => <Shot src="track-evidence.png" dur={d} /> },
    { at: c(1) + 110, url: "cargoflow-monad.vercel.app/track/0x0353f55d…c58e", title: "Audit trail", sub: "82 events, each linked to its transaction", node: (d) => <Shot src="track-audit.png" dur={d} /> },
    { at: c(2), url: "cargoflow-monad.vercel.app/notes", title: "Cargo Notes", sub: "re-read every block · on-chain evidence mark", node: () => <OffthreadVideo src={staticFile("live/rec/notes.mp4")} muted startFrom={360} style={{ width: 1600, height: 900 }} /> },
    { at: c(4), url: "testnet.monadvision.com/tx/0x0c2afd1c…3e62", title: "ResumeWithProof · Success", sub: "the Groth16 proof that resumed the facility", node: (d) => <Shot src="tx-recovery-mv.png" dur={d} /> },
    { at: c(4) + 75, url: "testnet.monadvision.com/tx/0xbd203765…1458c27", title: "Settle · Success", sub: "7 USDC in → 4.12 to the note holder · 2.88 to the exporter", node: (d) => <Shot src="tx-settle-mv.png" dur={d} /> },
  ];
  const idx = beats.reduce((acc, b, i) => (f >= b.at ? i : acc), 0);
  return (
    <Paper>
      {beats.map((b, i) => {
        const next = beats[i + 1]?.at ?? s.frames;
        if (i !== idx) return null;
        return (
          <Sequence key={i} from={b.at} durationInFrames={next - b.at} layout="none">
            <Browser url={b.url} k={fadeIn(f, b.at, 8)}>
              {b.node(next - b.at)}
            </Browser>
            <Lower title={b.title} sub={b.sub} at={b.at} />
          </Sequence>
        );
      })}
    </Paper>
  );
};

// ---------------------------------------------------------------- sponsor proofs (real terminal output)

type Line = { t: string; c?: string; b?: boolean };
const Terminal: React.FC<{ title: string; lines: Line[]; at: number; cps?: number; width?: number; x?: number; y?: number; fontSize?: number }> = ({ title, lines, at, cps = 5, width = 1480, x = 220, y = 200, fontSize = 23 }) => {
  const f = useCurrentFrame();
  const shown = Math.max(0, Math.floor((f - at) / (30 / (cps * 6))));
  let budget = shown * 6;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, borderRadius: 20, overflow: "hidden", background: "#0D1722", boxShadow: SHADOW, opacity: fadeIn(f, at - 6, 8) }}>
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#16222F" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <span style={{ marginLeft: 16, fontFamily: F.mono, fontSize: 18, color: "#8FA3B5" }}>{title}</span>
      </div>
      <div style={{ padding: "18px 26px 22px", fontFamily: F.mono, fontSize, lineHeight: 1.45, color: "#D7E1EA", whiteSpace: "pre-wrap" }}>
        {lines.map((l, i) => {
          if (budget <= 0) return null;
          const txt = l.t.slice(0, budget);
          budget -= l.t.length;
          return (
            <div key={i} style={{ color: l.c ?? "#D7E1EA", fontWeight: l.b ? 700 : 400, minHeight: fontSize * 1.45 }}>
              {txt}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const G = "#7EE787", Y = "#F2CC60", R = "#FF7B72", B = "#79C0FF", D = "#8FA3B5", L = P.signal;

const MM_REFUSE: Line[] = [
  { t: "$ mm cargo buy 0xe27855…e7dc --max-price 3", c: L, b: true },
  { t: "Error [CARGO_NOT_BUYABLE]: Refusing to buy this note:", c: R, b: true },
  { t: "  Status is PAUSED; agents only buy FINANCED, ACTIVE or DELIVERED notes.", c: R },
  { t: "  Evidence score 48 is below the minimum 75.", c: R },
  { t: "  Ask is 49 bps above the evidence mark 2.440248 USDC.", c: R },
  { t: "  (nothing was signed)", c: D },
];
const MM_BUY: Line[] = [
  { t: "$ mm cargo buy 0xb508ee58…39ff --max-price 3.01", c: L, b: true },
  { t: "Intent: Approve 3.00564 USDC to CargoNoteMarket" },
  { t: "⚠ [AWAITING_MFA] Approval required: check the email registered to your dashboard", c: Y },
  { t: "Approve 3.00564 USDC to CargoNoteMarket: BROADCASTED (0x10c17841…519c)", c: G },
  { t: "Intent: Buy cargo note 0xb508ee58 for 3.00564 USDC" },
  { t: "⚠ [AWAITING_MFA] Approval required: check the email registered to your dashboard", c: Y },
  { t: "Buy cargo note 0xb508ee58 for 3.00564 USDC: BROADCASTED (0x55a0bf98…357c)", c: G },
  { t: "Bought for 3.00564 USDC (claim 3.036, mark 3.036, evidence 100, upside 101 bps)", c: G, b: true },
];
const KURU: Line[] = [
  { t: "$ SHIPMENT=0xdfce8f86…fa84 SYMBOL=cNOTE-0516 ./scripts/kuru-list-note.sh", c: L, b: true },
  { t: "wrap note:       0xf130430c…2e1c" },
  { t: "note token:      0x427c9617…6D1e (cNOTE-0516, supply 3036000)", c: B },
  { t: "create market:   0x02a329a4…a18b   (Kuru Router.deployProxy)" },
  { t: "kuru market:     0x13f02ef0c5CF7357267C52947709acfE52021520", c: B },
  { t: "limit sell:      0xbf442758…d9b3 (3000000 @ 0.99)" },
  { t: "market buy:      0xade132a7…c01b", c: G },
  { t: "trader holds:    1009090 cNOTE-0516", c: G, b: true },
  { t: "$ cast call 0x13f02ef0… 'bestBidAsk()(uint256,uint256)'", c: L, b: true },
  { t: "ask 990000000000000000   # 0.99 USDC per cNOTE (1e18 precision)", c: Y },
];
const ENVIO: Line[] = [
  { t: "$ curl -s indexer.dev.hyperindex.xyz/bc5a6d2/v1/graphql -d '{ MarketStats Trade chain_metadata }'", c: L, b: true },
  { t: '"MarketStats": [{ "trades": 2, "volume": "7012447", "asks": 4, "bids": 2 }],', c: B },
  { t: '"Trade": [{ "buyer": "0x4124348e…9407", "price": "3005640", "mark": "3036000",', c: G },
  { t: '            "txHash": "0x55a0bf98…357c" }, …],' },
  { t: '"chain_metadata": [{ "latest_processed_block": 70771027 }]', c: Y },
];
const ALCHEMY: Line[] = [
  { t: "$ curl -s cargoflow-monad-api.onrender.com/v1/health", c: L, b: true },
  { t: '{"status":"ok","database":"ok","chainId":10143,"rpc":"primary"}', c: G, b: true },
  { t: "# primary = monad-testnet.g.alchemy.com/v2/••••  ·  fallback = testnet-rpc.monad.xyz", c: D },
];

const ProofsScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const c = (i: number) => cueAt(s, i);
  const kuruAt = c(2), envioAt = c(3);
  const alchemyAt = c(3) + Math.round((s.cues[3].end - s.cues[3].start) * 0.5);
  const phase = f < c(1) ? 0 : f < kuruAt ? 1 : f < envioAt ? 2 : f < alchemyAt ? 3 : 4;
  return (
    <Paper tone="paper">
      {phase === 0 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 96, color: P.ink, letterSpacing: -2, opacity: fadeIn(f, 0), transform: `translateY(${rise(f, 0)}px)` }}>
            An <span style={{ background: P.signal, borderRadius: 14, padding: "0 14px" }}>AI agent</span> trades notes
          </div>
          <div style={{ marginTop: 22, fontFamily: F.body, fontSize: 34, color: P.slate, opacity: fadeIn(f, 10) }}>MetaMask Agent Wallet · cargo-notes plugin · Monad Testnet</div>
        </AbsoluteFill>
      ) : null}
      {phase === 1 ? (
        <>
          <Lower title="MetaMask Agent Wallet · mm cargo" sub="evidence-aware limits · owner approves by email (2FA)" at={c(1)} />
          <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={MM_REFUSE} at={c(1) + 4} y={180} cps={9} />
          <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={MM_BUY} at={c(1) + Math.round((kuruAt - c(1)) * 0.42)} y={500} cps={9} fontSize={21} />
        </>
      ) : null}
      {phase === 2 ? (
        <>
          <Lower title="Kuru · Cargo Notes on a spot order book" sub="note → ERC-20 → cNOTE-0516/USDC market on Monad" at={kuruAt} />
          <Terminal title="scripts/kuru-list-note.sh · Monad Testnet" lines={KURU} at={kuruAt + 4} y={190} cps={10} />
        </>
      ) : null}
      {phase === 3 ? (
        <>
          <Lower title="Envio · HyperIndex on Envio Cloud" sub="every ask, bid, trade and transfer, synced to the chain head" at={envioAt} />
          <Terminal title="GraphQL · indexer.dev.hyperindex.xyz/bc5a6d2" lines={ENVIO} at={envioAt + 4} y={230} cps={10} />
        </>
      ) : null}
      {phase === 4 ? (
        <>
          <Lower title="Alchemy · primary Monad RPC" sub="every read, log window and role-key transaction of the API" at={alchemyAt} />
          <Terminal title="CargoFlow API · Monad Testnet" lines={ALCHEMY} at={alchemyAt + 4} y={300} cps={10} />
        </>
      ) : null}
    </Paper>
  );
};

// ---------------------------------------------------------------- proof + outro

const SPONSORS: [string, string][] = [
  ["Monad", "11 contracts · chain 10143"],
  ["Circle USDC", "the only money"],
  ["Kuru", "cNOTE-0516/USDC market"],
  ["Envio", "HyperIndex on Envio Cloud"],
  ["MetaMask", "Agent Wallet bought a note"],
  ["Alchemy", "primary Monad RPC"],
  ["ZeroDev", "passkeys · P-256 at 0x100"],
  ["OpenZeppelin", "contracts v5.4"],
];

const OutroScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t1 = cueAt(s, 1);
  return (
    <Paper tone={f >= t1 ? "navy" : "paper"}>
      {f < t1 ? (
        <>
          <div style={{ position: "absolute", left: 120, top: 110, fontFamily: F.display, fontWeight: 700, fontSize: 64, color: P.ink, letterSpacing: -1.4, opacity: fadeIn(f, 0) }}>Live on Monad Testnet</div>
          <div style={{ position: "absolute", left: 120, top: 210, display: "grid", gridTemplateColumns: "repeat(4, 400px)", gap: 22 }}>
            {SPONSORS.map(([n, why], i) => (
              <div key={n} style={{ padding: "22px 24px", borderRadius: 20, background: P.white, boxShadow: SHADOW, opacity: fadeIn(f, 6 + i * 4), transform: `translateY(${rise(f, 6 + i * 4)}px)` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 34, color: P.ink }}>{n}</span>
                  <Chip text="LIVE" tone="green" size={16} />
                </div>
                <div style={{ marginTop: 8, fontFamily: F.body, fontSize: 21, color: P.slate }}>{why}</div>
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 120, top: 620, display: "flex", gap: 24, opacity: fadeIn(f, 40) }}>
            <Chip text="379 contract tests" tone="ink" size={30} />
            <Chip text="300 frontend tests" tone="ink" size={30} />
            <Chip text="source-verified on MonadVision" tone="lime" size={30} />
          </div>
          <div style={{ position: "absolute", left: 120, top: 720, fontFamily: F.mono, fontSize: 26, color: P.ink2, opacity: fadeIn(f, 50) }}>CargoNoteMarket 0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d</div>
        </>
      ) : (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26, background: `linear-gradient(135deg, ${P.ink} 0%, ${P.ink2} 100%)` }}>
          <Logo width={760} variant="dark" reveal={interpolate(f, [t1, t1 + 24], [0, 1], clamp)} />
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 60, color: P.white, opacity: fadeIn(f, t1 + 18) }}>
            Capital that <span style={{ color: P.signal }}>moves</span> with your cargo
          </div>
          <div style={{ fontFamily: F.body, fontSize: 30, color: "#B9C7D3", opacity: fadeIn(f, t1 + 30) }}>Monad Metropolis · Track 01: Onchain Finance &amp; Trading</div>
          <div style={{ display: "flex", gap: 22, marginTop: 10, opacity: fadeIn(f, t1 + 40) }}>
            <Chip text="cargoflow-monad.vercel.app" tone="lime" size={28} />
            <Chip text="github.com/LSUDOKO/CargoFlow-Monad" tone="ink" size={28} style={{ border: "1px solid rgba(255,255,255,0.25)" }} />
          </div>
        </AbsoluteFill>
      )}
    </Paper>
  );
};

// ---------------------------------------------------------------- the film

const SCENE_FOR: Record<string, React.FC<{ s: Scene }>> = { clip: ClipScene, notes: NotesScene, demo: DemoScene, proofs: ProofsScene, outro: OutroScene };

export const MonadFilm: React.FC<{ captions: boolean; music: number }> = ({ captions, music }) => (
  <AbsoluteFill style={{ background: P.paper }}>
    {SCENES.map((s) => {
      const Comp = SCENE_FOR[s.kind];
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={`${s.id} · ${s.kind}${s.clip ? ` ${s.clip}` : ""}`}>
          <Comp s={s} />
        </Sequence>
      );
    })}
    {captions ? <MonadCaptions /> : null}
    <Audio src={staticFile("audio/monad-vo.wav")} />
    <Audio src={staticFile("audio/music.wav")} volume={(fr) => music * interpolate(fr, [0, 30, MONAD_FILM_FRAMES - 90, MONAD_FILM_FRAMES], [0, 1, 1, 0], clamp)} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------- README stills of the sponsor proofs

const PROOF_CARDS: Record<string, { title: string; sub: string; terms: { title: string; lines: Line[]; fontSize?: number }[] }> = {
  metamask: {
    title: "MetaMask Agent Wallet · cargo-notes plugin",
    sub: "the agent refuses a paused note, then buys an active one after the owner's email approval (2FA)",
    terms: [
      { title: "mm · agent wallet 0x4124…9407 · Monad Testnet", lines: MM_REFUSE },
      { title: "mm · agent wallet 0x4124…9407 · Monad Testnet", lines: MM_BUY, fontSize: 21 },
    ],
  },
  kuru: {
    title: "Kuru · a Cargo Note on a spot order book",
    sub: "note → CargoNoteToken (ERC-20) → cNOTE-0516/USDC market via Kuru's Router · limit sell + market buy",
    terms: [{ title: "scripts/kuru-list-note.sh · Monad Testnet", lines: KURU }],
  },
  envio: {
    title: "Envio · HyperIndex on Envio Cloud",
    sub: "every ask, bid, trade and transfer, synced to the chain head · feeds /notes",
    terms: [{ title: "GraphQL · indexer.dev.hyperindex.xyz/bc5a6d2", lines: ENVIO }],
  },
  alchemy: {
    title: "Alchemy · primary Monad RPC of the API",
    sub: "every read, indexer log window and role-key transaction; public RPC as fallback",
    terms: [{ title: "CargoFlow API · Monad Testnet", lines: ALCHEMY }],
  },
};

/** One sponsor proof as a still for the README: the film's terminal cards, fully typed, no captions. */
export const ProofStill: React.FC<{ which: string }> = ({ which }) => {
  const card = PROOF_CARDS[which] ?? PROOF_CARDS.metamask!;
  let y = 190;
  return (
    <Paper tone="paper">
      <div style={{ position: "absolute", left: 220, top: 64, fontFamily: F.display, fontWeight: 700, fontSize: 52, color: P.ink, letterSpacing: -1 }}>{card.title}</div>
      <div style={{ position: "absolute", left: 222, top: 132, fontFamily: F.body, fontSize: 26, color: P.slate }}>{card.sub}</div>
      {card.terms.map((t, i) => {
        const fs = t.fontSize ?? 23;
        const top = y;
        y += 46 + 40 + t.lines.length * fs * 1.45 + 40;
        return <Terminal key={i} title={t.title} lines={t.lines} at={-100000} y={top} fontSize={fs} />;
      })}
    </Paper>
  );
};
