import React from "react";
import { P } from "../assets/palette";
import { F } from "../theme";
import {
  Browser, Chip, CodeCard, CoBrand, EndCard, Lower, Paper, Scene, Shot, SponsorFilm, TC, Terminal, TitleCard,
  TLine, cueAt, fadeIn, rise, useCurrentFrame, SHADOW, spring, useVideoConfig, interpolate, clamp,
} from "./kit";
import plan from "./plan-mm.json";
import words from "../../public/audio/sp-mm.words.json";

/**
 * MetaMask Agent Wallet · cargo-notes plugin. Every terminal line is real output captured on 14 October 2026 from
 * the signed-in agent wallet (video/proofs/sponsors/mm-*.txt); the buy transcript is the owner's own run (two
 * AWAITING_MFA approvals, then BROADCASTED on Monad Testnet).
 */

const PAUSED = "0xe27855155eae78aeb39aca53e5f50a861f503e0e7cd87730add2bf093f27e7dc";
const STEPS = 10;
const step = (n: number) => `${String(n).padStart(2, "0")} / ${STEPS}`;

const IntroScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  if (f < t2 - 6) {
    return (
      <TitleCard
        sponsor="MetaMask Agent Wallet"
        kicker="Best Agent Wallet Plugin · cargo-notes"
        title={<>Evidence-aware <span style={{ color: P.signal }}>credit trading</span> for AI agents</>}
        sub="A native mm plugin that lets an agent find, price and buy Cargo Notes on Monad, within its owner's limits."
        chips={["mm cargo list · quote · buy · bid · scan", "Monad Testnet 10143", "real flows, real output"]}
      />
    );
  }
  const cards = [
    { k: "FIND", t: "mm cargo list · scan", d: "Every note on Monad: status, evidence score, claim, on-chain mark, ask, best bid." },
    { k: "PRICE", t: "mm cargo quote", d: "The mark explained in plain words, re-computed and checked against the contract." },
    { k: "BUY WITHIN LIMITS", t: "mm cargo buy · bid", d: "Min evidence score, max price, max premium to mark, budget. Refuses before signing." },
  ];
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower title="A new trading superpower" sub="Cargo Notes: short-dated trade-finance positions, priced by the cargo's own sensor evidence" at={t2 - 6} />
      <div style={{ position: "absolute", left: 96, right: 96, top: 300, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
        {cards.map((c, i) => {
          const at = t2 + 6 + i * 14;
          return (
            <div key={c.k} style={{ padding: "34px 34px 38px", borderRadius: 28, background: P.white, boxShadow: SHADOW, opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 18, 30)}px)` }}>
              <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 20, letterSpacing: 2.4, color: P.slate }}>{c.k}</div>
              <div style={{ marginTop: 14, fontFamily: F.mono, fontWeight: 700, fontSize: 32, color: P.ink, background: P.limeSoft, display: "inline-block", padding: "4px 12px", borderRadius: 10 }}>{c.t}</div>
              <div style={{ marginTop: 20, fontFamily: F.body, fontSize: 28, lineHeight: 1.35, color: P.ink2 }}>{c.d}</div>
            </div>
          );
        })}
      </div>
    </Paper>
  );
};

const INSTALL: TLine[] = [
  { cmd: "mm plugins" },
  { t: "mm-plugin-cargo-notes 0.1.0", c: TC.green, b: true },
  { cmd: "mm cargo --help | jq -r '.data.commands[].invocation'" },
  { t: "mm cargo bid" },
  { t: "mm cargo buy" },
  { t: "mm cargo cancel-bid" },
  { t: "mm cargo list" },
  { t: "mm cargo quote" },
  { t: "mm cargo scan" },
];

const InstallScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <CoBrand sponsor="MetaMask Agent Wallet" />
    <Lower step={step(1)} title="Installed into the real mm CLI" sub="oclif plugin · capabilities wallet-read + wallet-submit · target chain 10143" />
    <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={INSTALL} at={14} rows={11} marks={[{ line: 1, at: 60 }]} />
  </Paper>
);

const LIST: TLine[] = [
  { cmd: "mm cargo list -f text" },
  { t: "chainId: 10143", dim: true },
  { t: "market:  0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d", dim: true },
  { t: "source:  api", dim: true },
  { t: "count:   3", dim: true },
  { t: "Hint: 3 cargo note(s) (USDC):", c: TC.yellow },
  { t: "CF-LIVE-1791917840516  ACTIVE    score 100  claim 3.036  mark 3.036  ask -  bid -  upside -" },
  { t: "CF-LIVE-1791912900798  ACTIVE    score 100  claim 3.036  mark 3.036  ask -  bid 2.94492  upside -" },
  { t: "CF-LIVE-1791912775389  PAUSED    score  48  claim 3.036  mark 2.440248  ask 2.452449  bid 2.36704  upside 2379 bps", c: TC.yellow },
];

const ListScene: React.FC<{ s: Scene }> = () => (
  <Paper>
    <CoBrand sponsor="MetaMask Agent Wallet" />
    <Lower step={step(2)} title="mm cargo list" sub="the whole market, read from Monad: status · evidence · claim · mark · ask · bid" />
    <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={LIST} at={10} rows={10} fontSize={22} marks={[{ line: 6, to: 7, at: 120 }, { line: 8, at: 175 }]} />
  </Paper>
);

const QUOTE: TLine[] = [
  { cmd: `mm cargo quote ${PAUSED} -f text` },
  { t: "status:            PAUSED", c: TC.yellow, b: true },
  { t: "evidenceScore:     48", c: TC.red, b: true },
  { t: "claimUsdc:         3.036" },
  { t: "markUsdc:          2.440248", b: true },
  { t: "askUsdc:           2.452449" },
  { t: "markMatchesChain:  true", c: TC.green },
  { t: "whyThisMark:", c: TC.yellow },
  { t: "  - Undrawn 1.8 USDC is still in escrow and is marked at par." },
  { t: "  - Evidence score 48/100: drawn leg 1.236 x (1 - 0.5% x 52 pts) = x74.00%." },
  { t: "  - Facility is PAUSED (a breach is open): drawn leg further x70% -> x51.80%." },
  { t: "  - Mark = 1.8 + 0.640248 = 2.440248 USDC." },
];

const QuoteScene: React.FC<{ s: Scene }> = ({ s }) => {
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(3)} title="mm cargo quote: the price, explained" sub="a paused note after a temperature excursion · evidence score 48" />
      <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={QUOTE} at={10} cps={60} rows={12} fontSize={22} marks={[{ line: 1, to: 2, at: t2 + 20 }, { line: 9, to: 10, at: t2 + 80 }, { line: 6, at: t2 + 150 }]} />
    </Paper>
  );
};

const REFUSE: TLine[] = [
  { cmd: `mm cargo buy ${PAUSED} --max-price 3` },
  { t: "Error [CARGO_NOT_BUYABLE]: Refusing to buy this note:", c: TC.red, b: true },
  { t: "  Status is PAUSED; agents only buy FINANCED, ACTIVE or DELIVERED notes.", c: TC.red },
  { t: "  Evidence score 48 is below the minimum 75.", c: TC.red },
  { t: "  Ask is 49 bps above the evidence mark 2.440248 USDC; allowed premium is 0 bps.", c: TC.red },
  { t: "Hint: These limits come from your flags (--max-price, --min-score, --max-premium-to-mark-bps).", c: TC.dim },
];

const RefuseScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(4)} title="Refused before anything is signed" sub="the plugin's rules run first; MetaMask never sees a transaction" />
      <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={REFUSE} at={10} cps={60} rows={6} fontSize={23} marks={[{ line: 2, to: 4, at: t2 }]} />
      <div style={{ position: "absolute", left: 160, top: 640, display: "flex", gap: 22 }}>
        {[["PAUSED", "amber"], ["score 48 < 75", "red"], ["ask > mark", "red"], ["0 transactions signed", "green"]].map(([t, tone], i) => (
          <span key={t} style={{ opacity: fadeIn(f, t2 + 8 + i * 9), transform: `translateY(${rise(f, t2 + 8 + i * 9, 14, 16)}px)` }}>
            <Chip text={t} tone={tone as "amber" | "red" | "green"} size={30} />
          </span>
        ))}
      </div>
    </Paper>
  );
};

const SCAN: TLine[] = [
  { cmd: "mm cargo scan --budget 4 --min-score 90 --min-upside-bps 50 -f text" },
  { t: "scanned:          3", dim: true },
  { t: "selected:         []", c: TC.yellow },
  { t: "plannedSpendUsdc: 0", c: TC.yellow },
  { t: "Hint: Scanned 3 note(s) with min score 90, min upside 50 bps, max premium to mark 0 bps, budget 4 USDC.", c: TC.dim },
  { t: "  skip CF-LIVE-1791917840516: Nobody is offering this note (no ask)." },
  { t: "  skip CF-LIVE-1791912900798: Nobody is offering this note (no ask)." },
  { t: "  skip CF-LIVE-1791912775389: Status is PAUSED; agents only buy FINANCED, ACTIVE or DELIVERED notes." },
  { t: "    Evidence score 48 is below the minimum 90. Ask is 49 bps above the evidence mark 2.440248 USDC." },
];

const ScanScene: React.FC<{ s: Scene }> = ({ s }) => {
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(5)} title="mm cargo scan: a strategy in one command" sub="rank every note against your rules and budget · dry run unless --execute" />
      <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet" lines={SCAN} at={10} cps={50} rows={9} fontSize={21} marks={[{ line: 5, to: 8, at: 150 }, { line: 2, to: 3, at: t2 }]} />
    </Paper>
  );
};

const BUY: TLine[] = [
  { cmd: "mm cargo buy 0xb508ee5803f1531f5ef62d9df7e7760c091555550471dd98643f7114021239ff --max-price 3.01" },
  { t: "Intent: Approve 3.00564 USDC to CargoNoteMarket" },
  { t: "⚠ [AWAITING_MFA] Approval required: check the email registered to your dashboard and confirm to proceed.", c: TC.yellow },
  { t: "Approve 3.00564 USDC to CargoNoteMarket: BROADCASTED (0x10c178413612c177dffba0e71e12ca3cb8941c53b61b515de30504c80060519c)", c: TC.green },
  { t: "Intent: Buy cargo note 0xb508ee58 for 3.00564 USDC" },
  { t: "⚠ [AWAITING_MFA] Approval required: check the email registered to your dashboard and confirm to proceed.", c: TC.yellow },
  { t: "Buy cargo note 0xb508ee58 for 3.00564 USDC: BROADCASTED (0x55a0bf9840c9d028848cd0136e8a8cf0218c96aee1732b4cd0554f01e2ae357c)", c: TC.green },
  { t: "Hint: Bought 0xb508…39ff for 3.00564 USDC (claim 3.036, mark 3.036, evidence 100, upside 101 bps).", c: TC.green, b: true },
];

const BuyScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t2 = cueAt(s, 1);
  // the two approvals pace the transcript: approve line after the first MFA, buy line after the second
  const lps = 1.3;
  const mail = (at: number) => spring({ frame: f - at, fps, config: { damping: 14 } });
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(6)} title="The real buy, with the owner's 2FA" sub="ACTIVE · evidence 100 · ask 3.00564 USDC, 1% under the mark · +101 bps upside" />
      <Terminal title="mm · agent wallet 0x4124…9407 · Monad Testnet (the owner's run)" lines={BUY} at={8} cps={70} lps={lps} rows={8} fontSize={19} marks={[{ line: 2, at: t2 + 30 }, { line: 5, at: t2 + 60 }, { line: 7, at: t2 + 110 }]} />
      {[0, 1].map((i) => {
        const at = t2 + 34 + i * 30;
        const k = mail(at);
        return (
          <div key={i} style={{ position: "absolute", left: 980 + i * 380, top: 620, width: 350, padding: "20px 22px", borderRadius: 22, background: P.white, boxShadow: SHADOW, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
            <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 18, color: P.slate, letterSpacing: 1.4 }}>EMAIL · METAMASK</div>
            <div style={{ marginTop: 8, fontFamily: F.display, fontWeight: 700, fontSize: 26, color: P.ink }}>{i === 0 ? "Approve 3.00564 USDC" : "Buy cargo note"}</div>
            <div style={{ marginTop: 12 }}>
              <Chip text="✓ approved by the owner" tone="green" size={18} />
            </div>
          </div>
        );
      })}
    </Paper>
  );
};

const ChainScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const half = Math.round(s.frames * 0.45);
  return (
    <Paper>
      {f < half ? (
        <>
          <Browser url="testnet.monadscan.com/tx/0x10c17841…519c" at={0}>
            <Shot src="tx-mm-approve.png" zooms={[{ at: 14, cx: 560, cy: 380, scale: 1.3 }]} rings={[{ x: 470, y: 412, w: 92, h: 36, at: 34, label: "Success", tone: "green" }, { x: 186, y: 254, w: 640, h: 32, at: 50 }]} />
          </Browser>
          <Lower step={step(7)} title="Approve · Success" sub="exactly 3.00564 USDC, from the agent wallet 0x4124…9407" at={0} />
        </>
      ) : (
        <>
          <Browser url="testnet.monadvision.com/tx/0x55a0bf98…357c" at={half}>
            <Shot src="tx-mm-buy.png" zooms={[{ at: half + 12, cx: 640, cy: 540, scale: 1.3 }]} rings={[{ x: 392, y: 378, w: 126, h: 28, at: half + 30, label: "Buy · Success", tone: "green" }, { x: 392, y: 666, w: 502, h: 34, at: half + 46, label: "3.00564 USDC to the seller" }]} />
          </Browser>
          <Lower step={step(7)} title="Buy · Success" sub="CargoNoteMarket.buy · Monad Testnet · block 70,768,641" at={half} />
        </>
      )}
    </Paper>
  );
};

const HolderScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      {f < t2 - 4 ? (
        <>
          <Browser url="cargoflow-monad.vercel.app/track/0xb508ee58…39ff" at={0}>
            <Shot src="track-agent-financier.png" zooms={[{ at: 20, cx: 560, cy: 290, scale: 1.45 }]} rings={[{ x: 444, y: 240, w: 214, h: 26, at: 40, label: "the agent wallet" }]} />
          </Browser>
          <Lower step={step(8)} title="Financier of record: the agent" sub="settlement pays principal + fee to 0x4124…9407" at={0} />
        </>
      ) : (
        <>
          <Browser url="cargoflow-monad.vercel.app/notes · Market activity" at={t2 - 4}>
            <Shot src="notes-activity.png" zooms={[{ at: t2 + 10, cx: 800, cy: 300, scale: 1.12 }]} rings={[{ x: 192, y: 297, w: 1214, h: 42, at: t2 + 28, label: "Traded · 3.00564 USDC · buyer = the agent 0x4124…9407" }]} />
          </Browser>
          <Lower step={step(8)} title="The fill, in the live market feed" sub="indexed from Monad by Envio HyperIndex" at={t2 - 4} />
        </>
      )}
    </Paper>
  );
};

const SafetyScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  const box = (at: number): React.CSSProperties => ({ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 16, 26)}px)` });
  const arrow = (at: number) => (
    <div style={{ alignSelf: "center", width: 80, height: 6, borderRadius: 3, background: P.ink, opacity: fadeIn(f, at), transformOrigin: "0 50%", transform: `scaleX(${interpolate(f, [at, at + 14], [0, 1], clamp)})` }} />
  );
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(9)} title="Two layers of safety" sub="the plugin's evidence rules, then MetaMask's policy and the owner" />
      <div style={{ position: "absolute", left: 96, right: 96, top: 290, display: "flex", gap: 26, alignItems: "stretch" }}>
        <div style={{ ...box(8), flex: "0 0 250px", padding: 30, borderRadius: 26, background: P.ink, color: P.white, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: F.body, fontSize: 20, letterSpacing: 2, color: P.signal, fontWeight: 700 }}>AGENT</div>
          <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 26 }}>mm cargo scan --execute</div>
        </div>
        {arrow(16)}
        <div style={{ ...box(20), flex: 1, padding: 32, borderRadius: 26, background: P.white, boxShadow: SHADOW }}>
          <Chip text="1 · cargo-notes plugin" tone="lime" size={24} />
          {["status FINANCED / ACTIVE / DELIVERED", "evidence score ≥ --min-score", "ask ≤ --max-price and ≤ mark (+ premium)", "budget, upside, exact-amount approvals"].map((r, i) => (
            <div key={r} style={{ marginTop: 18, fontFamily: F.body, fontSize: 27, color: P.ink, opacity: fadeIn(f, 30 + i * 8) }}>✓ {r}</div>
          ))}
        </div>
        {arrow(t2)}
        <div style={{ ...box(t2 + 6), flex: 1, padding: 32, borderRadius: 26, background: P.white, boxShadow: SHADOW }}>
          <Chip text="2 · MetaMask Guard mode" tone="ink" size={24} />
          {["allowlist: CargoNoteMarket + USDC", "24-hour outflow limit", "two-factor approval (email / mobile)", "simulation + threat scan on every tx"].map((r, i) => (
            <div key={r} style={{ marginTop: 18, fontFamily: F.body, fontSize: 27, color: P.ink, opacity: fadeIn(f, t2 + 16 + i * 8) }}>✓ {r}</div>
          ))}
        </div>
        {arrow(t2 + 50)}
        <div style={{ ...box(t2 + 56), flex: "0 0 200px", padding: 30, borderRadius: 26, background: P.signal, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: F.body, fontSize: 20, letterSpacing: 2, color: P.ink, fontWeight: 700 }}>MONAD</div>
          <div style={{ marginTop: 10, fontFamily: F.display, fontWeight: 700, fontSize: 32, color: P.ink }}>tx lands</div>
        </div>
      </div>
    </Paper>
  );
};

const SKILL = `## Rules for agents

1. **Plan, then execute.** Run \`scan\` without \`--execute\` (or \`buy --dry-run\`), show the user the
   picks, the rejections and the planned spend, and only add \`--execute\` after they confirm.
2. **Never loosen a limit to make a trade go through.** If a command fails with \`CARGO_NOT_BUYABLE\`,
   report the reason. Don't retry with a lower \`--min-score\` or a higher \`--max-price\`.
4. **PAUSED means an open breach** (for example, the cargo got too warm). Explain it with \`quote\`.
5. **An AWAITING_MFA notice** means MetaMask is waiting for the user's 2FA approval.`;

const FEES = `  private async fees(to: Address, data: Hex) {
    const tip = 2_000_000_000n; // 2 gwei
    const block = await client.getBlock();
    const base = block.baseFeePerGas ?? 100_000_000_000n;
    const out = { maxFeePerGas: base * 2n + tip, maxPriorityFeePerGas: tip };
    const est = await client.estimateGas({ account: this.from, to, data });
    out.gas = (est * 125n) / 100n;   // Monad charges the gas limit: keep it tight
    return out;
  }`;

const SkillScene: React.FC<{ s: Scene }> = ({ s }) => {
  const f = useCurrentFrame();
  const t2 = cueAt(s, 1);
  return (
    <Paper>
      <CoBrand sponsor="MetaMask Agent Wallet" />
      <Lower step={step(10)} title={f < t2 - 4 ? "skills/cargo-notes/SKILL.md" : "Agent Wallet, working on Monad Testnet"} sub={f < t2 - 4 ? "how any agent should use the plugin" : "MetaMask's fee service rejects 10143: the plugin brings its own gas and fees"} />
      {f < t2 - 4 ? (
        <CodeCard path="agent-wallet-plugin/skills/cargo-notes/SKILL.md" code={SKILL} lang="md" at={6} fontSize={22} marks={[{ from: 3, to: 4, at: 40 }, { from: 5, to: 6, at: 100 }]} />
      ) : (
        <>
          <CodeCard path="agent-wallet-plugin/src/lib/host.ts" code={FEES} at={t2 - 2} firstLine={235} fontSize={23} marks={[{ from: 239, to: 239, at: t2 + 40 }, { from: 241, to: 241, at: t2 + 70 }]} />
          <div style={{ position: "absolute", left: 160, top: 690, display: "flex", gap: 20 }}>
            {["sends gas + maxFeePerGas + maxPriorityFeePerGas", "postinstall links the host SDK", "customEvmChains RPC for 10143"].map((t, i) => (
              <span key={t} style={{ opacity: fadeIn(f, t2 + 90 + i * 12) }}>
                <Chip text={t} tone={i === 0 ? "lime" : "white"} size={22} />
              </span>
            ))}
          </div>
        </>
      )}
    </Paper>
  );
};

const OutroScene: React.FC<{ s: Scene }> = () => (
  <EndCard
    sponsor="MetaMask Agent Wallet"
    line={<>Evidence-aware credit, <span style={{ color: P.signal }}>traded by agents</span>, on Monad</>}
    links={["cargoflow-monad.vercel.app/notes", "github.com/LSUDOKO/CargoFlow-Monad · agent-wallet-plugin", "skills/cargo-notes/SKILL.md"]}
  />
);

export const MM_FRAMES = plan.totalFrames;
export const MetaMaskFilm: React.FC<{ captions?: boolean }> = ({ captions = true }) => (
  <SponsorFilm
    plan={plan}
    words={words}
    vo="audio/sp-mm-vo.wav"
    captions={captions}
    scenes={{ intro: IntroScene, install: InstallScene, list: ListScene, quote: QuoteScene, refuse: RefuseScene, scan: ScanScene, buy: BuyScene, chain: ChainScene, holder: HolderScene, safety: SafetyScene, skill: SkillScene, outro: OutroScene }}
  />
);
