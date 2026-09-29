# ForeverMoney shell trial

Native header/footer around Safe (no iframe). ForeverMoney logo and links are reused from the main frontend. Safe owns wallet connection. Safe's existing legal footer stays available. Brand chrome hides during transaction/recovery overlays so their original viewport geometry is preserved.

## Revert live UI

Run `sh deploy/revert-forevermoney-shell.sh` from this repository, then refresh. It restores the pre-trial HTML, pointing at the retained previous immutable bundles. No Kubernetes rollout, indexer, RPC, database, or wallet state changes.

Saved HTML: `artifacts/ui-before-forevermoney-shell-html.tar.gz`.
Saved pre-trial source/override map/apply script: `artifacts/before-forevermoney-shell/`.

For a subsequent build without the shell, restore `app.tsx`, `paths.json`, and `apply-address-overrides.sh` from that directory; restore the upstream PageLayout CSS from `artifacts/safe-source/src/components/common/PageLayout/styles.module.css` into the build container. Do not run this historical rollback after unrelated frontend updates without checking those updates would be retained.

## Validation

- Production static build exit 0; all 34 overrides TypeScript check exit 0.
- Desktop dashboard and Accounts page, Receive modal, and account selector inspected.
- 390 × 844 mobile dashboard, Accounts, and sidebar overlay inspected; no horizontal document overflow.
- Sidebar begins below brand header; logo remains clickable. Existing Safe wallet control remains the only wallet connection in the header.
- No wallet signatures or transactions submitted during verification.

## Exact ForeverMoney styling pass

Source of truth: `forevermoney/src/components/Nav/{Nav,NavLogo,PrimaryNav,MobileNavMenu}.jsx`, `Footer/Footer.jsx`, and `src/styles/globals.css`.

- Same `public/font/MonaSans.woff2` (embedded, scoped to brand chrome).
- Header 60px / 56px below 768px; logo 160px / 128px below 640px / 112px at 360px.
- Nav 14px, weight 500, line-height 20px, height 40px, gap 24px, blue 64/95/191 active border.
- Footer 44px, 11px/500, 20px side padding (12px small), original X and Telegram icon paths and TOS label.
- Same canvas/muted/subtle colors and glass fallback; compact drawer below 1024px. Wallet control stays in Safe.
- Prior trial source in `artifacts/before-shell-exact/`; prior trial HTML in `artifacts/ui-before-shell-exact-html.tar.gz`. Original no-shell rollback remains available via `deploy/revert-forevermoney-shell.sh`.

Validation for exact styling: static build and all-override TypeScript passed. Live source and local preview Bridge link both measured 43.328125px wide, 14px/500, 20px line-height, 40px tall. Footer measured 44px tall, 11px/500, 20px padding, same muted RGB. Mobile header 56px with 16px padding; drawer and Contact dialog open/close verified at 390px, no horizontal overflow.

## Solid header/footer

Glass removed at user request: opaque `rgb(5 6 8)`, no backdrop filters, 1px `#232529` bottom border on header and top border on footer. Typography/heights unchanged. Source CSS updated; `brand-mobile.py` also applies a scoped semantic-selector style to exported HTML, permitting this CSS-only change without replacing the current RPC-enabled bundles. Backup: `artifacts/ui-before-solid-shell-html.tar.gz`.

## Persistent root layout

Removed the transaction/recovery exception that hid the brand chrome. `ForeverMoneyShell` now wraps `FinneyUrl` and the entire Safe app in `_app.tsx`, outside the changing page/flow content, including address resolution and initial loading. The loader and resolver error page reserve brand-bar space. Safe's elevated topbar and transaction popup use the shared header/footer dimensions; mobile transaction popup occupies the space between the brand bars.

Transaction geometry checked using the build's actual CSS in a local-only fixture: desktop popup top 156px (60px brand + 96px Safe controls), bottom 676px (44px footer in 720px viewport); 390×844 mobile popup top 56px, bottom 800px. Last action scrolled into view above footer. No wallet signatures required or submitted.

Rollback HTML: `artifacts/ui-before-persistent-shell-html.tar.gz`; prior source files: `artifacts/before-persistent-shell/`.
