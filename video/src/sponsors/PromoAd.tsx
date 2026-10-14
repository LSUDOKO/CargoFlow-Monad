import React from "react";
import { P } from "../assets/palette";
import { Logo } from "../components/Logo";
import { F } from "../theme";
import {
  AbsoluteFill, Browser, Chip, OffthreadVideo, Paper, Scene, Sequence, Shot, SponsorFilm, TC, Terminal, TLine, clamp, ease, fadeIn, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "./kit";
import plan from "./plan-pr.json";
import words from "../../public/audio/sp-pr.words.json";

/** 30-second product advertisement: hook → evidence → "Now it trades." (live app, Kuru, agent, Envio) → end card. */

const Kinetic: React.FC<{ text: string; at: number; size?: number; color?: string; y?: number; hl?: string }> = ({ text, at, size = 120, color = P.white, y = 0, hl }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ws = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.28}px`, transform: `translateY(${y}px)`, maxWidth: 1700 }}>
      {ws.map((w, i) => {
        const k = spring({ frame: f - at - i * 4, fps, config: { damping: 13, stiffness: 140 } });
        const isHl = hl && w.replace(/[.,]/g, "") === hl.replace(/[.,]/g, "");
        return (
          <span key={i} style={{ display: "inline-block", fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: -size * 0.03, color: isHl ? P.ink : color, background: isHl ? P.signal : undefined, borderRadius: size * 0.14, padding: isHl ? `0 ${size * 0.12}px` : 0, opacity: k, transform: `translateY(${(1 - k) * 40}px) scale(${0.9 + 0.1 * k})` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

const Clip: React.FC<{ src: string; from?: number; rate?: number; dim?: number }> = ({ src, from = 0, rate = 1, dim = 0.55 }) => (
  <AbsoluteFill>
    <OffthreadVideo src={staticFile(src)} startFrom={from} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
    <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(11,27,43,${dim * 0.6}) 0%, rgba(11,27,43,${dim}) 100%)` }} />
  </AbsoluteFill>
);

const HookScene: React.FC<{ s: Scene }> = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Clip src="clips/S00.mp4" from={0} rate={1.1} dim={0.5} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Kinetic text="Your loan is stuck at sea." at={18} size={128} hl="sea" />
        <div style={{ marginTop: 40, display: "flex", gap: 20, opacity: fadeIn(f, 70) }}>
          <Chip text="52 days to get paid" tone="white" size={30} />
          <Chip text="lenders see paperwork, not the cargo" tone="white" size={30} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EvidenceScene: React.FC<{ s: Scene }> = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Clip src="clips/S05b.mp4" from={90} rate={1.6} dim={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 150 }}>
        <Kinetic text="Until the cargo speaks for itself." at={30} size={96} hl="cargo" />
        <div style={{ marginTop: 34, display: "flex", gap: 18, opacity: fadeIn(f, 80) }}>
          <Chip text="signed sensor readings" tone="lime" size={28} />
          <Chip text="evidence score on Monad" tone="white" size={28} />
          <Chip text="money moves milestone by milestone" tone="white" size={28} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BUY: TLine[] = [
  { cmd: "mm cargo buy 0xb508ee58…39ff --max-price 3.01" },
  { t: "⚠ [AWAITING_MFA] Approval required: check the email registered to your dashboard", c: TC.yellow },
  { t: "Buy cargo note 0xb508ee58 for 3.00564 USDC: BROADCASTED (0x55a0bf98…357c)", c: TC.green, b: true },
];

const TradesScene: React.FC<{ s: Scene }> = () => {
  const f = useCurrentFrame();
  const cuts = [0, 52, 112, 172, 232]; // "Now it trades." then four 2-second cuts
  const idx = cuts.reduce((a, c, i) => (f >= c ? i : a), 0);
  const tag = (t: string, at: number) => (
    <div style={{ position: "absolute", left: 96, top: 60, opacity: fadeIn(f, at, 8) }}>
      <Chip text={t} tone="lime" size={34} />
    </div>
  );
  return (
    <Paper tone={idx === 0 ? "navy" : "paper"}>
      {idx === 0 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Kinetic text="Now it trades." at={6} size={170} hl="trades." />
        </AbsoluteFill>
      ) : null}
      {idx === 1 ? (
        <Sequence from={cuts[1]} layout="none">
          <Browser url="cargoflow-monad.vercel.app/notes" at={0}>
            <Shot src="notes-top.png" zooms={[{ at: 4, cx: 600, cy: 650, scale: 1.4, d: 40 }]} />
          </Browser>
          {tag("Cargo Notes · priced live by evidence", 2)}
        </Sequence>
      ) : null}
      {idx === 2 ? (
        <Sequence from={cuts[2]} layout="none">
          <Browser url="cargoflow-monad.vercel.app/notes · Kuru" at={0}>
            <Shot src="notes-kuru.png" zooms={[{ at: 4, cx: 800, cy: 230, scale: 1.45, d: 40 }]} />
          </Browser>
          {tag("listed on Kuru's order book", 2)}
        </Sequence>
      ) : null}
      {idx === 3 ? (
        <Sequence from={cuts[3]} layout="none">
          <Terminal title="MetaMask Agent Wallet · mm cargo" lines={BUY} at={-40} cps={90} rows={4} y={330} fontSize={24} />
          {tag("bought by an AI agent, owner-approved", 2)}
        </Sequence>
      ) : null}
      {idx === 4 ? (
        <Sequence from={cuts[4]} layout="none">
          <Browser url="cargoflow-monad.vercel.app/notes · Market activity" at={0}>
            <Shot src="notes-activity.png" zooms={[{ at: 4, cx: 700, cy: 300, scale: 1.3, d: 40 }]} />
          </Browser>
          {tag("indexed live by Envio", 2)}
        </Sequence>
      ) : null}
    </Paper>
  );
};

const EndScene: React.FC<{ s: Scene }> = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34, background: `linear-gradient(135deg, ${P.ink} 0%, ${P.ink2} 100%)` }}>
      <Logo width={720} variant="dark" reveal={interpolate(f, [0, 22], [0, 1], { ...clamp, easing: ease })} />
      <Kinetic text="Cargo Notes. CargoFlow, on Monad." at={14} size={78} hl="Monad." />
      <div style={{ opacity: fadeIn(f, 50) }}>
        <Chip text="cargoflow-monad.vercel.app" tone="lime" size={40} />
      </div>
    </AbsoluteFill>
  );
};

export const PR_FRAMES = plan.totalFrames;
export const PromoAd: React.FC = () => (
  <SponsorFilm plan={plan} words={words} vo="audio/sp-pr-vo.wav" captions={false} music={0.32} scenes={{ hook: HookScene, evidence: EvidenceScene, trades: TradesScene, end: EndScene }} />
);
