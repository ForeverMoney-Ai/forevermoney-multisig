# Receive panel redesign — 2026-09-24

SS58-first segmented format selector, matching QR and selected-address card, explicit copy and explorer actions. Full plain wallet address wraps inside the card; no duplicated secondary address. Both finney:SS58 and finney:0x link inputs remain supported and resolve to the same Safe.

Validated desktop and 390px mobile views for both formats; clipboard values and QR input match the complete selected plain address, explorer links match the selected format. Static build and independent full typecheck passed. Public app bundle verified byte-for-byte after assets-first deployment only to bittensor-safe/ui. Previous hashed assets retained. No transaction/signing logic changed.

Rollback HTML: artifacts/ui-before-receive-redesign-html.tar.gz.
