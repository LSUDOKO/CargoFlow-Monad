import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { Audio } from "@remotion/media";
import { P } from "../assets/palette";
import { Logo, LogoMark } from "../components/Logo";
import { F } from "../theme";

/**
 * Shared kit for the sponsor videos (MetaMask, Envio, Alchemy) and the promo: the Monad film's visual system
 * (paper / navy, lime signal, Space Grotesk / Inter / JetBrains Mono), with terminals that type real captured
 * output, code cards, a browser frame with punch-ins, and word-timed captions. Timing comes from
 * src/sponsors/plan-<v>.json (voiceover/place-sponsors.py), so every beat follows the voice-over.
 */

export type Cue = { id: string; text: string; start: number; end: number };
export type Scene = { id: string; from: number; frames: number; cues: Cue[] };
export type Plan = { fps: number; totalFrames: number; scenes: Scene[] };
export type Word = { word: string; startMs: number; endMs: number; cue: string };

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const SHADOW = "0 2px 0 rgba(11,27,43,0.06), 0 40px 80px -28px rgba(11,27,43,0.38)";
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const fadeIn = (f: number, at: number, d = 12) => interpolate(f, [at, at + d], [0, 1], { ...clamp, easing: ease });
export const fadeOut = (f: number, at: number, d = 10) => interpolate(f, [at, at + d], [1, 0], { ...clamp, easing: ease });
export const rise = (f: number, at: number, d = 16, px = 24) => (1 - fadeIn(f, at, d)) * px;
/** Scene-relative frame of cue i's start (clamped to the last cue). */
export const cueAt = (s: Scene, i: number) => (s.cues[Math.min(i, s.cues.length - 1)]?.start ?? s.from) - s.from;
export const cueEnd = (s: Scene, i: number) => (s.cues[Math.min(i, s.cues.length - 1)]?.end ?? s.from) - s.from;

// ---------------------------------------------------------------- surfaces

export const Paper: React.FC<{ children?: React.ReactNode; tone?: "paper" | "navy" }> = ({ children, tone = "paper" }) => (
  <AbsoluteFill
    style={{
      backgroundColor: tone === "navy" ? P.ink : P.paper,
      backgroundImage: tone === "navy" ? `linear-gradient(135deg, ${P.ink} 0%, ${P.ink2} 100%)` : "radial-gradient(rgba(11,27,43,0.05) 1.4px, transparent 1.4px)",
      backgroundSize: tone === "navy" ? "100% 100%" : "24px 24px",
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Chip: React.FC<{ text: React.ReactNode; tone?: "ink" | "lime" | "green" | "amber" | "red" | "white"; size?: number; style?: React.CSSProperties }> = ({ text, tone = "ink", size = 22, style }) => {
  const bg = { ink: P.ink, lime: P.signal, green: P.verified, amber: P.alert, red: P.danger, white: P.white }[tone];
  const fg = tone === "ink" || tone === "red" ? P.white : P.ink;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, background: bg, color: fg, fontFamily: F.body, fontWeight: 700, fontSize: size, whiteSpace: "nowrap", border: tone === "white" ? `1px solid ${P.line}` : undefined, ...style }}>
      {text}
    </span>
  );
};

/** Section title in the top-left, with an optional step counter ("03 · 12"). */
export const Lower: React.FC<{ title: string; sub?: string; at?: number; step?: string; dark?: boolean }> = ({ title, sub, at = 0, step, dark }) => {
  const f = useCurrentFrame();
  const k = fadeIn(f, at, 12);
  return (
    <div style={{ position: "absolute", left: 96, top: 52, opacity: k, transform: `translateX(${(1 - k) * -24}px)`, display: "flex", alignItems: "flex-start", gap: 20 }}>
      {step ? <div style={{ marginTop: 6, fontFamily: F.mono, fontWeight: 700, fontSize: 20, color: P.ink, background: P.signal, borderRadius: 8, padding: "4px 10px" }}>{step}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 42, color: dark ? P.white : P.ink, letterSpacing: -0.8 }}>{title}</div>
        {sub ? <div style={{ fontFamily: F.mono, fontSize: 21, color: dark ? "#9FB3C4" : P.slate }}>{sub}</div> : null}
      </div>
    </div>
  );
};

/** Small co-brand tag in the top-right corner: "CargoFlow × <Sponsor>". */
export const CoBrand: React.FC<{ sponsor: string; dark?: boolean }> = ({ sponsor, dark }) => (
  <div style={{ position: "absolute", right: 72, top: 58, display: "flex", alignItems: "center", gap: 12, fontFamily: F.body, fontWeight: 700, fontSize: 22, color: dark ? P.white : P.ink, opacity: 0.85 }}>
    <LogoMark size={30} />
    <span>CargoFlow</span>
    <span style={{ color: dark ? "#9FB3C4" : P.slate }}>×</span>
    <span>{sponsor}</span>
  </div>
);

// ---------------------------------------------------------------- terminal

export type TLine = { cmd?: string; t?: string; c?: string; b?: boolean; dim?: boolean };
export const TC = { green: "#7EE787", yellow: "#F2CC60", red: "#FF7B72", blue: "#79C0FF", dim: "#8FA3B5", lime: P.signal, text: "#D7E1EA", purple: "#D2A8FF" };

/**
 * A terminal that types each command (cps characters a second), waits `think` frames, then prints the command's
 * output a few lines per frame, like a real CLI. Long sessions scroll so the latest `rows` lines stay visible.
 * `marks` highlight output lines (by index into `lines`) from frame `at`.
 */
export const Terminal: React.FC<{
  title: string;
  lines: TLine[];
  at: number;
  cps?: number;
  think?: number;
  lps?: number;
  x?: number;
  y?: number;
  width?: number;
  rows?: number;
  fontSize?: number;
  marks?: { line: number; to?: number; at: number; color?: string }[];
  scale?: number;
}> = ({ title, lines, at, cps = 34, think = 12, lps = 2, x = 160, y = 170, width = 1600, rows = 18, fontSize = 23, marks = [], scale = 1 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // schedule: when each line starts and how many chars are shown
  let t = at;
  const sched = lines.map((l) => {
    if (l.cmd !== undefined) {
      const start = t + 6;
      const dur = Math.ceil((l.cmd.length / cps) * fps);
      t = start + dur + think;
      return { start, dur };
    }
    const start = t;
    t += 1 / lps;
    return { start, dur: 0 };
  });
  const visible = sched.filter((s) => f >= s.start).length;
  const lh = fontSize * 1.5;
  const offset = Math.max(0, visible - rows) * lh;
  const k = fadeIn(f, at - 8, 10);
  const cursorOn = Math.floor(f / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, borderRadius: 20, overflow: "hidden", background: "#0D1722", boxShadow: SHADOW, opacity: k, transform: `translateY(${(1 - k) * 18}px) scale(${scale})`, transformOrigin: "50% 0" }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", background: "#16222F" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <span style={{ marginLeft: 16, fontFamily: F.mono, fontSize: 18, color: "#8FA3B5" }}>{title}</span>
      </div>
      <div style={{ position: "relative", height: rows * lh + 36, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 28, right: 28, top: 18, transform: `translateY(${-offset}px)` }}>
          {lines.map((l, i) => {
            const s = sched[i];
            if (f < s.start) return null;
            const mark = marks.find((m) => i >= m.line && i <= (m.to ?? m.line) && f >= m.at);
            const markK = mark ? fadeIn(f, mark.at, 8) : 0;
            if (l.cmd !== undefined) {
              const n = Math.floor(interpolate(f, [s.start, s.start + s.dur], [0, l.cmd.length], clamp));
              const typing = f < s.start + s.dur + 4;
              return (
                <div key={i} style={{ height: lh, display: "flex", alignItems: "center", whiteSpace: "pre", fontFamily: F.mono, fontSize, fontWeight: 700, color: TC.lime }}>
                  <span style={{ color: TC.green }}>❯ </span>
                  <span>{l.cmd.slice(0, n)}</span>
                  {typing && cursorOn ? <span style={{ display: "inline-block", width: fontSize * 0.55, height: fontSize * 1.1, background: TC.lime, marginLeft: 2 }} /> : null}
                </div>
              );
            }
            return (
              <div
                key={i}
                style={{
                  height: lh,
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "pre",
                  fontFamily: F.mono,
                  fontSize,
                  fontWeight: l.b ? 700 : 400,
                  color: l.dim ? TC.dim : (l.c ?? TC.text),
                  background: markK ? `rgba(198,244,50,${0.16 * markK})` : undefined,
                  boxShadow: markK ? `inset 4px 0 0 rgba(198,244,50,${markK})` : undefined,
                  margin: "0 -12px",
                  padding: "0 12px",
                  borderRadius: 6,
                }}
              >
                {l.t}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- code card

const KW = /\b(const|let|await|async|return|if|for|func|type|struct|import|from|export|var|nil|err|true|false|chains|contracts|events|event|name|id|start_block|address|rpc|url|for)\b/g;
/** Minimal highlighter: comments, strings, keywords. Enough for short excerpts, never for whole files. */
function hl(line: string, lang: string): React.ReactNode[] {
  const cmt = lang === "yaml" || lang === "graphql" ? "#" : "//";
  const ci = line.indexOf(cmt);
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const comment = ci >= 0 ? line.slice(ci) : "";
  const parts: React.ReactNode[] = [];
  const re = /("[^"]*"|`[^`]*`|'[^']*')/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  const pushCode = (s: string) => {
    let l2 = 0;
    let k: RegExpExecArray | null;
    KW.lastIndex = 0;
    while ((k = KW.exec(s))) {
      if (k.index > l2) parts.push(<span key={key++}>{s.slice(l2, k.index)}</span>);
      parts.push(<span key={key++} style={{ color: TC.purple }}>{k[0]}</span>);
      l2 = k.index + k[0].length;
    }
    if (l2 < s.length) parts.push(<span key={key++}>{s.slice(l2)}</span>);
  };
  while ((m = re.exec(code))) {
    if (m.index > last) pushCode(code.slice(last, m.index));
    parts.push(<span key={key++} style={{ color: TC.blue }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) pushCode(code.slice(last));
  if (comment) parts.push(<span key={key++} style={{ color: TC.dim, fontStyle: "italic" }}>{comment}</span>);
  return parts;
}

export const CodeCard: React.FC<{
  path: string;
  code: string;
  lang?: string;
  at: number;
  firstLine?: number;
  x?: number;
  y?: number;
  width?: number;
  fontSize?: number;
  marks?: { from: number; to: number; at: number }[];
  scrollTo?: { line: number; at: number; d?: number };
  rows?: number;
}> = ({ path, code, lang = "ts", at, firstLine = 1, x = 160, y = 170, width = 1600, fontSize = 22, marks = [], scrollTo, rows = 20 }) => {
  const f = useCurrentFrame();
  const lines = code.replace(/\n$/, "").split("\n");
  const lh = fontSize * 1.55;
  const k = fadeIn(f, at - 6, 12);
  const scroll = scrollTo ? interpolate(f, [scrollTo.at, scrollTo.at + (scrollTo.d ?? 40)], [0, scrollTo.line * lh], { ...clamp, easing: ease }) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, borderRadius: 20, overflow: "hidden", background: "#0D1722", boxShadow: SHADOW, opacity: k, transform: `translateY(${(1 - k) * 18}px)` }}>
      <div style={{ height: 48, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", background: "#16222F" }}>
        <span style={{ fontFamily: F.mono, fontSize: 19, color: TC.lime, fontWeight: 700 }}>{path}</span>
      </div>
      <div style={{ position: "relative", height: Math.min(rows, lines.length) * lh + 32, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 16, transform: `translateY(${-scroll}px)` }}>
          {lines.map((l, i) => {
            // only the latest mark that has started is lit, so a walk-through moves down the file
            const live = marks.filter((m) => f >= m.at).sort((a, b) => b.at - a.at)[0];
            const mark = live && i + firstLine >= live.from && i + firstLine <= live.to ? live : undefined;
            const mk = mark ? fadeIn(f, mark.at, 10) : 0;
            return (
              <div key={i} style={{ height: lh, display: "flex", alignItems: "center", whiteSpace: "pre", fontFamily: F.mono, fontSize, color: TC.text, background: mk ? `rgba(198,244,50,${0.14 * mk})` : undefined, boxShadow: mk ? `inset 5px 0 0 rgba(198,244,50,${mk})` : undefined }}>
                <span style={{ width: 70, textAlign: "right", paddingRight: 22, color: "#4C6275", flexShrink: 0 }}>{i + firstLine}</span>
                <span>{hl(l, lang)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- browser + footage

export const Browser: React.FC<{ url: string; children: React.ReactNode; at?: number; x?: number; y?: number; w?: number; h?: number }> = ({ url, children, at = 0, x = 160, y = 150, w = 1600, h = 806 }) => {
  const f = useCurrentFrame();
  const k = fadeIn(f, at, 12);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h + 56, borderRadius: 24, overflow: "hidden", background: P.white, boxShadow: SHADOW, opacity: k, transform: `translateY(${(1 - k) * 22}px)` }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", background: "#F1F3EF", borderBottom: `1px solid ${P.line}` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: "#C9D0C6" }} />
        ))}
        <span style={{ marginLeft: 18, padding: "8px 18px", borderRadius: 999, background: P.white, fontFamily: F.mono, fontSize: 20, color: P.ink2 }}>{url}</span>
      </div>
      <div style={{ position: "relative", width: w, height: h, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/**
 * A 1600x900 screenshot (captured at 1.2 dpr, so 1920x1080 px) inside the browser, with a slow push and optional
 * punch-ins: each zoom moves the camera to centre (cx, cy) in page px at `scale`.
 */
export type Ring = { x: number; y: number; w: number; h: number; at: number; label?: string; tone?: "lime" | "green" | "amber" | "red"; until?: number };
export const Shot: React.FC<{ src: string; zooms?: { at: number; cx: number; cy: number; scale: number; d?: number }[]; drift?: number; rings?: Ring[]; dur?: number }> = ({ src, zooms = [], drift = 0.03, rings = [], dur = 300 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  let cx = 800, cy = 403, s = 1 + drift * Math.min(1, f / dur);
  zooms.forEach((z) => {
    const k = interpolate(f, [z.at, z.at + (z.d ?? 22)], [0, 1], { ...clamp, easing: ease });
    cx = cx + (z.cx - cx) * k;
    cy = cy + (z.cy - cy) * k;
    s = s + (z.scale - s) * k;
  });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1600, height: 900, left: 800 - cx * s, top: 403 - cy * s, transform: `scale(${s})`, transformOrigin: "0 0" }}>
        <Img src={staticFile(`live/${src}`)} style={{ position: "absolute", inset: 0, width: 1600, height: 900 }} />
        {rings.map((r, i) => {
          if (f < r.at || (r.until !== undefined && f > r.until)) return null;
          const k = spring({ frame: f - r.at, fps, config: { damping: 15, stiffness: 120 } });
          const col = { lime: P.signal, green: P.verified, amber: P.alert, red: P.danger }[r.tone ?? "lime"];
          return (
            <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, opacity: k }}>
              <div style={{ position: "absolute", inset: -5, borderRadius: 10, border: `${4 / s}px solid ${col}`, background: `rgba(198,244,50,${0.1 * k})`, transform: `scale(${1.08 - 0.08 * k})` }} />
              {r.label ? (
                <div style={{ position: "absolute", left: 0, top: r.h + 10, transform: `scale(${1 / s})`, transformOrigin: "0 0" }}>
                  <Chip text={r.label} tone={r.tone === "green" ? "green" : r.tone === "amber" ? "amber" : r.tone === "red" ? "red" : "lime"} size={24} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** A ring + label pointing at something on screen (absolute frame coords). */
export const Callout: React.FC<{ x: number; y: number; w: number; h: number; at: number; label?: string; side?: "top" | "bottom" | "left" | "right"; tone?: "lime" | "green" | "amber" | "red" }> = ({ x, y, w, h, at, label, side = "bottom", tone = "lime" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 120 } });
  if (f < at) return null;
  const col = { lime: P.signal, green: P.verified, amber: P.alert, red: P.danger }[tone];
  const lab: React.CSSProperties =
    side === "bottom" ? { left: 0, top: h + 14 } : side === "top" ? { left: 0, bottom: h + 14 } : side === "right" ? { left: w + 16, top: 0 } : { right: w + 16, top: 0 };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: k }}>
      <div style={{ position: "absolute", inset: -6, borderRadius: 14, border: `5px solid ${col}`, transform: `scale(${1.06 - 0.06 * k})`, boxShadow: `0 0 0 9999px rgba(11,27,43,${0.18 * k})` }} />
      {label ? (
        <div style={{ position: "absolute", ...lab, whiteSpace: "nowrap" }}>
          <Chip text={label} tone={tone === "lime" ? "lime" : tone === "green" ? "green" : tone === "amber" ? "amber" : "red"} size={22} />
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- cards

export const TitleCard: React.FC<{ kicker: string; title: React.ReactNode; sub: string; sponsor: string; chips?: string[] }> = ({ kicker, title, sub, sponsor, chips = [] }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - 4, fps, config: { damping: 16 } });
  return (
    <Paper tone="navy">
      <AbsoluteFill style={{ padding: "0 140px", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: fadeIn(f, 0) }}>
          <Logo width={300} variant="dark" />
          <span style={{ fontFamily: F.display, fontSize: 40, color: "#9FB3C4" }}>×</span>
          <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 46, color: P.white }}>{sponsor}</span>
        </div>
        <div style={{ marginTop: 56, fontFamily: F.body, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: P.signal, opacity: fadeIn(f, 8) }}>{kicker.toUpperCase()}</div>
        <div style={{ marginTop: 16, fontFamily: F.display, fontWeight: 700, fontSize: 88, lineHeight: 1.04, letterSpacing: -2.4, color: P.white, maxWidth: 1500, opacity: pop, transform: `translateY(${(1 - pop) * 30}px)` }}>{title}</div>
        <div style={{ marginTop: 26, fontFamily: F.body, fontSize: 32, color: "#B9C7D3", maxWidth: 1400, opacity: fadeIn(f, 20) }}>{sub}</div>
        <div style={{ marginTop: 40, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {chips.map((c, i) => (
            <span key={c} style={{ opacity: fadeIn(f, 30 + i * 6), transform: `translateY(${rise(f, 30 + i * 6, 14, 14)}px)` }}>
              <Chip text={c} tone={i === 0 ? "lime" : "white"} size={24} />
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </Paper>
  );
};

export const EndCard: React.FC<{ line: React.ReactNode; sponsor: string; links: string[] }> = ({ line, sponsor, links }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, background: `linear-gradient(135deg, ${P.ink} 0%, ${P.ink2} 100%)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Logo width={520} variant="dark" reveal={interpolate(f, [0, 24], [0, 1], clamp)} />
        <span style={{ fontFamily: F.display, fontSize: 52, color: "#9FB3C4", opacity: fadeIn(f, 16) }}>×</span>
        <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, color: P.white, opacity: fadeIn(f, 20) }}>{sponsor}</span>
      </div>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 50, color: P.white, opacity: fadeIn(f, 22), textAlign: "center", maxWidth: 1500 }}>{line}</div>
      <div style={{ fontFamily: F.body, fontSize: 28, color: "#B9C7D3", opacity: fadeIn(f, 30) }}>Monad Metropolis · Track 01: Onchain Finance &amp; Trading</div>
      <div style={{ display: "flex", gap: 18, marginTop: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 1600 }}>
        {links.map((l, i) => (
          <span key={l} style={{ opacity: fadeIn(f, 36 + i * 5) }}>
            <Chip text={l} tone={i === 0 ? "lime" : "ink"} size={26} style={{ border: i === 0 ? undefined : "1px solid rgba(255,255,255,0.25)" }} />
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- captions

const MAX_CHARS = 92;
type Page = { words: Word[]; start: number; end: number };
const toF = (ms: number) => (ms / 1000) * 30;

export const Captions: React.FC<{ words: Word[]; size?: number; dark?: boolean }> = ({ words, size = 33 }) => {
  const frame = useCurrentFrame();
  const pages = React.useMemo(() => {
    const byCue = new Map<string, Word[]>();
    words.forEach((w) => byCue.set(w.cue, [...(byCue.get(w.cue) ?? []), w]));
    const out: Page[] = [];
    byCue.forEach((ws) => {
      let cur: Word[] = [];
      let len = 0;
      const flush = () => {
        if (cur.length) out.push({ words: cur, start: toF(cur[0].startMs), end: toF(cur[cur.length - 1].endMs) });
        cur = [];
        len = 0;
      };
      ws.forEach((w) => {
        if (len + w.word.length + 1 > MAX_CHARS) flush();
        cur.push(w);
        len += w.word.length + 1;
      });
      flush();
    });
    return out.sort((a, b) => a.start - b.start);
  }, [words]);
  const idx = pages.findIndex((p, i) => {
    const next = pages[i + 1];
    return frame >= p.start - 5 && frame < Math.min(p.end + 14, next ? next.start - 6 : Infinity);
  });
  if (idx < 0) return null;
  const page = pages[idx];
  const next = pages[idx + 1];
  const showTo = Math.min(page.end + 14, next ? next.start - 6 : Infinity);
  const k = Math.min(interpolate(frame, [page.start - 5, page.start + 1], [0, 1], clamp), interpolate(frame, [showTo - 6, showTo], [1, 0], clamp));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1240, padding: "11px 26px 12px", borderRadius: 22, background: "rgba(255,255,255,0.95)", boxShadow: "0 1px 0 rgba(11,27,43,0.06), 0 14px 32px -18px rgba(11,27,43,0.35)", border: `1px solid ${P.line}`, opacity: k, transform: `translateY(${(1 - k) * 10}px)`, fontFamily: F.body, fontWeight: 600, fontSize: size, lineHeight: 1.32, letterSpacing: -0.2, textAlign: "center", color: P.ink }}>
        {page.words.map((w, i) => {
          const s = toF(w.startMs);
          const e = toF(w.endMs);
          const active = frame >= s && frame < Math.max(e, s + 4);
          return (
            <React.Fragment key={i}>
              <span style={{ color: frame >= s ? P.ink : "rgba(11,27,43,0.38)", backgroundColor: active ? P.signal : "transparent", borderRadius: 6, padding: "0 4px", margin: "0 -4px" }}>{w.word}</span>
              {i < page.words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- film wrapper

/** Plays each scene of a plan with a short cross-fade, the VO, a ducked music bed and the captions. */
export const SponsorFilm: React.FC<{ plan: Plan; words: Word[]; vo: string; music?: number; captions?: boolean; scenes: Record<string, React.FC<{ s: Scene }>> }> = ({ plan, words, vo, music = 0.12, captions = true, scenes }) => {
  const T = 10;
  return (
    <AbsoluteFill style={{ background: P.paper }}>
      {plan.scenes.map((s, i) => {
        const Comp = scenes[s.id];
        if (!Comp) return null;
        const last = i === plan.scenes.length - 1;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames + (last ? 0 : T)} name={s.id}>
            <Fade frames={s.frames + (last ? 0 : T)} first={i === 0} tail={last ? 0 : T}>
              <Comp s={s} />
            </Fade>
          </Sequence>
        );
      })}
      {captions ? <Captions words={words} /> : null}
      <Audio src={staticFile(vo)} />
      <Audio src={staticFile("audio/music.wav")} volume={(fr) => music * interpolate(fr, [0, 30, plan.totalFrames - 75, plan.totalFrames], [0, 1, 1, 0], clamp)} />
    </AbsoluteFill>
  );
};

const Fade: React.FC<{ children: React.ReactNode; frames: number; first: boolean; tail: number }> = ({ children, frames, first, tail }) => {
  const f = useCurrentFrame();
  const kin = first ? 1 : interpolate(f, [0, 10], [0, 1], clamp);
  const kout = tail ? interpolate(f, [frames - tail, frames], [1, 0], clamp) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(kin, kout) }}>{children}</AbsoluteFill>;
};

export { OffthreadVideo, Img, staticFile, interpolate, spring, useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence };
