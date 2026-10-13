import { CommandError, type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { type NoteSnapshot, readNote } from "../../lib/chain.js";
import { MARKET } from "../../lib/constants.js";
import { activeAddress, discoverNotes, intInput, type NoteView, noteView, readClient, Submitter, type TxRecord, usdcInput } from "../../lib/host.js";
import { evaluateBuy, formatUsdc, planScan } from "../../lib/rules.js";

const inputs = {
  budget: { type: InputFieldType.Text, flag: "budget", message: "Total USDC the scan may spend", required: true, prompt: true },
  minScore: { type: InputFieldType.Text, flag: "min-score", message: "Minimum evidence score 0-100 (default 90)", required: false, prompt: false },
  minUpsideBps: { type: InputFieldType.Text, flag: "min-upside-bps", message: "Minimum return to claim at the ask, in bps (default 50)", required: false, prompt: false },
  maxPremiumToMarkBps: {
    type: InputFieldType.Text,
    flag: "max-premium-to-mark-bps",
    message: "Largest premium of an ask over its evidence mark, in bps (default 0)",
    required: false,
    prompt: false,
  },
  ids: { type: InputFieldType.Text, flag: "ids", message: "Comma-separated shipment ids to scan instead of asking the API", required: false, prompt: false },
  execute: { type: InputFieldType.Boolean, flag: "execute", message: "Buy the selected notes (default: dry run)", required: false, prompt: false, default: false },
} satisfies InputSchema;

type Pick = NoteView & { priceUsdc: string; upsideBps: number };
type ScanResult = {
  action: "scan";
  executed: boolean;
  rules: { budgetUsdc: string; minScore: number; minUpsideBps: number; maxPremiumToMarkBps: number };
  scanned: number;
  selected: Pick[];
  overBudget: Pick[];
  rejected: { shipmentId: string; ref: string | null; status: string; reasons: string[] }[];
  plannedSpendUsdc: string;
  bought: { shipmentId: string; priceUsdc: string; transactions: TxRecord[] }[];
  skipped: { shipmentId: string; reason: string }[];
  readErrors: { shipmentId: string; error: string }[];
};

export default class CargoScan extends PluginCommand<ScanResult> {
  static override description =
    "Scan every live cargo note, keep the ones whose sensor evidence, mark and upside clear your rules, and fill a USDC budget best-upside first. Dry run unless --execute.";

  static override examples = [
    "<%= config.bin %> cargo scan --budget 10 --min-score 90 --min-upside-bps 50",
    "<%= config.bin %> cargo scan --budget 10 --min-score 90 --min-upside-bps 50 --execute --json",
  ];

  // The dry run works signed out; --execute needs the wallet and checks it below.
  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:scan";

  async execute(io: CommandIO): Promise<ScanResult> {
    const raw = await io.resolveInputs(inputs);
    const budget = usdcInput(raw.budget, "budget");
    const minScore = intInput(raw.minScore, "min-score", 90, 0, 100);
    const minUpsideBps = intInput(raw.minUpsideBps, "min-upside-bps", 50, -10_000, 1_000_000);
    const maxPremiumToMarkBps = intInput(raw.maxPremiumToMarkBps, "max-premium-to-mark-bps", 0, -10_000, 10_000);
    const execute = raw.execute === true;

    const buyer = activeAddress(this.ctx);
    const { client } = await readClient(this.ctx, true);
    const { notes, errors } = await discoverNotes(client, raw.ids, io);
    const rules = { budget, minScore, minUpsideBps, maxPremiumToMarkBps, buyer };
    const plan = planScan(notes, rules);

    const pick = (c: (typeof plan.selected)[number]): Pick => ({ ...noteView(c.note as NoteSnapshot), priceUsdc: formatUsdc(c.price), upsideBps: c.upsideBps });
    const result: ScanResult = {
      action: "scan",
      executed: execute,
      rules: { budgetUsdc: formatUsdc(budget), minScore, minUpsideBps, maxPremiumToMarkBps },
      scanned: notes.length,
      selected: plan.selected.map(pick),
      overBudget: plan.overBudget.map(pick),
      rejected: plan.rejected.map((r) => ({ shipmentId: r.note.shipmentId, ref: r.note.ref ?? null, status: r.note.status, reasons: r.rejections.map((x) => x.message) })),
      plannedSpendUsdc: formatUsdc(plan.spend),
      bought: [],
      skipped: [],
      readErrors: errors,
    };
    if (!execute || plan.selected.length === 0) return result;

    if (!buyer) {
      throw new CommandError("CARGO_NO_WALLET", "No agent wallet found to buy with.", "Run `mm login` and `mm init`, then re-run with --execute.");
    }
    const tx = await Submitter.create(this.ctx, io, this.pluginCommandId);
    let spent = 0n;
    for (const c of plan.selected) {
      const id = c.note.shipmentId as `0x${string}`;
      // Re-read and re-check right before each buy: evidence can land between the scan and the fill.
      const fresh = await readNote(client, id, c.note.ref);
      const d = evaluateBuy(fresh, { maxPrice: budget - spent, minScore, maxPremiumToMarkBps, minUpsideBps, buyer });
      if (!d.ok || d.price === null) {
        result.skipped.push({ shipmentId: id, reason: d.rejections.map((r) => r.message).join(" ") });
        continue;
      }
      const before = tx.txs.length;
      try {
        await tx.ensureAllowance(client, buyer, d.price, `scan buy of ${fresh.ref ?? id}`);
        await tx.send("buy", MARKET, tx.buyData(id, d.price), `Buy cargo note ${fresh.ref ?? id.slice(0, 10)} for ${formatUsdc(d.price)} USDC (scan)`, {
          shipment: id,
          price: `${formatUsdc(d.price)} USDC`,
          evidenceScore: String(fresh.score),
          upside: `${d.upsideBps} bps`,
        });
        spent += d.price;
        result.bought.push({ shipmentId: id, priceUsdc: formatUsdc(d.price), transactions: tx.txs.slice(before) });
      } catch (e) {
        if (e instanceof CommandError && e.code === "CARGO_INSUFFICIENT_USDC") {
          result.skipped.push({ shipmentId: id, reason: e.message });
          continue;
        }
        throw e;
      }
    }
    return result;
  }

  override successHint(r: ScanResult): string {
    const lines = [
      `Scanned ${r.scanned} note(s) with min score ${r.rules.minScore}, min upside ${r.rules.minUpsideBps} bps, max premium to mark ${r.rules.maxPremiumToMarkBps} bps, budget ${r.rules.budgetUsdc} USDC.`,
      ...r.selected.map((s) => `  ${r.executed ? "pick" : "would buy"} ${s.ref ?? s.shipmentId} at ${s.priceUsdc} (score ${s.evidenceScore}, upside ${s.upsideBps} bps)`),
      ...r.overBudget.map((s) => `  over budget: ${s.ref ?? s.shipmentId} at ${s.priceUsdc}`),
      ...r.rejected.map((x) => `  skip ${x.ref ?? x.shipmentId}: ${x.reasons.join(" ")}`),
    ];
    if (r.executed) {
      lines.push(...r.bought.map((b) => `  bought ${b.shipmentId.slice(0, 10)} for ${b.priceUsdc}: ${b.transactions.map((t) => t.explorerUrl ?? t.status).join(" ")}`));
      lines.push(...r.skipped.map((s) => `  not bought ${s.shipmentId.slice(0, 10)}: ${s.reason}`));
    } else if (r.selected.length) {
      lines.push(`Dry run: re-run with --execute to buy for ${r.plannedSpendUsdc} USDC.`);
    }
    return lines.join("\n");
  }
}
