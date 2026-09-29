# Self-hosted upstream Transaction Builder

Source: https://github.com/safe-global/safe-react-apps
Pinned commit: e8cccfb9a1042fa2954087988bae59c3b8c81780
App version: 1.18.3. MIT license; retain LICENSE.md alongside served build.

The upstream interface and transaction composition logic are preserved. patch.py only routes ABI metadata and gateway chain configuration to our Finney gateway. The parent multisig app remains responsible for proposal, review and signing.

Build in node:22-bookworm-slim with yarn 1.22.22, frozen upstream lockfile, CYPRESS_INSTALL_BINARY=0, HUSKY=0. Apply patch.py once to a clean source checkout before building `yarn workspace tx-builder build` with GENERATE_SOURCEMAP=false. Serve output under /tx-builder. Do not add Safe logo branding to our outer shell.

Frontend entrypoint override: deploy/ui-overrides/useTxBuilderApp.ts.

2026-09-28 deployed under /tx-builder and registered in our Finney app catalogue. UI build _app-a847e67bfbea102e.js. App SDK accepts the exact https://safe.forevermoney.ai parent origin. Upstream tests pass under specified Node 18: 594 passed, 3 skipped, 6 suites passed. Node 22 initially produced 17 assertion failures solely due to JSON parser error wording; use Node 18 for the upstream test suite.

The app build is copied from artifacts/tx-builder-build into subsequent wallet exports *after* wallet metadata processing, preserving the builder's HTML. Nginx supports builder deep links. The config registration stores a catalogue icon under /assets/metadata; its bytes were copied into the UI export as the config service media isn't otherwise publicly served.

Rollback: restore artifacts/ui-before-selfhost-builder-html.tar.gz and artifacts/ui-nginx-before-builder.json, restart only deployment/ui. Prior immutable wallet chunks remain. The self-hosted catalogue row can be unlisted without deleting it. No transactions were submitted or signed during verification. The first-use Terms screen still requires user consent before completing browser interaction with the embedded builder.

## Redirect fix and browser validation — 2026-09-28

The initial deployment missed Nginx's automatic directory redirect: /tx-builder returned 301 to http://safe.forevermoney.ai:8080/tx-builder/, preventing iframe loading. Added an exact-match internal rewrite to /tx-builder/index.html. Local Nginx validated no-slash, slash, deep-link, manifest and JS routes (200, no redirects) before rollout. Production no-slash returns 200 with no redirect after rollout.

Before deploying this fix, used the existing Brave session (already consented) with the slash URL to test actual UI: loaded builder, added zero-TAO / 0x data draft to connected wallet's own address, Create Batch, reviewed, Send Batch handed off to multisig Confirm transaction with nonce 4 and correct recipient/data. Stopped before Continue/signing/submission, discarded the parent review, then reloaded to remove the in-memory builder draft. No library save or onchain operation. Prior 301 may be browser-cached and needs a hard refresh.

Backup: artifacts/ui-nginx-before-builder-redirect-fix.json. Change only Nginx routing, no app or contract code.

Follow-up: Brave retained the old 301 for iframe navigation even after refreshing the parent. The UI entrypoint now explicitly uses /tx-builder/ (the browser-tested URL), avoiding that cache key. Verified manual ABI form generation and adding a local draft; discarded by reload without submitting. Added check-routes.py, passing against local Nginx and production. Existing Brave session had already accepted first-use Terms, so no new acceptance was performed.
