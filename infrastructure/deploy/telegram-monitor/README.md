# Safe Telegram sync monitor

Installed in bittensor-safe. CronJob sync-alert checks every minute and posts only to the fixed configured group, Forevermoney Safe alerts. It does not poll Telegram updates, accept commands, or discover new destinations.

Alert after three consecutive unsuccessful checks: Safe or ERC20 indexed block timestamps more than 300 seconds old, stale RPC head timestamps, or invalid/unavailable indexing API. Alert once per incident and send one recovery message. State lives under a dedicated Redis key; a Redis restart clears suppression state. Full cluster failure, monitor failure, Telegram outage, and external ingress failure cannot be reliably reported by this in-cluster monitor. An independent external monitor is still needed for those cases.

Endpoint: http://ui:8080/txs/api/v1/about/indexing/. Public loopback routing was unreachable from this cluster, so this check traverses the internal UI proxy. Redis access uses the existing namespace network policy. No Kubernetes API permissions or mounted service-account token. Telegram token is in a dedicated Kubernetes Secret; local installation config is mode 0600 at ~/.kube/bittensor-safe-telegram.json. Never commit or log it.

Install: python3 deploy/telegram-monitor/install.py
Tests: python3 -m unittest discover -s deploy/telegram-monitor

Verified on 2026-09-24: four logic tests passed; actual cluster job reported zero failures/no lag and successfully delivered a clearly labelled self-test to the configured group. No Safe data or index checkpoints changed.

Also blocked the public transaction-service /api/v1/about endpoint through the UI proxy because it included a credential-bearing RPC URL. The indexing endpoint remains available. Rotate that RPC credential separately; blocking exposure does not invalidate previously disclosed credentials.

2026-09-29 production review: scheduled jobs were failing before pod creation because the configured sync-alert ServiceAccount was absent. Restored that account with automountServiceAccountToken=false and no RBAC grants; installer now creates it explicitly. Consecutive scheduled runs completed with failures=0 and problems=[]. No test message or recipient change was made.
