"use client";

import { useQuery } from "@tanstack/react-query";

/** The Envio HyperIndex GraphQL endpoint for the note market (indexer/); unset hides the activity feed. */
export const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "";

export type OrderEvent = {
  id: string;
  note_id: string;
  kind: "ASK" | "ASK_CANCELLED" | "BID" | "BID_CANCELLED" | "TRADE" | "TRANSFER";
  account: string;
  price: string | null;
  mark: string | null;
  timestamp: number;
  txHash: string;
};

export type MarketStats = { trades: number; volume: string; asks: number; bids: number };

const QUERY = `query Activity($limit: Int!) {
  OrderEvent(order_by: { blockNumber: desc }, limit: $limit) { id note_id kind account price mark timestamp txHash }
  MarketStats(where: { id: { _eq: "global" } }) { trades volume asks bids }
  chain_metadata { block_height latest_processed_block }
}`;

/** Latest order-book activity and protocol counters from the indexer, refreshed every few seconds. */
export function useNoteActivity(limit = 25) {
  return useQuery({
    queryKey: ["envio", "activity", limit],
    enabled: !!ENVIO_URL,
    refetchInterval: 4_000,
    queryFn: async () => {
      const res = await fetch(ENVIO_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: QUERY, variables: { limit } }),
      });
      if (!res.ok) throw new Error(`indexer answered ${res.status}`);
      const body = (await res.json()) as {
        data?: {
          OrderEvent: OrderEvent[];
          MarketStats: MarketStats[];
          chain_metadata: { block_height: number; latest_processed_block: number }[];
        };
        errors?: { message: string }[];
      };
      if (body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? "no data");
      return {
        events: body.data.OrderEvent,
        stats: body.data.MarketStats[0] ?? { trades: 0, volume: "0", asks: 0, bids: 0 },
        indexedBlock: body.data.chain_metadata[0]?.latest_processed_block,
      };
    },
  });
}
