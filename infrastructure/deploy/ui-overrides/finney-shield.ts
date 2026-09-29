import { keccak256 } from 'ethers'
import { decodeAlphaTransfer, decodeAlphaBatch, STAKING_PRECOMPILE } from '@/services/tx/finney-alpha'
import type { SafeTransaction } from '@safe-global/types-kit'
import { ContractStatus, Severity, StatusGroup, type ContractAnalysisResults } from '@safe-global/utils/features/safe-shield/types'
import { decodeSs58Transfer, TAO_TRANSFER } from '@/services/tx/finney-tao'

// Pinned runtime hashes from @safe-global/safe-deployments canonical 1.3.0/1.4.1 artifacts.
const BATCH_CODE_HASHES: Record<string, string> = {
  '0x40a2accbd92bca938b02010e17a5b8929b49130d': '0xa9865ac2d9c7a1591619b188c4d88167b50df6cc0c5327fcbd1c8c75f7c066ad',
  '0x9641d764fc13c8b624c04430c7356c1c7c8102e2': '0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939',
}
export function matchesFinneyBatchCode(chainId: string, address: string, code: string): boolean {
  try { return chainId === '964' && !!BATCH_CODE_HASHES[address.toLowerCase()] && keccak256(code) === BATCH_CODE_HASHES[address.toLowerCase()] } catch { return false }
}

/** Explain an exact native transfer as an extension notice, retaining its unavailable verification status. */
export function explainFinneyTransfer(
  chainId: string,
  transaction: SafeTransaction | undefined,
  results: ContractAnalysisResults | undefined,
  verifiedBatchAddress?: string,
): ContractAnalysisResults | undefined {
  const tx = transaction?.data
  if (!results || !tx) return results
  const tao = decodeSs58Transfer(chainId, tx.to, tx.data, tx.value, tx.operation)
  const batch = decodeAlphaBatch(chainId, tx.to, tx.data, tx.value, tx.operation)
  const alpha = decodeAlphaTransfer(chainId, tx.to, tx.data, tx.value, tx.operation) || batch
  if (!tao && !alpha) return results
  const target = alpha ? STAKING_PRECOMPILE : TAO_TRANSFER
  return Object.fromEntries(Object.entries(results).map(([address, result]) => {
    const verifiedWrapper = !!batch && verifiedBatchAddress?.toLowerCase() === tx.to.toLowerCase() && address.toLowerCase() === tx.to.toLowerCase()
    if (verifiedWrapper) {
      const description = `This ForeverMoney feature sends SN${batch.netuid} from ${batch.legs.length} validator positions in one multisig transaction. The recipient keeps the same validators. The deployed batch contract matches Safe’s published bytecode; every call is a recognized native stake transfer. This is a local check, not a Safe Shield verification.`
      return [address, Object.fromEntries(Object.entries(result).map(([group, items]) => [group, Array.isArray(items) ? items.map(item =>
        (group === StatusGroup.CONTRACT_VERIFICATION && item.type === ContractStatus.VERIFICATION_UNAVAILABLE) ||
        (group === StatusGroup.DELEGATECALL && item.type === ContractStatus.UNEXPECTED_DELEGATECALL)
          ? {...item, severity: Severity.INFO, title: `Native SN${batch.netuid} transfer · ForeverMoney`, description}
          : item,
      ) : items]))]
    }
    if (address.toLowerCase() !== target) return [address, result]
    const verification = result[StatusGroup.CONTRACT_VERIFICATION]
    if (!verification?.some(item => item.type === ContractStatus.VERIFICATION_UNAVAILABLE)) return [address, result]
    return [address, {
      ...result,
      [StatusGroup.CONTRACT_VERIFICATION]: verification.map(item =>
        item.type === ContractStatus.VERIFICATION_UNAVAILABLE ? {
          ...item,
          severity: Severity.INFO,
          title: alpha ? `SN${alpha.netuid} native stake transfer · ForeverMoney extension` : 'TAO → SS58 · ForeverMoney extension',
          description: alpha ? 'This ForeverMoney extension transfers native subnet stake to an SS58 account through Bittensor’s staking precompile. It keeps the same subnet and validator. Safe Shield cannot verify this system precompile.' : 'This transfer feature was added by ForeverMoney and is not part of standard Safe. It uses Bittensor’s native transfer precompile to send TAO to an SS58 address. Safe Shield cannot verify this system precompile.',
        } : item,
      ),
    }]
  }))
}
