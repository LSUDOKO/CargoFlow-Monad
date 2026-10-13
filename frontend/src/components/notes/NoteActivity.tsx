"use client";

import { Section } from "@/components/ui/Section";
import { useContracts } from "@/lib/chain/contracts";
import { ENVIO_URL, useNoteActivity, type OrderEvent } from "@/lib/envio";
import { explorerTx } from "@/lib/explorer";
import { formatUSDG } from "@/lib/format";

const LABEL: Record<OrderEvent["kind"], string> = {
  ASK: "Ask placed",
  ASK_CANCELLED: "Ask cancelled",
  BID: "Bid placed",
  BID_CANCELLED: "Bid cancelled",
  TRADE: "Traded",
  TRANSFER: "Position moved",
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ago = (t: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - t);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

/** The note market's activity feed, indexed by Envio HyperIndex from the CargoNoteMarket and controller events. */
export function NoteActivity() {
  const { chainId } = useContracts();
  const { data, isLoading, isError } = useNoteActivity();
  if (!ENVIO_URL) return null;

  return (
    <Section
      title="Market activity"
      description={
        <>
          Every ask, bid, fill and position transfer, indexed from Monad by Envio HyperIndex
          {data?.indexedBlock ? <> · indexed to block <span className="num">{data.indexedBlock.toLocaleString()}</span></> : null}.
        </>
      }
    >
      {data && (
        <p className="mb-3 text-small text-text-muted">
          <span className="num font-semibold text-ink">{data.stats.trades}</span> trades ·{" "}
          <span className="num font-semibold text-ink">{formatUSDG(data.stats.volume)}</span> USDC volume ·{" "}
          <span className="num font-semibold text-ink">{data.stats.asks}</span> asks ·{" "}
          <span className="num font-semibold text-ink">{data.stats.bids}</span> bids
        </p>
      )}
      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-1">
        <table className="w-full text-small">
          <caption className="sr-only">Recent Cargo Note market activity</caption>
          <thead className="text-left text-caption text-text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Note</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-right font-semibold">Mark</th>
              <th className="px-4 py-3 font-semibold">Tx</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-6 text-text-muted">Loading the indexer…</td></tr>
            )}
            {isError && (
              <tr><td colSpan={7} className="px-4 py-6 text-text-muted">The indexer is unreachable right now; the order book above reads the chain directly.</td></tr>
            )}
            {data?.events.map((e) => {
              const href = explorerTx(chainId ?? 10143, e.txHash);
              return (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text-muted">{ago(e.timestamp)}</td>
                  <td className={`px-4 py-3 ${e.kind === "TRADE" ? "font-semibold" : ""}`}>{LABEL[e.kind] ?? e.kind}</td>
                  <td className="num px-4 py-3">{short(e.note_id)}</td>
                  <td className="num px-4 py-3">{short(e.account)}</td>
                  <td className="num px-4 py-3 text-right">{e.price ? formatUSDG(e.price) : "–"}</td>
                  <td className="num px-4 py-3 text-right">{e.mark ? formatUSDG(e.mark) : "–"}</td>
                  <td className="px-4 py-3">
                    {href ? <a href={href} target="_blank" rel="noreferrer" className="underline decoration-ink/25 underline-offset-4">{short(e.txHash)}<span className="sr-only"> (opens in a new tab)</span></a> : short(e.txHash)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
