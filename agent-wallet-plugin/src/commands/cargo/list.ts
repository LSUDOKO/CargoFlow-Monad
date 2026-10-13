import { type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { discoverNotes, type NoteView, noteView } from "../../lib/host.js";
import { fallbackClient } from "../../lib/chain.js";
import { MARKET } from "../../lib/constants.js";
import { BUYABLE, shortId, type StatusName } from "../../lib/rules.js";

const inputs = {
  ids: {
    type: InputFieldType.Text,
    flag: "ids",
    message: "Comma-separated shipment ids to read straight from chain (skips the CargoFlow API)",
    required: false,
    prompt: false,
  },
} satisfies InputSchema;

type ListResult = {
  chainId: number;
  market: string;
  source: "api" | "ids";
  count: number;
  notes: NoteView[];
  errors: { shipmentId: string; error: string }[];
};

export default class CargoList extends PluginCommand<ListResult> {
  static override description =
    "List live CargoFlow cargo notes on Monad testnet: status, evidence score, claim, mark, ask, best bid and upside at the ask.";

  static override examples = ["<%= config.bin %> cargo list", "<%= config.bin %> cargo list --json", "<%= config.bin %> cargo list --ids 0xb508…39ff"];

  // Public data only: no sign-in, no wallet, no capabilities. Reads go to the public Monad RPC.
  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:list";

  async execute(io: CommandIO): Promise<ListResult> {
    const { ids } = await io.resolveInputs(inputs);
    const { notes, errors, source } = await discoverNotes(fallbackClient(), ids, io);
    // Notes an agent may buy first, then by upside at the ask.
    const rank = (v: NoteView) => (BUYABLE.includes(v.status as StatusName) ? 0 : 1);
    const views = notes.map(noteView).sort((a, b) => rank(a) - rank(b) || (b.upsideAtAskBps ?? -1e9) - (a.upsideAtAskBps ?? -1e9));
    return { chainId: 10143, market: MARKET, source, count: views.length, notes: views, errors };
  }

  override successHint(data: ListResult): string {
    if (data.notes.length === 0) return "No live cargo notes right now.";
    const rows = data.notes.map(
      (n) =>
        `${(n.ref ?? shortId(n.shipmentId)).padEnd(22)} ${n.status.padEnd(9)} score ${String(n.evidenceScore).padStart(3)}  claim ${n.claimUsdc}  mark ${n.markUsdc}  ask ${n.askUsdc ?? "-"}  bid ${n.bestBidUsdc ?? "-"}  upside ${n.upsideAtAskBps === null ? "-" : `${n.upsideAtAskBps} bps`}`,
    );
    return [`${data.count} cargo note(s) (USDC):`, ...rows].join("\n");
  }
}
