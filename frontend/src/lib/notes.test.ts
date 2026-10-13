import { describe, expect, it } from "vitest";
import { bpsLabel, explainMark, isTradeable, parseUsdc, upsideBps, vsMarkBps } from "./notes";

describe("notes", () => {
  it("parses typed USDC amounts", () => {
    expect(parseUsdc("39,000.5")).toBe(39_000_500_000n);
    expect(parseUsdc("0")).toBeUndefined();
    expect(parseUsdc("1.1234567")).toBeUndefined();
    expect(parseUsdc("abc")).toBeUndefined();
  });

  it("knows which states trade", () => {
    expect(isTradeable("active")).toBe(true);
    expect(isTradeable("DISPUTED")).toBe(false);
    expect(isTradeable(undefined)).toBe(false);
  });

  it("computes upside and distance from the mark", () => {
    expect(upsideBps(41_200n, 40_000n)).toBe(300);
    expect(upsideBps(41_200n, undefined)).toBeUndefined();
    expect(vsMarkBps(39_000n, 40_000n)).toBe(-250);
    expect(bpsLabel(-250)).toBe("−2.50%");
    expect(bpsLabel(300)).toBe("+3.00%");
  });

  it("matches the contract's mark (CargoNoteMarket.t.sol)", () => {
    const m = explainMark({ committed: 40_000_000_000n, drawn: 16_000_000_000n, feeBps: 300, score: 95, status: "ACTIVE" });
    const drawnLeg = 16_000_000_000n + (16_000_000_000n * 300n) / 10_000n;
    expect(m.mark).toBe(24_000_000_000n + (drawnLeg * 9_750n) / 10_000n);
    expect(explainMark({ committed: 10n, drawn: 0n, feeBps: 300, score: 40, status: "FINANCED" }).mark).toBe(10n);
    const paused = explainMark({ committed: 40_000n, drawn: 16_000n, feeBps: 300, score: 95, status: "PAUSED" });
    expect(paused.factorBps).toBe(6_825);
    expect(explainMark({ committed: 40_000n, drawn: 16_000n, feeBps: 300, score: 10, status: "DELIVERED" }).mark).toBe(40_480n);
  });
});
