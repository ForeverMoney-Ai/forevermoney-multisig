# RPC guard

In-cluster JSON-RPC proxy (`rpc-guard:8545`) between the Safe services (`txs`, `worker`, `worker-live`, `scheduler`, `governance-sync`) and the Bittensor EVM archive RPC.

OnFinality load-balances each request across backends, and a lagging backend answers with an old head and empty logs. The Safe indexer then stalls or misses recent blocks, which shows up as flapping `sync-alert` messages. The guard sends every request upstream in one batch with `eth_blockNumber`, so the head shows which state answered it:

1. Primary (OnFinality archive) up to `PRIMARY_ATTEMPTS` times while the reply is more than `MAX_LAG_BLOCKS` behind the best head seen.
2. Then the fallback (GetBlock, full node, not archive) within `FALLBACK_DAILY_CALLS` per UTC day. A fallback reply is used only when every call in it succeeded.
3. Otherwise the freshest reply received, so behaviour is never worse than calling the primary directly.

A primary 429 is passed through so the worker pacer backs off. `GET /healthz` returns counters; the same counters are logged every 5 minutes.

## Credentials

Upstream URLs contain API keys and live only in the cluster Secret `rpc-guard` (never in this repository):

```
kubectl -n bittensor-safe create secret generic rpc-guard \
  --from-literal=PRIMARY_RPC_URL="$ONFINALITY_URL" \
  --from-literal=FALLBACK_RPC_URL="$GETBLOCK_URL"
```

The Safe services read `ETHEREUM_NODE_URL` from Secret `archive-rpc`, which points at `http://rpc-guard:8545`.

## Rollback

Set `archive-rpc` `ETHEREUM_NODE_URL` back to the OnFinality URL (`PRIMARY_RPC_URL` in Secret `rpc-guard`) and restart `txs`, `worker`, `worker-live` and `scheduler`.

## Tests

```
cd infrastructure/deploy/rpc-guard && python3 -m unittest test_rpc_guard
```
