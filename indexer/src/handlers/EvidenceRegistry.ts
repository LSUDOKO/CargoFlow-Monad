import { indexer } from "envio";
import { loadNote } from "../lib/shared.js";

indexer.onEvent({ contract: "EvidenceRegistry", event: "EvidenceEpochCommitted" }, async ({ event, context }) => {
  const { shipmentId, epochId, milestoneIndex, seq, score, conflictBps, compliant } = event.params;
  context.Epoch.set({
    id: epochId,
    note_id: shipmentId,
    milestoneIndex: Number(milestoneIndex),
    seq: Number(seq),
    score: Number(score),
    conflictBps: Number(conflictBps),
    compliant,
    timestamp: event.block.timestamp,
  });
  const note = await loadNote(context, shipmentId, event.block.timestamp);
  context.Note.set({ ...note, lastScore: Number(score), epochs: note.epochs + 1, updatedAt: event.block.timestamp });
});
