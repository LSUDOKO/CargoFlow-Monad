import { describe, expect, it } from "vitest";
import {
  evaluateBid,
  evaluateBuy,
  explainMark,
  formatUsdc,
  type NoteState,
  normalizeShipmentId,
  parseUsdc,
  planScan,
  premiumToMarkBps,
  upsideBps,
} from "../src/lib/rules.js";

const SELLER = "0x2198AB4E7755510A6A94EE298cf70f44e0f86414";
const ME = "0x00000000000000000000000000000000000000aa";

function note(over: Partial<NoteState> = {}): NoteState {
  // Mirrors the live note CF-LIVE-1791912900798 on Monad testnet.
  return {
    shipmentId: "0x" + "b5".repeat(32),
    ref: "CF-LIVE-1",
    status: "ACTIVE",
    score: 100,
    claim: 3_036_000n,
    mark: 3_036_000n,
    ask: { seller: SELLER, price: 3_005_640n },
    bestBid: { bidder: ME, price: 2_944_920n },
    financier: SELLER,
    ...over,
  };
}

const rules = { maxPrice: parseUsdc("3.01"), minScore: 75, maxPremiumToMarkBps: 0 };

describe("amounts", () => {
  it("parses and formats USDC", () => {
    expect(parseUsdc("3")).toBe(3_000_000n);
    expect(parseUsdc("2.95")).toBe(2_950_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(formatUsdc(3_005_640n)).toBe("3.00564");
    expect(formatUsdc(3_000_000n)).toBe("3");
    expect(() => parseUsdc("-1")).toThrow();
    expect(() => parseUsdc("1.0000001")).toThrow();
    expect(() => parseUsdc("abc")).toThrow();
  });
  it("normalizes shipment ids", () => {
    expect(normalizeShipmentId("0x" + "AB".repeat(32))).toBe("0x" + "ab".repeat(32));
    expect(() => normalizeShipmentId("0x1234")).toThrow();
  });
  it("computes upside and premium in bps", () => {
    expect(upsideBps(3_036_000n, 3_005_640n)).toBe(101);
    expect(premiumToMarkBps(3_005_640n, 3_036_000n)).toBe(-100);
    expect(upsideBps(1n, 0n)).toBeNull();
    expect(premiumToMarkBps(1n, 0n)).toBeNull();
  });
});

describe("explainMark (mirrors CargoNoteMarket.markPrice)", () => {
  const base = { committed: 3_000_000n, drawn: 1_200_000n, feeBps: 300, funded: true, closed: false };
  it("marks undrawn at par and haircuts the drawn leg 0.5% per point", () => {
    const m = explainMark({ ...base, status: "ACTIVE", score: 80 });
    // drawn leg = 1.2 + 0.036 = 1.236; x 0.90 = 1.1124; + undrawn 1.8 = 2.9124
    expect(m.claim).toBe(3_036_000n);
    expect(m.undrawn).toBe(1_800_000n);
    expect(m.factorBps).toBe(9_000n);
    expect(m.mark).toBe(2_912_400n);
  });
  it("applies the 70% pause factor", () => {
    const m = explainMark({ ...base, status: "PAUSED", score: 80 });
    expect(m.factorBps).toBe(6_300n);
    expect(m.mark).toBe(1_800_000n + (1_236_000n * 6_300n) / 10_000n);
  });
  it("marks delivered notes at par and untradeable ones at zero", () => {
    expect(explainMark({ ...base, status: "DELIVERED", score: 10 }).mark).toBe(3_036_000n);
    expect(explainMark({ ...base, status: "SETTLED", score: 100 }).mark).toBe(0n);
    expect(explainMark({ ...base, status: "ACTIVE", score: 100, closed: true }).mark).toBe(0n);
  });
});

describe("evaluateBuy", () => {
  it("accepts a healthy note below mark and max price", () => {
    const d = evaluateBuy(note(), rules);
    expect(d.ok).toBe(true);
    expect(d.price).toBe(3_005_640n);
    expect(d.upsideBps).toBe(101);
  });
  it("refuses paused, disputed and defaulted notes", () => {
    for (const status of ["PAUSED", "DISPUTED", "DEFAULTED", "SETTLED"] as const) {
      const d = evaluateBuy(note({ status }), rules);
      expect(d.ok).toBe(false);
      expect(d.rejections[0].code).toBe("CARGO_NOT_BUYABLE");
    }
  });
  it("refuses a low evidence score", () => {
    const d = evaluateBuy(note({ score: 70 }), rules);
    expect(d.rejections.map((r) => r.code)).toContain("CARGO_SCORE_TOO_LOW");
  });
  it("refuses an ask above max price", () => {
    const d = evaluateBuy(note(), { ...rules, maxPrice: parseUsdc("3") });
    expect(d.rejections.map((r) => r.code)).toEqual(["CARGO_ASK_ABOVE_MAX"]);
  });
  it("refuses an ask above mark unless a premium is allowed", () => {
    const n = note({ mark: 2_900_000n });
    expect(evaluateBuy(n, rules).rejections.map((r) => r.code)).toEqual(["CARGO_ASK_ABOVE_MARK"]);
    expect(evaluateBuy(n, { ...rules, maxPremiumToMarkBps: 400 }).ok).toBe(true);
  });
  it("refuses no ask, stale asks and buying your own note", () => {
    expect(evaluateBuy(note({ ask: null }), rules).rejections[0].code).toBe("CARGO_NO_ASK");
    expect(evaluateBuy(note({ financier: ME }), rules).rejections.map((r) => r.code)).toContain("CARGO_STALE_ASK");
    expect(evaluateBuy(note(), { ...rules, buyer: SELLER.toLowerCase() }).rejections.map((r) => r.code)).toContain("CARGO_OWN_NOTE");
  });
  it("enforces a minimum upside when given", () => {
    expect(evaluateBuy(note(), { ...rules, minUpsideBps: 150 }).rejections[0].code).toBe("CARGO_UPSIDE_TOO_LOW");
    expect(evaluateBuy(note(), { ...rules, minUpsideBps: 100 }).ok).toBe(true);
  });
});

describe("evaluateBid", () => {
  it("accepts a sane bid and refuses bids above claim or on weak notes", () => {
    expect(evaluateBid(note(), { price: parseUsdc("2.95"), minScore: 90 }).ok).toBe(true);
    expect(evaluateBid(note(), { price: parseUsdc("3.1"), minScore: 90 }).rejections[0].code).toBe("CARGO_BID_ABOVE_CLAIM");
    expect(evaluateBid(note({ score: 60 }), { price: parseUsdc("2"), minScore: 90 }).rejections[0].code).toBe("CARGO_SCORE_TOO_LOW");
    expect(evaluateBid(note({ status: "PAUSED" }), { price: parseUsdc("2"), minScore: 0 }).ok).toBe(false);
    expect(evaluateBid(note(), { price: 0n, minScore: 0 }).rejections[0].code).toBe("CARGO_ZERO_PRICE");
  });
});

describe("planScan", () => {
  const scanRules = { budget: parseUsdc("10"), minScore: 90, minUpsideBps: 50, maxPremiumToMarkBps: 0 };
  const a = note({ shipmentId: "0x" + "0a".repeat(32), ref: "A" }); // 101 bps
  const b = note({ shipmentId: "0x" + "0b".repeat(32), ref: "B", ask: { seller: SELLER, price: 2_900_000n }, mark: 3_000_000n }); // 468 bps
  const c = note({ shipmentId: "0x" + "0c".repeat(32), ref: "C", score: 85 }); // low score
  const d = note({ shipmentId: "0x" + "0d".repeat(32), ref: "D", status: "PAUSED" }); // paused
  const e = note({ shipmentId: "0x" + "0e".repeat(32), ref: "E", ask: { seller: SELLER, price: 3_030_000n } }); // 19 bps

  it("selects passing notes best upside first and explains rejections", () => {
    const plan = planScan([a, b, c, d, e], scanRules);
    expect(plan.selected.map((s) => s.note.ref)).toEqual(["B", "A"]);
    expect(plan.spend).toBe(2_900_000n + 3_005_640n);
    expect(plan.rejected.map((r) => r.note.ref).sort()).toEqual(["C", "D", "E"]);
    const reasons = Object.fromEntries(plan.rejected.map((r) => [r.note.ref, r.rejections.map((x) => x.code)]));
    expect(reasons.C).toContain("CARGO_SCORE_TOO_LOW");
    expect(reasons.D).toContain("CARGO_NOT_BUYABLE");
    expect(reasons.E).toContain("CARGO_UPSIDE_TOO_LOW");
  });
  it("never exceeds the budget", () => {
    const plan = planScan([a, b], { ...scanRules, budget: parseUsdc("3") });
    expect(plan.selected.map((s) => s.note.ref)).toEqual(["B"]);
    expect(plan.overBudget).toHaveLength(0); // A's ask (3.00564) is above the 3 USDC budget, so it is rejected outright
    expect(plan.rejected.map((r) => r.note.ref)).toEqual(["A"]);
    const plan2 = planScan([a, b], { ...scanRules, budget: parseUsdc("5") });
    expect(plan2.selected.map((s) => s.note.ref)).toEqual(["B"]);
    expect(plan2.overBudget.map((s) => s.note.ref)).toEqual(["A"]);
    expect(plan2.remaining).toBe(parseUsdc("5") - 2_900_000n);
  });
  it("returns an empty plan when nothing qualifies", () => {
    const plan = planScan([c, d], scanRules);
    expect(plan.selected).toHaveLength(0);
    expect(plan.spend).toBe(0n);
  });
});
