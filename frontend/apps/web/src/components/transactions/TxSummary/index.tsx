import useChainId from '@/hooks/useChainId'
import { useTransactionsGetTransactionByIdV1Query } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { decodeAlphaTransfer, decodeAlphaBatch, STAKING_PRECOMPILE } from '@/services/tx/finney-alpha'
import { isCustomTxInfo, isMultiSendTxInfo } from '@/utils/transaction-guards'
import TokenAmount from '@/components/common/TokenAmount'
import { TransferDirection } from '@safe-global/store/gateway/types'
import { ArrowUpRight } from 'lucide-react'
import type { ModuleTransaction, MultisigTransaction } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { TxProposalChip } from '@/features/proposers'
import { SwapFeature, useIsExpiredSwap } from '@/features/swap'
import { Typography } from '@/components/ui/typography'
import type { ReactElement } from 'react'

import css from './styles.module.css'
import DateTime from '@/components/common/DateTime'
import TxInfo from '@/components/transactions/TxInfo'
import { isMultisigExecutionInfo, isTxQueued } from '@/utils/transaction-guards'
import { TxTypeIcon, TxTypeText } from '@/components/transactions/TxType'
import classNames from 'classnames'
import { isImitation, isTrustedTx } from '@/utils/transactions'
import MaliciousTxWarning from '../MaliciousTxWarning'
import QueueActions from './QueueActions'
import useIsPending from '@/hooks/useIsPending'
import TxConfirmations from '../TxConfirmations'
import { useHasFeature } from '@/hooks/useChains'
import TxStatusLabel from '@/components/transactions/TxStatusLabel'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { ellipsis } from '@safe-global/utils/utils/formatters'
import {
  useHnQueueAssessmentResult,
  useShowHypernativeAssessment,
  useHypernativeOAuth,
  HypernativeFeature,
} from '@/features/hypernative'
import { getSafeTxHashFromTxId } from '@/utils/transactions'
import { SafenetChecksFeature, useIsSafenetChecksEnabled } from '@/features/safenet-checks'
import { useLoadFeature } from '@/features/__core__/useLoadFeature'

type TxSummaryProps = {
  isConflictGroup?: boolean
  isBulkGroup?: boolean
  item: ModuleTransaction | MultisigTransaction
}

const TxSummary = ({ item, isConflictGroup, isBulkGroup }: TxSummaryProps): ReactElement => {
  const { StatusLabel } = useLoadFeature(SwapFeature)
  const hasDefaultTokenlist = useHasFeature(FEATURES.DEFAULT_TOKENLIST)
  const { HnQueueAssessment } = useLoadFeature(HypernativeFeature)
  const safenet = useLoadFeature(SafenetChecksFeature)
  const isSafenetEnabled = useIsSafenetChecksEnabled()

  const tx = item.transaction
  const chainId = useChainId()
  // Only fetch candidate native calls/batches; normal history rows keep their lazy detail loading.
  const nativeCandidate = chainId === '964' && (isMultiSendTxInfo(tx.txInfo) ||
    (isCustomTxInfo(tx.txInfo) && [STAKING_PRECOMPILE, '0x40a2accbd92bca938b02010e17a5b8929b49130d', '0x9641d764fc13c8b624c04430c7356c1c7c8102e2'].includes(tx.txInfo.to.value.toLowerCase())))
  const { currentData: nativeDetails } = useTransactionsGetTransactionByIdV1Query(
    { chainId, id: tx.id }, { skip: !nativeCandidate },
  )
  const nativeData = nativeDetails?.txData
  const alpha = nativeData && (
    decodeAlphaTransfer(chainId, nativeData.to.value, nativeData.hexData || '', nativeData.value || '0', nativeData.operation) ||
    decodeAlphaBatch(chainId, nativeData.to.value, nativeData.hexData || '', nativeData.value || '0', nativeData.operation)
  )
  const isQueue = isTxQueued(tx.txStatus)
  const nonce = isMultisigExecutionInfo(tx.executionInfo) ? tx.executionInfo.nonce : undefined
  const isTrusted = !hasDefaultTokenlist || isTrustedTx(tx)
  const isImitationTransaction = isImitation(tx)
  const showWarning = isImitationTransaction || !isTrusted
  const isPending = useIsPending(tx.id)
  const executionInfo = isMultisigExecutionInfo(tx.executionInfo) ? tx.executionInfo : undefined
  const expiredSwap = useIsExpiredSwap(tx.txInfo)

  // Extract safeTxHash for assessment
  const safeTxHash = tx.id ? getSafeTxHashFromTxId(tx.id) : undefined
  const assessment = useHnQueueAssessmentResult(safeTxHash)
  const { isAuthenticated } = useHypernativeOAuth()
  const showAssessment = useShowHypernativeAssessment() && isQueue
  // Bulk-group rows hide the cell via CSS; skipping the mount also skips the chain read.
  const showSafenetStatus = isSafenetEnabled && isQueue && !isBulkGroup && !!safeTxHash

  return (
    <div
      data-testid="transaction-item"
      className={classNames(css.gridContainer, {
        // Top-level queue rows carry the most cells, so they get their own narrow-width template.
        [css.queue]: isQueue && !isConflictGroup && !isBulkGroup,
        [css.history]: !isQueue,
        [css.conflictGroup]: isConflictGroup,
        [css.bulkGroup]: isBulkGroup,
        [css.untrusted]: showWarning,
        [css.withAssessment]: showAssessment,
        [css.withSafenet]: showSafenetStatus,
      })}
      id={tx.id}
    >
      {/* The warning claims the same cell, so the nonce yields to it rather than stacking underneath. */}
      {nonce !== undefined && !isConflictGroup && !showWarning && (
        <div data-testid="nonce" className={css.nonce} style={{ gridArea: 'nonce' }}>
          {nonce}
        </div>
      )}

      {showWarning && (
        <div data-testid="warning" style={{ gridArea: 'nonce' }}>
          <MaliciousTxWarning withTooltip={!isImitationTransaction} />
        </div>
      )}

      <div data-testid="tx-type" className={css.type} style={{ gridArea: 'type' }}>
        {/* Composed from TxType's icon and text rather than the combined export, so this file owns the
            label's class and can drop it on phones while keeping the icon. */}
        <div className={css.typeRow}>
          {alpha ? <ArrowUpRight className="size-4 text-destructive" /> : <TxTypeIcon tx={tx} />}
          <span className={css.typeLabel}>
            {alpha ? (isQueue ? 'Send' : 'Sent') : <TxTypeText tx={tx} />}
          </span>
        </div>

        {tx.note && (
          <Typography
            variant="paragraph-small"
            className={classNames('text-[var(--color-text-secondary)]', css.note)}
            title={tx.note}
          >
            {ellipsis(tx.note, 25)}
          </Typography>
        )}
      </div>

      <div data-testid="tx-info" className={css.info} style={{ gridArea: 'info' }}>
        {alpha ? <TokenAmount roundIcon value={alpha.amount} decimals={9} tokenSymbol={`SN${alpha.netuid}`} direction={TransferDirection.OUTGOING} logoUri={`/assets/metadata/subnets/sn${alpha.netuid}.webp`} /> : <TxInfo info={tx.txInfo} />}
      </div>

      <div data-testid="tx-date" className={css.date} style={{ gridArea: 'date' }}>
        <DateTime value={tx.timestamp} />
      </div>

      {isQueue && executionInfo && (
        <div style={{ gridArea: 'confirmations' }}>
          {executionInfo.confirmationsSubmitted > 0 || isPending ? (
            <TxConfirmations
              submittedConfirmations={executionInfo.confirmationsSubmitted}
              requiredConfirmations={executionInfo.confirmationsRequired}
            />
          ) : (
            <TxProposalChip />
          )}
        </div>
      )}

      {showAssessment && safeTxHash && (
        <div style={{ gridArea: 'assessment' }} className={css.assessment}>
          <HnQueueAssessment safeTxHash={safeTxHash} assessment={assessment} isAuthenticated={isAuthenticated} />
        </div>
      )}

      {showSafenetStatus && safeTxHash && (
        <div style={{ gridArea: 'safenet' }} className={css.safenet}>
          <safenet.SafenetQueueStatus safeTxHash={safeTxHash} timestampMs={tx.timestamp} />
        </div>
      )}

      {(!isQueue || expiredSwap || isPending) && (
        <div className={css.status} style={{ gridArea: 'status' }}>
          {isQueue && expiredSwap ? <StatusLabel status="expired" /> : <TxStatusLabel tx={tx} />}
        </div>
      )}

      {isQueue && !expiredSwap && (
        <div className={css.actions} style={{ gridArea: 'actions' }}>
          <QueueActions tx={tx} />
        </div>
      )}
    </div>
  )
}

export default TxSummary
