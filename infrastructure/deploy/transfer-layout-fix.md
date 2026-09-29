# Transfer address layout fix — 2026-09-24

Aligned the transfer To/From label and avatar with the primary SS58 address. Kept the action menu alongside the primary copy/explorer actions, with the EVM address beneath. Full addresses wrap on narrow screens; shortened account rows retain truncation.

Added the stock TransferTxInfo component override and registered it in both override mappings. No transaction construction, signing, or value logic changed.

Validation: static production build passed; separate full TypeScript check passed. Local shared transfer component checked at desktop and 390px mobile widths, with full address text preserved and no icon overlap. Live incoming transfer expanded and visually verified after deployment. This verifies the shared layout, not an outgoing signed transaction.

Deployed static assets first, then HTML, only to bittensor-safe/ui. Public bundle _app-a7646769f9e5398d.js matched local export byte-for-byte (5534618 bytes). Prior hashed assets retained. Rollback HTML: artifacts/ui-before-transfer-layout-html.tar.gz.
