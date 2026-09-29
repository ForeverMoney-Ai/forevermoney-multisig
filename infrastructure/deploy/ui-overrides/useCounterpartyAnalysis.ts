import { decodeAlphaBatch } from '@/services/tx/finney-alpha'
import { explainFinneyTransfer, matchesFinneyBatchCode } from '@/services/tx/finney-shield'
import { useContext, useMemo, useEffect, useState } from 'react'
import { useCounterpartyAnalysis as useCounterpartyAnalysisUtils } from '@safe-global/utils/features/safe-shield/hooks'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import useChainId from '@/hooks/useChainId'
import useSafeAddress from '@/hooks/useSafeAddress'
import useOwnedSafes from '@/hooks/useOwnedSafes'
import { useMergedAddressBooks } from '@/hooks/useAllAddressBooks'
import type {
  RecipientAnalysisResults,
  ContractAnalysisResults,
  DeadlockAnalysisResults,
} from '@safe-global/utils/features/safe-shield/types'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import type { SafeTransaction } from '@safe-global/types-kit'

export function useCounterpartyAnalysis(overrideSafeTx?: SafeTransaction): {
  recipient: AsyncResult<RecipientAnalysisResults>
  contract: AsyncResult<ContractAnalysisResults>
  deadlock: AsyncResult<DeadlockAnalysisResults>
} {
  const safeAddress = useSafeAddress()
  const chainId = useChainId()
  const web3ReadOnly = useWeb3ReadOnly()
  const mergedAddressBooks = useMergedAddressBooks(chainId)
  const ownedSafesByChain = useOwnedSafes(chainId)
  const { safeTx } = useContext(SafeTxContext)

  const ownedSafes = ownedSafesByChain[chainId] || []

  const analysis = useCounterpartyAnalysisUtils({
    safeAddress,
    chainId,
    safeTx: overrideSafeTx || safeTx,
    isInAddressBook: mergedAddressBooks.has,
    ownedSafes,
    web3ReadOnly,
  })
  const transaction = overrideSafeTx || safeTx
  const txData = transaction?.data
  const batchTarget = txData && decodeAlphaBatch(chainId, txData.to, txData.data, txData.value, txData.operation) ? txData.to : undefined
  const [verifiedBatch, setVerifiedBatch] = useState<{provider: typeof web3ReadOnly; chainId: string; address: string}>()
  useEffect(() => {
    let cancelled = false
    setVerifiedBatch(undefined)
    if (batchTarget && web3ReadOnly && chainId === '964') {
      const provider = web3ReadOnly
      void (async () => {
        if ((await provider.getNetwork()).chainId !== 964n) return
        const code = await provider.getCode(batchTarget)
        if (!cancelled && matchesFinneyBatchCode(chainId, batchTarget, code)) setVerifiedBatch({provider, chainId, address: batchTarget})
      })().catch(() => { /* Failed verification retains original warnings. */ })
    }
    return () => { cancelled = true }
  }, [web3ReadOnly, chainId, batchTarget])
  const verifiedAddress = verifiedBatch?.provider === web3ReadOnly && verifiedBatch?.chainId === chainId && verifiedBatch?.address === batchTarget ? verifiedBatch.address : undefined
  const contractResults = useMemo(
    () => explainFinneyTransfer(chainId, transaction, analysis.contract[0], verifiedAddress),
    [chainId, transaction, analysis.contract[0], verifiedAddress],
  )
  return { ...analysis, contract: [contractResults, analysis.contract[1], analysis.contract[2]] }
}
