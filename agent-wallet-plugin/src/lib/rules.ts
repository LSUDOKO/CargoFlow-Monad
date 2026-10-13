// Pure decision logic for cargo-note trading. No I/O and no mm imports, so it is unit-testable
// on its own and the agent-facing commands stay thin wrappers around it.
//
// Amounts are USDC base units (6 decimals) as bigint. Basis points are plain numbers.

export const BPS = 10_000n;
/** CargoNoteMarket.HAIRCUT_PER_POINT_BPS: haircut on the drawn leg per score point below 100. */
export const HAIRCUT_PER_POINT_BPS = 50n;
/** CargoNoteMarket.PAUSED_FACTOR_BPS: extra multiplier on the drawn leg while paused. */
export const PAUSED_FACTOR_BPS = 7_000n;

export const STATUS_NAMES = [
  "NONE",
  "CREATED",
  "FINANCED",
  "ACTIVE",
  "PAUSED",
  "DISPUTED",
  "DELIVERED",
  "SETTLED",
  "DEFAULTED",
  "CANCELLED",
] as const;
export type StatusName = (typeof STATUS_NAMES)[number];

export function statusName(status: number): StatusName {
  return STATUS_NAMES[status] ?? "NONE";
}

/** Statuses the market contract lets a note trade in. */
export const TRADEABLE: readonly StatusName[] = ["FINANCED", "ACTIVE", "PAUSED", "DELIVERED"];
/** Statuses the plugin lets an agent buy or bid in. PAUSED is tradeable on chain, but an agent never buys into a breach. */
export const BUYABLE: readonly StatusName[] = ["FINANCED", "ACTIVE", "DELIVERED"];

// ------------------------------------------------------------------ amounts

const USDC_UNIT = 1_000_000n;

/** "12.5" -> 12500000n. Throws on anything that is not a non-negative decimal with at most 6 places. */
export function parseUsdc(input: string): bigint {
  const s = String(input).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) {
    throw new Error(`'${input}' is not a USDC amount (use a number like 3 or 2.95, at most 6 decimals)`);
  }
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * USDC_UNIT + BigInt(frac.padEnd(6, "0"));
}

/** 12500000n -> "12.5" */
export function formatUsdc(amount: bigint): string {
  const neg = amount < 0n;
  const a = neg ? -amount : amount;
  const whole = a / USDC_UNIT;
  const frac = (a % USDC_UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export function parseIntStrict(input: string, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const s = String(input).trim();
  if (!/^-?\d+$/.test(s)) throw new Error(`--${name} must be an integer (got '${input}')`);
  const n = Number(s);
  if (n < min || n > max) throw new Error(`--${name} must be between ${min} and ${max} (got ${n})`);
  return n;
}

// ------------------------------------------------------------------ mark price

export type MarkInputs = {
  status: StatusName;
  committed: bigint;
  drawn: bigint;
  feeBps: number;
  score: number;
  funded: boolean;
  closed: boolean;
};

export type MarkExplanation = {
  mark: bigint;
  claim: bigint;
  undrawn: bigint;
  drawnLeg: bigint;
  /** Factor applied to the drawn leg, in bps (10000 = par). */
  factorBps: bigint;
  explanation: string[];
};

/**
 * Mirrors CargoNoteMarket.markPrice / claimValue so the plugin can say *why* the mark is what it is.
 * Undrawn capital is still in escrow and is marked at par; the drawn principal + fee is haircut by
 * 0.5% per evidence point below 100, and by a further 30% while the facility is paused.
 */
export function explainMark(m: MarkInputs): MarkExplanation {
  const lines: string[] = [];
  if (m.closed || !m.funded) {
    return { mark: 0n, claim: 0n, undrawn: 0n, drawnLeg: 0n, factorBps: 0n, explanation: ["Facility is not funded or already closed: nothing to trade."] };
  }
  const feeOnDrawn = (m.drawn * BigInt(m.feeBps)) / BPS;
  const claim = m.committed + feeOnDrawn;
  const undrawn = m.committed - m.drawn;
  const drawnLeg = m.drawn + feeOnDrawn;
  if (!TRADEABLE.includes(m.status)) {
    return { mark: 0n, claim, undrawn, drawnLeg, factorBps: 0n, explanation: [`Status ${m.status} is not tradeable, so the mark is 0.`] };
  }
  lines.push(`Claim at settlement = committed ${formatUsdc(m.committed)} + fee on drawn ${formatUsdc(feeOnDrawn)} (${m.feeBps} bps) = ${formatUsdc(claim)} USDC.`);
  lines.push(`Undrawn ${formatUsdc(undrawn)} USDC is still in escrow and is marked at par.`);
  let factor: bigint;
  if (m.status === "DELIVERED") {
    factor = BPS;
    lines.push(`Delivered: only the buyer's payment is outstanding, so the drawn leg ${formatUsdc(drawnLeg)} is marked at par.`);
  } else {
    const score = BigInt(Math.max(0, Math.min(100, m.score)));
    factor = BPS - (100n - score) * HAIRCUT_PER_POINT_BPS;
    lines.push(`Evidence score ${m.score}/100: drawn leg ${formatUsdc(drawnLeg)} x (1 - 0.5% x ${100n - score} pts) = x${bpsToPct(factor)}.`);
    if (m.status === "PAUSED") {
      factor = (factor * PAUSED_FACTOR_BPS) / BPS;
      lines.push(`Facility is PAUSED (a breach is open): drawn leg further x70% -> x${bpsToPct(factor)}.`);
    }
  }
  const mark = undrawn + (drawnLeg * factor) / BPS;
  lines.push(`Mark = ${formatUsdc(undrawn)} + ${formatUsdc((drawnLeg * factor) / BPS)} = ${formatUsdc(mark)} USDC.`);
  return { mark, claim, undrawn, drawnLeg, factorBps: factor, explanation: lines };
}

function bpsToPct(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(2)}%`;
}

// ------------------------------------------------------------------ note metrics

export type NoteState = {
  shipmentId: string;
  ref?: string;
  status: StatusName;
  score: number;
  claim: bigint;
  mark: bigint;
  ask: { seller: string; price: bigint } | null;
  bestBid: { bidder: string; price: bigint } | null;
  financier: string;
};

/** Return if the note is bought at `price` and settles: claim / price - 1, in bps. Null when price is 0. */
export function upsideBps(claim: bigint, price: bigint): number | null {
  if (price <= 0n) return null;
  return Number(((claim - price) * BPS) / price);
}

/** How far `price` sits above the mark, in bps (negative = discount to mark). Null when mark is 0. */
export function premiumToMarkBps(price: bigint, mark: bigint): number | null {
  if (mark <= 0n) return null;
  return Number(((price - mark) * BPS) / mark);
}

// ------------------------------------------------------------------ buy rules

export type BuyRules = {
  /** Never pay more than this for the note (USDC base units). */
  maxPrice: bigint;
  /** Minimum evidence score (0-100). */
  minScore: number;
  /** Maximum premium of the ask over the on-chain mark, in bps. 0 = never pay above mark. */
  maxPremiumToMarkBps: number;
  /** Optional: minimum return to claim, in bps. */
  minUpsideBps?: number;
  /** Optional: the buyer's own address, to refuse buying your own note. */
  buyer?: string;
};

export type Rejection = { code: string; message: string };

export type BuyDecision = {
  ok: boolean;
  price: bigint | null;
  upsideBps: number | null;
  premiumToMarkBps: number | null;
  rejections: Rejection[];
};

export function evaluateBuy(note: NoteState, rules: BuyRules): BuyDecision {
  const rejections: Rejection[] = [];
  const price = note.ask?.price ?? null;
  const up = price === null ? null : upsideBps(note.claim, price);
  const prem = price === null ? null : premiumToMarkBps(price, note.mark);

  if (!BUYABLE.includes(note.status)) {
    rejections.push({ code: "CARGO_NOT_BUYABLE", message: `Status is ${note.status}; agents only buy FINANCED, ACTIVE or DELIVERED notes.` });
  }
  if (note.score < rules.minScore) {
    rejections.push({ code: "CARGO_SCORE_TOO_LOW", message: `Evidence score ${note.score} is below the minimum ${rules.minScore}.` });
  }
  if (!note.ask || price === null) {
    rejections.push({ code: "CARGO_NO_ASK", message: "Nobody is offering this note (no ask)." });
  } else {
    if (note.ask.seller.toLowerCase() !== note.financier.toLowerCase()) {
      rejections.push({ code: "CARGO_STALE_ASK", message: "The ask was placed by a previous holder and can no longer fill." });
    }
    if (rules.buyer && note.ask.seller.toLowerCase() === rules.buyer.toLowerCase()) {
      rejections.push({ code: "CARGO_OWN_NOTE", message: "This wallet already holds the note." });
    }
    if (price > rules.maxPrice) {
      rejections.push({ code: "CARGO_ASK_ABOVE_MAX", message: `Ask ${formatUsdc(price)} USDC is above your max price ${formatUsdc(rules.maxPrice)} USDC.` });
    }
    if (note.mark <= 0n) {
      rejections.push({ code: "CARGO_NO_MARK", message: "The note has no on-chain mark (not tradeable)." });
    } else if (prem !== null && prem > rules.maxPremiumToMarkBps) {
      rejections.push({
        code: "CARGO_ASK_ABOVE_MARK",
        message: `Ask is ${prem} bps above the evidence mark ${formatUsdc(note.mark)} USDC; allowed premium is ${rules.maxPremiumToMarkBps} bps.`,
      });
    }
    if (price > note.claim) {
      rejections.push({ code: "CARGO_ASK_ABOVE_CLAIM", message: `Ask ${formatUsdc(price)} is above what the note pays at settlement (${formatUsdc(note.claim)}).` });
    }
    if (rules.minUpsideBps !== undefined && (up === null || up < rules.minUpsideBps)) {
      rejections.push({ code: "CARGO_UPSIDE_TOO_LOW", message: `Upside ${up ?? 0} bps to claim is below the minimum ${rules.minUpsideBps} bps.` });
    }
  }
  return { ok: rejections.length === 0, price, upsideBps: up, premiumToMarkBps: prem, rejections };
}

// ------------------------------------------------------------------ bid rules

export type BidRules = { price: bigint; minScore: number };

export function evaluateBid(note: NoteState, rules: BidRules): { ok: boolean; upsideBps: number | null; rejections: Rejection[] } {
  const rejections: Rejection[] = [];
  if (rules.price <= 0n) rejections.push({ code: "CARGO_ZERO_PRICE", message: "Bid price must be above 0." });
  if (!BUYABLE.includes(note.status)) {
    rejections.push({ code: "CARGO_NOT_BUYABLE", message: `Status is ${note.status}; agents only bid on FINANCED, ACTIVE or DELIVERED notes.` });
  }
  if (note.score < rules.minScore) {
    rejections.push({ code: "CARGO_SCORE_TOO_LOW", message: `Evidence score ${note.score} is below the minimum ${rules.minScore}.` });
  }
  if (note.claim > 0n && rules.price > note.claim) {
    rejections.push({ code: "CARGO_BID_ABOVE_CLAIM", message: `Bid ${formatUsdc(rules.price)} is above what the note pays at settlement (${formatUsdc(note.claim)}).` });
  }
  return { ok: rejections.length === 0, upsideBps: upsideBps(note.claim, rules.price), rejections };
}

// ------------------------------------------------------------------ scan

export type ScanRules = {
  budget: bigint;
  minScore: number;
  minUpsideBps: number;
  maxPremiumToMarkBps: number;
  buyer?: string;
};

export type ScanCandidate = { note: NoteState; price: bigint; upsideBps: number; premiumToMarkBps: number | null };

export type ScanPlan = {
  /** Notes to buy, best upside first, whose asks fit in the budget together. */
  selected: ScanCandidate[];
  /** Notes that pass every rule but did not fit in the remaining budget. */
  overBudget: ScanCandidate[];
  rejected: { note: NoteState; rejections: Rejection[] }[];
  spend: bigint;
  remaining: bigint;
};

/**
 * The agent superpower: filter every live note by evidence, mark and upside, then fill the budget
 * greedily by upside (ties: higher score, then cheaper ask). Each buy uses its own ask as max price.
 */
export function planScan(notes: NoteState[], rules: ScanRules): ScanPlan {
  const passing: ScanCandidate[] = [];
  const rejected: ScanPlan["rejected"] = [];
  for (const note of notes) {
    const d = evaluateBuy(note, {
      maxPrice: rules.budget,
      minScore: rules.minScore,
      maxPremiumToMarkBps: rules.maxPremiumToMarkBps,
      minUpsideBps: rules.minUpsideBps,
      buyer: rules.buyer,
    });
    if (d.ok && d.price !== null && d.upsideBps !== null) {
      passing.push({ note, price: d.price, upsideBps: d.upsideBps, premiumToMarkBps: d.premiumToMarkBps });
    } else {
      rejected.push({ note, rejections: d.rejections });
    }
  }
  passing.sort((a, b) => b.upsideBps - a.upsideBps || b.note.score - a.note.score || (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
  const selected: ScanCandidate[] = [];
  const overBudget: ScanCandidate[] = [];
  let remaining = rules.budget;
  for (const c of passing) {
    if (c.price <= remaining) {
      selected.push(c);
      remaining -= c.price;
    } else {
      overBudget.push(c);
    }
  }
  return { selected, overBudget, rejected, spend: rules.budget - remaining, remaining };
}

// ------------------------------------------------------------------ ids

export function normalizeShipmentId(input: string): `0x${string}` {
  const s = String(input).trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(s)) {
    throw new Error(`'${input}' is not a shipment id (expected 0x + 64 hex characters)`);
  }
  return s as `0x${string}`;
}

export function shortId(id: string): string {
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}
