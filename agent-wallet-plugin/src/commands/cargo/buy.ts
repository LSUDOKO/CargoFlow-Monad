import { type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { readNote } from "../../lib/chain.js";
import { MARKET } from "../../lib/constants.js";
import { activeAddress, idInput, intInput, type NoteView, noteView, readClient, refusal, Submitter, type TxRecord, usdcInput } from "../../lib/host.js";
import { evaluateBuy, formatUsdc } from "../../lib/rules.js";

const inputs = {
  shipmentId: { type: InputFieldType.Text, flag: "shipment-id", message: "Shipment id of the cargo note to buy", required: true, index: 0 },
  maxPrice: { type: InputFieldType.Text, flag: "max-price", message: "Most you will pay for the note, in USDC (e.g. 3.01)", required: true, prompt: true },
  minScore: { type: InputFieldType.Text, flag: "min-score", message: "Minimum evidence score 0-100 (default 75)", required: false, prompt: false },
  maxPremiumToMarkBps: {
    type: InputFieldType.Text,
    flag: "max-premium-to-mark-bps",
    message: "Largest premium of the ask over the evidence mark, in bps (default 0: never pay above mark)",
    required: false,
    prompt: false,
  },
  dryRun: { type: InputFieldType.Boolean, flag: "dry-run", message: "Check every rule and show the plan without submitting", required: false, prompt: false, default: false },
} satisfies InputSchema;

export type BuyResult = {
  action: "buy";
  dryRun: boolean;
  note: NoteView;
  priceUsdc: string;
  upsideBps: number | null;
  askVsMarkBps: number | null;
  limits: { maxPriceUsdc: string; minScore: number; maxPremiumToMarkBps: number };
  buyer: string | null;
  transactions: TxRecord[];
};

export default class CargoBuy extends PluginCommand<BuyResult> {
  static override description =
    "Buy a cargo note at its ask, only if the shipment is healthy (FINANCED/ACTIVE/DELIVERED), its evidence score clears --min-score, and the ask is within --max-price and the evidence mark.";

  static override examples = [
    "<%= config.bin %> cargo buy 0xb508…39ff --max-price 3.01 --dry-run",
    "<%= config.bin %> cargo buy 0xb508…39ff --max-price 3.01 --min-score 90 --json",
  ];

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:buy";

  async execute(io: CommandIO): Promise<BuyResult> {
    const raw = await io.resolveInputs(inputs);
    const id = idInput(raw.shipmentId);
    const maxPrice = usdcInput(raw.maxPrice, "max-price");
    const minScore = intInput(raw.minScore, "min-score", 75, 0, 100);
    const maxPremiumToMarkBps = intInput(raw.maxPremiumToMarkBps, "max-premium-to-mark-bps", 0, -10_000, 10_000);

    const buyer = activeAddress(this.ctx);
    const { client } = await readClient(this.ctx, true);
    io.progress("Reading the note and its evidence from Monad testnet…");
    const note = await readNote(client, id);
    io.progress();

    const d = evaluateBuy(note, { maxPrice, minScore, maxPremiumToMarkBps, buyer });
    if (!d.ok || d.price === null) throw refusal("buy this note", d.rejections);

    const result: BuyResult = {
      action: "buy",
      dryRun: raw.dryRun === true,
      note: noteView(note),
      priceUsdc: formatUsdc(d.price),
      upsideBps: d.upsideBps,
      askVsMarkBps: d.premiumToMarkBps,
      limits: { maxPriceUsdc: formatUsdc(maxPrice), minScore, maxPremiumToMarkBps },
      buyer: buyer ?? null,
      transactions: [],
    };
    if (result.dryRun) return result;

    const tx = await Submitter.create(this.ctx, io, this.pluginCommandId);
    await tx.ensureAllowance(client, buyer, d.price, `buying note ${note.ref ?? id}`);
    // maxPrice = the ask we just checked, so a seller raising the ask in between makes the buy revert.
    await tx.send("buy", MARKET, tx.buyData(id, d.price), `Buy cargo note ${note.ref ?? id.slice(0, 10)} for ${formatUsdc(d.price)} USDC`, {
      shipment: id,
      price: `${formatUsdc(d.price)} USDC`,
      claimAtSettlement: `${formatUsdc(note.claim)} USDC`,
      evidenceScore: String(note.score),
      mark: `${formatUsdc(note.mark)} USDC`,
    });
    result.transactions = tx.txs;
    return result;
  }

  override successHint(r: BuyResult): string {
    const head = `${r.dryRun ? "Would buy" : "Bought"} ${r.note.ref ?? r.note.shipmentId} for ${r.priceUsdc} USDC (claim ${r.note.claimUsdc}, mark ${r.note.markUsdc}, evidence ${r.note.evidenceScore}, upside ${r.upsideBps} bps).`;
    return [head, ...r.transactions.map((t) => `  ${t.step}: ${t.explorerUrl ?? t.status}`)].join("\n");
  }
}
