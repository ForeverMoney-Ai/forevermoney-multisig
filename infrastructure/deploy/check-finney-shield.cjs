const fs=require('fs'),vm=require('vm'),assert=require('assert'),{createRequire}=require('module');
const req=createRequire('/app/apps/web/package.json'),ts=req('typescript');
function compile(path,loader=req){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:loader,TextEncoder,Uint8Array,BigInt});return exports}
const tao=compile('/overrides/finney-tao.ts');
const alpha=compile('/overrides/finney-alpha.ts',id=>id.includes('finney-tao')?tao:req(id));
const {explainFinneyTransfer:explain}=compile('/overrides/finney-shield.ts',id=>id.includes('finney-alpha')?alpha:id.includes('finney-tao')?tao:id.includes('safe-shield/types')?{Severity:{INFO:'INFO'},ContractStatus:{VERIFICATION_UNAVAILABLE:'VERIFICATION_UNAVAILABLE'},StatusGroup:{CONTRACT_VERIFICATION:'CONTRACT_VERIFICATION'}}:req(id));
const tx={data:tao.createSs58Transfer('5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK','0.002',req('ethers').ZeroAddress,'964')};
const item={type:'VERIFICATION_UNAVAILABLE',severity:'WARN',title:'Unable to verify contract',description:'Unavailable'};
const other={type:'UNEXPECTED_DELEGATECALL',severity:'CRITICAL'};
const results={[tao.TAO_TRANSFER]:{CONTRACT_VERIFICATION:[item],DELEGATECALL:[other]},'0x1234':{CONTRACT_VERIFICATION:[item]}};
const before=JSON.stringify(results),out=explain('964',tx,results);
assert.match(out[tao.TAO_TRANSFER].CONTRACT_VERIFICATION[0].title,/ForeverMoney extension/);
assert.equal(out[tao.TAO_TRANSFER].CONTRACT_VERIFICATION[0].severity,'INFO');
assert.equal(out[tao.TAO_TRANSFER].CONTRACT_VERIFICATION[0].type,item.type);
assert.strictEqual(out[tao.TAO_TRANSFER].DELEGATECALL[0],other);
assert.strictEqual(out['0x1234'],results['0x1234']);assert.equal(JSON.stringify(results),before);
for(const patch of [{to:'0x814cfC546b8667efeACb3910C149aD3053708f8E'},{operation:1},{data:'0x'},{data:tx.data.data+'00'},{value:'1'},{value:'0'}])assert.strictEqual(explain('964',{data:{...tx.data,...patch}},results),results);
assert.strictEqual(explain('1',tx,results),results);assert.strictEqual(explain('964',undefined,results),results);assert.equal(explain('964',tx,undefined),undefined);
console.log('PASS: exact SS58 call only; other chains, recipients, selectors, delegatecalls, malformed calldata and amounts untouched; unavailable verification status and all other checks preserved; exact transfer is informational.');
const path=require('path'),cache={};
function loadTs(file){if(cache[file])return cache[file];return cache[file]=compile(file,id=>{if(id.startsWith('.')){let p=path.resolve(path.dirname(file),id);if(fs.existsSync(p+'.ts'))p+='.ts';else p+='/index.ts';return loadTs(p)}return req(id)})}
const overall=loadTs('/app/packages/utils/src/features/safe-shield/utils/getOverallStatus.ts').getOverallStatus;
const clean=explain('964',tx,{[tao.TAO_TRANSFER]:{CONTRACT_VERIFICATION:[item]}});
assert.equal(overall({},clean).title,'Review details');
assert.equal(overall({},clean,undefined,true).title,'Issues found');
assert.equal(overall({},out).severity,'CRITICAL');
console.log('PASS: actual Safe Shield aggregation shows Review details for extension alone, Issues found for simulation failure, and CRITICAL for unrelated critical findings.');
