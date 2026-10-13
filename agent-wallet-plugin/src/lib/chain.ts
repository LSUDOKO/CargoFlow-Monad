import { type Address, createPublicClient, http, type PublicClient, zeroAddress } from "viem";
import { monadTestnet } from "viem/chains";
import { controllerAbi, erc20Abi, marketAbi, vaultAbi } from "./abi.js";
import { CONTROLLER, MARKET, RPC_URL, USDC, VAULT } from "./constants.js";
import { explainMark, type MarkExplanation, type NoteState, statusName } from "./rules.js";

export type Hex32 = `0x${string}`;

/** Direct client to the public Monad testnet RPC (used by `cargo list`, which needs no capability, and as a fallback). */
export function fallbackClient(): PublicClient {
  return createPublicClient({ chain: monadTestnet, batch: { multicall: true }, transport: http(RPC_URL, { timeout: 20_000, retryCount: 2 }) }) as PublicClient;
}

export type NoteSnapshot = NoteState & {
  vault: { committed: bigint; drawn: bigint; feeBps: number; funded: boolean; closed: boolean; invoiceValue: bigint };
  pauseCount: number;
  markCheck: MarkExplanation;
};

export async function readNote(client: PublicClient, id: Hex32, ref?: string): Promise<NoteSnapshot> {
  const [facility, vault, score, claim, mark, ask, bid] = await Promise.all([
    client.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: "getFacility", args: [id] }),
    client.readContract({ address: VAULT, abi: vaultAbi, functionName: "getFacility", args: [id] }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "evidenceScore", args: [id] }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "claimValue", args: [id] }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "markPrice", args: [id] }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "asks", args: [id] }),
    client.readContract({ address: MARKET, abi: marketAbi, functionName: "bestBid", args: [id] }),
  ]);
  const status = statusName(Number(facility.status));
  const markCheck = explainMark({
    status,
    committed: vault.committed,
    drawn: vault.drawn,
    feeBps: Number(vault.feeBps),
    score: Number(score),
    funded: vault.funded,
    closed: vault.closed,
  });
  return {
    shipmentId: id,
    ref,
    status,
    score: Number(score),
    claim,
    mark,
    ask: ask[0] === zeroAddress ? null : { seller: ask[0], price: ask[1] },
    bestBid: bid[0] === zeroAddress || bid[1] === 0n ? null : { bidder: bid[0], price: bid[1] },
    financier: facility.financier,
    vault: {
      committed: vault.committed,
      drawn: vault.drawn,
      feeBps: Number(vault.feeBps),
      funded: vault.funded,
      closed: vault.closed,
      invoiceValue: vault.invoiceValue,
    },
    pauseCount: Number(facility.pauseCount),
    markCheck,
  };
}

/** Read many notes, keeping going when one fails (a deleted or never-financed id should not sink a scan). */
export async function readNotes(
  client: PublicClient,
  items: { id: Hex32; ref?: string }[],
): Promise<{ notes: NoteSnapshot[]; errors: { shipmentId: string; error: string }[] }> {
  // The public Monad RPC rate-limits bursts, so read a few notes at a time.
  const results: PromiseSettledResult<NoteSnapshot>[] = [];
  for (let i = 0; i < items.length; i += 4) {
    results.push(...(await Promise.allSettled(items.slice(i, i + 4).map((it) => readNote(client, it.id, it.ref)))));
  }
  const notes: NoteSnapshot[] = [];
  const errors: { shipmentId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") notes.push(r.value);
    else errors.push({ shipmentId: items[i].id, error: r.reason instanceof Error ? r.reason.message.split("\n")[0] : String(r.reason) });
  });
  return { notes, errors };
}

export async function usdcPosition(client: PublicClient, owner: Address): Promise<{ balance: bigint; allowance: bigint }> {
  const [balance, allowance] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [owner, MARKET] }),
  ]);
  return { balance, allowance };
}

export async function myBid(client: PublicClient, id: Hex32, owner: Address): Promise<bigint> {
  return client.readContract({ address: MARKET, abi: marketAbi, functionName: "bids", args: [id, owner] });
}
