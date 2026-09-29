set -eu
container=${1:-bittensor-safe-ui-export}
base=/app/apps/web/src
copy() { docker cp "deploy/ui-overrides/$1" "$container:$base/$2"; }
copy useChains.ts hooks/useChains.ts
copy useChainId.ts hooks/useChainId.ts
copy SrcEthHashInfo.tsx components/common/EthHashInfo/SrcEthHashInfo/index.tsx
copy EthHashInfo.tsx components/common/EthHashInfo/index.tsx
copy FinneyReceive.tsx components/common/FinneyReceive.tsx
copy QrModal.tsx components/common/QrCodeButton/QrModal.tsx
copy AddFunds.tsx components/common/AddFunds/index.tsx
copy FirstSteps.tsx components/dashboard/FirstSteps/index.tsx
copy SafeSelectorTriggerContent.tsx features/spaces/components/SafeSelectorDropdown/components/SafeSelectorTriggerContent.tsx
copy SafeInfoDisplay.tsx components/common/AccountRow/SafeInfoDisplay.tsx
copy SafeItem.tsx features/spaces/components/SafeSelectorDropdown/components/SafeItem.tsx
copy TransferTxInfo.tsx components/transactions/TxDetails/TxData/Transfer/index.tsx
copy SafeAccountTableRow.tsx features/myAccounts/components/SafeAccountsTable/SafeAccountTableRow.tsx
copy CreationReviewStep.tsx components/new-safe/create/steps/ReviewStep/index.tsx
copy CreationStatusStep.tsx components/new-safe/create/steps/StatusStep/index.tsx
copy AddressInput.tsx components/common/AddressInput/index.tsx
copy TokenAmountInput.tsx components/common/TokenAmountInput/index.tsx
copy RecipientRow.tsx components/tx-flow/flows/TokenTransfer/RecipientRow/index.tsx
copy ReviewTokenTransfer.tsx components/tx-flow/flows/TokenTransfer/ReviewTokenTransfer.tsx
copy CreateTokenTransfer.tsx components/tx-flow/flows/TokenTransfer/CreateTokenTransfer.tsx
copy ReviewRecipientRow.tsx components/tx-flow/flows/TokenTransfer/ReviewRecipientRow.tsx
copy TxData.tsx components/transactions/TxDetails/TxData/index.tsx
copy finney-tao.ts services/tx/finney-tao.ts
copy FinneyTaoTransfer.tsx components/common/FinneyTaoTransfer.tsx

copy app.tsx pages/_app.tsx
copy ForeverMoneyShell.tsx components/common/ForeverMoneyShell.tsx
copy ForeverMoneyShell.module.css components/common/ForeverMoneyShell.module.css
copy PageLayout.module.css components/common/PageLayout/styles.module.css

copy finney-rpc.ts utils/finney-rpc.ts
copy chains.ts utils/chains.ts
copy web3.ts hooks/wallets/web3.ts
copy safeCoreSDK.ts hooks/coreSDK/safeCoreSDK.ts

copy TxModalDialog.module.css components/common/TxModalDialog/styles.module.css

copy LaunchScreen.tsx components/common/LaunchScreen/index.tsx
copy FinneyUrl.tsx components/common/FinneyUrl.tsx

copy MetaTags.tsx components/common/MetaTags/index.tsx
copy finney-shield.ts services/tx/finney-shield.ts
copy useCounterpartyAnalysis.ts features/safe-shield/hooks/useCounterpartyAnalysis.ts

copy SidebarIndexingStatus.tsx features/spaces/components/Sidebar/SidebarIndexingStatus/SidebarIndexingStatus.tsx

copy useTxBuilderApp.ts hooks/safe-apps/useTxBuilderApp.ts

copy finney-alpha.ts services/tx/finney-alpha.ts
copy FinneyAlphaAssets.tsx components/common/FinneyAlphaAssets.tsx
copy FinneyAlphaAssets.module.css components/common/FinneyAlphaAssets.module.css
copy FinneyAlphaTransfer.tsx components/common/FinneyAlphaTransfer.tsx
copy FinneyAlphaFlow.tsx components/common/FinneyAlphaFlow.tsx
copy BalancesPage.tsx pages/balances/index.tsx

copy AssetsTable.tsx components/balances/AssetsTable/index.tsx
copy EnhancedTable.tsx components/common/EnhancedTable/index.tsx

copy TxSummary.tsx components/transactions/TxSummary/index.tsx

copy TokenAmount.tsx components/common/TokenAmount/index.tsx

copy DelegateCallCardItem.tsx features/safe-shield/components/AnalysisGroupCard/DelegateCallCardItem.tsx

# MIT backend compatibility: chain config via /v1/chains (works on cgw v1.101.0 and later).
docker cp deploy/ui-overrides/store-chains.ts "$container:/app/packages/store/src/gateway/chains/index.ts"

# Dashboard includes Finney native stake in total, top assets and empty-state checks.
copy DashboardIndex.tsx components/dashboard/index.tsx
copy DashboardOverview.tsx components/dashboard/Overview/Overview.tsx
copy DashboardAssets.tsx components/dashboard/Assets/index.tsx
