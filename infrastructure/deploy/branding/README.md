# Reversible product branding — LOCAL ONLY

The deployment is still on its original Safe branding. These commands build previews and never deploy or modify the cluster:

```sh
sh deploy/preview-branding.sh multisig
sh deploy/preview-branding.sh safe
```

- `multisig`: ForeverMoney Multi-sig name; transparent original scales in navigation/loading; app icon for favicon; wordmark remains in main header; no Safe logo badge in transaction checks; factual Safe technology attribution; edited AI Open Graph image.
- `safe`: restores the saved original source/assets, then reapplies the latest functional overrides. Restores the existing Safe name/logos and original Open Graph image. No transaction behavior changes.

Outputs are separate: `artifacts/branding-multisig` and `artifacts/branding-safe`. The preview container keeps an original-file manifest; `mode.cjs safe` restores all files changed by the branding mode. Run the wrapper when functional overrides have changed so the original-file manifest is refreshed correctly. The standard deployment scripts are unchanged; they do not automatically activate this branding.

The domain is intentionally unchanged pending the team's decision. Do not assume this eliminates every trademark consideration. Copyright/license notices and factual descriptions of the Safe contract technology remain intact.

## Image

`deploy/assets/forevermoney/opengraph-multisig-v1.jpg`: 1200×630 preview, derived from `opengraph-multisig-ai-original.png`. Original Safe image remains `deploy/assets/safe-opengraph-v1.jpg`.

Built-in image generation edit prompt: preserve the original black/green composition and perspective; replace the small in-app Safe logo with the supplied original white ForeverMoney scales; replace YOUR SAFE with YOUR MULTI-SIG; change account empty/import wording; retain SAFE.FOREVERMONEY.AI because the domain has not changed. No other intentional changes.

Original supplied brand sources:
- `/Users/creatorbid/Downloads/ForeverMoney_Icon_white.svg` (transparent scales)
- ForeverMoney frontend `src/assets/images/ForeverMoney_Logo_white.svg` (wordmark)
- ForeverMoney frontend `public/favicon.png` (square app icon)

Validation: Multi-sig TypeScript check and static export passed. The local accounts screen was inspected in a browser. All 143 tracked original files restored byte-for-byte in Safe mode, then Multi-sig mode reapplied successfully. Crawler metadata checked on all 67 exported HTML pages. The deployed site and DNS were not changed.

## Current production state

2026-09-27: user approved deployment. `multisig` is now LIVE on the existing safe.forevermoney.ai domain. Public account page verified in browser; 61 deployed files matched the approved local output byte-for-byte. No domain, RPC, indexer or contract configuration changes.

Active mode is recorded in `deploy/branding/active-mode`. For future UI fixes, build with `sh deploy/preview-branding.sh multisig` and publish `artifacts/branding-multisig`; publishing the old `artifacts/ui-branded` export would unintentionally restore Safe branding.

Immediate rollback: `artifacts/ui-before-multisig-branding-html.tar.gz` contains the prior verified production export (app bc624515144cc9b7). The network backup stream was interrupted, so this archive was reconstructed from the matching preserved local export and archive integrity checked. Prior immutable assets remain deployed. Restore its contents into /usr/share/nginx/html of deployment/ui in namespace bittensor-safe, and set active-mode to safe. No rebuild or database changes required for this exact rollback.
