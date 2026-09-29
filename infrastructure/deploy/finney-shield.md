# Native TAO Safe Shield explanation

For an exact Finney native SS58 transfer recognized by decodeSs58Transfer, rewrite only VERIFICATION_UNAVAILABLE title/description for the 0x0800 precompile. Retain its type and severity, other verification results, other addresses, recipient/deadlock analysis, errors, loading state, simulation, and signing behavior. No verified status is fabricated. Batch calls retain upstream wording because this change only recognizes a direct exact call.

Files: ui-overrides/finney-shield.ts and useCounterpartyAnalysis.ts, mapped by paths.json. Reuses the strict recipient/calldata/value/chain decoder. Regression check: check-finney-shield.cjs. Full TypeScript check passed.

Rollback: restore artifacts/ui-before-finney-shield-html.tar.gz to the ui deployment's /usr/share/nginx/html in namespace bittensor-safe. Old immutable assets retained.

2026-09-27: user requested the recognized extension not be categorized as a risk. Exact recognized direct native transfers now map VERIFICATION_UNAVAILABLE to INFO with the title `TAO → SS58 · ForeverMoney extension` and explicit non-standard Safe/precompile wording. Verification status stays unavailable, never verified. All other statuses and errors are preserved. Actual upstream getOverallStatus regression tests verify Review details for this notice alone, Issues found for simulation failure, and CRITICAL precedence for unrelated critical findings. Typecheck passed. Rollback for this revision: artifacts/ui-before-shield-info-html.tar.gz.
