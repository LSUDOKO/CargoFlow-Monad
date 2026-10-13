import { type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData } from "viem";
import { marketAbi } from "../../lib/abi.js";
import { myBid, readNote } from "../../lib/chain.js";
import { MARKET } from "../../lib/constants.js";
import { activeAddress, idInput, intInput, type NoteView, noteView, readClient, refusal, Submitter, type TxRecord, usdcInput } from "../../lib/host.js";
import { evaluateBid, formatUsdc } from "../../lib/rules.js";

const inputs = {
  shipmentId: { type: InputFieldType.Text, flag: "shipment-id", message: "Shipment id of the cargo note to bid on", required: true, index: 0 },
  price: { type: InputFieldType.Text, flag: "price", message: "Bid in USDC, escrowed in the market until filled or cancelled", required: true, prompt: true },
  minScore: { type: InputFieldType.Text, flag: "min-score", message: "Minimum evidence score 0-100 (default 75)", required: false, prompt: false },
  dryRun: { type: InputFieldType.Boolean, flag: "dry-run", message: "Check the rules and show the plan without submitting", required: false, prompt: false, default: false },
} satisfies InputSchema;

type BidResult = {
  action: "bid";
  dryRun: boolean;
  note: NoteView;
  priceUsdc: string;
  previousBidUsdc: string | null;
  escrowDeltaUsdc: string;
  upsideBps: number | null;
  bidder: string | null;
  transactions: TxRecord[];
};

export default class CargoBid extends PluginCommand<BidResult> {
  static override description =
    "Place (or replace) an escrowed USDC bid on a cargo note; refuses unhealthy shipments, low evidence scores and bids above the note's claim.";

  static override examples = ["<%= config.bin %> cargo bid 0xb508…39ff --price 2.95 --min-score 90"];

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:bid";

  async execute(io: CommandIO): Promise<BidResult> {
    const raw = await io.resolveInputs(inputs);
    const id = idInput(raw.shipmentId);
    const price = usdcInput(raw.price, "price");
    const minScore = intInput(raw.minScore, "min-score", 75, 0, 100);
    const bidder = activeAddress(this.ctx);
    const { client } = await readClient(this.ctx, true);
    const note = await readNote(client, id);
    const d = evaluateBid(note, { price, minScore });
    if (!d.ok) throw refusal("bid on this note", d.rejections);

    const previous = bidder ? await myBid(client, id, bidder) : 0n;
    const delta = price > previous ? price - previous : 0n;
    const result: BidResult = {
      action: "bid",
      dryRun: raw.dryRun === true,
      note: noteView(note),
      priceUsdc: formatUsdc(price),
      previousBidUsdc: previous > 0n ? formatUsdc(previous) : null,
      escrowDeltaUsdc: formatUsdc(delta),
      upsideBps: d.upsideBps,
      bidder: bidder ?? null,
      transactions: [],
    };
    if (result.dryRun) return result;

    const tx = await Submitter.create(this.ctx, io, this.pluginCommandId, bidder);
    // The market only pulls the increase over an earlier bid; without a known address approve the full price.
    if (delta > 0n || !bidder) await tx.ensureAllowance(client, bidder, bidder ? delta : price, `bidding on ${note.ref ?? id}`);
    await tx.send(
      "placeBid",
      MARKET,
      encodeFunctionData({ abi: marketAbi, functionName: "placeBid", args: [id, price] }),
      `Bid ${formatUsdc(price)} USDC for cargo note ${note.ref ?? id.slice(0, 10)}`,
      { shipment: id, price: `${formatUsdc(price)} USDC`, evidenceScore: String(note.score), claimAtSettlement: `${formatUsdc(note.claim)} USDC` },
    );
    result.transactions = tx.txs;
    return result;
  }

  override successHint(r: BidResult): string {
    return [
      `${r.dryRun ? "Would bid" : "Bid"} ${r.priceUsdc} USDC on ${r.note.ref ?? r.note.shipmentId} (claim ${r.note.claimUsdc}, mark ${r.note.markUsdc}, upside ${r.upsideBps} bps).`,
      ...r.transactions.map((t) => `  ${t.step}: ${t.explorerUrl ?? t.status}`),
    ].join("\n");
  }
}
