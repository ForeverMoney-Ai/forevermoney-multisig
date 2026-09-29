// Read-only validation of the deployed bytecode and gateway proposal trust gate.
const assert=require('node:assert/strict');
const {keccak256}=require('/node_modules/viem');
const {ContractPageSchema}=require('/dist/src/modules/data-decoder/domain/v2/entities/contract.entity.js');
const {TransactionVerifierHelper}=require('/dist/src/modules/transactions/routes/helpers/transaction-verifier.helper.js');
const hashes={'0x40A2aCCbd92BCA938b02010E17A5b8929b49130D':'0xa9865ac2d9c7a1591619b188c4d88167b50df6cc0c5327fcbd1c8c75f7c066ad','0x9641d764fc13c8B624c04430C7356C1C7C8102e2':'0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939'};
async function trusted({chainId,contractAddress}){const r=await fetch('http://ui:8080/finney-decoder/api/v1/contracts/'+contractAddress+'?chain_ids='+chainId);if(!r.ok)return false;const data=ContractPageSchema.parse(await r.json());return !!data.results.find(x=>x.address.toLowerCase()===contractAddress.toLowerCase()&&x.trustedForDelegateCall)}
(async()=>{for(const [address,hash] of Object.entries(hashes)){const r=await(await fetch(process.env.FINNEY_RPC_URL||'https://lite.chain.opentensor.ai',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://safe.forevermoney.ai'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getCode',params:[address,'latest']})})).json();assert.equal(keccak256(r.result),hash);console.log('PASS runtime hash',address);}
const helper=new TransactionVerifierHelper({getOrThrow:()=>true},{},{},{isTrustedForDelegateCall:trusted},{});
for(const to of Object.keys(hashes))await helper.verifyProposalDelegateCall({chainId:'964',proposal:{operation:1,to},code:422});
await assert.rejects(helper.verifyProposalDelegateCall({chainId:'1',proposal:{operation:1,to:Object.keys(hashes)[0]},code:422}),/Delegate call is disabled/);
await assert.rejects(helper.verifyProposalDelegateCall({chainId:'964',proposal:{operation:1,to:'0x814cfC546b8667efeACb3910C149aD3053708f8E'},code:422}),/Delegate call is disabled/);
console.log('PASS actual CGW proposal delegate-call verifier: canonical batch accepted; wrong chain and unknown target rejected. No proposal submitted.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
