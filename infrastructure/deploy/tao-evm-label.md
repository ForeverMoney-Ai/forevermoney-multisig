# Recipient wording and Safe Shield investigation (2026-09-26)

Finney recipient placeholder now reads `TAO EVM or SS58 recipient address`.

The gateway log at 2026-09-26T14:15:44Z reports metadata lookup failure for chain 964 address 0x0000000000000000000000000000000000000800. This is the native TAO transfer precompile used by the SS58 send flow. Safe Shield's contract analysis calls its data decoder metadata service; a failed lookup maps to VERIFICATION_UNAVAILABLE. It does not establish that the final recipient is a smart contract, nor that the transfer failed. Plain empty-calldata EVM sends are excluded by upstream extractContracts. The warning is preserved, with no bypass or fabricated verification status.

Rollback HTML: artifacts/ui-before-tao-evm-label-html.tar.gz. Previous immutable assets retained.
