import { blo } from 'blo'
import { evmToSs58 } from '@/components/common/SpaceSafeBar/BittensorAddress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Typography } from '@/components/ui/typography'
import { useSafeDisplayName } from '@/hooks/useSafeDisplayName'
import SafeBalanceBlock from './SafeBalanceBlock'
import { ThresholdBadge } from '@/components/common/AccountBadges'
import {
  CopyAddressButton,
  ExplorerLinkButton,
  FullAddress,
  TruncatedText,
  getInitials,
  getSafeDisplayInfo,
} from '@/components/common/AccountRow'
import NotActivatedBadge from '@/components/common/NotActivatedBadge'
import type { SafeItemData } from '../types'
import EnvHintButton from '@/components/settings/EnvironmentVariables/EnvHintButton'
import { useChain } from '@/hooks/useChains'
import { getBlockExplorerLink } from '@safe-global/utils/utils/chains'
import { HypernativeFeature, useIsHypernativeGuard } from '@/features/hypernative'
import { useLoadFeature } from '@/features/__core__'

export interface SafeSelectorTriggerContentProps {
  selectedItem: SafeItemData
  selectedChainId: string
}

function SafeSelectorTriggerContent({ selectedItem, selectedChainId }: SafeSelectorTriggerContentProps) {
  const selectedChain = selectedItem.chains.find((c) => c.chainId === selectedChainId) ?? selectedItem.chains[0]
  const isUndeployed = Boolean(selectedChain?.isUndeployed)
  const isActivating = Boolean(selectedChain?.isActivating)

  const resolvedName = useSafeDisplayName(selectedItem.address, selectedChainId)
  const { shortAddress, displayName } = getSafeDisplayInfo(resolvedName, selectedItem.address)
  const ss58 = selectedChainId === '964' ? evmToSs58(selectedItem.address) : undefined

  const chainConfig = useChain(selectedChain?.chainId ?? '')
  const blockExplorerLink = chainConfig ? getBlockExplorerLink(chainConfig, selectedItem.address) : undefined

  const { SafeHeaderHnTooltip } = useLoadFeature(HypernativeFeature)
  const { isHypernativeGuard } = useIsHypernativeGuard()

  return (
    <div className="flex items-center gap-2 w-full" data-testid="safe-header-info">
      <div className="relative shrink-0">
        <Avatar size="sm" data-testid="safe-icon">
          <AvatarImage src={blo(selectedItem.address as `0x${string}`)} alt={displayName} />
          <AvatarFallback>{getInitials(displayName || '?')}</AvatarFallback>
        </Avatar>
      </div>
      <div className="flex flex-col items-start flex-1 min-w-0" data-testid="safe-selector-trigger-details">
        <div className="flex items-center gap-1 min-w-0 max-w-full">
          <TruncatedText
            data-testid="safe-selector-trigger-name"
            variant="paragraph-small-medium"
            className="block min-w-0"
            text={ss58 && !resolvedName ? `${ss58.slice(0, 6)}…${ss58.slice(-6)}` : displayName}
          />
          {isHypernativeGuard && <SafeHeaderHnTooltip />}
        </div>
        <div className="flex items-center gap-1 min-w-0 max-w-full">
          {ss58 && (
            <>
              <FullAddress address={ss58} className="max-sm:hidden" title={ss58} data-testid="safe-selector-trigger-ss58" />
              <Typography variant="paragraph-mini" color="muted" className="font-mono sm:hidden" title={ss58}>
                {ss58.slice(0, 4)}…{ss58.slice(-4)}
              </Typography>
              <span className="flex shrink-0 items-center gap-0.5">
                <CopyAddressButton address={ss58} testId="copy-ss58-btn" />
                <ExplorerLinkButton href={`https://taostats.io/account/${ss58}`} title="View on Taostats" />
              </span>

            </>
          )}
          {!ss58 && <>
          <FullAddress
            address={selectedItem.address}
            className="max-sm:hidden"
            data-testid="safe-selector-trigger-address"
          />
          {/* The full address would starve the name/balance on small screens — short form instead. */}
          <Typography variant="paragraph-mini" color="muted" className="font-mono sm:hidden">
            {ss58 ? `${selectedItem.address.slice(0, 4)}…${selectedItem.address.slice(-4)}` : shortAddress}
          </Typography>
          {/* Keep actions visible beside both address formats at every screen width. */}
          <span className="flex shrink-0 items-center gap-0.5">
            <CopyAddressButton address={selectedItem.address} />
            {blockExplorerLink && <ExplorerLinkButton href={blockExplorerLink.href} title={blockExplorerLink.title} />}
          </span>
          </>}
          <EnvHintButton chainId={selectedChainId} />
        </div>
      </div>
      {selectedItem.owners > 0 && (
        // flex (not inline): the inline-flex badge would otherwise sit on the wrapper's text
        // baseline and render a couple of px above the vertical middle of the chip.
        <span className="flex shrink-0 items-center max-sm:hidden">
          {/* The trigger always reflects the active safe on the active chain, so it shows that chain's
              threshold — even for a multi-chain safe (the dropdown group summary stays icon-only). */}
          <ThresholdBadge threshold={selectedItem.threshold} owners={selectedItem.owners} />
        </span>
      )}
      {isUndeployed ? (
        <NotActivatedBadge isActivating={isActivating} data-testid="safe-selector-not-activated-icon" />
      ) : (
        <SafeBalanceBlock isLoading={selectedItem.isLoading ?? false} balance={selectedItem.balance} />
      )}
    </div>
  )
}

export default SafeSelectorTriggerContent
