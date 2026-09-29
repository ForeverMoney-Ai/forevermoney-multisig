import { blake2b } from '@noble/hashes/blake2b'
import { Interface, parseUnits, ZeroAddress } from 'ethers'
import type { MetaTransactionData } from '@safe-global/types-kit'

export const TAO_TRANSFER = '0x0000000000000000000000000000000000000800'
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const abi = new Interface(['function transfer(bytes32 recipient) payable'])
const checksum = (payload: Uint8Array) => blake2b(new Uint8Array([...new TextEncoder().encode('SS58PRE'), ...payload]), { dkLen: 64 })
export const stripFinney = (value: string) => value.trim().replace(/^finney:/, '').trim()
export const isSs58Input = (value: string) => /^(finney:)?\s*5/.test(value.trim())

export function decodeFinneyAddress(value: string): string {
  const address = stripFinney(value)
  if (!/^[1-9A-HJ-NP-Za-km-z]{48}$/.test(address)) throw new Error('Enter a valid Finney SS58 address')
  let n = 0n
  for (const char of address) n = n * 58n + BigInt(alphabet.indexOf(char))
  const hex = n.toString(16).padStart(70, '0')
  if (hex.length !== 70) throw new Error('Invalid SS58 address length')
  const bytes = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16))
  if (bytes[0] !== 42) throw new Error('Use a Finney SS58 address (prefix 42)')
  const hash = checksum(bytes.slice(0, 33))
  if (bytes[33] !== hash[0] || bytes[34] !== hash[1]) throw new Error('SS58 address checksum is invalid')
  if (bytes.slice(1, 33).every(byte => byte === 0)) throw new Error('The zero account cannot receive this transfer')
  return '0x' + hex.slice(2, 66)
}

export function encodeFinneyAddress(publicKey: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(publicKey)) throw new Error('Invalid account ID')
  const payload = new Uint8Array([42, ...Uint8Array.from(publicKey.slice(2).match(/../g)!, byte => parseInt(byte, 16))])
  const bytes = new Uint8Array([...payload, ...checksum(payload).slice(0, 2)])
  let n = BigInt('0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''))
  let result = ''
  while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n }
  return result
}

export function validateSs58Recipient(recipient: string, token: string, spendingLimit = false): string | undefined {
  try { decodeFinneyAddress(recipient) } catch (error) { return (error as Error).message }
  if (token.toLowerCase() !== ZeroAddress) return 'SS58 transfers are available for native TAO only'
  if (spendingLimit) return 'SS58 transfers require the multi-sig owners’ approval'
}

export function nativeTaoValue(amount: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error('Enter a valid TAO amount')
  const value = parseUnits(amount, 18)
  if (value <= 0n) throw new Error('Enter an amount greater than zero')
  if (value % 1000000000n !== 0n) throw new Error('TAO to SS58 supports up to 9 decimal places')
  return value
}

export function createSs58Transfer(recipient: string, amount: string, token: string, chainId: string): MetaTransactionData {
  if (chainId !== '964') throw new Error('SS58 transfers are only supported on Finney')
  const error = validateSs58Recipient(recipient, token)
  if (error) throw new Error(error)
  return { to: TAO_TRANSFER, value: nativeTaoValue(amount).toString(), data: abi.encodeFunctionData('transfer', [decodeFinneyAddress(recipient)]), operation: 0 }
}

export function decodeSs58Transfer(chainId: string, to: string, data: string, value: string, operation: number) {
  if (chainId !== '964' || to.toLowerCase() !== TAO_TRANSFER || operation !== 0 || !/^0x[0-9a-fA-F]{72}$/.test(data)) return undefined
  try {
    const [key] = abi.decodeFunctionData('transfer', data)
    if (BigInt(value) <= 0n || BigInt(value) % 1000000000n !== 0n) return undefined
    const recipient = encodeFinneyAddress(key)
    decodeFinneyAddress(recipient)
    return { recipient, value }
  } catch { return undefined }
}
