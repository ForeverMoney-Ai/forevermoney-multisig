const fs=require('fs'),vm=require('vm'),ts=require('/app/node_modules/typescript');
const dep=require('/app/node_modules/@safe-global/safe-deployments'),ethers=require('/app/node_modules/ethers'),Safe=require('/app/node_modules/@safe-global/protocol-kit').default;
function compile(file,req){const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports:out,require:req,console,BigInt,TextEncoder,Uint8Array});return out}
const deployments=compile('/app/packages/utils/src/services/contracts/deployments.ts',id=>{
 if(id==='@safe-global/safe-deployments')return dep;
 if(id.startsWith('@safe-global/safe-deployments/'))return require('/app/node_modules/'+id);
 if(id==='semver/functions/satisfies')return require('/app/node_modules/'+id);
 if(id.includes('utils/addresses'))return {sameAddress:(a,b)=>a?.toLowerCase()===b?.toLowerCase()};
 if(id.includes('utils/chains'))return {getLatestSafeVersion:()=> '1.4.1'};
 return {};
});
const url=process.env.FINNEY_RPC_URL||'https://lite.chain.opentensor.ai';
const provider={getNetwork:async()=>({chainId:964n}),send:async(method,params)=>{const j=await(await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://safe.forevermoney.ai'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json();if(j.error){const e=Error(j.error.message);e.rpcData=j.error.data;throw e;}return j.result}};
const sdk=compile('/overrides/safeCoreSDK.ts',id=>{
 if(id.includes('finney-rpc'))return {safeRpcInput:p=>({request:({method,params})=>p.send(method,params)})};
 if(id.endsWith('config/chains'))return {eth:'1'};
 if(id==='@safe-global/safe-deployments')return dep;
 if(id.includes('ExternalStore'))return class{getStore(){} setStore(){} useStore(){}};
 if(id==='@safe-global/protocol-kit')return {__esModule:true,default:{init:async opts=>{console.log('Contract settings',JSON.stringify(opts.contractNetworks));return Safe.init(opts)}}};
 if(id.endsWith('/safeContracts'))return {isValidMasterCopy:()=>true};
 if(id.endsWith('/contracts/utils'))return {isLegacyVersion:()=>false};
 if(id.endsWith('/contracts/deployments'))return deployments;
 if(id==='ethers')return ethers;
 return {};
});

const {createRequire}=require('module'),req=createRequire('/app/apps/web/package.json');
const tao=compile('/overrides/finney-tao.ts',req);
const alpha=compile('/overrides/finney-alpha.ts',id=>id.includes('finney-tao')?tao:req(id));
(async()=>{
 const address='0x4816aF10706d7F1472837215fdD8f28CFa9A81ad';
 const s=await sdk.initSafeSDK({provider,chainId:'964',address,version:'1.4.1+L2',implementation:'0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',implementationVersionState:'UP_TO_DATE',isL2Chain:true,isZkChain:false});

 const transactions=['0.1','0.1'].map(amount=>alpha.alphaTransfer('964','5DXq7SMZQXQrsLhXfLZoRE8JYbzkNdfHrEruZQN4i7LvH6tK','0x06ee4f6ae37569097680a092d6307661481ffe9c92b7bfb5c4e8b94a9bed1d29',10,amount));
 for (const tx of transactions) await provider.send('eth_call',[{from:address,to:tx.to,data:tx.data,value:'0x0'},'latest']);
 console.log('Individual calls passed');
 const built=await s.createTransaction({transactions,onlyCalls:true});
 const decoded=alpha.decodeAlphaBatch('964',built.data.to,built.data.data,built.data.value,built.data.operation);
 require('assert/strict').equal(decoded.amount,'200000000');
 const sim=new ethers.Interface(['function simulateAndRevert(address targetContract,bytes calldataPayload)']);
 let response;
 try { await provider.send('eth_call',[{to:address,gas:'0x989680',data:sim.encodeFunctionData('simulateAndRevert',[built.data.to,built.data.data])},'latest']);throw Error('Expected simulation revert'); }
 catch(e){response=e.rpcData;if(!response)throw e;}
 const raw=ethers.getBytes(response); console.log('Simulation payload',response);
 require('assert/strict').equal(BigInt(ethers.hexlify(raw.slice(0,32))),1n,'Whole batch reverted');
 const request=new ethers.FetchRequest(url);request.setHeader('Origin','https://safe.forevermoney.ai');const browserProvider=new ethers.JsonRpcProvider(request,964,{staticNetwork:true});
 try {let result;try{await browserProvider.call({to:address,gasLimit:10000000n,data:sim.encodeFunctionData('simulateAndRevert',[built.data.to,built.data.data])})}catch(failure){result=failure.data||failure.info?.error?.data}require('assert/strict').equal(BigInt(ethers.hexlify(ethers.getBytes(result).slice(0,32))),1n)}finally{browserProvider.destroy()}
 console.log('PASS: browser ethers error extraction for whole-batch simulation');
 console.log('PASS: SDK MultiSendCallOnly construction, total decoding and whole-batch simulation from multisig; 2 native transfers, no signing/broadcast');
})().catch(e=>{console.error(e.message);process.exitCode=1});
