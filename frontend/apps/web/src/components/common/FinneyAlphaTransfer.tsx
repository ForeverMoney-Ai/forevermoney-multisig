import { formatUnits } from 'ethers'
import { Ss58Recipient } from '@/components/common/FinneyTaoTransfer'
export default function FinneyAlphaTransfer({ recipient, hotkey, netuid, amount, legs }: { recipient: string; hotkey: string; netuid: number; amount: string; legs?: {hotkey:string;amount:string}[] }) {
  return <div className="flex min-w-0 flex-col gap-4" data-testid="native-alpha-review">
    <p className="font-semibold">{formatUnits(amount, 9)} SN{netuid} alpha</p>
    <Ss58Recipient address={recipient} />
    <details open><summary>Validator breakdown · {(legs || [{hotkey,amount}]).length} position(s)</summary>{(legs || [{hotkey,amount}]).map((p,i)=><div key={i} className="mt-3"><code className="break-all text-sm">{p.hotkey}</code><p>{formatUnits(p.amount,9)} SN{netuid}</p></div>)}</details>
    <p className="text-sm text-muted-foreground">Transfers native subnet stake on Finney. The subnet and validator stay the same. No swap to TAO.</p>
  </div>
}
