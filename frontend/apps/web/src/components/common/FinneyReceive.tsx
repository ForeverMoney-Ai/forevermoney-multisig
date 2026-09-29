import { useState } from 'react'
import { Copy, ExternalLink, TriangleAlert } from 'lucide-react'
import QRCode from '@/components/common/QRCode'
import CopyTooltip from '@/components/common/CopyTooltip'
import { evmToSs58 } from '@/components/common/SpaceSafeBar/BittensorAddress'
import { Button } from '@/components/ui/button'

export default function FinneyReceive({ address }: { address: string }) {
  const [format, setFormat] = useState<'ss58' | 'evm'>('ss58')
  const ss58 = evmToSs58(address)
  if (!ss58) return null
  const selected = format === 'ss58' ? ss58 : address
  const explorer = format === 'ss58' ? `https://taostats.io/account/${ss58}` : `https://evm.tao.app/address/${address}`

  return <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-center gap-5" data-testid="finney-receive">
    <div role="note" data-testid="finney-network-warning" className="flex w-full items-start gap-3 rounded-xl border p-4" style={{ background: '#241d10', borderColor: '#685025', color: '#f5d491' }}>
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">Bittensor (Finney) only</p>
        <p className="mt-1">This multi-sig is on Bittensor EVM. Do not send funds from Ethereum, Base, or any other chain. Funds sent on the wrong network may be lost.</p>
      </div>
    </div>
    <div className="text-center">
      <p className="font-semibold">One multi-sig. Two address formats.</p>
      <p className="mt-1 text-sm text-muted-foreground">Choose the format your sending wallet uses.</p>
    </div>
    <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-background p-1" role="group" aria-label="Receive address format">
      <Button className="min-w-0 rounded-lg" variant={format === 'ss58' ? 'default' : 'ghost'} aria-pressed={format === 'ss58'} onClick={() => setFormat('ss58')}>SS58</Button>
      <Button className="min-w-0 rounded-lg" variant={format === 'evm' ? 'default' : 'ghost'} aria-pressed={format === 'evm'} onClick={() => setFormat('evm')}>EVM mirror</Button>
    </div>
    <p className="text-center text-sm text-muted-foreground">{format === 'ss58' ? 'For native TAO transfers on Finney.' : 'For TAO and tokens sent from EVM wallets on Finney.'}</p>
    <div className="rounded-xl border p-3" data-testid="finney-receive-qr" data-address={selected}><QRCode value={selected} size={164} /></div>
    <div className="w-full min-w-0 rounded-xl border bg-background p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{format === 'ss58' ? 'SS58 address' : 'EVM mirror address'}</span>
        <span>Finney</span>
      </div>
      <code className="block break-all font-mono text-sm leading-relaxed select-all" data-testid="finney-receive-address">{selected}</code>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <CopyTooltip text={selected} initialToolTipText={`Copy ${format === 'ss58' ? 'SS58' : 'EVM'} address`}>
          <Button size="sm" variant="default"><Copy className="size-4" />Copy address</Button>
        </CopyTooltip>
        <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" aria-label={`View ${format === 'ss58' ? 'SS58' : 'EVM'} address on explorer`}>Explorer<ExternalLink className="size-4" /></a>
      </div>
    </div>
    <p className="text-center text-xs text-muted-foreground">Both addresses belong to this multi-sig. Send only on Finney.</p>
  </div>
}
