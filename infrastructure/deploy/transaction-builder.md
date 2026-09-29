# Transaction Builder blank page — 2026-09-28

Root cause: Finney chain 964 exposed CONTRACT_INTERACTION, but not SAFE_APPS. The upstream /apps/open page returns null when SAFE_APPS is disabled, despite displaying Transaction Builder entry points.

Added SAFE_APPS to the seed configuration and applied the narrow, idempotent enable-safe-apps.py script to the existing cfg database. No RPC, signing, contracts or balances changed. CGW reflected the new feature immediately via configuration webhooks.

Verified the live route now displays the first-use app Terms/disclaimer instead of a blank page. The upstream Transaction Builder page and manifest both respond HTTP 200 and do not prohibit iframe embedding via CSP/X-Frame-Options. Further interactive verification waits for explicit approval to accept the Terms/disclaimer.

Rollback: remove chain 964 from Feature.objects.get(key="SAFE_APPS").chains. Do not delete the feature globally.
