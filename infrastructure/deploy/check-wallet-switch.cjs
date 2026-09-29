const fs=require('fs'),vm=require('vm'),ts=require('/app/node_modules/typescript'),assert=require('assert');
const s=fs.readFileSync('/app/apps/web/src/services/tx/tx-sender/sdk.ts','utf8');
const piece=s.slice(s.indexOf('async function switchOrAddChain'),s.indexOf('export const assertWalletChain')).replace('export const switchWalletChain','const switchWalletChain')+'\nglobalThis.run = switchWalletChain;';
async function test(mode){
 let callback, timer, unsub=0,calls=[];
 let wallet={chainId:'56',provider:{request:async ({method})=>{calls.push(method); if(method==='wallet_switchEthereumChain'){if(mode==='reject')throw new Error('Rejected');if(mode==='add'&&calls.length===1)throw {code:4902};if(mode!=='hang') {wallet={...wallet,chainId:'964'};callback([wallet]);}} if(method==='eth_chainId')return '0x38';}}};
 const context={setTimeout:f=>{timer=f;return 1},clearTimeout:()=>{},getConnectedWallet:ws=>ws[0],isWalletConnect:()=>false,isHardwareWallet:()=>false,toQuantity:n=>'0x'+n.toString(16),get:(obj,key)=>key.split('.').reduce((v,k)=>v?.[k],obj),getChainConfig:async()=>({chainName:'Finney',nativeCurrency:{},publicRpcUri:{value:'https://lite.chain.opentensor.ai'},blockExplorerUriTemplate:{address:'https://evm.tao.app/address/{address}'}}),URL,Error,BigInt};
 vm.createContext(context);vm.runInContext(ts.transpileModule(piece,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText,context);
 const promise=context.run({state:{get:()=>({wallets:[wallet]}),select:()=>({subscribe:fn=>{callback=fn;return {unsubscribe:()=>unsub++}}})}},'964');
 if(mode==='hang'){timer();await assert.rejects(promise,/did not confirm/);}else if(mode==='reject'){await assert.rejects(promise,/Rejected/);}else{assert.equal((await promise).chainId,'964');}
 assert.equal(unsub,1);if(mode==='add')assert.deepEqual(calls,['wallet_switchEthereumChain','wallet_addEthereumChain','eth_chainId','wallet_switchEthereumChain']);console.log('PASS',mode);
}
(async()=>{for(const m of ['success','reject','hang','add'])await test(m)})().catch(e=>{console.error(e);process.exitCode=1});
