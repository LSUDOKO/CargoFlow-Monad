import { indexer } from "envio";
import { loadNote, loadStats, orderEvent } from "../lib/shared.js";

indexer.onEvent({ contract: "CargoNoteMarket", event: "AskPlaced" }, async ({ event, context }) => {
  const { shipmentId, seller, price, mark } = event.params;
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, askPrice: price, askSeller: seller, updatedAt: event.block.timestamp });
  const stats = await loadStats(context);
  context.MarketStats.set({ ...stats, asks: stats.asks + 1 });
  orderEvent(context, event, shipmentId, "ASK", seller, price, mark);
});

indexer.onEvent({ contract: "CargoNoteMarket", event: "AskCancelled" }, async ({ event, context }) => {
  const { shipmentId, seller } = event.params;
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, askPrice: undefined, askSeller: undefined, updatedAt: event.block.timestamp });
  orderEvent(context, event, shipmentId, "ASK_CANCELLED", seller);
});

indexer.onEvent({ contract: "CargoNoteMarket", event: "BidPlaced" }, async ({ event, context }) => {
  const { shipmentId, bidder, price, mark } = event.params;
  context.Note.set(await loadNote(context, shipmentId, event.block.timestamp));
  const stats = await loadStats(context);
  context.MarketStats.set({ ...stats, bids: stats.bids + 1 });
  orderEvent(context, event, shipmentId, "BID", bidder, price, mark);
});

indexer.onEvent({ contract: "CargoNoteMarket", event: "BidCancelled" }, async ({ event, context }) => {
  const { shipmentId, bidder, refund } = event.params;
  orderEvent(context, event, shipmentId, "BID_CANCELLED", bidder, refund);
});

indexer.onEvent({ contract: "CargoNoteMarket", event: "NoteTraded" }, async ({ event, context }) => {
  const { shipmentId, seller, buyer, price, mark, takerWasBuyer } = event.params;
  const id = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  context.Trade.set({
    id,
    note_id: shipmentId,
    seller,
    buyer,
    price,
    mark,
    takerWasBuyer,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({
    ...note,
    holder: buyer,
    trades: note.trades + 1,
    volume: note.volume + price,
    lastTradePrice: price,
    askPrice: undefined,
    askSeller: undefined,
    updatedAt: event.block.timestamp,
  });
  const stats = await loadStats(context);
  context.MarketStats.set({ ...stats, trades: stats.trades + 1, volume: stats.volume + price });
  orderEvent(context, event, shipmentId, "TRADE", buyer, price, mark);
});
