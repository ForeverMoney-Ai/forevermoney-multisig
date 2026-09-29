# Browser RPC

Finney frontend reads use a separate origin-restricted OnFinality API app. The API app key is intentionally public in the browser bundle. Allowed origin is `https://safe.forevermoney.ai`.

The indexing deployment, secrets, backend RPC URLs, and chain config database were not changed. Wallet-added network URLs retain the original unrestricted public RPC, since wallet services may not send the site's Origin header.

`utils/finney-rpc.ts` overrides browser chain configuration and retries only allowlisted read methods on `https://lite.chain.opentensor.ai` after primary transport errors, invalid responses, or rate-limit errors. Timeout is 10 seconds per endpoint. Ethers reads and the core Safe SDK/transaction-check SafeProvider share this transport. Custom user RPCs and other chains remain untouched. Contract reverts are returned unchanged. Signing/broadcast methods never retry on the fallback. This is RPC availability fallback, not a guarantee against both providers being unavailable or serving stale state.

Validation: real primary chain 964, latest block and Safe nonce; allowed-origin succeeds, other origin/no origin rejected; CORS preflight supports POST/content-type; fallback chain 964/CORS verified. `node deploy/check-frontend-rpc.cjs` checks successful primary, network/HTTP/rate-limit/malformed response failover, preservation of reverts, broadcast no-retry, both-provider failure, batches, custom RPC/other chain isolation, and SDK routing.

Rollback: restore `artifacts/ui-before-frontend-rpc-html.tar.gz` into the UI webroot. Immutable pre-change assets remain present. Pre-change existing override files are in `artifacts/before-frontend-rpc/`.

Additional verification: a temporary same-origin browser page ran the deployed read transport from `https://safe.forevermoney.ai`, with only OnFinality contacted, returning chain `0x3c4` and Safe nonce 4. The page was removed afterward. Actual ethers-provider integration tests in `deploy/check-frontend-rpc-provider.cjs` passed reads, SDK request adaptation, failover, and CALL_EXCEPTION handling for reverts. All-override TypeScript check passed.
