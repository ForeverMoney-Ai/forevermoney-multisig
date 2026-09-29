import { useMemo, type ReactElement } from 'react'
import ExternalLink from '@/components/common/ExternalLink'
import { HelpCenterArticle } from '@safe-global/utils/config/constants'
import type {
  ContractAnalysisResults,
  RecipientAnalysisResults,
  ThreatAnalysisResults,
  DeadlockAnalysisResults,
  SafeAnalysisResult,
} from '@safe-global/utils/features/safe-shield/types'
import { SafeShieldHeader } from './SafeShieldHeader'
import { SafeShieldContent } from './SafeShieldContent'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import type { SafeTransaction } from '@safe-global/types-kit'
import { getOverallStatus } from '@safe-global/utils/features/safe-shield/utils'
import { useCheckSimulation } from '../hooks/useCheckSimulation'
import type { HypernativeAuthStatus } from '@/features/hypernative'


export const SafeShieldDisplay = ({
  recipient,
  contract,
  threat,
  deadlock,
  safeTx,
  hypernativeAuth,
  showHypernativeInfo = true,
  showHypernativeActiveStatus = true,
  safeAnalysis,
  onAddToTrustedList,
}: {
  recipient: AsyncResult<RecipientAnalysisResults>
  contract: AsyncResult<ContractAnalysisResults>
  threat: AsyncResult<ThreatAnalysisResults>
  deadlock: AsyncResult<DeadlockAnalysisResults>
  safeTx?: SafeTransaction
  hypernativeAuth?: HypernativeAuthStatus
  showHypernativeInfo?: boolean
  showHypernativeActiveStatus?: boolean
  safeAnalysis?: SafeAnalysisResult | null
  onAddToTrustedList?: () => void
}): ReactElement => {
  const [recipientResults] = recipient || []
  const [contractResults] = contract || []
  const [threatResults] = threat || []
  const [deadlockResults] = deadlock || []
  const { hasSimulationError } = useCheckSimulation(safeTx)

  const hnLoginRequired = useMemo(
    () => hypernativeAuth !== undefined && (!hypernativeAuth.isAuthenticated || hypernativeAuth.isTokenExpired),
    [hypernativeAuth],
  )

  const overallStatus = useMemo(
    () =>
      getOverallStatus(
        recipientResults,
        contractResults,
        threatResults,
        hasSimulationError,
        hnLoginRequired,
        deadlockResults,
      ),
    [recipientResults, contractResults, threatResults, hasSimulationError, hnLoginRequired, deadlockResults],
  )


  return (
    <div className="flex flex-col gap-2" data-testid="safe-shield-widget">
      {/* Radius pairs with the inner header/list: 16px outer − 4px inset (px-1) = 12px inner, so the
          two curves stay concentric instead of the inner corner cutting inside the outer one. */}
      <div className="overflow-hidden rounded-lg bg-card">
        <SafeShieldHeader
          recipient={recipient}
          contract={contract}
          threat={threat}
          deadlock={deadlock}
          overallStatus={overallStatus}
        />

        <SafeShieldContent
          threat={threat}
          recipient={recipient}
          contract={contract}
          deadlock={deadlock}
          safeTx={safeTx}
          overallStatus={overallStatus}
          hypernativeAuth={hypernativeAuth}
          showHypernativeInfo={showHypernativeInfo}
          showHypernativeActiveStatus={showHypernativeActiveStatus}
          safeAnalysis={safeAnalysis}
          onAddToTrustedList={onAddToTrustedList}
        />
      </div>

      <div className="flex flex-row items-center self-end">
        <ExternalLink href={HelpCenterArticle.SAFE_SHIELD} noIcon>
          <span className="text-xs text-muted-foreground">Transaction checks</span>
        </ExternalLink>
      </div>
    </div>
  )
}
