# Native TAO to SS58 — implementation and validation

Finney-only extension of the existing Safe TokenTransfer flow. Accepts raw SS58 prefix-42 AccountId32 addresses and finney:SS58. Checksum/network/zero-account validation occurs in the field and again in transaction construction. EVM recipients retain their upstream transfer implementation. Native TAO only; ERC20 and spending-limit sends to SS58 are rejected.

Native transfer is a CALL to 0x0000000000000000000000000000000000000800 with transfer(bytes32) calldata and an 18-decimal EVM value. Values must be positive and multiples of 1e9 wei (whole native RAO). Max floors to the nearest whole RAO. Existing balance/aggregate amount checks remain, with SS58 precision validation added afterward. Standard Safe signing, threshold, nonce, simulation and execution paths are retained.

Confirmation/details recognize only chain 964, exact precompile, CALL operation, exact selector/length and whole-RAO positive value. The destination is derived from signed calldata and displayed as its full SS58 address with copy and Taostats link. Generic EVM risk lookups exclude native SS58 recipients. Batch review rows show SS58 directly; signing is still the upstream MultiSendCallOnly path.

Checks: six real AddressInput form tests, pure transaction/address tests (checksum, prefixes, precision, token/chain gating, exact call, strict decoder), and read-only mainnet eth_call with the governance Safe as caller. Valid transfer succeeds; unknown selector is rejected. Gateway preview returns exact value and calldata. No transaction was signed or broadcast by the agent. A user-signed small native SS58 transfer remains the final end-to-end check for this new path.

Full TypeScript check and production export passed. Assets published before HTML, old assets retained; public app and SS58-containing bundles matched local bytes. Rollback HTML: artifacts/ui-before-ss58-send-html.tar.gz.
