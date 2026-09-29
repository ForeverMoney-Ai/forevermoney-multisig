const fs = require('fs'), vm = require('vm'), assert = require('assert/strict')
const ts = require('/Users/creatorbid/Documents/development/forevermoney/node_modules/typescript')
const code=ts.transpileModule(fs.readFileSync('deploy/ui-overrides/finney-rpc.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function setup(replies){const calls=[],exports={};vm.runInNewContext(code,{exports,AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});const next=replies.shift();if(next instanceof Error)throw next;return {ok:next.status===undefined||next.status===200,status:next.status||200,json:async()=>next.body}}});return {calls,...exports}}
const read={id:1,jsonrpc:'2.0',method:'eth_call',params:[]}, ok={id:1,jsonrpc:'2.0',result:'0x3'}, revert={id:1,jsonrpc:'2.0',error:{code:3,message:'execution reverted',data:'0xdead'}}
;(async()=>{
 let s=setup([{body:ok}]);assert.equal((await s.sendFinneyRpc(read))[0].result,'0x3');assert.equal(s.calls.length,1);assert.equal(s.calls[0].url,s.FINNEY_BROWSER_RPC)
 for(const failure of [new Error('network'),{status:429},{status:503},{body:{id:1,jsonrpc:'2.0',error:{code:-32005,message:'rate limit'}}},{body:{bad:true}}]){s=setup([failure,{body:ok}]);assert.equal((await s.sendFinneyRpc(read))[0].result,'0x3');assert.equal(s.calls[1].url,s.FINNEY_FALLBACK_RPC)}
 s=setup([{body:revert}]);assert.equal((await s.sendFinneyRpc(read))[0].error.data,'0xdead');assert.equal(s.calls.length,1)
 s=setup([new Error('network')]);await assert.rejects(()=>s.sendFinneyRpc({...read,method:'eth_sendRawTransaction'}));assert.equal(s.calls.length,1)
 s=setup([new Error('primary down'),new Error('fallback down')]);await assert.rejects(()=>s.sendFinneyRpc(read),/fallback down/)
 s=setup([{body:[ok,{...ok,id:2}]}]);assert.equal((await s.sendFinneyRpc([read,{...read,id:2}])).length,2)
 s=setup([]);const other={chainId:'1',rpcUri:{value:'custom'}};assert.equal(s.withFinneyBrowserRpc(other),other)
 const custom={_getConnection:()=>({url:'https://custom.example'}),send:async()=>null};assert.equal(s.safeRpcInput(custom),'https://custom.example')
 const primary={_getConnection:()=>({url:s.FINNEY_BROWSER_RPC}),send:async(method)=>method};assert.equal(await s.safeRpcInput(primary).request({method:'eth_call'}),'eth_call')
 console.log('PASS: primary, outage/rate-limit/malformed failover, revert preservation, no broadcast retry, both failures, batches, other-chain/custom preservation, SDK routing')
})().catch(e=>{console.error(e);process.exit(1)})
