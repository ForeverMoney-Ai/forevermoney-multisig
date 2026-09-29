import { type ReactNode, useContext, useEffect, useState } from 'react'
import { formatUnits } from 'ethers'
import { ChevronDown, ChevronUp, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TokenIcon from '@/components/common/TokenIcon'
import FiatValue from '@/components/common/FiatValue'
import CheckWallet from '@/components/common/CheckWallet'
import { TxModalContext } from '@/components/tx-flow'
import type { EnhancedTableProps } from '@/components/common/EnhancedTable'
import useSafeInfo from '@/hooks/useSafeInfo'
import useChainId from '@/hooks/useChainId'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3'
import { readAlphaPositions, type AlphaPosition } from '@/services/tx/finney-alpha'
import { encodeFinneyAddress } from '@/services/tx/finney-tao'
import FinneyAlphaFlow from '@/components/common/FinneyAlphaFlow'
import css from './FinneyAlphaAssets.module.css'

type Metadata = { netuid: number; name: string; logoUri: string }
type Snapshot = Awaited<ReturnType<typeof readAlphaPositions>> & { address: string }
const short = (value: string) => `${value.slice(0, 7)}…${value.slice(-7)}`


const cacheKey = (address: string) => `finney:964:native-stake:v2:${address.toLowerCase()}`
export function readCachedAlpha(address: string): Snapshot | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey(address)) || 'null')
    if (!value || value.address?.toLowerCase() !== address.toLowerCase() || !Number.isSafeInteger(value.block) || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || Date.now() - value.savedAt > 86400000 || !Array.isArray(value.positions) || value.positions.length > 65536) return
    if (!value.positions.every((p: AlphaPosition) => Number.isInteger(p.netuid) && p.netuid > 0 && p.netuid <= 65535 && /^0x[0-9a-fA-F]{64}$/.test(p.hotkey) && /^\d+$/.test(p.amount) && BigInt(p.amount) > 0n && BigInt(p.amount) <= (1n<<64n)-1n)) return
    if (!value.prices || !Object.values(value.prices).every(p => typeof p === 'string' && /^\d+$/.test(p))) return
    return value
  } catch { return }
}

/** One native-stake subnet, summarised for compact lists such as the dashboard. */
export type FinneyAlphaItem = { key: string; netuid: number; name: string; logoUri?: string; balance: string; fiat: number | null; send: ReactNode }
export type FinneyAlphaAssets = ReturnType<typeof useFinneyAlphaAssets>

/** Native stake shares the asset table, but never masquerades as an ERC-20 address. */
export function useFinneyAlphaAssets(taoFiatPrice?: number) {
  const provider = useWeb3ReadOnly(), { setTxFlow } = useContext(TxModalContext)
  const chainId = useChainId(), { safeAddress, safeLoaded } = useSafeInfo()
  const active = chainId === '964' && safeLoaded && !!safeAddress
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const data = active && snapshot?.address.toLowerCase() === safeAddress.toLowerCase() ? snapshot : undefined
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, refresh] = useState(0)
  const [metadata, setMetadata] = useState<Metadata[]>([])
  const [expanded, setExpanded] = useState<number[]>([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/assets/metadata/subnets.json', { signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(catalog => {
      if (!controller.signal.aborted && Array.isArray(catalog.subnets)) setMetadata(catalog.subnets)
    }).catch(() => {})
    return () => controller.abort()
  }, [])
  useEffect(() => { setExpanded([]); setSnapshot(readCachedAlpha(safeAddress)); }, [safeAddress, chainId])
  useEffect(() => {
    if (!active || !provider) return
    let cancelled = false
    setLoading(true); setError('')
    readAlphaPositions(provider, safeAddress, () => cancelled).then(value => { if (!cancelled) { const next = { ...value, address: safeAddress }; setSnapshot(next); try { localStorage.setItem(cacheKey(safeAddress), JSON.stringify({...next, savedAt:Date.now()})) } catch {} } }).catch(() => { if (!cancelled) setError('Could not refresh native stake. Displayed balances may be out of date.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider, safeAddress, active, revision])
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(x => x + 1) }, 120000); return () => clearInterval(timer) }, [])
  const groups = new Map<number, AlphaPosition[]>()
  for (const position of data?.positions || []) groups.set(position.netuid, [...(groups.get(position.netuid) || []), position])
  const open = (positions: AlphaPosition[], hotkey?: string) => {
    setTxFlow(<FinneyAlphaFlow positions={positions} initialHotkey={hotkey} safeAddress={safeAddress} />)
  }
  let fiatTotal = 0, hasUnpriced = false
  const rows: EnhancedTableProps['rows'] = [], mobileRows = []
  const items: FinneyAlphaItem[] = []
  for (const [netuid, positions] of groups) {
    const meta = metadata.find(m => m.netuid === netuid)
    const balance = formatUnits(positions.reduce((sum, p) => sum + BigInt(p.amount), 0n), 9)
    const quote = data?.prices?.[netuid]
    const price = quote && BigInt(quote) > 0n && taoFiatPrice && taoFiatPrice > 0 ? Number(formatUnits(quote, 18)) * taoFiatPrice : null
    const fiat = price == null ? null : Number(balance) * price
    if (fiat == null) hasUnpriced = true; else fiatTotal += fiat
    const isExpanded = expanded.includes(netuid)
    const toggle = () => setExpanded(ids => ids.includes(netuid) ? ids.filter(id => id !== netuid) : [...ids, netuid])
    const identity = <button type="button" className={css.identity} onClick={toggle} aria-label={`SN${netuid} validators`} aria-expanded={isExpanded}>
      <TokenIcon logoUri={meta?.logoUri?.replace('https://safe.forevermoney.ai', '')} tokenSymbol={`SN${netuid}`} size={32} />
      <span><strong>{meta?.name || `Subnet ${netuid}`}</strong><small>SN{netuid} · Native stake</small></span>
      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    const send = <CheckWallet>{isOk => <Button variant="ghost" size="icon" aria-label={`Send SN${netuid}`} title={`Send SN${netuid}`} disabled={!isOk || loading || !!error} onClick={() => open(positions)}><ArrowUpRight size={18} /></Button>}</CheckWallet>
    const details = <div className={css.details} aria-label={`SN${netuid} validator positions`}>
      <p className={css.caption}>Staked across {positions.length} validator{positions.length === 1 ? '' : 's'}</p>
      {positions.map(position => <div className={css.position} key={position.hotkey}>
        <div className={css.validator}><span>Validator hotkey</span><a href={`https://taostats.io/account/${encodeFinneyAddress(position.hotkey)}`} target="_blank" rel="noreferrer" title={encodeFinneyAddress(position.hotkey)}>{short(encodeFinneyAddress(position.hotkey))} ↗</a></div>
        <span className={css.balance}>{formatUnits(position.amount, 9)} SN{netuid}</span>
        <CheckWallet>{isOk => <Button variant="outline" disabled={!isOk || loading || !!error} onClick={() => open(positions, position.hotkey)}>Send from validator</Button>}</CheckWallet>
      </div>)}
    </div>
    items.push({ key: `native-alpha:${netuid}`, netuid, name: meta?.name || `Subnet ${netuid}`, logoUri: meta?.logoUri?.replace('https://safe.forevermoney.ai', ''), balance, fiat, send })
    rows.push({key:`native-alpha:${netuid}`,expandedContent:isExpanded ? details : undefined,cells:{
      asset:{rawValue:meta?.name || `SN${netuid}`,content:identity},
      price:{rawValue:price,content:<div className="text-right"><FiatValue value={price == null ? null : String(price)} /></div>},
      balance:{rawValue:Number(balance),content:<div className="text-right" title={`${balance} SN${netuid}`}>{balance}</div>},
      weight:{rawValue:null,content:<></>},
      value:{rawValue:fiat,content:<div className="text-right"><FiatValue value={fiat == null ? null : String(fiat)} /></div>},
      actions:{rawValue:'',content:<div className="flex justify-end">{send}</div>},
    }})
    mobileRows.push(<div key={`native-alpha:${netuid}`} className={css.mobile}>
      <div className={css.mobileMain}>{identity}<div className="text-right"><FiatValue value={fiat == null ? null : String(fiat)} /><small>{balance} SN{netuid}</small></div>{send}</div>
      {isExpanded && details}
    </div>)
  }
  const status = active && <div className={css.status}>
    {error ? <span role="alert">{error}</span> : loading ? <span role="status">{data ? 'Updating saved stake balances…' : 'Loading native stake…'}</span> : hasUnpriced ? <span>Some native stake prices are unavailable and excluded from the total.</span> : null}
    <Button variant="ghost" size="sm" disabled={loading || !provider} onClick={() => refresh(x => x + 1)}>Refresh stake</Button>
  </div>
  return { rows, mobileRows, items, status, fiatTotal, hasUnpriced, loading: active && loading, hasPositions: groups.size > 0, pendingInitial: active && loading && !data }
}
