# Finney trusted batches

CGW defaults FF_TRUSTED_DELEGATE_CALL to false. This rejects native multi-validator proposals with CGW-422, even when contract simulation succeeds. Enabling the flag preserves CGW's trusted-target check, hash verification and signature verification.

Run `python3 deploy/trusted-batches/configure.py` from the repository root after the base deployment. It merges the existing nginx configuration, serves Finney-only metadata for the canonical MultiSendCallOnly 1.3.0 and 1.4.1 addresses, and proxies other decoder requests to the existing upstream. It checks the pinned deployment runtime hashes and exercises the actual CGW delegate-call proposal verifier before enabling the feature. It does not sign or submit proposals. Unknown targets and other chains remain subject to normal trust validation.

The local contract metadata is deliberately restricted to chain 964. Trust is pinned to immutable canonical runtime code checked by verify.cjs. No custom delegatecall contract has been enabled. Re-run the verifier after any chain reset or contract migration.

2026-09-29 incident: proposal at 01:28:01Z rejected before forwarding to transaction service, with detail `Delegate call is disabled`. Native balances remained unchanged. Previous tests had covered entry/review/simulation but missed proposal trust configuration. Added production-equivalent verifier coverage.

Rollback: remove the two added CGW config keys using artifacts/cgw-config-before-batch.json, restore artifacts/ui-nginx-before-decoder.json data, then restart CGW and UI. Those snapshots are local ignored artifacts; do not publish configuration snapshots.
