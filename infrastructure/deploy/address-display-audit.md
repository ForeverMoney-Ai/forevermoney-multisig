# Finney address presentation audit — 24 September

Shared entry points changed:
- useChains/useChain: chain 964's UI short name is `finney`; backend config and transaction chain id stay unchanged. Legacy `tao` URL input remains accepted.
- EthHashInfo/SrcEthHashInfo: SS58 primary, EVM secondary; separate exact copy values and Taostats/EVM explorer links. Includes NamedAddressInfo callers.
- AccountRow/SafeInfoDisplay: newer account tables and selector rows, explicit per-row chain id.
- SafeSelectorTriggerContent: existing dual-address header retained; unnamed Safe heading now prefers SS58.
- QrModal, AddFunds, FirstSteps: common FinneyReceive view, default SS58 QR, explicit EVM mirror QR option for EVM/token transfers.

Call-site coverage through shared components includes account cards/lists, address-book entries, setup/owner/settings displays, transaction address details, creation/import review address displays, wallet address popovers, and Safe-app account selection. Direct chain-prefix labels read the normalized UI chain metadata. `TAO` remains the native token ticker; explorer domain evm.tao.app remains unchanged.

Scope: address presentation and receive QR selection. Signed transaction values, ABI arguments, chain ID 964, backend RPC and indexers remain EVM-based. Raw calldata/transaction export fields are not converted into SS58. Existing EVM input validation is retained.

Apply source overrides with `sh deploy/apply-address-overrides.sh` before exporting the existing pinned Safe UI image. Preserve all prior URL/branding overrides.

Verification: production export succeeded (`_app-c7eabb18f4b21793.js`). Live
browser verified dashboard resolution, Finney-prefixed import input label,
SS58-first owner/settings rows, receive layout, both QR payload attributes, and
exact full SS58/EVM clipboard values. The browser test profile has no saved
accounts; account-list/table coverage was checked at their shared rendering
components rather than adding a saved account through the terms-consent flow.
Wallet signing was not exercised. Inherited export skips full lint/type checks.
