import { type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { readNote } from "../../lib/chain.js";
import { APP_URL } from "../../lib/constants.js";
import { idInput, type NoteView, noteView, readClient } from "../../lib/host.js";
import { formatUsdc } from "../../lib/rules.js";

const inputs = {
  shipmentId: {
    type: InputFieldType.Text,
    flag: "shipment-id",
    message: "Shipment id (0x + 64 hex) of the cargo note",
    required: true,
    index: 0,
  },
} satisfies InputSchema;

type QuoteResult = NoteView & {
  committedUsdc: string;
  drawnUsdc: string;
  undrawnUsdc: string;
  feeBps: number;
  pauseCount: number;
  drawnLegFactorBps: number;
  markMatchesChain: boolean;
  whyThisMark: string[];
  rpc: "host" | "public";
  appUrl: string;
};

export default class CargoQuote extends PluginCommand<QuoteResult> {
  static override description =
    "Quote one cargo note and explain its mark: undrawn capital at par plus the drawn leg haircut 0.5% per evidence point below 100 (x0.7 while paused).";

  static override examples = ["<%= config.bin %> cargo quote 0xb508ee5803f1531f5ef62d9df7e7760c091555550471dd98643f7114021239ff --json"];

  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:quote";

  async execute(io: CommandIO): Promise<QuoteResult> {
    const { shipmentId } = await io.resolveInputs(inputs);
    const id = idInput(shipmentId);
    const { client, rpc } = await readClient(this.ctx, true);
    io.progress("Reading the note from Monad testnet…");
    const n = await readNote(client, id);
    io.progress();
    const m = n.markCheck;
    const why = [...m.explanation];
    if (n.ask) why.push(`Ask ${formatUsdc(n.ask.price)} USDC pays ${formatUsdc(n.claim - n.ask.price)} USDC at settlement if the buyer pays in full.`);
    return {
      ...noteView(n),
      committedUsdc: formatUsdc(n.vault.committed),
      drawnUsdc: formatUsdc(n.vault.drawn),
      undrawnUsdc: formatUsdc(m.undrawn),
      feeBps: n.vault.feeBps,
      pauseCount: n.pauseCount,
      drawnLegFactorBps: Number(m.factorBps),
      markMatchesChain: m.mark === n.mark,
      whyThisMark: why,
      rpc,
      appUrl: `${APP_URL}/notes`,
    };
  }

  override successHint(q: QuoteResult): string {
    return [
      `${q.ref ?? q.shipmentId}  ${q.status}  evidence ${q.evidenceScore}/100`,
      `claim ${q.claimUsdc}  mark ${q.markUsdc}  ask ${q.askUsdc ?? "-"}  best bid ${q.bestBidUsdc ?? "-"}  upside at ask ${q.upsideAtAskBps ?? "-"} bps`,
      ...q.whyThisMark.map((l) => `  - ${l}`),
    ].join("\n");
  }
}
