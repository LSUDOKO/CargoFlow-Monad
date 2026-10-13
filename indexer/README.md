# CargoFlow indexer (Envio HyperIndex)

Indexes the Cargo Note market on Monad Testnet (chain 10143) with [Envio HyperIndex](https://docs.envio.dev), reading
from HyperSync (`https://10143.hypersync.xyz`) with the public RPC as a fallback. It powers the **Market activity** feed
and the trade/volume counters on [`/notes`](https://cargoflow-monad.vercel.app/notes).

| Contract | Address | Events |
|---|---|---|
| CargoNoteMarket | `0x120142b2e5A90F2676F41d8d20bDCC94C66ec55d` | AskPlaced, AskCancelled, BidPlaced, BidCancelled, NoteTraded |
| FinancingController | `0x172f8B86a9368ef729fa76c773ECA03d166DEB4d` | FacilityCreated, StatusChanged, PositionTransferred |
| EvidenceRegistry | `0x4aD47799586B4793b7952BA849013F5D0eC2e66a` | EvidenceEpochCommitted |

Entities (`schema.graphql`): `Note` (status, holder, latest evidence score, trades, volume, current ask), `Trade`,
`OrderEvent` (the activity feed), `Epoch` (the evidence the mark is priced from) and `MarketStats` (protocol counters,
kept in a handler because Envio Cloud does not expose `_aggregate`).

## Run

```bash
pnpm install
pnpm codegen
pnpm dev                        # Docker: Postgres + Hasura, GraphQL at http://localhost:8080/v1/graphql
```

Without Docker's default ports (or without a HyperSync token), run against any Postgres with Hasura off and the RPC
capped to Monad's 100-block `eth_getLogs` window:

```bash
ENVIO_HASURA=false ENVIO_PG_HOST=127.0.0.1 ENVIO_PG_PORT=5434 ENVIO_PG_USER=... ENVIO_PG_PASSWORD=... ENVIO_PG_DATABASE=envio \
ENVIO_RPC_INITIAL_BLOCK_INTERVAL=100 ENVIO_RPC_INTERVAL_CEILING=100 pnpm envio start
```

Hosted: Envio Cloud, root directory `indexer/`, config `config.yaml`. The web app reads the endpoint from
`NEXT_PUBLIC_ENVIO_GRAPHQL_URL`.

```graphql
query { OrderEvent(order_by: { blockNumber: desc }, limit: 25) { kind note_id account price mark txHash }
        MarketStats(where: { id: { _eq: "global" } }) { trades volume asks bids } }
```

Verified locally on 14 October 2026 against Monad Testnet from block 70,736,162: the indexer reproduced the live run's
trade (`0x8525c279…`, 4.006807 USDC, mark 4.04728), 8 order events, 11 evidence epochs and every facility status.
