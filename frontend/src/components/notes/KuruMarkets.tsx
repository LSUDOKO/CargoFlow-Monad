"use client";

import { erc20Abi, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { Badge } from "@/components/ui/Pill";
import { Section } from "@/components/ui/Section";
import manifest from "@/data/deployments/monad-testnet.json";
import { noteMarketAbi } from "@/lib/chain/abis";
import { useContracts } from "@/lib/chain/contracts";
import { explorerAddress } from "@/lib/explorer";
import { formatUSDG } from "@/lib/format";

type KuruMarket = { shipmentId: string; externalRef: string; token: string; symbol: string; market: string; takerFeeBps: number };

/** Kuru's OrderBook read surface used here: best bid and ask in 1e18 precision. */
const kuruBookAbi = [
  { type: "function", name: "bestBidAsk", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }, { type: "uint256" }] },
] as const;

const MARKETS: KuruMarket[] = ((manifest as { kuru?: { markets?: KuruMarket[] } }).kuru?.markets ?? []);
const EMPTY_BID = 2n ** 256n - 1n; // Kuru reports an empty bid side as type(uint256).max and an empty ask as 0

/** Price in 1e18 precision as USDC per token, or undefined on an empty side. */
const side = (v: bigint | undefined, empty: bigint) => (v === undefined || v === empty ? undefined : Number(v) / 1e18);

/**
 * Cargo Notes made fungible (CargoNoteToken) and listed on Kuru's on-chain spot order book: one market per note,
 * quoted in USDC, next to the note's evidence mark per token so a trader can see the discount at a glance.
 */
export function KuruMarkets() {
  const { contracts, chainId } = useContracts();
  const market = contracts?.noteMarket;
  const reads = useReadContracts({
    contracts: market
      ? MARKETS.flatMap((m) => [
          { address: m.market as Address, abi: kuruBookAbi, functionName: "bestBidAsk", chainId: chainId as 10143 },
          { address: m.token as Address, abi: erc20Abi, functionName: "totalSupply", chainId: chainId as 10143 },
          { address: market, abi: noteMarketAbi, functionName: "markPrice", args: [m.shipmentId as `0x${string}`], chainId: chainId as 10143 },
          { address: market, abi: noteMarketAbi, functionName: "claimValue", args: [m.shipmentId as `0x${string}`], chainId: chainId as 10143 },
        ] as const)
      : [],
    query: { enabled: !!market && MARKETS.length > 0, refetchInterval: 4_000 },
  });
  if (MARKETS.length === 0) return null;

  return (
    <Section
      title={<span className="inline-flex flex-wrap items-center gap-3">Cargo Notes on Kuru <Badge variant="success" dot>Live order book</Badge></span>}
      description="A note wrapped into a CargoNoteToken (supply = its claim, redeemable pro-rata after settlement) trades on Kuru's on-chain spot order book against USDC, like any other token."
    >
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-1">
        <table className="w-full text-small">
          <caption className="sr-only">Cargo Note tokens listed on Kuru</caption>
          <thead className="text-left text-caption text-text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">Token</th>
              <th className="px-4 py-3 font-semibold">Shipment</th>
              <th className="px-4 py-3 text-right font-semibold">Supply</th>
              <th className="px-4 py-3 text-right font-semibold">Mark / token</th>
              <th className="px-4 py-3 text-right font-semibold">Kuru bid</th>
              <th className="px-4 py-3 text-right font-semibold">Kuru ask</th>
              <th className="px-4 py-3 font-semibold">Market</th>
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((m, i) => {
              const r = reads.data?.slice(i * 4, i * 4 + 4).map((x) => x.result);
              const book = r?.[0] as readonly [bigint, bigint] | undefined;
              const supply = r?.[1] as bigint | undefined;
              const mark = r?.[2] as bigint | undefined;
              const claim = r?.[3] as bigint | undefined;
              // the mark is for the whole position; per token it is mark / supply (claim ≈ supply at wrap time)
              const perToken = mark !== undefined && supply ? Number(mark) / Number(supply) : undefined;
              const bid = side(book?.[0], EMPTY_BID);
              const ask = side(book?.[1], 0n);
              const href = explorerAddress(chainId ?? 10143, m.market);
              return (
                <tr key={m.market} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold">{m.symbol}</td>
                  <td className="px-4 py-3">
                    <a href={`/track/${m.shipmentId}`} className="underline decoration-ink/25 underline-offset-4">{m.externalRef}</a>
                  </td>
                  <td className="num px-4 py-3 text-right">{supply !== undefined ? formatUSDG(supply) : "–"}</td>
                  <td className="num px-4 py-3 text-right">{perToken !== undefined ? perToken.toFixed(4) : "–"}{claim === 0n ? " (closed)" : ""}</td>
                  <td className="num px-4 py-3 text-right">{bid !== undefined ? bid.toFixed(4) : "–"}</td>
                  <td className="num px-4 py-3 text-right font-semibold">{ask !== undefined ? ask.toFixed(4) : "–"}</td>
                  <td className="px-4 py-3">
                    {href ? <a href={href} target="_blank" rel="noreferrer" className="font-mono underline decoration-ink/25 underline-offset-4">{m.market.slice(0, 8)}…<span className="sr-only"> (opens in a new tab)</span></a> : m.market}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-text-muted">
        Listed with <code>scripts/kuru-list-note.sh</code>: wrap through <code>CargoNoteWrapper</code>, create the market with Kuru&apos;s permissionless Router, post a limit
        sell. Trade it from any Kuru-compatible client; holders redeem tokens for USDC once the buyer settles.
      </p>
    </Section>
  );
}
