import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import css from '@/components/common/ConnectWallet/styles.module.css'
import { ChevronUp, ChevronDown, Copy } from 'lucide-react'
import { type ConnectedWallet } from '@/hooks/wallets/useOnboard'
import WalletOverview, { WalletIdenticon } from '../WalletOverview'
import CopyTooltip from '@/components/common/CopyTooltip'
import { evmToSs58 } from '@/components/common/SpaceSafeBar/BittensorAddress'
import WalletInfo from '@/components/common/WalletInfo'
import useChainId from '@/hooks/useChainId'

const AccountCenter = ({ wallet }: { wallet: ConnectedWallet }) => {
  const [open, setOpen] = useState(false)
  const { balance } = wallet
  const chainId = useChainId()
  const ss58 = chainId === '964' || wallet.chainId === '964' ? evmToSs58(wallet.address) : undefined

  const closeWalletInfo = () => {
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {ss58 ? (
        <div className={`${css.buttonContainer} ${css.connectedButton}`}>
          <WalletIdenticon wallet={wallet} />
          <div className="flex min-w-0 flex-col">
            {[
              { label: 'SS58', address: ss58 },
              { label: 'TAO EVM', address: wallet.address },
            ].map(({ label, address }) => (
              <CopyTooltip key={label} text={address} initialToolTipText={`Copy ${label} address`}>
                <button
                  type="button"
                  aria-label={`Copy ${label} address`}
                  className="flex min-w-0 items-center gap-1 text-xs leading-5"
                >
                  <span className="w-14 shrink-0 text-left text-muted-foreground">{label}</span>
                  <span className="truncate">
                    {address.slice(0, 6)}…{address.slice(-6)}
                  </span>
                  <Copy className="size-3 shrink-0" />
                </button>
              </CopyTooltip>
            ))}
          </div>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Open wallet details"
                className="flex size-8 shrink-0 items-center justify-center"
              />
            }
            data-testid="open-account-center"
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </PopoverTrigger>
        </div>
      ) : (
        <PopoverTrigger
          render={<button type="button" className="flex self-stretch text-left" />}
          data-testid="open-account-center"
        >
          <div className={`${css.buttonContainer} ${css.connectedButton}`}>
            <WalletOverview wallet={wallet} balance={balance} showBalance />

            <div className="ml-auto flex items-center justify-end text-[var(--color-border-main)]">
              {open ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown data-testid="ExpandMoreIcon" className="size-4" />
              )}
            </div>
          </div>
        </PopoverTrigger>
      )}

      <PopoverContent
        showBackdrop
        align="center"
        side="bottom"
        sideOffset={0}
        className="w-auto overflow-hidden rounded-3xl border-0 p-0 ring-0 shadow-none"
      >
        <div className={css.popoverContainer}>
          <WalletInfo wallet={wallet} handleClose={closeWalletInfo} balance={balance} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AccountCenter
