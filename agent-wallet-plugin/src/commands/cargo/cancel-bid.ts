import { CommandError, type CommandIO, InputFieldType, type InputSchema, PluginCommand, schemaToArgs, schemaToFlags } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData } from "viem";
import { marketAbi } from "../../lib/abi.js";
import { myBid } from "../../lib/chain.js";
import { MARKET } from "../../lib/constants.js";
import { activeAddress, idInput, readClient, Submitter, type TxRecord } from "../../lib/host.js";
import { formatUsdc } from "../../lib/rules.js";

const inputs = {
  shipmentId: { type: InputFieldType.Text, flag: "shipment-id", message: "Shipment id of the cargo note", required: true, index: 0 },
} satisfies InputSchema;

type CancelResult = { action: "cancel-bid"; shipmentId: string; refundUsdc: string | null; transactions: TxRecord[] };

export default class CargoCancelBid extends PluginCommand<CancelResult> {
  static override description = "Cancel your escrowed bid on a cargo note and get the USDC back (always allowed).";
  static override examples = ["<%= config.bin %> cargo cancel-bid 0xb508…39ff"];
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "cargo:cancel-bid";

  async execute(io: CommandIO): Promise<CancelResult> {
    const { shipmentId } = await io.resolveInputs(inputs);
    const id = idInput(shipmentId);
    const bidder = activeAddress(this.ctx);
    let refund: bigint | null = null;
    if (bidder) {
      const { client } = await readClient(this.ctx, true);
      refund = await myBid(client, id, bidder);
      if (refund === 0n) {
        throw new CommandError("CARGO_NO_BID", `Wallet ${bidder} has no open bid on ${id}.`, "Run `mm cargo quote <id>` to see the order book.");
      }
    }
    const tx = await Submitter.create(this.ctx, io, this.pluginCommandId);
    await tx.send(
      "cancelBid",
      MARKET,
      encodeFunctionData({ abi: marketAbi, functionName: "cancelBid", args: [id] }),
      `Cancel bid on cargo note ${id.slice(0, 10)}${refund ? ` (refund ${formatUsdc(refund)} USDC)` : ""}`,
      { shipment: id, ...(refund ? { refund: `${formatUsdc(refund)} USDC` } : {}) },
    );
    return { action: "cancel-bid", shipmentId: id, refundUsdc: refund === null ? null : formatUsdc(refund), transactions: tx.txs };
  }

  override successHint(r: CancelResult): string {
    return `Bid cancelled${r.refundUsdc ? `, ${r.refundUsdc} USDC refunded` : ""}. ${r.transactions.map((t) => t.explorerUrl ?? t.status).join(" ")}`;
  }
}
