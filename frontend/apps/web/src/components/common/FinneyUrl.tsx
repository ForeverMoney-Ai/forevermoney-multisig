import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import LaunchScreen from '@/components/common/LaunchScreen'
import { ShadcnProvider } from '@/components/ui/ShadcnProvider'

type Mapping = { evm: string; ss58: string; chainId: string }
const mappings = new Map<string, Mapping>()

export default function FinneyUrl({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const path = router.asPath
  const visible = new URL(path, 'https://safe.forevermoney.ai').searchParams.get('safe') || ''
  const supported = /^(finney|tao):/.test(visible)
  const internal = String(router.query.safe || '')
  const mapping = mappings.get(visible.split(':')[1])
  const resolved = mapping && internal === `tao:${mapping.evm}`

  useEffect(() => {
    if (!router.isReady || !supported) return
    let cancelled = false
    const controller = new AbortController()
    setError('')
    const timer = setTimeout(() => controller.abort(), 15000)
    async function load() {
      try {
        const value = visible.slice(visible.indexOf(':') + 1)
        let match = mappings.get(value)
        if (!match) {
          const response = await fetch(`/address-resolver/resolve?address=${encodeURIComponent(value)}`, { signal: controller.signal })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'Unable to resolve this multi-sig address')
          match = data as Mapping
          if (match.chainId !== '964' || !/^0x[0-9a-fA-F]{40}$/.test(match.evm) || !/^[1-9A-HJ-NP-Za-km-z]{48}$/.test(match.ss58)) throw new Error('Invalid address lookup response')
          mappings.set(match.evm, match)
          mappings.set(match.ss58, match)
          mappings.set(value, match)
        }
        if (cancelled) return
        const url = new URL(router.asPath, window.location.origin)
        url.searchParams.set('safe', `finney:${match.ss58}`)
        const canonical = (url.pathname + url.search + url.hash).replace(/%3A/gi, ':')
        if (internal !== `tao:${match.evm}` || visible !== `finney:${match.ss58}`) {
          // Next.js supports a distinct display URL while query.safe remains EVM internally.
          await router.replace({ pathname: router.pathname, query: { ...router.query, safe: `tao:${match.evm}` }, hash: url.hash }, canonical, { shallow: true, scroll: false })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Address lookup timed out. Please retry.')
      } finally { clearTimeout(timer) }
    }
    void load()
    return () => { cancelled = true; controller.abort(); clearTimeout(timer) }
  }, [router.isReady, visible, internal, retry])

  if (!router.isReady || (supported && !resolved)) {
    if (!error) return <ShadcnProvider dark><LaunchScreen pending /></ShadcnProvider>
    return <main style={{ minHeight: 'calc(100vh - var(--fm-header, 0px) - var(--fm-footer, 0px))', display: 'grid', placeContent: 'center', background: '#101010', color: '#fff', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ fontSize: 20 }}>ForeverMoney Multi-sig</h1>
      <p role={error ? 'alert' : 'status'}>{error || 'Loading multi-sig…'}</p>
      {error && <><button onClick={() => setRetry(x => x + 1)}>Retry</button><a style={{ color: '#fff', marginTop: 16 }} href="/welcome/accounts">Open using an EVM address</a></>}
    </main>
  }
  return <>{children}</>
}
