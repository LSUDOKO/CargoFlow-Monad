import type { EvmOnEventContext } from "envio";

export const STATUS = ["NONE", "CREATED", "FINANCED", "ACTIVE", "PAUSED", "DISPUTED", "DELIVERED", "SETTLED", "DEFAULTED", "CANCELLED"];

type Ctx = EvmOnEventContext;

/** The note for a shipment, created on first sight with neutral defaults. */
export async function loadNote(context: Ctx, id: string, timestamp: number) {
  const existing = await context.Note.get(id);
  return (
    existing ?? {
      id,
      status: "FINANCED",
      holder: "",
      lastScore: 100,
      epochs: 0,
      trades: 0,
      volume: 0n,
      lastTradePrice: undefined,
      askPrice: undefined,
      askSeller: undefined,
      updatedAt: timestamp,
    }
  );
}

export async function loadStats(context: Ctx) {
  return (await context.MarketStats.get("global")) ?? { id: "global", trades: 0, volume: 0n, asks: 0, bids: 0 };
}

/** One row per order-book action, keyed by the log so a re-run never duplicates it. */
export function orderEvent(
  context: Ctx,
  e: { chainId: number; logIndex: number; block: { number: number; timestamp: number }; transaction: { hash: string } },
  note: string,
  kind: string,
  account: string,
  price?: bigint,
  mark?: bigint,
) {
  context.OrderEvent.set({
    id: `${e.chainId}_${e.block.number}_${e.logIndex}`,
    note_id: note,
    kind,
    account,
    price,
    mark,
    blockNumber: e.block.number,
    timestamp: e.block.timestamp,
    txHash: e.transaction.hash,
  });
}
