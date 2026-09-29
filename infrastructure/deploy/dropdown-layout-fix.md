# Account dropdown address spacing — 24 September 2026

Fixed overlapping SS58/EVM text and copy/explorer controls in Finney account rows.

- Address content can shrink and truncate; action groups cannot shrink or overlap it.
- Inline copy text participates in ellipsis instead of overflowing its text box.
- Finney rows use narrower chain/balance columns and omit the empty pending column.
  A nonzero pending count still renders. Other networks retain the original columns.
- Explicit chain ID is passed into the shared address display.

Source: `ui-overrides/SrcEthHashInfo.tsx`, `ui-overrides/SafeItem.tsx`.
Both override application paths include the new SafeItem override.

Verification:
- Reproduced original overlap with two imported accounts in an isolated localhost
  preview; did not change the user's production account list or connect a wallet.
- Inspected final build at 1280 and 390 pixels wide. Both rows retain a four-pixel
  gap before the primary action group, with controls inside the address container.
  Desktop EVM rows also retain a four-pixel gap. No text/icon overlap observed.
- SS58 and EVM copy actions returned their respective full addresses.
- Production build passed. Full typecheck of all 21 overrides passed in an
  isolated container (3 GiB Node heap). Initial concurrent and default-heap attempts
  exhausted local build memory; they were rerun successfully with adequate memory.
- Assets published before HTML, preserving previous assets for open sessions.
- HTML rollback snapshot: `artifacts/ui-before-dropdown-html.tar.gz`.

Existing upstream horizontal scrolling on narrow dropdowns is unchanged.
