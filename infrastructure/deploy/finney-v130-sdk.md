# Finney Safe 1.3.0 L2 SDK initialization fix

The canonical Safe 1.3.0 L2 deployment is live on chain 964, but this UI's safe-deployments registry does not list chain 964 for that version. The default SDK lookup failed with `Invalid multiSend contract address`, leaving transaction controls in the loading state.

`ui-overrides/safeCoreSDK.ts` now explicitly resolves canonical auxiliary contracts only for chain 964, version 1.3.0 (including +L2 metadata), and the recognized canonical L2 implementation. It does not enable unsupported L1 implementations or change any on-chain contract.

Verified all eight canonical 1.3.0 deployment addresses with `eth_getCode` against official registry code hashes on Finney. SDK initialization and nonce reads pass for the affected 1.3.0 L2 Safe and a 1.4.1 L2 Safe, with and without the chain L2 metadata flag.

Rollback HTML: `artifacts/ui-before-multisend-fix-html.tar.gz`. Previous immutable Next assets remain on the UI server. Restore this archive into `/usr/share/nginx/html` of deployment/ui in namespace bittensor-safe to roll back. Do not touch the indexer or database.

Deployment verified 2026-09-25: live `_app-6bc78ad7139ee0c7.js` matches the local build byte-for-byte. The actual compiled SDK initializes the affected Safe and reads nonce 1. Reloaded the user's Brave Settings page: the blockchain error and indefinite SDK loading are gone. Disabled actions now correctly say the connected wallet is not a signer of this Safe. No transaction was signed or broadcast. Full TypeScript check passed.
