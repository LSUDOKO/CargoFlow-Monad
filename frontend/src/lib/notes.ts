import { parseUnits } from "viem";

/** Facility states in which a Cargo Note can change hands (mirrors CargoNoteMarket._tradeable). */
export const TRADEABLE = ["FINANCED", "ACTIVE", "PAUSED", "DELIVERED"] as const;

export const isTradeable = (status: string | undefined | null) => TRADEABLE.includes((status ?? "").toUpperCase() as (typeof TRADEABLE)[number]);

/** A USDC amount typed by a person ("39,000.50"), in base units; undefined when it is not a positive amount. */
export function parseUsdc(text: string): bigint | undefined {
  const t = text.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return undefined;
  const v = parseUnits(t, 6);
  return v > 0n ? v : undefined;
}

/**
 * The return a buyer locks in by paying `price` for a note that pays `claim` at settlement, in basis points
 * (claim / price - 1). Undefined without a price.
 */
export function upsideBps(claim: bigint, price: bigint | undefined): number | undefined {
  if (!price || price <= 0n) return undefined;
  return Number(((claim - price) * 10_000n) / price);
}

/** How far `price` sits from the evidence mark, in basis points (negative: below the mark). */
export function vsMarkBps(price: bigint | undefined, mark: bigint): number | undefined {
  if (!price || mark <= 0n) return undefined;
  return Number(((price - mark) * 10_000n) / mark);
}

/** "+2.31%" style label for a basis-point figure. */
export function bpsLabel(bps: number | undefined): string {
  if (bps === undefined) return "–";
  const sign = bps > 0 ? "+" : bps < 0 ? "−" : "";
  return `${sign}${(Math.abs(bps) / 100).toFixed(2)}%`;
}

/**
 * The mark the market contract computes, reproduced off chain so the UI can explain it: undrawn escrow at par,
 * the drawn principal + fee haircut by 0.5% per score point below 100, and by a further 30% while paused.
 */
export function explainMark(input: { committed: bigint; drawn: bigint; feeBps: number; score: number; status: string }): {
  undrawn: bigint;
  drawnLeg: bigint;
  factorBps: number;
  mark: bigint;
} {
  const undrawn = input.committed - input.drawn;
  const drawnLeg = input.drawn + (input.drawn * BigInt(input.feeBps)) / 10_000n;
  const status = input.status.toUpperCase();
  if (!isTradeable(status)) return { undrawn, drawnLeg, factorBps: 0, mark: 0n };
  if (status === "DELIVERED") return { undrawn, drawnLeg, factorBps: 10_000, mark: undrawn + drawnLeg };
  let factorBps = 10_000 - (100 - Math.max(0, Math.min(100, input.score))) * 50;
  if (status === "PAUSED") factorBps = Math.floor((factorBps * 7_000) / 10_000);
  return { undrawn, drawnLeg, factorBps, mark: undrawn + (drawnLeg * BigInt(factorBps)) / 10_000n };
}
