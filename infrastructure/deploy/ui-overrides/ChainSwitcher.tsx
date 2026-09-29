import type { ReactElement } from 'react'
import { useCallback, useState } from 'react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useCurrentChain } from '@/hooks/useChains'
import useOnboard from '@/hooks/wallets/useOnboard'
import useIsWrongChain from '@/hooks/useIsWrongChain'
import { switchWalletChain } from '@/services/tx/tx-sender/sdk'

const ChainSwitcher = ({
  fullWidth,
  primaryCta = false,
}: {
  fullWidth?: boolean
  primaryCta?: boolean
}): ReactElement | null => {
  const chain = useCurrentChain()
  const onboard = useOnboard()
  const isWrongChain = useIsWrongChain()
  const [loading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState('')

  const handleChainSwitch = useCallback(async () => {
    if (!onboard || !chain) return
    setIsLoading(true)
    setError('')
    try {
      const wallet = await switchWalletChain(onboard, chain.chainId)
      if (!wallet || wallet.chainId !== chain.chainId) throw new Error('Your wallet is still on a different network. Select Finney (chain ID 964), then disconnect and reconnect your wallet.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to switch networks. Check your wallet and try again.')
    } finally { setIsLoading(false) }
  }, [chain, onboard])

  if (!isWrongChain) return null

  return (
    <div className="flex flex-col gap-2">
    <Button
      onClick={handleChainSwitch}
      variant={primaryCta ? 'default' : 'outline'}
      className={cn('min-w-[200px]', !primaryCta && 'text-foreground', fullWidth && 'w-full')}
      size={primaryCta ? 'default' : 'sm'}
      disabled={loading}
    >
      {loading ? (
        <Spinner className="size-5" />
      ) : (
        <>
          <span className="whitespace-nowrap">Switch to&nbsp;</span>
          <img
            src={chain?.chainLogoUri ?? undefined}
            alt={`${chain?.chainName} Logo`}
            width={24}
            height={24}
            loading="lazy"
          />
          <span className="whitespace-nowrap">&nbsp;{chain?.chainName}</span>
        </>
      )}
    </Button>
    {error && <p role="alert" className="text-sm">{error}</p>}
    </div>
  )
}

export default ChainSwitcher
