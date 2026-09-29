import { useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { Contract, Interface, getBytes, hexlify, formatUnits } from 'ethers'
import { TxFlow } from '@/components/tx-flow/TxFlow'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import ReviewTransaction from '@/components/tx/ReviewTransactionV2'
import { createMultiSendCallOnlyTx } from '@/services/tx/tx-sender'
import useSafeInfo from '@/hooks/useSafeInfo'
import useChainId from '@/hooks/useChainId'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3'
import { ALPHA_ABI, STAKING_PRECOMPILE, evmColdkey, resolveAlphaRecipient, alphaTransfer, decodeAlphaBatch, planAlphaTransfer, type AlphaPosition } from '@/services/tx/finney-alpha'

import { TxFlowStep } from '@/components/tx-flow/TxFlowStep'
import { TxFlowContext } from '@/components/tx-flow/TxFlowProvider'
import TxCard, { TxCardActions } from '@/components/tx-flow/common/TxCard'
import { Button } from '@/components/ui/button'
import CheckWallet from '@/components/common/CheckWallet'
import AssetsIcon from '@/public/images/sidebar/assets.svg'
import { encodeFinneyAddress } from '@/services/tx/finney-tao'
import css from './FinneyAlphaAssets.module.css'

type Transfer = { plan: AlphaPosition[]; hotkey?: string; recipient: string; amount: string; safeAddress: string }
function AlphaReview(props: PropsWithChildren<{ onSubmit: () => void }>) {
  const { data } = useContext(TxFlowContext)
  const transfer = data as Transfer
  const { setSafeTx, setSafeTxError } = useContext(SafeTxContext)
  const provider = useWeb3ReadOnly(), chainId = useChainId(), { safeAddress } = useSafeInfo()
  useEffect(() => {
    let cancelled = false
    setSafeTx(undefined); setSafeTxError(undefined)
    async function build() {
      if (!provider || safeAddress.toLowerCase() !== transfer.safeAddress.toLowerCase()) throw new Error('Multisig changed. Reopen the transfer from Assets.')
      if ((await provider.getNetwork()).chainId !== 964n || chainId !== '964') throw new Error('Switch to Finney')
      const { plan, recipient } = transfer
      if (resolveAlphaRecipient(recipient).coldkey === evmColdkey(safeAddress)) throw new Error('Choose a recipient other than this multisig')
      const staking = new Contract(STAKING_PRECOMPILE, ALPHA_ABI, provider)
      const transactions = []
      for (const position of plan) {
        const available = await staking.getStake(position.hotkey, evmColdkey(safeAddress), position.netuid)
        if (BigInt(position.amount) > available) throw new Error('The available stake changed. Go back and refresh Assets.')
        const tx = alphaTransfer(chainId, recipient, position.hotkey, position.netuid, formatUnits(position.amount,9))
        await provider.call({...tx, from:safeAddress})
        transactions.push(tx)
      }
      const built = await createMultiSendCallOnlyTx(transactions)
      if (transactions.length > 1) {
        if (!decodeAlphaBatch(chainId,built.data.to,built.data.data,built.data.value,built.data.operation)) throw new Error('Unexpected batch contract or data')
        const simulation = new Interface(['function simulateAndRevert(address targetContract,bytes calldataPayload)'])
        let result: string | undefined
        try { await provider.call({to:safeAddress,gasLimit:10000000n,data:simulation.encodeFunctionData('simulateAndRevert',[built.data.to,built.data.data])}) }
        catch (e) { const failure = e as {data?:string;info?:{error?:{data?:string}}}; result = failure.data || failure.info?.error?.data }
        if (!result || !/^0x[0-9a-fA-F]{128,}$/.test(result) || BigInt(hexlify(getBytes(result).slice(0,32))) !== 1n) throw new Error('The combined transfer could not be simulated')
      }
      return built
    }
    build().then(tx => { if (!cancelled) setSafeTx(tx) }).catch(() => { if (!cancelled) setSafeTxError(new Error('Could not validate this native stake transfer. Refresh the position and check the amount, recipient, and subnet restrictions. Each validator portion must meet Bittensor’s minimum transfer amount.')) })
    return () => { cancelled = true }
  }, [provider, chainId, safeAddress, transfer, setSafeTx, setSafeTxError])
  return <ReviewTransaction {...props} />
}
export function CreateAlphaTransfer({positions, initialHotkey, safeAddress}: {positions: AlphaPosition[]; initialHotkey?: string; safeAddress: string}) {
  const {data, onNext} = useContext(TxFlowContext)
  const previous = data as Transfer | undefined
  const [hotkey, setHotkey] = useState(previous?.hotkey || initialHotkey || '')
  const [recipient, setRecipient] = useState(previous?.recipient || '')
  const [amount, setAmount] = useState(previous?.amount || '')
  const [error, setError] = useState('')
  const available = positions.filter(p => !hotkey || p.hotkey === hotkey).reduce((sum,p)=>sum+BigInt(p.amount),0n)
  let preview: AlphaPosition[] = []
  try { preview = planAlphaTransfer(positions,amount,hotkey || undefined) } catch {}
  let resolved: ReturnType<typeof resolveAlphaRecipient> | undefined
  try { resolved = resolveAlphaRecipient(recipient) } catch {}
  const netuid = positions[0].netuid
  function next() {
    try {
      const plan = planAlphaTransfer(positions,amount,hotkey || undefined)
      for (const p of plan) alphaTransfer('964',recipient,p.hotkey,p.netuid,formatUnits(p.amount,9))
      if (resolveAlphaRecipient(recipient).coldkey === evmColdkey(safeAddress)) throw new Error('Choose a different recipient')
      onNext({plan, hotkey:hotkey || undefined, recipient, amount, safeAddress})
    } catch(e) { setError((e as Error).message) }
  }
  return <TxCard>
    <div className={css.transferForm}>
      <p>Send native SN{netuid} stake. The recipient keeps the same subnet and validator positions.</p>
      <label htmlFor="alpha-validator">Validator selection · {hotkey ? "Manual" : "Automatic"}</label>
      <select id="alpha-validator" value={hotkey} onChange={e => {setHotkey(e.target.value); setAmount(''); setError('')}}>
        <option value="">Automatic · use combined balance</option>
        {positions.map(p => <option key={p.hotkey} value={p.hotkey}>{encodeFinneyAddress(p.hotkey)} · {formatUnits(p.amount,9)} SN{p.netuid}</option>)}
      </select>
      <p>Automatic selection uses the largest positions first and combines them into one multisig transaction.</p>
      <label htmlFor="alpha-recipient">Recipient · TAO EVM or SS58</label>
      <input id="alpha-recipient" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x… or 5… (finney: prefix optional)" autoComplete="off" spellCheck={false}/>
      {resolved?.evm && <p>Native stake will arrive at this TAO EVM account’s SS58 mirror:<br/><code className="break-all">{resolved.ss58}</code></p>}
      <label htmlFor="alpha-amount">Amount · SN{netuid}</label>
      <div className={css.amount}><input id="alpha-amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal"/><Button variant="outline" disabled={!available} onClick={() => setAmount(formatUnits(available,9))}>Max</Button></div>
      <p>Available: {formatUnits(available,9)} SN{netuid}. Later rewards remain in this multisig.</p>
      {!!preview.length && <details><summary>Transfer breakdown · {preview.length} validator{preview.length === 1 ? '' : 's'}</summary>{preview.map(p=><p key={p.hotkey}><code className="break-all">{encodeFinneyAddress(p.hotkey)}</code><br/>{formatUnits(p.amount,9)} SN{netuid}</p>)}</details>}
      {error && <p role="alert" className={css.error}>{error}</p>}
    </div>
    <TxCardActions><CheckWallet>{isOk => <Button disabled={!isOk} onClick={next}>Next</Button>}</CheckWallet></TxCardActions>
  </TxCard>
}
export default function FinneyAlphaFlow({positions, initialHotkey, safeAddress}: {positions: AlphaPosition[]; initialHotkey?: string; safeAddress: string}) {
  const initialData = useMemo(() => undefined, [])
  return <TxFlow initialData={initialData} icon={AssetsIcon} subtitle={`Send SN${positions[0].netuid}`} ReviewTransactionComponent={AlphaReview}>
    <TxFlowStep title="New transaction"><CreateAlphaTransfer positions={positions} initialHotkey={initialHotkey} safeAddress={safeAddress}/></TxFlowStep>
  </TxFlow>
}
