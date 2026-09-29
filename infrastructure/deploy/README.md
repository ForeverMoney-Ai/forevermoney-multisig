# Bittensor Safe on bg-staging

Namespace: `bittensor-safe`. Intended public host: `safe.forevermoney.ai`.
All resources are namespace-scoped except creation of this dedicated namespace.
No existing workloads, ingress routes, node taints, cluster roles or controllers are modified.

## Current status — production pass, 24 September

Read [the production readiness report](production-readiness-2026-09-24.md) before
changing or announcing this service. The L2 indexer is caught up, but executed
history for seven standard non-L2 Safes is incomplete. No compatible historical
tracing RPC has been verified. Do not change indexing mode on the live database.
The temporary bootstrap schedules are now disabled; normal workers and scheduler
are running. A real new Safe was created and loads, and database restore testing
passed. Scheduled off-server backup and a user-signed outgoing transaction test
remain outstanding. The configuration narrative below is historical.

## Operating configuration snapshot — standard Safe services, 23 September

Apply `standard-services.json` after the baseline manifests. Generate it with
`python3 deploy/build-standard-services.py`. It runs the upstream Safe Celery
worker/tasks and database scheduler. `worker` handles historical indexing;
`worker-live` handles recent indexing and transaction processing. The runtime
wrapper only paces RPC calls and disables latency-based window adjustment; Safe's
discovery/decoding/processing algorithms are unchanged. Both workers and the
transaction API now use the authenticated OnFinality endpoint from the
`archive-rpc` Secret (switched 23 September at the user's request). Public
Opentensor is no longer configured on these active services. The one-address `governance-sync` is
retired (zero replicas); do not re-enable it as the service indexer.

After the Growth upgrade was confirmed by OnFinality's 200-units/second header,
the historical worker was restarted to clear old 120/240/480-second retry waits.
It now starts with 500-block batches and 0.5-second request spacing; live indexing
retains 1-second spacing. Checkpoints advanced from 5161365 to 5165365 (Safe)
and 5160865 to 5163865 (tokens) during the first post-restart observation.

Verified L2 singleton start blocks: 1.3.0 at 4970425 and 5112613; 1.4.1 at
5125434. Each boundary had empty code immediately before and nonempty code at
the recorded block. The global index checkpoints were initialized at those
deployments, never at an unscanned recent head. The standard L2 indexer includes
proxy creation discovery, so upstream's disabled standalone proxy task is correct.

While historical indexing catches up, `configure-standard-tasks.py` schedules
upstream reindex tasks from block 9129342 onward every 30 seconds on
`live-indexing`, without any Safe address filter. Processing runs every 30 seconds.
This keeps newly created Safes and recent events moving independently of old
history. These temporary bootstrap schedules must be removed once historical
checkpoints catch up; their fixed start must not be advanced across an unscanned
gap. They do not mark full history complete. Older, undiscovered Safes can still
return 404 until discovered. Full historic Safe enumeration is NOT complete.

Verification: standard discovery and processing successfully registered the
arbitrage Safe at its creation block 8915307, alongside governance. Both gateway
Safe-info calls returned HTTP 200, with nonces 14 and 28 respectively. The official
UI accepted the second address and displayed its dashboard/2-of-3 threshold and
balance. Factory creation simulation succeeded via `eth_call` from a funded
existing owner; no transaction was signed or broadcast. An actual wallet-based
creation/proposal/execution remains to be tested by its signer.

The old GetBlock API backend was replaced after repeated long-process connection
errors. A private pre-change txs dump is stored under
`~/.kube/bittensor-safe-backups/` (directory 0700, dump 0600); this is a local
recovery copy, not scheduled/off-site backup coverage. Automatic RPC failover is
not implemented. Existing deployments outside this namespace were not modified.

The `safe.forevermoney.ai` ingress is live with DNS A `safe` → `5.161.162.37`.
Apply `tls-issuer.yaml` before `ingress.pending.json` (the latter filename is historical).
The namespace-local `safe-letsencrypt` issuer uses HTTP validation; the shared
cluster issuer only covers creator.bid and was left unchanged. HTTPS certificate
validation and public UI HTTP 200 were verified, alongside successful gateway
responses for both registered Safes, on 23 September. All older
status sections below are historical snapshots, not the current launch status.

## Access

Use the kubeconfig at `~/.kube/bg-staging.yaml` explicitly.

```sh
kubectl --kubeconfig="$HOME/.kube/bg-staging.yaml" -n bittensor-safe port-forward --address=127.0.0.1 svc/ui 3004:8080
```

Open http://localhost:3004. Public ingress is also live at https://safe.forevermoney.ai.

## Configuration and secrets

`deploy/generate.py` generates `deploy/manifests.json`. Secrets are stored with
mode 0600 outside this repository in `~/.kube/bittensor-safe-secrets.json` and
`~/.kube/bittensor-safe-k8s-secrets.json`. Never commit these files.
The generator does not regenerate existing credentials.

The Postgres PVC is 20Gi. The UI PVC requested 1Gi but Hetzner provisioned its
10Gi minimum. Deleting PVCs may delete the underlying volumes; do not do this
as routine cleanup. Production database backups are still to be configured.

Gateway v1.110.0 is pinned by digest because newer upstream images inspected
were ARM-only and this cluster is x86. Gateway uses CGW_ENV=development as the
self-hosted configuration without Safe's AWS KMS/Blockaid integrations; CORS is
still disabled and these unused features must remain disabled. All Django debug
settings are off. UI gateway uses same-origin `/cgw`.

Transaction service v6.10.1; config service v2.105.0.
The index scheduler is running (one replica).
The initial worker startup ran migrations and setup_service. Subsequent startup
sets RUN_MIGRATIONS=0 to preserve explicit indexing start blocks. For a clean
new database, run migrations/setup_service before starting workers and configure
contract start blocks before enabling the scheduler.

## UI build

### ForeverMoney asset metadata

`import-forevermoney-metadata.py` copies the ForeverMoney snapshot (128 subnet
names, 106 supplied logos, TAO fallback for 22) to `artifacts/metadata`. Publish
that directory at `/usr/share/nginx/html/assets/metadata` on the UI volume.
`cfg` uses `MEDIA_URL=https://safe.forevermoney.ai/assets/metadata/`; run
`seed-chain-logos.py` through `python src/manage.py shell` in cfg.
Run `seed-token-metadata.py` through `python manage.py shell` in txs for the
verified chain-964 wrapped TAO, SN10/Pareton, and SN80/OpenRoboto contracts.
The names/artwork come from ForeverMoney's 9 September snapshot. All three
contracts returned the expected symbols and 18 decimals on chain 964.
Only display metadata was set; existing trust/spam classifications are preserved.
The full catalog is served at `/assets/metadata/subnets.json`, but catalog entries
without a contract are not ERC20s and are not fabricated into Safe balances.
Native subnet stake still requires a separate integration. Keep the metadata
directory when deploying future UI builds.

Official image: `safeglobal/safe-wallet-web@sha256:03ff53f8235305ae8b94347dfd7507dbe4a10607897c70f297b1c4e47099f4ba` (reports 1.99.2).
Static output lives in ignored `artifacts/ui` and is served by nginx in-cluster.
Build locally to avoid resource pressure on live cluster workers. Build env:

- NEXT_PUBLIC_IS_PRODUCTION=true
- NEXT_PUBLIC_IS_OFFICIAL_HOST=false
- NEXT_PUBLIC_BRAND_NAME=ForeverMoney Safe
- NEXT_PUBLIC_GATEWAY_URL_PRODUCTION=/cgw
- NEXT_PUBLIC_DEFAULT_MAINNET_CHAIN_ID=964
- NEXT_PUBLIC_SAFE_VERSION=1.4.1
- NODE_OPTIONS=--max-old-space-size=3072

`deploy/build-ui.sh` disables build-time lint/type checking and source maps in
the disposable build container to fit local memory. This is not a claim that upstream lint/type checks pass.
The header has a small display-only SS58 addition: copy
`ui-overrides/SpaceSafeBar.tsx` to `src/components/common/SpaceSafeBar/index.tsx`
and `ui-overrides/BittensorAddress.tsx` alongside it before building. It retains
the EVM address and shows the SS58 mirror only for chain 964. The mapping is
blake2b-256 of `evm:` plus the 20-byte address, encoded as SS58 prefix 42 with
the standard two-byte checksum. Both registered Safe vectors were verified
against the chain's addressMapping precompile and an independent Python encoder.
Wallet/transaction logic is unchanged.
Deployed 23 September: public header verified for arbitrage and its copy button
returned the expected SS58 string. Previous static output is saved locally in
`artifacts/ui-before-ss58.tar.gz`; new output is in `artifacts/ui-ss58`.
The current branded layout (`artifacts/ui-branded`) places SS58 first, then `|`,
then EVM in the existing address line. Copy `ui-overrides/SafeSelectorTriggerContent.tsx`
to `src/features/spaces/components/SafeSelectorDropdown/components/SafeSelectorTriggerContent.tsx`
before building. Both addresses reuse upstream FullAddress, CopyAddressButton and
ExplorerLinkButton, with unchanged activation behavior and always-visible icons.
SS58 links to Taostats; EVM uses the chain's explorer. The standalone SS58 row
is removed. Address conversion and transaction behavior are unchanged.
Run `python3 deploy/brand-mobile.py artifacts/ui-branded` on the exported output
before upload to keep the address card bounded at narrow screen sizes.
Wallet connection, signing and transactions require separate user testing.

## Before public rollout

- Reliable historical Bittensor RPC, indexer caught up, and existing Safe reads verified.
- Validate current image versions/compatibility and backup/recovery configuration.
- Add namespace-scoped ingress and TLS for safe.forevermoney.ai.
- Cloudflare DNS should point that host to existing ingress IP 5.161.162.37.
- Expose only UI and required client gateway paths; keep database/admin endpoints private.

## Verified status — 22 September 2026

- All seven running application pods ready; continuous scheduler remains stopped.
- Private UI HTTP 200; browser confirmed Accounts and governance Safe dashboard.
- Governance Safe API returns version 1.4.1+L2, nonce 26 and threshold 2 of 3.
- Gateway chains API returns Bittensor/964 as the only configured chain.
- The replacement backend GetBlock URL is stored in `~/.kube/bittensor-safe-rpc-url`
  (0600) and the transaction-service Secret. Secret equality was verified without
  printing credentials. The original frontend key is no longer used here.
- The replacement GetBlock endpoint supports current state but returned empty
  historical code/logs and no receipt for the known governance Safe creation.
- Official `https://archive.chain.opentensor.ai` returned historical code and the
  real creation event at block 8786146. Partial backfill hit HTTP 429 and the
  historical-work budget. Do not treat the history as complete or hammer retries.
- OnFinality `https://bittensor-finney.api.onfinality.io/public` passed chain 964,
  historical code (171 bytes), creation log, and creation receipt checks against
  the same known block/transaction. See `deploy/reports/rpc-check.json` and rerun
  `node deploy/check-rpc.mjs` for read-only verification. Sustained backfill and
  authenticated-account limits still need validation before continuous indexing.
- Worker now uses the authenticated OnFinality archive Secret; transaction API uses the
  replacement GetBlock endpoint. No scheduler has been enabled.
- `deploy/archive-contracts.json` records verified deployment boundaries.
  `deploy/contracts.json` has current addresses but no validated start blocks.
  Indexing starts remain at zero until archive setup and backfill are complete.
- Governance Safe was registered from its actual creation transaction. History
  remains incomplete. No signatures or on-chain transactions were sent.
- `deploy/ingress.pending.json` passed server dry-run but has NOT been applied.
  No public route/DNS/certificate exists yet for this new deployment.
- Existing safe964 deployment was left unchanged.

Provider references:
- https://www.onfinality.io/en/networks/bittensor-finney (archive support; public
  5 requests/sec, free authenticated tier advertised up to 40 requests/sec).
- https://getblock.io/nodes/shared/ (Bittensor listed as Full, not Archive).
- https://preview.bittensor.com/docs/guides/running-a-node (public archive is for
  occasional history; own archive requires substantial separate resources).

This is a working UI preview, not a fully validated production wallet service.
Resolve historical RPC/indexing, then verify account data and transaction
preparation before publishing the hostname.

## Authenticated archive backfill — 22 September 2026

- Authenticated OnFinality URL saved mode 0600 at
  `~/.kube/bittensor-safe-archive-rpc-url`; Kubernetes Secret `archive-rpc`.
  The worker and backfill Jobs use this Secret, never a public frontend setting.
- `archive-sample` successfully processed blocks 8786146–8796145 (10,000 blocks)
  with one Safe event and no rate-limit errors, in approximately one minute.
  Provider billed response-unit usage has not been verified.
- `governance-history-backfill` is a bounded Kubernetes Job for governance Safe
  events and ERC20/ERC721 transfers from creation to a captured head minus 20.
  It has no automatic retry and a three-hour deadline. It runs independently of
  the local terminal. See the Job's status/logs to determine actual completion.
- This targeted job does NOT advance global indexing checkpoints. Scheduler
  remains off until broader history and contract start blocks are configured.
- Do not equate `BACKFILL_COMPLETE` with full production readiness, complete
  native-transfer coverage or indexing of every Safe on Bittensor.

### Backfill recovery

The initial governance-history-backfill job failed on HTTP 429 after processing
through block 9001168 (~64% of the Safe-event scan). A subsequent single-block
archive probe returned HTTP 200. `governance-history-resume` continues from
9001169 through the original cutoff 9122933, then scans token events from creation.
It uses one log-query worker, a pause between bounded chunks, and exponential
60/120/240/480-second waits after errors (maximum five attempts). Completed ranges
are logged as CHECKPOINT entries. It never skips failed ranges. The scheduler
remains disabled. Billing allowance/plan has not been confirmed from the dashboard.

Backfill suspended after repeated rate limits. Last confirmed SAFE checkpoint 9081168, next block 9081169; cutoff 9122933. Token scan still pending from 8786146. See reports/paused-checkpoint.json. Do not simply unsuspend the old Job: its script starts from the earlier checkpoint. Prepare a new bounded run after fixing request-level pacing or replacing the provider.

### Request-paced OnFinality run

Active Job: governance-history-paced. Resumes SAFE at 9081169 through 9122933,
then TOKEN from 8786146. Old resume Job remains suspended. The bounded new Job
has a 12-hour deadline and no automatic job retry. deploy/paced-backfill.py
serializes OnFinality requests within the job, spaces requests by at least 15s
(weighted for batches), honors numeric Retry-After and waits at least 120s with
exponential backoff on HTTP 429 / explicit quota RPC errors. It stops after five
rate-limited attempts without skipping a block range. Offline tests verified
spacing, Retry-After and bounded retry behavior. The worker is a separate process,
so this is not an account-wide limiter; the continuous scheduler remains off.
Monitoring was re-enabled for the new Job. Actual progress is recorded in logs.

### Token scan correction

SAFE stage completed through 9122933. Deliberate request pacing was included
in upstream query-duration measurement, causing ERC20 auto-adjustment to collapse
to single-block queries. Suspended governance-history-paced; new active Job is
governance-token-paced (deploy/paced-token-backfill.py). It disables adaptive
block sizing for this bounded token scan while preserving request-level pacing,
rate-limit waits and fixed 1000-block windows. Token scan restarts at creation
8786146 (only a few individual blocks had been scanned; replay is idempotent).
Monitoring now targets governance-token-paced. No global scheduler enabled.

### Fixed-window token continuation

The authenticated archive provider is OnFinality. Its usage dashboard showed
ample daily quota, while upstream retry logic repeatedly reduced failed windows
to one block. `governance-token-paced` was suspended at its last complete
1,000-block checkpoint, 8899145. `governance-token-fixed` continues at 8899146
through 9122933. It calls the ERC20/721 indexer directly with fixed 1,000-block
windows, retains request-level pacing and rate-limit waits, and retries a failed
window without reducing its size or skipping blocks. The first fixed window
completed successfully. Reprocessing a partially scanned range is idempotent.

## Gap investigation and continuous governance indexing — 23 September

The fixed historical scans completed at 9122933, but no continuous follower was
started, leaving newer blocks unscanned. In addition, `reprocess_addresses()`
only resets decoded records; it does not execute their final processing. All 27
decoded records (setup plus 26 execTransaction calls) were pending. Explicitly
running `process_decoded_txs_for_safe()` produced 26 multisig transactions with
consecutive nonces 0–25 and SafeLastStatus nonce 26. Earlier reports interpreting
zero MultisigTransaction rows as absence of executed transactions were incorrect.

`deploy/build-sync.py` generates `deploy/continuous-sync.json`: one scoped
governance-sync Deployment and its code ConfigMap. The follower scans both Safe
and ERC20/721 events, processes decoded transactions, and then commits progress.
Upstream writes are idempotent: a failed window is replayed before progress can
advance. Slow RPC calls run outside the checkpoint transaction, avoiding the
database idle-in-transaction timeout encountered during initial verification.
It follows RPC `finalized`, checks chain ID 964 and
saved block hashes, uses fixed windows with request pacing, and retains progress
in the txs database table `fm_governance_sync`. A Postgres advisory lock prevents
overlapping followers using a dedicated unpooled session. A lost lock session stops the process so Kubernetes
can restart it and reacquire the lock. Readiness requires fresh status and lag at
most 20 blocks relative to the finalized height observed during that cycle.

The separate global scheduler intentionally stays at zero: global factory
discovery has not been backfilled and must not be marked caught up. This follower
tracks only the explicitly bootstrapped governance Safe. To add another Safe,
first verify and backfill that Safe; do not reuse this checkpoint for it.
Finalized block-hash disagreement fails closed and requires investigation.
No signing, broadcasting, public ingress, or existing workload changes are part
of this repair. `python3 deploy/test-sync.py` checks window boundaries and pacing.

Verification: restarting only `governance-sync` preserved the durable checkpoint
at 9124933; its replacement continued at 9124934. The following window recovered
the second post-cutoff execution. Database history now contains 28 consecutive
multisig nonces (0–27), zero pending decoded records, and Safe status nonce 28,
matching a direct current-chain read. The new namespace's API was separately
restarted after its long-lived process returned RPC connection errors while a
fresh process succeeded; gateway history then returned HTTP 200. This recovery
does not establish the underlying cause of that separate connection failure.

Final check on 2026-09-23 around 01:37 UTC: the follower committed 9126934–9127051,
then automatically followed the newer range 9127052–9127067. Both cycles reached
their observed finalized head. An independent current-state read returned live
tip 9127083 (16 blocks ahead), DB and chain nonce 28, 28 consecutive executed
transactions, and zero pending decoded records. Gateway history repeatedly
returned HTTP 200 with count 29 (28 executions plus the incoming transfer).
Both follower and API were Ready. Request pacing means ordinary ongoing lag of
a few minutes; reaching an observed finalized head does not mean zero lag to a
later live-tip reading. Monitoring must compare timestamps and live tip as well
as the reported per-cycle lag. No claim of global Safe discovery completeness.

### Recent-block latency improvement — 23 September, morning

Read-only provider comparison found GetBlock returned zero logs for the known
execution at block 9125865, while OnFinality returned two. Therefore the follower
continues using OnFinality; switching to GetBlock could silently omit events.
Twelve recent-block/log requests at one-second intervals succeeded on OnFinality.
The continuous follower now uses `SYNC_RPC_INTERVAL_SECONDS=1` and
`SYNC_POLL_SECONDS=6`; historical backfill scripts retain their conservative
15-second spacing. Rate-limit retries and Retry-After remain unchanged and were
tested at both pacing speeds. Default script values remain 15 and 60 for rollback.

Readiness now requires a status less than 90 seconds old and at most six blocks
behind a fresh live tip (`head_lag`), rather than relying on the pre-scan finalized
height. The faster follower processed consecutive windows with live-tip gaps of
2–3 blocks (roughly 24–36 seconds) and no rate-limit errors during verification.
Finality/hash checks, durable progress, and the dedicated advisory lock remain.
Only the governance follower Deployment and its code ConfigMap were updated.

### Public archive follower — 23 September

The faster OnFinality configuration subsequently hit repeated rate limits and
was not sustainable. The governance follower now explicitly uses
`https://archive.chain.opentensor.ai`, with one-second request spacing and six-second
poll pauses. HTTP and WebSocket tests returned chain 964 and both expected logs
at block 9125865. Retry-After/backoff also applies to this public provider.
The follower retains its saved checkpoint; no history is skipped or reset.

OnFinality's `archive-rpc` Secret remains available for historical recovery jobs,
but is no longer injected into this follower. There is no automatic provider
failover. API/current-state RPC, worker, UI, and other namespaces are unchanged.
To revert the follower, remove its explicit `ETHEREUM_NODE_URL` override and
restore `archive-rpc` as its last envFrom source, using conservative pacing.

Post-switch verification: nine samples over more than six minutes showed the
checkpoint advancing 9129100 → 9129132, live-tip lag 3–4 blocks, zero rate-limit
responses, zero sync errors, and zero restarts. Evidence is saved in
`deploy/reports/public-archive-verification.json`. The final independent check
read checkpoint 9129132 versus live tip 9129136, all 28 executions present, zero
pending decoded records, and both DB and on-chain nonce 28. This is a bounded
successful trial, not a guarantee of future public-endpoint availability.

### Finney address URLs — 23 September

Public Safe links use `?safe=finney:<SS58>`. `finney:<EVM>` and legacy
`tao:<EVM>` links are accepted and normalized to the SS58 display URL.
Next.js keeps `tao:<checksummed EVM>` in its internal route query so the stock
Safe account hooks and transaction API continue using EVM addresses.

`ui-overrides/FinneyUrl.tsx` belongs at `src/components/common/FinneyUrl.tsx`;
`ui-overrides/app.tsx` at `src/pages/_app.tsx`; and `ui-overrides/useChainId.ts`
at `src/hooks/useChainId.ts` in the Safe web app. These are in addition to the
existing branding/address-bar overrides. Build with the existing export workflow.

Run `python3 deploy/build-resolver.py` then apply `deploy/address-resolver.json`
in namespace `bittensor-safe`. This overlay includes the UI nginx resolver route;
apply it after any baseline UI nginx manifest. Restart the UI deployment if its
subPath nginx configuration changed. The lookup service runs the same pinned
transaction-service image and reads registered `SafeContract` addresses, with a
five-second cache. It never calls an RPC or writes to the database. SS58 checksums
and prefix 42 are validated. Unknown SS58 addresses return 404 with guidance to
open the EVM address; SS58 reversal requires the Safe to have been discovered.
An EVM alias can be converted without that lookup. No index checkpoints changed.

Verification: both known Safe mapping vectors passed; public resolver returned
200 for known addresses, 400 for malformed input, and 404 for an unknown valid
SS58 address. Browser checks passed for direct SS58, Finney EVM alias, legacy TAO
EVM alias, preserved query/hash, Assets and transaction-history navigation, and
reloading transaction history. Final bundle: `_app-7a85c232b1ebda8a.js`.
Same-account navigation preserves the mounted application. Wallet signing was
not exercised. Production export passed; inherited build configuration skips
TypeScript/lint checks.

The Finney lookup now reuses Safe's `LaunchScreen` component, including its logo,
progress bar and captions. `ui-overrides/LaunchScreen.tsx` replaces
`src/components/common/LaunchScreen/index.tsx`; its optional `pending` flag keeps
it visible during address resolution. The Redux provider wraps the URL resolver
so the existing launch-screen hook has its normal store context. Lookup errors
retain their retry UI. No RPC or indexing configuration changes are involved.

### Global discovery and paid-RPC audit — 23 September

Active historical and bootstrap-live jobs have no Safe address allowlist and no
ignored initiators/recipients. Stock SafeEventsIndexer searches all emitter
addresses for its supported event signatures, including SafeSetup and
ProxyCreation. This is L2 event-based indexing, not a guarantee of full history
for custom or non-L2 Safe implementations requiring execution traces.

OnFinality binary search verified factory 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2
first has code at block 4970386 and no code at 4970385. The other configured
factories had no code at 4970424. The original earliest L2 start was 4970425.
An unfiltered eth_getLogs check AND stock reindex_master_copies for the inclusive
range 4970386–4970425 both returned zero events. This closes the 39-block factory
start interval without rewinding or advancing any historical checkpoints.

Only the historical worker was rolled out with 0.1-second request pacing and
RPC_ADAPTIVE_WINDOWS=1. Upstream adaptive sizing now recovers after successful
reads rather than only shrinking after errors. Initial/max window is 500 blocks;
429 retry/backoff, one concurrent getLogs per indexer, global discovery and saved
checkpoints remain. Live worker retains its pacing/adaptive defaults. Do not
apply all generated deployments to roll out this historical-only tuning.

### Finney presentation throughout the UI — 24 September

See `address-display-audit.md` for address-rendering entry points and validation.
Apply `sh deploy/apply-address-overrides.sh` on top of existing URL and branding
overrides. Chain 964 uses `finney` in UI chain metadata, SS58 primary and EVM
secondary in shared address displays. Backend chain metadata and transaction
payloads remain unchanged. Native asset ticker remains TAO. FinneyReceive offers
separate SS58 and EVM mirror QR modes with raw wallet-compatible address payloads.

### Wallet network switch recovery — 24 September

`ui-overrides/tx-sender-sdk.ts` replaces `src/services/tx/tx-sender/sdk.ts`;
`ui-overrides/ChainSwitcher.tsx` replaces `src/components/common/ChainSwitcher/index.tsx`.
After adding a missing network, verify eth_chainId and explicitly switch when
needed. Wait for Onboard's confirmed target network with a 45-second bound and
subscription cleanup. The switch button always resets and reports errors; it
never marks an unconfirmed chain as correct. Actual transaction signing remains
behind the existing chain assertion and wallet approval. Mocked tests in
`check-wallet-switch.cjs` pass for success, rejection, missing network add+switch,
and no-event timeout. Wallet-specific reproduction still requires the user's
wallet/network details.

### 2026-09-24: activation completion recovery
A fresh 1.4.1+L2 Safe at `0x4816aF10706d7F1472837215fdD8f28CFa9A81ad` was created by the user and confirmed indexed with one owner/threshold 1. The original creation screen remained pending. Hardened the status handoff: retain the exact created address in step data, filter events by address and chain, treat INDEXED as completion, and use the existing gateway poll to recover a missed success event. Pending-record removal no longer erases the redirect target. Signing/deployment code unchanged. Regression harness `check-creation-status.cjs` verifies success followed by INDEXED/removal, unrelated events, and recovery after a missed event. Actual original-tab event sequence was not captured, so the precise trigger remains unproven.
