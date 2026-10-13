import { indexer } from "envio";
import { loadNote, orderEvent, STATUS } from "../lib/shared.js";

indexer.onEvent({ contract: "FinancingController", event: "StatusChanged" }, async ({ event, context }) => {
  const { shipmentId, to } = event.params;
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, status: STATUS[Number(to)] ?? String(to), updatedAt: event.block.timestamp });
});

indexer.onEvent({ contract: "FinancingController", event: "PositionTransferred" }, async ({ event, context }) => {
  const { shipmentId, from, to } = event.params;
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, holder: to, updatedAt: event.block.timestamp });
  orderEvent(context, event, shipmentId, "TRANSFER", from);
});

indexer.onEvent({ contract: "FinancingController", event: "FacilityCreated" }, async ({ event, context }) => {
  const { shipmentId, financier } = event.params;
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, status: "CREATED", holder: financier, updatedAt: event.block.timestamp });
});
