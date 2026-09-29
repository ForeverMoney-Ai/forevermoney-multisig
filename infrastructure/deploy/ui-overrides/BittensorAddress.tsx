import { blake2b } from '@noble/hashes/blake2b'
import { Copy } from 'lucide-react'
import useSafeAddress from '@/hooks/useSafeAddress'
import useChainId from '@/hooks/useChainId'
import CopyTooltip from '@/components/common/CopyTooltip'

// Bittensor's EVM mirror: blake2_256("evm:" ++ H160), SS58 prefix 42.
export function evmToSs58(address: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return undefined
  const evm = Uint8Array.from(address.slice(2).match(/../g)!, (byte) => parseInt(byte, 16))
  const publicKey = blake2b(new Uint8Array([101, 118, 109, 58, ...evm]), { dkLen: 32 })
  const payload = new Uint8Array([42, ...publicKey])
  const checksum = blake2b(new Uint8Array([...new TextEncoder().encode('SS58PRE'), ...payload]), { dkLen: 64 })
  const bytes = new Uint8Array([...payload, ...checksum.slice(0, 2)])
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let value = BigInt('0x' + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''))
  let encoded = ''
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded
    value /= 58n
  }
  return encoded
}

export default function BittensorAddress() {
  const address = useSafeAddress()
  const chainId = useChainId()
  const ss58 = chainId === '964' ? evmToSs58(address) : undefined
  if (!ss58) return null

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted px-3 py-2" data-testid="safe-ss58-address">
      <img src="/assets/metadata/tao.png" alt="Bittensor" width={32} height={32} className="size-8 shrink-0 rounded-full bg-white" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">Bittensor SS58</div>
        <div className="flex min-w-0 items-center gap-2" title={ss58}>
          <code className="min-w-0 truncate font-mono text-sm text-foreground select-all">{ss58}</code>
        </div>
      </div>
      <CopyTooltip text={ss58} initialToolTipText="Copy SS58 address">
        <button type="button" aria-label="Copy SS58 address" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Copy className="size-4" />
        </button>
      </CopyTooltip>
    </div>
  )
}
