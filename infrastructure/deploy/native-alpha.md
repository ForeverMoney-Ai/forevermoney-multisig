# Native Finney alpha in multisig Assets

Native subnet stake is read from the multisig's Bittensor coldkey mirror. It is not represented as a fabricated ERC-20. Subnets appear as normal rows in the existing Assets table, with expandable validator positions and per-validator transfers.

- Finney 964 only; staking V2 precompile 0x…0805.
- Read all positions in one block-pinned StakeInfoRuntimeApi_get_stake_info_for_coldkey call. Strict SCALE decoding checks the owner, bounds, duplicates, and complete consumption; unknown layouts fail closed. No per-subnet discovery scan.
- Amounts remain integer alpha units (9 decimals); Max is a balance snapshot. Later rewards stay behind.
- Same-subnet transferStake, ordinary CALL, zero attached TAO. No cross-subnet conversion, staking purchase, unstake, or validator change in this flow.
- Live alpha prices come from 0x…0808 getAlphaPrice (TAO per alpha, 18 decimals), multiplied by the existing selected-currency TAO quote. Unpriced positions show unavailable values, never a fabricated zero. Assets total includes available native valuations; other site-wide summaries still use the gateway's token total.
- Fresh balance validation and read-only precompile simulation precede standard Safe SDK transaction creation. Existing signer/threshold/nonce approval flow remains responsible for signing and execution.
- A precisely decoded native transfer gets an informational ForeverMoney extension explanation for unavailable system-precompile verification. Other risk findings are retained.

References: https://www.bittensor.com/docs/guides/evm/precompiles/staking-v2 and https://preview.bittensor.com/docs/guides/evm/read-chain-state

## Validation

- TypeScript and production export passed. Eight UI/table tests passed.
- `check-native-alpha.cjs`: amount precision, chain/selector/operation/value boundaries, live position discovery, preserving other analysis findings.
- `check-native-alpha-ui.test.tsx`: partial/Max form, invalid/self recipient, excess amount, stale balance disabling, grouped validators.
- `check-native-alpha-simulation.cjs`: real chain eth_call from multisig and real SDK construction for partial and full SN10 position; no signatures or broadcasts.
- `check-finney-rpc.cjs`: batched read fallback, no write retry.
- Local browser fixture in ignored artifacts: signing-disabled EIP-6963 wallet, no private key. It proxies only explicitly allowed reads, transaction previews and security analysis; it is never part of the production export.

## Rollback

Before publication: `artifacts/ui-before-native-alpha.tar.gz` is an integrity-checked backup of mutable production files. Previous immutable chunks remain deployed. Restore the archive to the UI deployment's `/usr/share/nginx/html` to roll back the page references. No database or contract changes.

## Published verification — 2026-09-28

Deployed the production export after eight table/form tests and desktop/mobile browser checks. A signing-disabled local wallet reached standard confirmation with 0.1 SN10, the exact recipient, and unchanged validator; Max filled 0.418946583. Live native valuation included about $0.79 in the Assets total despite zero liquid TAO. No financial transaction was signed or broadcast during these checks. Transaction Builder route regression checks passed after publication. Rollback archive remains available.

## Fast loading and standard entry step

- Versioned, address-scoped local cache retains confirmed snapshots for up to one day; last-known balances stay visible during refresh and are explicitly marked. Cached or failed reads cannot enable sending until a fresh read succeeds. Transaction review independently checks live available stake and simulates the call.
- First load shows an unknown/loading total rather than zero while native stake is unresolved.
- Asset Send opens the standard TxFlow/TxFlowStep/TxCard transaction page. Choose validator, recipient, amount or Max there; Next enters the standard review and existing signature/execution stages.
- Multiple validators are summed into a single subnet row. Transfers choose one validator position; Max is that position only. The destination retains the validator and subnet. No implicit validator aggregation or stake swap.
- Runtime fixtures cover multiple validators/subnets, truncated payloads, wrong owners, and empty positions. Live runtime balance matched getStake at the same block. Complete direct read measured ~0.64 seconds; cross-check included ~1.06 seconds.

Published fast-loading build on 2026-09-28. Six focused cache/form/grouping tests passed; TypeScript/export passed. Desktop and mobile browser checks covered standard entry page, Max, partial transfer, confirmation decoding and Back preserving data. No signatures/broadcasts. Live Assets loaded 0.418961239 SN10 (~$0.80) after a fresh load; production HTML matched the export and every referenced script was accessible. Transaction Builder routes passed. Immediate predecessor backup: artifacts/ui-before-alpha-fast.tar.gz.

## Automatic validator allocation

The standard send page defaults to combined balance, chooses largest positions first, and shows an expandable exact breakdown. Manual validator selection remains under advanced details. Max uses all eligible positions. Allocation is deterministic and uses integer alpha units; no validator or subnet changes. At most 64 calls are planned. The Safe SDK creates a MultiSendCallOnly batch when more than one position is needed. Each leg is checked against live stake and simulated; the entire batch is simulated through Safe.simulateAndRevert before review becomes actionable. Small legs may be rejected by chain minimums rather than silently changing the amount. Strict batch recognition accepts only canonical CallOnly targets, zero outer value, delegatecall wrapper, and same-recipient/same-subnet native CALL legs; other Shield findings remain unchanged.

Automatic-selection update published and verified 2026-09-28. Six UI/cache tests and allocator/batch-decoder tests passed. Live read-only simulation used two 0.1 SN10 portions from the one currently funded validator, including ethers revert extraction; no signatures or broadcasts. Multiple distinct validators covered by deterministic allocation/decoder fixtures, not a funded live transfer. Mobile standard send and final confirmation checked; production export equality/script access and Transaction Builder route checks passed. Rollback: artifacts/ui-before-alpha-batch.tar.gz.

## TAO EVM recipients — 2026-09-28

Native alpha accepts raw or finney-prefixed TAO EVM and SS58 recipients. EVM addresses resolve through Bittensor's blake2b256(evm: + address bytes) coldkey mapping; the entry screen displays the SS58 mirror, and standard review decodes that destination from calldata. Invalid checksum/zero addresses and both forms of self-transfer are rejected. No change to amounts, validators or batching. Seven UI/cache tests, destination-equivalence/invalid-input tests, TypeScript/export and read-only batch simulation passed. Local browser entered a prefixed EVM address, reached standard confirmation for 0.1 SN10, and preserved input on Back. Published export and script availability plus Transaction Builder routes verified. No signing or broadcasting. Rollback: artifacts/ui-before-alpha-evm.tar.gz.

## Native transfer history summaries — 2026-09-29

Transaction summary rows recognize strictly decoded native alpha calls and same-subnet/same-recipient canonical batches. Eligible Finney custom/batch rows reuse the gateway details cache; unrelated rows retain lazy details loading. Recognized rows use the standard outgoing TokenAmount presentation, subnet logo, SN symbol and Send/Sent label. Expanded full precision, recipient, validator and audit details remain intact. TypeScript/export passed; actual nonce 4 SN10 transfer verified locally beside standard TAO history rows, including expansion. Published history export and all referenced scripts verified. Rollback: artifacts/ui-before-alpha-history.tar.gz.

## Verified native batch notices — 2026-09-29

Recognized same-subnet native stake batches get a ForeverMoney informational explanation only after the read provider reports Finney (964) and the batch target's deployed runtime matches a pinned canonical Safe MultiSendCallOnly 1.3.0 or 1.4.1 hash. Strict decoding still requires zero-value delegatecall to an allowed wrapper and only same-recipient/same-subnet native transfer CALL legs. Missing RPC/code verification leaves the original warnings intact. Only wrapper verification-unavailable and expected batch delegatecall findings become informational; all unrelated findings remain unchanged. The notice explicitly distinguishes local checks from Safe Shield verification.

Validation: allocator/decoder/adversarial-result checks and live runtime hash check passed. The signing-disabled browser fixture reached standard confirmation for 0.6 SN10 across the two actually funded validators. The information state did not require risk acceptance after adding the known account locally. No signatures or broadcasts. Rollback: artifacts/ui-before-alpha-shield.tar.gz.

Published after final browser verification. Production HTML and every changed chunk matched the tested export byte-for-byte; all referenced scripts and Transaction Builder route checks passed. Screenshot: artifacts/alpha-shield-batch-e2e.png.
