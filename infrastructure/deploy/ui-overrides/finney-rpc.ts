import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

export const FINNEY_FALLBACK_RPC = 'https://lite.chain.opentensor.ai'
// Browser RPC (origin-restricted provider URL) comes from the build environment, never from source.
export const FINNEY_BROWSER_RPC = process.env.NEXT_PUBLIC_FINNEY_RPC_URL || FINNEY_FALLBACK_RPC
export const withFinneyBrowserRpc = (chain: Chain): Chain => chain.chainId === '964' ? {
  ...chain,
  rpcUri: { ...chain.rpcUri, authentication: 'NO_AUTHENTICATION', value: FINNEY_BROWSER_RPC },
  // Wallet-added network RPCs keep their public URL: wallet services may omit Origin.
  safeAppsRpcUri: { ...chain.safeAppsRpcUri, authentication: 'NO_AUTHENTICATION', value: FINNEY_BROWSER_RPC },
} : chain

const READ_METHODS = new Set(['eth_accounts', 'state_call', 'chain_getBlockHash', 'state_getKeysPaged', 'eth_chainId', 'net_version', 'eth_blockNumber', 'eth_call', 'eth_estimateGas', 'eth_getBalance', 'eth_getCode', 'eth_getStorageAt', 'eth_getTransactionCount', 'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getLogs', 'eth_gasPrice', 'eth_feeHistory', 'eth_maxPriorityFeePerGas'])
type RpcPayload = { id: number; jsonrpc: '2.0'; method: string; params: unknown[] | Record<string, unknown> }
type RpcResponse = { id: number; jsonrpc: '2.0'; result?: unknown; error?: { code: number; message: string; data?: unknown } }
const isRateLimit = (r: RpcResponse) => !!r.error && ([-32005, -32016, -32029, 429].includes(r.error.code) || /rate.?limit|too many requests/i.test(r.error.message))

async function request(url: string, payload: RpcPayload | RpcPayload[]): Promise<RpcResponse[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit' })
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`)
    const json = await response.json()
    const result: RpcResponse[] = Array.isArray(json) ? json : [json]
    const expected = Array.isArray(payload) ? payload : [payload]
    if (result.length !== expected.length || expected.some(p => !result.some(r => r && r.jsonrpc === '2.0' && r.id === p.id && ('result' in r || 'error' in r)))) throw new Error('Invalid RPC response')
    return result
  } finally { clearTimeout(timer) }
}

// Retry a transient fallback failure once; this helper is only called for read methods.
async function fallbackRead(payload: RpcPayload | RpcPayload[]): Promise<RpcResponse[]> {
  try {
    const result = await request(FINNEY_FALLBACK_RPC, payload)
    if (!result.some(isRateLimit)) return result
  } catch { /* Retry one transient transport failure, never a write. */ }
  await new Promise(resolve => setTimeout(resolve, 300))
  return request(FINNEY_FALLBACK_RPC, payload)
}

// Retry reads only. Contract reverts are returned unchanged; signing and broadcasts
// are never retried on another provider. Every call tries OnFinality first.
export async function sendFinneyRpc(payload: RpcPayload | RpcPayload[]): Promise<RpcResponse[]> {
  const requests = Array.isArray(payload) ? payload : [payload]
  const retryable = requests.every(p => READ_METHODS.has(p.method))
  let responses: RpcResponse[]
  try { responses = await request(FINNEY_BROWSER_RPC, payload) }
  catch (error) {
    if (!retryable) throw error
    return fallbackRead(payload)
  }
  if (retryable && responses.some(isRateLimit)) return fallbackRead(payload)
  return responses
}

export function safeRpcInput(provider: { _getConnection(): { url: string }; send(method: string, params: unknown[] | Record<string, unknown>): Promise<unknown> }) {
  return provider._getConnection().url === FINNEY_BROWSER_RPC
    ? { request: ({ method, params }: { method: string; params?: readonly unknown[] | object }) => provider.send(method, params == null ? [] : Array.isArray(params) ? [...params] : { ...params }) }
    : provider._getConnection().url
}
