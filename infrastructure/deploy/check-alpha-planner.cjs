const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');const req=createRequire('/app/apps/web/package.json'),ts=req('typescript'),e=req('ethers');
function compile(file,loader=req){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('/overrides/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:loader,TextEncoder,Uint8Array,BigInt});return exports}
const tao=compile('finney-tao.ts'),a=compile('finney-alpha.ts',id=>id.includes('finney-tao')?tao:req(id));
const p=[{netuid:10,hotkey:'0x'+'11'.repeat(32),amount:'600000000'},{netuid:10,hotkey:'0x'+'22'.repeat(32),amount:'400000000'}];
let plan=a.planAlphaTransfer(p,'0.8');assert.equal(plan.length,2);assert.equal(plan[1].amount,'200000000');assert.equal(a.planAlphaTransfer(p,'0.5').length,1);assert.equal(a.planAlphaTransfer(p,'0.4',p[1].hotkey)[0].hotkey,p[1].hotkey);
for(const args of [[p,'1.1'],[[p[0],p[0]],'0.8'],[[p[0],{...p[1],netuid:80}],'0.8']])assert.throws(()=>a.planAlphaTransfer(...args));
const recipient='5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK';
const txs=plan.map(p=>a.alphaTransfer('964',recipient,p.hotkey,10,e.formatUnits(p.amount,9)));
const pack=tx=>e.solidityPacked(['uint8','address','uint256','uint256','bytes'],[tx.operation,tx.to,tx.value,e.getBytes(tx.data).length,tx.data]);
const iface=new e.Interface(['function multiSend(bytes)']);const data=iface.encodeFunctionData('multiSend',[e.concat(txs.map(pack))]);const target='0x9641d764fc13c8B624c04430C7356C1C7C8102e2';
assert.equal(a.decodeAlphaBatch('964',target,data,'0',1).amount,'800000000');
assert.equal(a.decodeAlphaBatch('964',target,data+'00','0',1),undefined);assert.equal(a.decodeAlphaBatch('964',target,data,'0',0),undefined);assert.equal(a.decodeAlphaBatch('1',target,data,'0',1),undefined);
for(const patch of [{operation:1},{value:'1'},{to:'0x'+'11'.repeat(20)}]){const bad=iface.encodeFunctionData('multiSend',[e.concat([pack(txs[0]),pack({...txs[1],...patch})])]);assert.equal(a.decodeAlphaBatch('964',target,bad,'0',1),undefined)}
console.log('PASS: automatic/manual allocation, exact totals, insufficient/duplicate/mixed positions and strict batch decoding boundaries');
for(const tx of [a.alphaTransfer('964',recipient,p[1].hotkey,80,'0.1'),a.alphaTransfer('964','5HCiqveWdMteyv3jkPKAsuxm8wGokKSimNhwK7sY73JDPRnv',p[1].hotkey,10,'0.1')]){const bad=iface.encodeFunctionData('multiSend',[e.concat([pack(txs[0]),pack(tx)])]);assert.equal(a.decodeAlphaBatch('964',target,bad,'0',1),undefined)}
assert.equal(a.decodeAlphaBatch('964','0x'+'11'.repeat(20),data,'0',1),undefined);
console.log('PASS: mixed recipient/subnet and untrusted batch targets rejected');

const evm='0x814cfC546b8667efeACb3910C149aD3053708f8E';
for (const input of [evm, evm.toLowerCase(), 'finney:'+evm, ' finney: '+evm+' ']) {
  assert.equal(a.resolveAlphaRecipient(input).ss58,recipient);
  assert.equal(a.alphaTransfer('964',input,p[0].hotkey,10,'0.1').data,a.alphaTransfer('964',recipient,p[0].hotkey,10,'0.1').data);
}
for (const input of ['0x1234','0x'+'00'.repeat(20),evm.replace('814cfC','814cFC'),'ethereum:'+evm]) assert.throws(()=>a.resolveAlphaRecipient(input));
assert.equal(a.resolveAlphaRecipient('finney:'+recipient).ss58,recipient);
assert.equal(a.resolveAlphaRecipient('0x4816aF10706d7F1472837215fdD8f28CFa9A81ad').coldkey,a.evmColdkey('0x4816aF10706d7F1472837215fdD8f28CFa9A81ad'));
console.log('PASS: EVM/SS58 destination equivalence, prefixes, checksum, zero and invalid inputs');
const types={Severity:{INFO:'INFO'},ContractStatus:{VERIFICATION_UNAVAILABLE:'VERIFICATION_UNAVAILABLE',UNEXPECTED_DELEGATECALL:'UNEXPECTED_DELEGATECALL'},StatusGroup:{CONTRACT_VERIFICATION:'CONTRACT_VERIFICATION',DELEGATECALL:'DELEGATECALL'}};
const shield=compile('finney-shield.ts',id=>id.includes('finney-alpha')?a:id.includes('finney-tao')?tao:id.includes('safe-shield/types')?types:req(id));
const warnings={[target]:{CONTRACT_VERIFICATION:[{type:'VERIFICATION_UNAVAILABLE',severity:'WARN'},{type:'MALICIOUS',severity:'CRITICAL'}],DELEGATECALL:[{type:'UNEXPECTED_DELEGATECALL',severity:'WARN'}]},['0x'+'99'.repeat(20)]:{CONTRACT_VERIFICATION:[{type:'VERIFICATION_UNAVAILABLE',severity:'WARN'}]}};
const batchTx={data:{to:target,data,value:'0',operation:1}};
assert.equal(shield.explainFinneyTransfer('964',batchTx,warnings)[target].CONTRACT_VERIFICATION[0].severity,'WARN');
const explained=shield.explainFinneyTransfer('964',batchTx,warnings,target);
assert.equal(explained[target].CONTRACT_VERIFICATION[0].severity,'INFO');assert.equal(explained[target].DELEGATECALL[0].severity,'INFO');assert.equal(explained[target].CONTRACT_VERIFICATION[1].severity,'CRITICAL');assert.equal(explained['0x'+'99'.repeat(20)].CONTRACT_VERIFICATION[0].severity,'WARN');
assert.equal(shield.explainFinneyTransfer('964',{data:{...batchTx.data,data:data+'00'}},warnings,target),warnings);
assert.equal(shield.explainFinneyTransfer('1',batchTx,warnings,target),warnings);
for(const code of ['0x','0x00','bad'])assert.equal(shield.matchesFinneyBatchCode('964',target,code),false);
console.log('PASS: verified native batch notices, absent verification fails closed, unrelated risks and unknown calls preserved');
(async()=>{const provider=new e.JsonRpcProvider('https://lite.chain.opentensor.ai');try{const code=await provider.getCode(target);assert(shield.matchesFinneyBatchCode('964',target,code));assert(!shield.matchesFinneyBatchCode('1',target,code));console.log('PASS: live batch runtime matches pinned Safe deployment hash')}finally{provider.destroy()}})().catch(err=>{console.error(err.message);process.exitCode=1});
