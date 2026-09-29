import { formatUnits } from 'ethers'
import { Copy, ExternalLink } from 'lucide-react'
import CopyTooltip from '@/components/common/CopyTooltip'
import { stripFinney } from '@/services/tx/finney-tao'

export function Ss58Recipient({ address }: { address: string }) {
  const recipient = stripFinney(address)
  return <div className="min-w-0" data-testid="ss58-transfer-recipient">
    <p className="mb-2 text-sm text-muted-foreground">To · Finney SS58</p>
    <div className="flex min-w-0 items-start gap-3">
      <code className="min-w-0 flex-1 break-all text-sm leading-relaxed select-all">{recipient}</code>
      <CopyTooltip text={recipient}><button type="button" aria-label="Copy SS58 recipient" className="shrink-0"><Copy className="size-4" /></button></CopyTooltip>
      <a href={`https://taostats.io/account/${recipient}`} target="_blank" rel="noreferrer" aria-label="View SS58 recipient on Taostats" className="shrink-0"><ExternalLink className="size-4" /></a>
    </div>
  </div>
}
export default function FinneyTaoTransfer({ recipient, value }: { recipient: string; value: string }) {
  return <div className="flex min-w-0 flex-col gap-4" data-testid="ss58-tao-transfer">
    <div className="flex items-center gap-2"><img src="/assets/metadata/tao.png" alt="" width={28} height={28} /><span className="font-semibold">{formatUnits(value, 18)} TAO</span></div>
    <Ss58Recipient address={recipient} />
    <p className="text-sm text-muted-foreground">Native TAO transfer on Finney</p>
  </div>
}
