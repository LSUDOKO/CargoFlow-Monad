// Glue between the pure rules, the chain reads and the mm host (CommandError, ctx, executor).
import { CommandError, type CommandIO, type PluginCommandContext } from "@metamask/agent-wallet/plugin";
import { type Address, encodeFunctionData, type Hex, isAddress, type PublicClient } from "viem";
import { erc20Abi, marketAbi } from "./abi.js";
import { ApiUnavailableError, fetchLiveShipments } from "./api.js";
import { fallbackClient, type Hex32, type NoteSnapshot, readNotes, usdcPosition } from "./chain.js";
import { API_URL, CHAIN_ID, EXPLORER_TX, MARKET, USDC } from "./constants.js";
import { formatUsdc, normalizeShipmentId, parseIntStrict, parseUsdc, premiumToMarkBps, type Rejection, upsideBps } from "./rules.js";

// ------------------------------------------------------------------ inputs

export function usdcInput(raw: string | undefined, flag: string, fallback?: string): bigint {
  const value = raw ?? fallback;
  if (value === undefined || value === "") {
    throw new CommandError("MISSING_FLAG", `Missing required input --${flag}.`, `Pass --${flag} <usdc>, e.g. --${flag} 3.`);
  }
  try {
    return parseUsdc(value);
  } catch (e) {
    throw new CommandError("INVALID_INPUT", (e as Error).message, `Pass --${flag} as a plain USDC amount, e.g. 2.95.`);
  }
}

export function intInput(raw: string | undefined, flag: string, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === "") return fallback;
  try {
    return parseIntStrict(raw, flag, min, max);
  } catch (e) {
    throw new CommandError("INVALID_INPUT", (e as Error).message, `Pass --${flag} as an integer between ${min} and ${max}.`);
  }
}

export function idInput(raw: string | undefined): Hex32 {
  try {
    return normalizeShipmentId(raw ?? "");
  } catch (e) {
    throw new CommandError("CARGO_INVALID_ID", (e as Error).message, "Run `mm cargo list` to see live shipment ids.");
  }
}

// ------------------------------------------------------------------ clients and wallet

/**
 * Prefer the host's authenticated RPC client (wallet-read); fall back to the public Monad RPC when the
 * command has no wallet-read grant, the user is signed out, or the host gateway does not serve 10143.
 */
export async function readClient(ctx: PluginCommandContext | undefined, useHost: boolean): Promise<{ client: PublicClient; rpc: "host" | "public" }> {
  if (useHost && ctx) {
    try {
      const client = ctx.publicClient(CHAIN_ID);
      const id = await client.getChainId();
      if (id === CHAIN_ID) return { client, rpc: "host" };
    } catch {
      // fall through to the public RPC
    }
  }
  return { client: fallbackClient(), rpc: "public" };
}

/** The active EVM address from the local wallet state (wallet-read). Undefined when it cannot be determined. */
export function activeAddress(ctx: PluginCommandContext): Address | undefined {
  try {
    const state = ctx.walletStateManager.read() as unknown as {
      byokWallets?: { address?: string; namespace?: string }[];
      remoteWallets?: { address?: string; namespace?: string }[];
      selectedWallet?: { namespace?: string; ref?: unknown };
    };
    const wallets = [...(state.remoteWallets ?? []), ...(state.byokWallets ?? [])].filter(
      (w) => typeof w.address === "string" && isAddress(w.address, { strict: false }),
    );
    const ref = JSON.stringify(state.selectedWallet?.ref ?? "").toLowerCase();
    const selected = wallets.find((w) => ref.includes(w.address!.toLowerCase()));
    return (selected ?? wallets[0])?.address as Address | undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ discovery

export async function discoverNotes(
  client: PublicClient,
  ids: string | undefined,
  io?: CommandIO,
): Promise<{ notes: NoteSnapshot[]; errors: { shipmentId: string; error: string }[]; source: "api" | "ids" }> {
  let items: { id: Hex32; ref?: string }[];
  let source: "api" | "ids";
  if (ids && ids.trim()) {
    items = ids
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((s) => ({ id: idInput(s) }));
    source = "ids";
  } else {
    io?.progress("Fetching live shipments from the CargoFlow API (a cold start can take ~60s)…");
    try {
      const shipments = await fetchLiveShipments();
      items = shipments.map((s) => ({ id: s.id.toLowerCase() as Hex32, ref: s.externalRef }));
    } catch (e) {
      io?.progress();
      if (e instanceof ApiUnavailableError) {
        throw new CommandError(
          "CARGO_API_UNAVAILABLE",
          e.message,
          `The API (${API_URL}) runs on a free tier and may need ~60s to wake. Retry, or pass --ids 0x…,0x… to read notes straight from chain.`,
        );
      }
      throw e;
    }
    source = "api";
  }
  io?.progress(`Reading ${items.length} note(s) from Monad testnet…`);
  const res = await readNotes(client, items);
  io?.progress();
  return { ...res, source };
}

// ------------------------------------------------------------------ output shapes (no bigint in JSON)

export type NoteView = {
  shipmentId: string;
  ref: string | null;
  status: string;
  evidenceScore: number;
  claimUsdc: string;
  markUsdc: string;
  askUsdc: string | null;
  askSeller: string | null;
  bestBidUsdc: string | null;
  bestBidder: string | null;
  holder: string;
  upsideAtAskBps: number | null;
  askVsMarkBps: number | null;
};

export function noteView(n: NoteSnapshot): NoteView {
  return {
    shipmentId: n.shipmentId,
    ref: n.ref ?? null,
    status: n.status,
    evidenceScore: n.score,
    claimUsdc: formatUsdc(n.claim),
    markUsdc: formatUsdc(n.mark),
    askUsdc: n.ask ? formatUsdc(n.ask.price) : null,
    askSeller: n.ask?.seller ?? null,
    bestBidUsdc: n.bestBid ? formatUsdc(n.bestBid.price) : null,
    bestBidder: n.bestBid?.bidder ?? null,
    holder: n.financier,
    upsideAtAskBps: n.ask ? upsideBps(n.claim, n.ask.price) : null,
    askVsMarkBps: n.ask ? premiumToMarkBps(n.ask.price, n.mark) : null,
  };
}

export function refusal(action: string, rejections: Rejection[]): CommandError {
  const first = rejections[0];
  const all = rejections.map((r) => r.message).join(" ");
  return new CommandError(
    first.code,
    `Refusing to ${action}: ${all}`,
    "These limits come from your flags (--max-price, --min-score, --max-premium-to-mark-bps). Run `mm cargo quote <id>` to see the evidence and mark.",
  );
}

// ------------------------------------------------------------------ submission

type ExecResult = { kind?: string; hash?: string; status?: string; failureCode?: string; failureDescription?: string; pendingJob?: { pollingId?: string } };
type Executor = (
  request: {
    kind: "transaction";
    chainId: number;
    transaction: { to: Address; data: Hex; gas?: bigint; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint };
    intent?: { summary: string; action: "call"; details?: Record<string, string | undefined> };
  },
  opts?: { waitForReceipt?: boolean; signal?: AbortSignal },
) => Promise<ExecResult>;

export type TxRecord = { step: string; hash: string | null; status: string; explorerUrl: string | null };

const FAILED = /FAIL|DENIED|EXPIRED|REJECT|REVERT|CANCEL/i;

export class Submitter {
  readonly txs: TxRecord[] = [];
  private constructor(
    private readonly exec: Executor,
    private readonly io: CommandIO,
    private readonly from: Address | undefined,
  ) {}

  static async create(ctx: PluginCommandContext, io: CommandIO, commandId: string, from?: Address): Promise<Submitter> {
    let exec: Executor;
    try {
      exec = (await ctx.walletExecutor(io, commandId, { emitStepNotices: true })) as unknown as Executor;
    } catch (e) {
      if (e instanceof CommandError) throw e;
      throw new CommandError(
        "CARGO_WALLET_UNAVAILABLE",
        `Could not get the wallet executor: ${e instanceof Error ? e.message : String(e)}`,
        "Run `mm login` and `mm init`, and make sure the plugin was installed with the wallet-submit capability.",
      );
    }
    return new Submitter(exec, io, from);
  }

  async send(step: string, to: Address, data: Hex, summary: string, details: Record<string, string>): Promise<TxRecord> {
    const result = await this.exec(
      { kind: "transaction", chainId: CHAIN_ID, transaction: { to, data, ...(await this.fees(to, data)) }, intent: { summary, action: "call", details } },
      { waitForReceipt: true, signal: this.io.signal },
    );
    const status = result.status ?? "UNKNOWN";
    const rec: TxRecord = { step, hash: result.hash ?? null, status, explorerUrl: result.hash ? EXPLORER_TX + result.hash : null };
    this.txs.push(rec);
    if (FAILED.test(status) || result.failureCode) {
      throw new CommandError(
        "CARGO_TX_FAILED",
        `${step} did not go through (${status}${result.failureDescription ? `: ${result.failureDescription}` : ""}).`,
        "Check `mm wallet requests list`; in Guard Mode allowlist the CargoNoteMarket and USDC contracts on Monad testnet (10143).",
      );
    }
    if (!result.hash) {
      // Pending approval (for example AWAITING_MFA beyond the wait window): the next step would fail on chain.
      throw new CommandError(
        "CARGO_TX_PENDING",
        `${step} is waiting for approval (${status}).`,
        "Approve it in MetaMask (2FA), then re-run the command; already-approved steps are skipped.",
      );
    }
    return rec;
  }

  /**
   * Gas and EIP-1559 fees read from Monad itself. MetaMask's hosted gas-fee service answers "Invalid chainId" for
   * Monad testnet (10143); a transaction that already carries maxFeePerGas, maxPriorityFeePerGas and gas skips it.
   * Monad charges the gas limit, not the gas used, so the limit is the estimate plus 25%, not a round ceiling.
   */
  private async fees(to: Address, data: Hex): Promise<{ gas?: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const { client } = await readClient(undefined, false);
    const tip = 2_000_000_000n; // 2 gwei
    const block = await client.getBlock();
    const base = block.baseFeePerGas ?? 100_000_000_000n;
    // bigints: the executor hex-encodes them itself (a 0x string would come out as 0x0x...)
    const out: { gas?: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } = {
      maxFeePerGas: base * 2n + tip,
      maxPriorityFeePerGas: tip,
    };
    try {
      const est = await client.estimateGas({ account: this.from, to, data });
      out.gas = (est * 125n) / 100n;
    } catch {
      out.gas = 300_000n; // a safe ceiling for an approve or a market call
    }
    return out;
  }

  /** Approve exactly what the market needs to pull, unless the allowance already covers it. */
  async ensureAllowance(client: PublicClient, owner: Address | undefined, amount: bigint, why: string): Promise<void> {
    if (owner) {
      const pos = await usdcPosition(client, owner);
      if (pos.balance < amount) {
        throw new CommandError(
          "CARGO_INSUFFICIENT_USDC",
          `Wallet ${owner} holds ${formatUsdc(pos.balance)} USDC; ${why} needs ${formatUsdc(amount)}.`,
          `Fund the agent wallet with test USDC (${USDC}) on Monad testnet.`,
        );
      }
      if (pos.allowance >= amount) return;
    }
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MARKET, amount] });
    await this.send("approve", USDC, data, `Approve ${formatUsdc(amount)} USDC to CargoNoteMarket`, {
      spender: MARKET,
      amount: `${formatUsdc(amount)} USDC`,
      reason: why,
    });
  }

  buyData(id: Hex32, maxPrice: bigint): Hex {
    return encodeFunctionData({ abi: marketAbi, functionName: "buy", args: [id, maxPrice] });
  }
}
