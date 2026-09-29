const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const ts=require('/app/node_modules/typescript');
const out={};let calls=[];
const fetch=async(url,options)=>{calls.push(url);if(url.includes('onfinality'))return {ok:false,status:401};const body=JSON.parse(options.body);return {ok:true,json:async()=>body.map(p=>({id:p.id,jsonrpc:'2.0',result:p.method==='eth_accounts'?[]:['subnet-key']}))}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('/overrides/finney-rpc.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,fetch,AbortController,setTimeout,clearTimeout});
(async()=>{
 const result=await out.sendFinneyRpc([{id:1,jsonrpc:'2.0',method:'state_getKeysPaged',params:[]},{id:2,jsonrpc:'2.0',method:'eth_accounts',params:[]}]);assert.equal(result.length,2);assert.equal(calls.length,2);
 calls=[];await assert.rejects(()=>out.sendFinneyRpc({id:3,jsonrpc:'2.0',method:'eth_sendRawTransaction',params:[]}));assert.equal(calls.length,1);
 console.log('PASS: batched subnet/account reads fall back together; signing/broadcast requests never retry on another RPC');
})().catch(e=>{console.error(e);process.exitCode=1});
