import { Contract, Interface, getAddress, getBytes, hexlify, parseUnits, type JsonRpcProvider } from 'ethers'
import { blake2b } from '@noble/hashes/blake2b'
import { decodeFinneyAddress, encodeFinneyAddress } from '@/services/tx/finney-tao'
import type { MetaTransactionData } from '@safe-global/types-kit'

export const STAKING_PRECOMPILE = '0x0000000000000000000000000000000000000805'
export const ALPHA_ABI = [
  'function getStakingHotkeys(bytes32 coldkey,uint64 offset,uint16 limit) view returns(bytes32[] hotkeys,uint64 total)',
  'function getStakeInfoForColdkeyAndNetuid(bytes32 coldkey,uint256 netuid,bytes32[] hotkeys) view returns(tuple(bytes32 hotkey,uint256 stake)[] positions)',
  'function getStake(bytes32 hotkey,bytes32 coldkey,uint256 netuid) view returns(uint256)',
  'function transferStake(bytes32 destinationColdkey,bytes32 hotkey,uint256 originNetuid,uint256 destinationNetuid,uint256 amount)',
]
const abi = new Interface(ALPHA_ABI)
const MAX_U64 = (1n << 64n) - 1n
export type AlphaPosition = { netuid: number; hotkey: string; amount: string }
export function evmColdkey(address: string): string {
  return hexlify(blake2b(new Uint8Array([...new TextEncoder().encode('evm:'), ...getBytes(getAddress(address))]), { dkLen: 32 }))
}
/** Resolve a Finney EVM account to its native coldkey, or validate an SS58 coldkey. */
export function resolveAlphaRecipient(value: string): { coldkey: string; ss58: string; evm?: string } {
  const input = value.trim().replace(/^finney:/, '').trim()
  if (/^0x/i.test(input)) {
    let evm: string
    try { evm = getAddress(input) } catch { throw new Error('Enter a valid TAO EVM or Finney SS58 address') }
    if (BigInt(evm) === 0n) throw new Error('The zero address cannot receive native subnet tokens')
    const coldkey = evmColdkey(evm)
    return { coldkey, ss58: encodeFinneyAddress(coldkey), evm }
  }
  const coldkey = decodeFinneyAddress(input)
  return { coldkey, ss58: encodeFinneyAddress(coldkey) }
}
export function alphaAmount(value: string): bigint {
  if (!/^\d+(\.\d{1,9})?$/.test(value)) throw new Error('Enter an alpha amount with up to 9 decimal places')
  const amount = parseUnits(value, 9)
  if (amount <= 0n || amount > MAX_U64) throw new Error('Enter a positive alpha amount within the supported range')
  return amount
}
export function alphaTransfer(chainId: string, recipient: string, hotkey: string, netuid: number, amount: string): MetaTransactionData {
  if (chainId !== '964') throw new Error('Native subnet transfers are only available on Finney')
  if (!Number.isInteger(netuid) || netuid <= 0 || netuid > 65535) throw new Error('Invalid subnet')
  if (!/^0x[0-9a-fA-F]{64}$/.test(hotkey) || BigInt(hotkey) === 0n) throw new Error('Invalid validator hotkey')
  return { to: STAKING_PRECOMPILE, value: '0', operation: 0, data: abi.encodeFunctionData('transferStake', [resolveAlphaRecipient(recipient).coldkey, hotkey, netuid, netuid, alphaAmount(amount)]) }
}
export function decodeAlphaTransfer(chainId: string, to: string, data: string, value: string, operation: number) {
  if (chainId !== '964' || to.toLowerCase() !== STAKING_PRECOMPILE || operation !== 0 || value !== '0' || !/^0x[0-9a-fA-F]{328}$/.test(data)) return undefined
  try {
    const [key, hotkey, origin, destination, amount] = abi.decodeFunctionData('transferStake', data)
    if (origin !== destination || origin <= 0n || origin > 65535n || amount <= 0n || amount > MAX_U64 || BigInt(hotkey) === 0n) return undefined
    const recipient = encodeFinneyAddress(key)
    decodeFinneyAddress(recipient)
    return { recipient, hotkey: encodeFinneyAddress(hotkey), netuid: Number(origin), amount: amount.toString() }
  } catch { return undefined }
}
// SCALE layout from Subtensor StakeInfoRuntimeApi. Reject unknown/truncated layouts,
// rather than turning a decoding failure into an empty balance.
export function decodeStakeInfo(encoded: string, coldkey: string): AlphaPosition[] {
  const bytes = getBytes(encoded)
  let offset = 0
  const take = (n: number) => {
    if (offset + n > bytes.length) throw new Error('Incomplete stake response')
    const value = bytes.slice(offset, offset + n); offset += n; return value
  }
  const compact = (): bigint => {
    const first = take(1)[0], mode = first & 3
    if (mode === 0) return BigInt(first >> 2)
    const tail = take(mode === 1 ? 1 : mode === 2 ? 3 : (first >> 2) + 4)
    let value = mode === 3 ? 0n : BigInt(first)
    for (let i = 0; i < tail.length; i++) value |= BigInt(tail[i]) << BigInt(8 * (i + (mode === 3 ? 0 : 1)))
    return mode === 3 ? value : value >> 2n
  }
  const count = compact()
  if (count > 65536n) throw new Error('Too many stake positions')
  const positions: AlphaPosition[] = [], seen = new Set<string>()
  for (let i = 0n; i < count; i++) {
    const hotkey = hexlify(take(32)), owner = hexlify(take(32))
    const netuid = compact(), stake = compact()
    for (let field = 0; field < 4; field++) compact() // locked, emission, tao_emission, drain
    const registered = take(1)[0]
    if (owner.toLowerCase() !== coldkey.toLowerCase() || netuid > 65535n || stake > MAX_U64 || registered > 1) throw new Error('Invalid stake response')
    const key = `${netuid}:${hotkey}`
    if (seen.has(key)) throw new Error('Duplicate stake position')
    seen.add(key)
    if (netuid > 0n && stake > 0n) positions.push({netuid: Number(netuid), hotkey, amount: stake.toString()})
  }
  if (offset !== bytes.length) throw new Error('Unsupported stake response layout')
  return positions.sort((a,b) => a.netuid - b.netuid || a.hotkey.localeCompare(b.hotkey))
}
export async function readAlphaPositions(provider: JsonRpcProvider, address: string, cancelled: () => boolean = () => false) {
  if ((await provider.getNetwork()).chainId !== 964n) throw new Error('Wrong network')
  const blockTag = await provider.getBlockNumber()
  const hash = await provider.send('chain_getBlockHash', [blockTag])
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Invalid block hash')
  if (cancelled()) throw new Error('Cancelled')
  const coldkey = evmColdkey(address)
  const encoded = await provider.send('state_call', ['StakeInfoRuntimeApi_get_stake_info_for_coldkey', coldkey, hash])
  const positions = decodeStakeInfo(encoded, coldkey)
  const prices: Record<number, string> = {}
  const pricing = new Contract('0x0000000000000000000000000000000000000808', ['function getAlphaPrice(uint16) view returns(uint256)'], provider)
  const netuids = [...new Set(positions.map(p => p.netuid))]
  let index = 0
  await Promise.all(Array.from({length: Math.min(4, netuids.length)}, async () => {
    while (index < netuids.length) {
      if (cancelled()) throw new Error('Cancelled')
      const netuid = netuids[index++]
      try { prices[netuid] = (await pricing.getAlphaPrice(netuid, {blockTag})).toString() } catch { /* Never hide a confirmed position because its quote is unavailable. */ }
    }
  }))
  return {prices, positions, block: blockTag}
}

/** Largest positions first minimizes calls. Stable hotkey tie-break makes the plan reproducible. */
export function planAlphaTransfer(positions: AlphaPosition[], amount: string, hotkey?: string): AlphaPosition[] {
  let remaining = alphaAmount(amount)
  const netuid = positions[0]?.netuid, seen = new Set<string>()
  if (!netuid || positions.some(p => p.netuid !== netuid || !/^0x[0-9a-fA-F]{64}$/.test(p.hotkey) || !/^\d+$/.test(p.amount) || BigInt(p.amount) > MAX_U64 || seen.has(p.hotkey.toLowerCase()) || !seen.add(p.hotkey.toLowerCase()))) throw new Error('Invalid validator positions')
  const available = positions.filter(p => !hotkey || p.hotkey === hotkey).sort((a,b) => BigInt(a.amount) === BigInt(b.amount) ? a.hotkey.localeCompare(b.hotkey) : BigInt(a.amount) > BigInt(b.amount) ? -1 : 1)
  const plan: AlphaPosition[] = []
  for (const position of available) {
    const take = BigInt(position.amount) < remaining ? BigInt(position.amount) : remaining
    if (take > 0n) plan.push({...position, amount:take.toString()})
    remaining -= take
    if (!remaining) break
  }
  if (remaining) throw new Error('Amount exceeds available stake')
  if (plan.length > 64) throw new Error('This transfer needs more than 64 validators. Choose a smaller amount or a specific validator.')
  return plan
}
const multisend = new Interface(['function multiSend(bytes transactions)'])
// Canonical deployments shipped by Safe, matching the SDK configuration on Finney.
const CALL_ONLY = new Set(['0x40a2accbd92bca938b02010e17a5b8929b49130d','0x9641d764fc13c8b624c04430c7356c1c7c8102e2'])
export function decodeAlphaBatch(chainId: string, to: string, data: string, value: string, operation: number) {
  if (chainId !== '964' || operation !== 1 || value !== '0' || !CALL_ONLY.has(to.toLowerCase())) return
  try {
    const [packed] = multisend.decodeFunctionData('multiSend',data)
    if (multisend.encodeFunctionData('multiSend',[packed]).toLowerCase() !== data.toLowerCase()) return
    const bytes = getBytes(packed), legs: NonNullable<ReturnType<typeof decodeAlphaTransfer>>[] = []
    let offset = 0
    while (offset < bytes.length) {
      if (offset + 85 > bytes.length || legs.length >= 64) return
      const op = bytes[offset], target = hexlify(bytes.slice(offset+1,offset+21))
      const amount = BigInt(hexlify(bytes.slice(offset+21,offset+53))).toString()
      const length = Number(BigInt(hexlify(bytes.slice(offset+53,offset+85))))
      if (length !== 164 || offset+85+length > bytes.length) return
      const decoded = decodeAlphaTransfer(chainId,target,hexlify(bytes.slice(offset+85,offset+85+length)),amount,op)
      if (!decoded) return
      if (legs.length && (decoded.recipient !== legs[0].recipient || decoded.netuid !== legs[0].netuid)) return
      legs.push(decoded); offset += 85+length
    }
    if (legs.length < 2) return
    return {...legs[0], amount:legs.reduce((sum,p)=>sum+BigInt(p.amount),0n).toString(), legs}
  } catch { return }
}
