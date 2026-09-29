// Read-only probes. Never print credential-bearing endpoint URLs.
import fs from 'node:fs';
import os from 'node:os';
const address='0xADF60fcC63217961c931d57f1dCE2C5d70Af3546';
const block='0x8610e2';
const tx='0xca49e8207cc3dc57b58d618e5cc80f1c91d755db0b09a142374080a7b75fa869';
const providers=[['getblock-backend',fs.readFileSync(`${os.homedir()}/.kube/bittensor-safe-rpc-url`,'utf8').trim()],['onfinality-public','https://bittensor-finney.api.onfinality.io/public']];
const probes=[['chain','eth_chainId',[]],['historicalCode','eth_getCode',[address,block]],['creationLogs','eth_getLogs',[{address,fromBlock:block,toBlock:block}]],['creationReceipt','eth_getTransactionReceipt',[tx]]];
const results=[];
for(const [provider,url] of providers){
 const entry={provider,checks:{}};
 for(const [name,method,params] of probes){
  try{
   const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();
   entry.checks[name]={http:response.status,errorCode:data.error?.code,result:data.error?null:name==='historicalCode'?{bytes:((data.result?.length??2)-2)/2}:name==='creationLogs'?{count:data.result?.length,transactionHash:data.result?.[0]?.transactionHash}:name==='creationReceipt'?{found:!!data.result,blockNumber:data.result?.blockNumber}:data.result};
  }catch{entry.checks[name]={transportError:true};}
  await new Promise(r=>setTimeout(r,1100));
 }
 results.push(entry);
}
const report={checkedAt:new Date().toISOString(),address,creationBlock:8786146,results};
fs.writeFileSync(new URL('./reports/rpc-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
