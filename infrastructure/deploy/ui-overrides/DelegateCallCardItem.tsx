import { Severity, type AnalysisResult } from '@safe-global/utils/features/safe-shield/types'
import { type ReactElement } from 'react'
import { HelpCenterArticle } from '@safe-global/utils/config/constants'
import { AnalysisGroupCardItem } from './AnalysisGroupCardItem'
import { AnalysisCardItemWithLink } from './AnalysisCardItemWithLink'

interface DelegateCallCardItemProps {
  result: AnalysisResult
  isPrimary?: boolean
}

export const DelegateCallCardItem = ({ result, isPrimary = false }: DelegateCallCardItemProps): ReactElement => {
  if (result.severity === Severity.INFO && result.title?.endsWith('transfer · ForeverMoney')) {
    return <AnalysisGroupCardItem result={result} description="The verified batch contract executes the native stake transfers shown in this review." severity={isPrimary ? result.severity : undefined} showImage />
  }
  return (
    <AnalysisCardItemWithLink
      result={result}
      isPrimary={isPrimary}
      beforeLinkText="This transaction calls a smart contract that will be able to modify your Multi-sig account. "
      linkText="Learn more"
      linkUrl={HelpCenterArticle.UNEXPECTED_DELEGATE_CALL}
    />
  )
}
