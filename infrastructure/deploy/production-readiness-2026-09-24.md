# Production pass — 24 September 2026

## Subsequent launch-scope decisions

The user accepted the official unsupported-version warning for standard non-L2
Safes and removed their historical tracing coverage from the launch requirement.
The user also declined scheduled off-server backups, accepting that executed
history can be reindexed but pending proposals/signatures may be lost with the DB.
The remaining end-to-end launch check is a user-signed outgoing transaction.
Automatic RPC failover remains unimplemented and was disclosed as an availability
limitation. The audit findings below describe the broader original scope.

## Verdict

Not yet verified as a complete replacement supporting every existing Finney Safe.
The L2 Safe service is running and caught up; standard (non-L2) Safe executed
history is incomplete. Do not equate global L2 checkpoints with tracing coverage.
No resources outside `bittensor-safe` were changed during this pass.

## Verified

- All ten active deployments ready, with no pod restarts at inspection.
- Public UI, health endpoint, chain configuration and new Safe gateway details
  returned HTTP 200. TLS valid through 22 December 2026.
- Real user-created Safe `0x4816aF10706d7F1472837215fdD8f28CFa9A81ad`
  is discovered and its dashboard loads (1 of 1, nonce 0, Safe 1.4.1 L2).
- L2 Safe and token checkpoints reached RPC head 9137869. A later sample at
  9137880 had Safe at head and token indexing one block behind.
  Final sample: both checkpoints and RPC head were 9137926, synced true.
- All 33 discovered Safes checked against on-chain owners, threshold and nonce
  at fixed block 9137878. Owners and thresholds matched for all 33.
- Full TypeScript check passed with all 20 UI overrides applied to the pinned
  upstream UI image. Override mapping: `ui-overrides/paths.json`.
  Typecheck log: `../artifacts/production-typecheck.log` (empty, exit 0).
- Prior focused wallet-switch and creation-status regression checks passed.
  The creation status fix recovers a missed success event through Safe-info polling.
- Three PostgreSQL databases backed up and actually restored into an isolated
  local temporary Postgres container: txs 48 tables, cfg 29, cgw 20; 33 Safes
  present after restore. Test container removed after verification.
- Postgres uses a persistent 20 GiB Hetzner volume; about 91 MB filesystem usage
  and 15 MB transaction database at inspection. Redis is ephemeral queue/cache.

## Changes made in this pass

- Disabled the two temporary fixed-start bootstrap reindex schedules once normal
  indexing reached head. Normal discovery, token indexing and processing remain
  enabled. `retire-bootstrap-tasks.py` checks checkpoints before disabling them.
  Do not blindly rerun the older `configure-standard-tasks.py` bootstrap setup.
- Corrected Governance's zero singleton metadata using its verified canonical
  ProxyCreation receipt and current storage. Updated 31 SafeStatus rows, one
  SafeLastStatus and its setup internal transaction destination. No owners,
  threshold, nonce, execution history or signatures were changed.
  Evidence and guarded operation: `repair-governance-singleton.py`.

## Coverage blocker

There are 18 L2 Safes and 15 standard non-L2 Safes in the discovered set.
Seven standard 1.4.1 Safes have executed on-chain transactions absent from the
service's executed-history tables (database nonce 0):

| Safe | On-chain nonce |
| --- | ---: |
| 0x785C2Fc05ae0b6167B4113a20d054B34950ADa09 | 2 |
| 0x0e9e3a250F77F8Eba7f9B357bBA660b77DB57a71 | 4 |
| 0x8bC974c630393B17efBaC3cf03017D7D2C73FA76 | 3 |
| 0x2Cf793156eeeBeBf150eb3e2505304E6bA087147 | 8 |
| 0x7DD60cF84b2e0a720eD8847B15A089d49B4c3562 | 5 |
| 0x8dE3BD159AA20A67C2AF75FddBe06085D1cea9aa | 22 |
| 0xB6dbADce6Bf5A79bcD3B59C3Ac19be9A4921Ac38 | 8 |

Their singleton is `0x41675C099F32341bf84BFc5382aF534df5C7461a`.
The other eight non-L2 Safes have on-chain nonce 0; this does not prove future
execution support. Public current Safe details use live calls and can return
correct nonce even when indexed history is missing. The upstream UI displays an
unsupported-version/migration notice for a sampled standard Safe. No migration
was initiated and no wallet transaction signed by the agent.

Safe's [RPC requirements](https://docs.safe.global/core-api/api-safe-transaction-service/rpc-requirements)
require tracing for these contracts. They also warn against changing indexing
mode on an initialized database. Preserve the live L2 database; validate any
tracing service in a separate database before planning a switch, including
preservation of pending proposals and signatures.

## RPC research and probes

Backend/API/workers/scheduler use authenticated OnFinality. Frontend public RPC
is lite.chain.opentensor.ai. Automatic RPC failover is not implemented.

Test vector: chain 964; creation block 8074560; transaction
`0x6cd33fcb7db89956e3b6d4622693fe488ec57ce40648ea4fa9ac02895446a301`.
Require real historical trace contents, not merely HTTP 200 or marketing claims.

| Provider | Observed result | Conclusion |
| --- | --- | --- |
| Authenticated OnFinality | trace_transaction, trace_filter and debug_traceTransaction unavailable (-32601) | Existing endpoint does not provide required tracing |
| Authenticated GetBlock | trace_transaction unavailable (-32601) | Not a verified tracing fallback |
| Blockmachine public | Chain 964 verified; trace_transaction and debug_traceTransaction unavailable (-32601) using curl | Documentation alone does not establish live support |
| dRPC public | Chain requires paid plan (code 35) | Paid tracing unverified |
| Nodies public | Endpoint says subscription required | Paid tracing unverified |
| NOWNodes | TAO-specific docs advertise debugging; general shared tracing network list omits TAO | Conflicting docs; no key available to test, unverified |

Follow-up with the user's Blockmachine key (Authorization Bearer header): chain
964, the historical creation receipt and contract code at block 8074560 returned
successfully. However trace_transaction, trace_block, trace_filter,
debug_traceTransaction and debug_traceBlockByNumber all returned -32601 Method
not found. rpc_methods advertises several debug tracing methods despite these
failures. Provider-side clarification is needed; the method listing does not
prove usable tracing. Sanitized results: `reports/blockmachine-authenticated-tracing.json`.
The key is stored privately outside the repository. No live RPC configuration changed.

Primary sources:
- https://blockmachine.io/docs/gateway-methods/bittensor
- https://docs.nownodes.io/tao/
- https://docs.nownodes.io/trace-debug-api/
- https://docs.nodies.app/rpc-services/public-endpoints
- https://raw.githubusercontent.com/RaoFoundation/subtensor/main/vendor/frontier/client/rpc-core/src/debug.rs

The inspected upstream Subtensor Debug RPC interface exposes raw-block/receipt
methods, not debug_traceTransaction. A vanilla self-hosted archive node is
therefore not a verified solution either. A provider could use a custom build;
none has been verified here. No additional subscriptions purchased.

## Recovery and remaining operational work

Private manual backup directory (0700):
`~/.kube/bittensor-safe-backups/production-pass-20260924T133507Z`.
Contains txs/cfg/cgw custom-format dumps, roles, and private Kubernetes recovery
configuration. Files are 0600. Do not publish or commit these files.
This snapshot predates the two bounded database changes described above.

A newer snapshot includes those changes:
`~/.kube/bittensor-safe-backups/manual-20260924T134933Z`.
It contains five recovery files (898,168 bytes), a SHA-256 manifest and a separate
restore verification record. Full isolated restore passed at 13:50:08 UTC:
48 txs tables/33 Safes, 29 cfg tables and 20 cgw tables. Checksums passed.
Roles and full Kubernetes recovery were not exercised by this database test.

Reusable manual operations, run from the repository root:

```sh
python3 deploy/backup.py
python3 deploy/verify-backup.py /absolute/path/printed/by/backup
```

The backup tool reads only the dedicated namespace, keeps secrets out of output,
uses private file permissions, and retains failed output as a `.partial` directory.
The restore tool uses disposable memory-backed PostgreSQL with no network or
published ports; it does not write to the cluster. The databases are dumped
sequentially, not as a cross-database atomic snapshot. Neither script schedules
itself or provides remote retention.

Restore proof used PostgreSQL 16.10, no network, temporary memory-backed storage,
and pg_restore --no-owner --no-acl --exit-on-error into three empty databases.
For actual recovery, provision separate storage first, restore roles/credentials
and databases consistently, verify row counts and Safe state, then plan routing
and worker activation. Do not test restoration over the live databases.

Outstanding:
- Verified historical tracing provider and standard Safe coverage.
- Scheduled off-server backups and an agreed retention/destination. Manual Mac
  copies are available, but no unattended backup protection is configured.
- User-signed small outgoing Safe transaction to prove proposal/sign/execute and
  indexed history end-to-end. Creation alone does not prove this complete flow.
- Tested RPC failure handling/failover. Current deployment has a single backend
  provider and single database instance, not high availability.
- Optional ERC20 price/position integrations: gateway logs contain missing chain
  price-provider configuration and a positions-provider error. Native TAO price
  works; do not claim universal token pricing or portfolio integration support.

The readiness goal remains open until the outstanding scope is resolved or
explicitly narrowed by the user.
