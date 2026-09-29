# Finney receive warning and account header

The Finney account selector trigger shows the SS58 address with its copy and Taostats actions. The EVM address remains available in Receive and elsewhere; other chains retain their EVM header display.

Receive shows a persistent amber notice above the address-format selector for both SS58 and EVM formats: “Bittensor (Finney) only. This Safe is on Bittensor EVM. Do not send funds from Ethereum, Base, or any other chain. Funds sent on the wrong network may be lost.”

Source overrides: SafeSelectorTriggerContent.tsx and FinneyReceive.tsx. Preview-only DOM script under artifacts is not shipped.

Pre-deployment HTML rollback: artifacts/ui-before-network-warning-html.tar.gz. Previous immutable assets remain on the UI server.
