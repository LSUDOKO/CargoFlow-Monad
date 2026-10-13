"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type Address, maxUint256 } from "viem";
import { useAccount, useBlockNumber, useReadContracts } from "wagmi";
import { Callout } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Badge, StatusPill } from "@/components/ui/Pill";
import { PageHeader, Section } from "@/components/ui/Section";
import { Stat } from "@/components/ui/Stat";
import { useShipmentsByStatus } from "@/lib/api/hooks";
import type { Shipment } from "@/lib/api/schemas";
import { controllerAbi, noteMarketAbi, usdgAbi } from "@/lib/chain/abis";
import { useContracts } from "@/lib/chain/contracts";
import { useTx } from "@/lib/chain/useTx";
import { formatUSDG } from "@/lib/format";
import { bpsLabel, parseUsdc, TRADEABLE, upsideBps, vsMarkBps } from "@/lib/notes";

type ChainId = 10143 | 31337;
const ZERO = "0x0000000000000000000000000000000000000000";

/** One note's live market state, read straight from the chain on every block. */
type NoteState = {
  shipment: Shipment;
  holder?: Address;
  status: string;
  mark: bigint;
  claim: bigint;
  score: number;
  ask?: { seller: Address; price: bigint };
  bestBid?: { bidder: Address; price: bigint };
  myBid: bigint;
  operator?: Address;
};

const STATUS = ["NONE", "CREATED", "FINANCED", "ACTIVE", "PAUSED", "DISPUTED", "DELIVERED", "SETTLED", "DEFAULTED", "CANCELLED"];

function useNotes(shipments: Shipment[]) {
  const { contracts, chainId } = useContracts();
  const { address } = useAccount();
  const market = contracts?.noteMarket;
  const reads = useReadContracts({
    contracts:
      market && contracts
        ? shipments.flatMap((s) => {
            const id = s.id as `0x${string}`;
            const c = chainId as ChainId;
            return [
              { address: contracts.controller, abi: controllerAbi, functionName: "getFacility", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "markPrice", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "claimValue", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "evidenceScore", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "asks", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "bestBid", args: [id], chainId: c },
              { address: market, abi: noteMarketAbi, functionName: "bids", args: [id, (address ?? ZERO) as Address], chainId: c },
              { address: contracts.controller, abi: controllerAbi, functionName: "positionOperator", args: [id], chainId: c },
            ] as const;
          })
        : [],
    // Monad finalises in under a second, so the book re-reads about once a block
    query: { enabled: !!market && shipments.length > 0, refetchInterval: 1_000 },
  });
  const notes = useMemo<NoteState[]>(() => {
    if (!reads.data) return [];
    return shipments.map((shipment, i) => {
      const r = reads.data!.slice(i * 8, i * 8 + 8).map((x) => x.result as unknown);
      const f = r[0] as { status: number; financier: Address } | undefined;
      const ask = r[4] as readonly [Address, bigint] | undefined;
      const best = r[5] as readonly [Address, bigint] | undefined;
      return {
        shipment,
        holder: f?.financier,
        status: f ? (STATUS[f.status] ?? shipment.status) : shipment.status,
        mark: (r[1] as bigint | undefined) ?? 0n,
        claim: (r[2] as bigint | undefined) ?? 0n,
        score: Number((r[3] as number | undefined) ?? 0),
        ask: ask && ask[0] !== ZERO ? { seller: ask[0], price: ask[1] } : undefined,
        bestBid: best && best[1] > 0n ? { bidder: best[0], price: best[1] } : undefined,
        myBid: (r[6] as bigint | undefined) ?? 0n,
        operator: r[7] as Address | undefined,
      };
    });
  }, [reads.data, shipments]);
  return { notes, loading: reads.isLoading, market };
}

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "–");
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function NotesView() {
  const { contracts, chainId } = useContracts();
  const { data, isLoading } = useShipmentsByStatus([...TRADEABLE]);
  const shipments = useMemo(() => data?.shipments ?? [], [data]);
  const { notes, loading, market } = useNotes(shipments);
  const { data: block } = useBlockNumber({ watch: true, chainId: chainId as ChainId, query: { enabled: !!chainId } });
  const [selected, setSelected] = useState<string>();
  const current = notes.find((n) => n.shipment.id === selected) ?? notes[0];

  const totals = notes.reduce((t, n) => ({ claim: t.claim + n.claim, mark: t.mark + n.mark, asks: t.asks + (n.ask ? 1 : 0) }), { claim: 0n, mark: 0n, asks: 0 });

  return (
    <div className="container-page py-(--space-page-y)">
      <PageHeader
        eyebrow="Trade"
        title="Cargo Notes"
        description={
          <>
            A Cargo Note is a financier&apos;s position in a live shipment: it pays principal + fee + undrawn capital when the buyer settles. Buy one, bid on one or sell yours
            while the container is still at sea. Every price below is marked on chain to the cargo&apos;s latest signed evidence and re-read each block on Monad.
          </>
        }
        actions={
          <Badge variant="success" dot pulse>
            {block ? <span className="num">Block {block.toString()}</span> : "Connecting"}
          </Badge>
        }
      />

      {!market && contracts && (
        <Callout variant="warning" title="The note market is not deployed on this network." className="mb-8">
          Deploy contracts with the Monad deploy script; the manifest&apos;s <code>noteMarket</code> address turns this page on.
        </Callout>
      )}

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Notes outstanding" value={notes.length} loading={isLoading} hint="Funded facilities that can change hands" />
        <Stat label="Claim at settlement" value={formatUSDG(totals.claim, { compact: true })} unit="USDC" loading={loading} hint="What the notes pay if every buyer settles" />
        <Stat label="Evidence mark" value={formatUSDG(totals.mark, { compact: true })} unit="USDC" loading={loading} hint={`${totals.asks} on offer now`} />
      </div>

      {notes.length === 0 && !isLoading ? (
        <EmptyState title="No live notes yet" description="A note appears here as soon as a financier funds a facility." action={<Link className="underline" href="/market">Open the financing market</Link>} />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section title="Order book" description="Click a note to trade it. Upside is what the note pays at settlement over the price you pay.">
            <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-1">
              <table className="w-full text-small">
                <caption className="sr-only">Cargo Notes with their evidence mark, ask and best bid</caption>
                <thead className="text-left text-caption text-text-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 font-semibold">Shipment</th>
                    <th className="px-4 py-3 font-semibold">State</th>
                    <th className="px-4 py-3 text-right font-semibold">Score</th>
                    <th className="px-4 py-3 text-right font-semibold">Claim</th>
                    <th className="px-4 py-3 text-right font-semibold">Mark</th>
                    <th className="px-4 py-3 text-right font-semibold">Ask</th>
                    <th className="px-4 py-3 text-right font-semibold">Best bid</th>
                    <th className="px-4 py-3 text-right font-semibold">Upside at ask</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((n) => (
                    <tr
                      key={n.shipment.id}
                      onClick={() => setSelected(n.shipment.id)}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-surface-2 ${current?.shipment.id === n.shipment.id ? "bg-surface-2" : ""}`}
                    >
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/shipments/${n.shipment.id}`} className="underline decoration-ink/25 underline-offset-4" onClick={(e) => e.stopPropagation()}>
                          {n.shipment.externalRef || short(n.shipment.id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={n.status} /></td>
                      <td className="num px-4 py-3 text-right">{n.score}</td>
                      <td className="num px-4 py-3 text-right">{formatUSDG(n.claim)}</td>
                      <td className="num px-4 py-3 text-right font-semibold">{formatUSDG(n.mark)}</td>
                      <td className="num px-4 py-3 text-right">{n.ask ? formatUSDG(n.ask.price) : "–"}</td>
                      <td className="num px-4 py-3 text-right">{n.bestBid ? formatUSDG(n.bestBid.price) : "–"}</td>
                      <td className="num px-4 py-3 text-right">{bpsLabel(upsideBps(n.claim, n.ask?.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-text-muted">
              Mark = undrawn escrow at par + (drawn principal + fee) × (1 − 0.5% per score point below 100), × 0.7 while paused. Computed by <code>CargoNoteMarket.markPrice</code>; trades settle at the prices traders set.
            </p>
          </Section>
          {current && market && <TradePanel note={current} market={market} />}
        </div>
      )}
    </div>
  );
}

function TradePanel({ note, market }: { note: NoteState; market: Address }) {
  const { address } = useAccount();
  const { contracts } = useContracts();
  const { send, pending } = useTx();
  const [price, setPrice] = useState("");
  const id = note.shipment.id as `0x${string}`;
  const isHolder = same(address, note.holder);
  const typed = parseUsdc(price);
  const marketIsOperator = same(note.operator, market);
  const label = note.shipment.externalRef || short(note.shipment.id);
  if (!contracts) return null;

  const approveUsdc = (amount: bigint) =>
    send({ address: contracts.usdg, abi: usdgAbi, functionName: "approve", args: [market, amount > 0n ? amount : maxUint256], label: "Approve USDC" });
  const allowOperator = () =>
    send({ address: contracts.controller, abi: controllerAbi, functionName: "setPositionOperator", args: [id, market], label: "Allow the market to transfer your note" });

  return (
    <aside className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-1 lg:sticky lg:top-24 lg:self-start">
      <div>
        <p className="text-caption text-text-muted">Trading</p>
        <h2 className="text-h4 font-semibold">{label}</h2>
        <p className="mt-1 text-small text-text-muted">Holder {isHolder ? "you" : short(note.holder)} · evidence score {note.score}/100</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-small">
        <div><dt className="text-text-muted">Pays at settlement</dt><dd className="num font-semibold">{formatUSDG(note.claim)} USDC</dd></div>
        <div><dt className="text-text-muted">Evidence mark</dt><dd className="num font-semibold">{formatUSDG(note.mark)} USDC</dd></div>
        <div><dt className="text-text-muted">Ask</dt><dd className="num">{note.ask ? `${formatUSDG(note.ask.price)} (${bpsLabel(vsMarkBps(note.ask.price, note.mark))} vs mark)` : "none"}</dd></div>
        <div><dt className="text-text-muted">Best bid</dt><dd className="num">{note.bestBid ? `${formatUSDG(note.bestBid.price)} by ${short(note.bestBid.bidder)}` : "none"}</dd></div>
      </dl>

      {note.status === "PAUSED" && (
        <Callout variant="warning" title="The facility is paused.">The evidence failed its policy; the mark carries a 30% haircut on the drawn leg until a recovery proof resumes it.</Callout>
      )}

      {!address ? (
        <p className="text-small text-text-muted">Connect a wallet on Monad Testnet to trade.</p>
      ) : isHolder ? (
        <div className="flex flex-col gap-3">
          <Field label="Ask price" suffix="USDC" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={formatUSDG(note.mark)} />
          {!marketIsOperator && (
            <Button variant="secondary" loading={pending} onClick={allowOperator}>1 · Allow the market to transfer this note</Button>
          )}
          <Button disabled={!typed} loading={pending} onClick={() => typed && send({ address: market, abi: noteMarketAbi, functionName: "placeAsk", args: [id, typed], label: "Place ask", successTitle: `${label} offered at ${formatUSDG(typed)} USDC` })}>
            {marketIsOperator ? "Place ask" : "2 · Place ask"}
          </Button>
          {note.ask && same(note.ask.seller, address) && (
            <Button variant="ghost" loading={pending} onClick={() => send({ address: market, abi: noteMarketAbi, functionName: "cancelAsk", args: [id], label: "Cancel ask" })}>Cancel my ask</Button>
          )}
          {note.bestBid && (
            <Button
              variant="secondary"
              disabled={!marketIsOperator}
              loading={pending}
              onClick={() => send({ address: market, abi: noteMarketAbi, functionName: "acceptBid", args: [id, note.bestBid!.bidder, note.bestBid!.price], label: "Sell into the best bid", successTitle: `Sold ${label} for ${formatUSDG(note.bestBid!.price)} USDC` })}
            >
              Sell into best bid · {formatUSDG(note.bestBid.price)} USDC
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {note.ask && (
            <>
              <Button variant="secondary" loading={pending} onClick={() => approveUsdc(note.ask!.price)}>1 · Approve {formatUSDG(note.ask.price)} USDC</Button>
              <Button loading={pending} onClick={() => send({ address: market, abi: noteMarketAbi, functionName: "buy", args: [id, note.ask!.price], label: "Buy note", successTitle: `You now hold ${label}` })}>
                2 · Buy at {formatUSDG(note.ask.price)} · upside {bpsLabel(upsideBps(note.claim, note.ask.price))}
              </Button>
            </>
          )}
          <Field label="Bid price" suffix="USDC" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={formatUSDG(note.mark)} hint={typed ? `Upside if filled: ${bpsLabel(upsideBps(note.claim, typed))}` : "Your USDC is escrowed by the market until you cancel or the holder accepts."} />
          <Button variant="secondary" disabled={!typed} loading={pending} onClick={() => typed && approveUsdc(typed)}>1 · Approve bid amount</Button>
          <Button disabled={!typed} loading={pending} onClick={() => typed && send({ address: market, abi: noteMarketAbi, functionName: "placeBid", args: [id, typed], label: "Place bid", successTitle: `Bid ${formatUSDG(typed)} USDC on ${label}` })}>2 · Place bid</Button>
          {note.myBid > 0n && (
            <Button variant="ghost" loading={pending} onClick={() => send({ address: market, abi: noteMarketAbi, functionName: "cancelBid", args: [id], label: "Cancel bid" })}>Cancel my bid ({formatUSDG(note.myBid)} USDC)</Button>
          )}
        </div>
      )}
      <p className="text-caption text-text-muted">Buying a note makes you the financier of record: settlement, default payouts, the escrowed bill of lading and any cover follow it.</p>
    </aside>
  );
}
