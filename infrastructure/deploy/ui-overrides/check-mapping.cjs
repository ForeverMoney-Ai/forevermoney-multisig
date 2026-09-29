// Run from /app/apps/web in the Safe build container.
const fs = require('fs')
const ts = require('typescript')
const vm = require('vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync('src/components/common/SpaceSafeBar/BittensorAddress.tsx', 'utf8')
const conversion = source.slice(source.indexOf('export function'), source.indexOf('export default')).replace('export function', 'function')
const context = { blake2b: require('@noble/hashes/blake2b').blake2b, TextEncoder, Uint8Array }
vm.createContext(context)
vm.runInContext(ts.transpile(conversion, { target: ts.ScriptTarget.ES2020 }), context)
// Verified against addressMapping(address) on chain 964 and Python hashlib SS58 encoding.
for (const [evm, ss58] of [
  ['0xADF60fcC63217961c931d57f1dCE2C5d70Af3546', '5FY8MpC4MJN5evrCoMrM1KyD3MQEuWZDg2qPHk5sbiqXvCZL'],
  ['0x7F11ccf992Eb61C7e4E4446EF7cced2AA07C7659', '5DcbL2bjaBYGdMZxJh73HnQYjiJCsHuYesVzsxuBcijfY9jJ'],
]) {
  assert.equal(context.evmToSs58(evm), ss58)
  assert.equal(context.evmToSs58(evm.toLowerCase()), ss58)
}
for (const invalid of ['', '0xzz', '0x1234']) assert.equal(context.evmToSs58(invalid), undefined)
console.log('SS58 mapping vectors and invalid-input checks passed')
