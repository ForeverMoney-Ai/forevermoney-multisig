const fs=require('fs'),vm=require('vm'),ts=require('/app/node_modules/typescript'),assert=require('assert');
const source=fs.readFileSync('/app/apps/web/src/components/new-safe/create/steps/StatusStep/index.tsx','utf8');
const events=Object.fromEntries(['PROCESSING','SUCCESS','INDEXED','FAILED','REVERTED','RELAYING','AWAITING_EXECUTION'].map(x=>[x,x]));
async function test(mode){
const address='0x4816aF10706d7F1472837215fdD8f28CFa9A81ad';let pending=mode==='removed'?[]:[address,{status:{}}], states=[],index=0,effects=[],subs={},pushed=[],resolvePoll;
const poll=new Promise(r=>resolvePoll=r),router={query:{},push:r=>pushed.push(r)},chain={chainId:'964',shortName:'finney'};
const mocks={react:{useState:init=>{const n=index++;if(!(n in states))states[n]=init;return [states[n],v=>states[n]=v]},useEffect:fn=>effects.push(fn)},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'next/router':{useRouter:()=>router},'@/hooks/useChains':{useCurrentChain:()=>chain},'@/store':{useAppDispatch:()=>()=>{}},'@/components/common/Notifications/useCounter':{useCounter:()=>0},'@/components/new-safe/create/steps/StatusStep/useUndeployedSafe':{default:()=>pending},'@/components/new-safe/create/logic':{pollSafeInfo:()=>poll,getRedirect:(prefix,safe)=>`/home?safe=${prefix}:${safe}`},'@/features/counterfactual':{safeCreationPendingStatuses:events},'@/features/counterfactual/services':{SafeCreationEvent:events,safeCreationSubscribe:(event,fn)=>{subs[event]=fn;return ()=>{};}},'@safe-global/theme/palettes':{lightPalette:{secondary:{main:'green'},error:{main:'red'}}},'@/config/routes':{AppRoutes:{index:'/'}}};
const ctx={exports:{},require:name=>mocks[name]||{},setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
function render(){index=0;effects=[];ctx.exports.CreateSafeStatus({data:{safeAddress:address},setStep:()=>{}});effects.forEach(f=>f());}
render();
if(mode==='removed'){resolvePoll({});await new Promise(r=>setImmediate(r));render();assert.equal(states[0],'SUCCESS');}
else {subs.SUCCESS({safeAddress:'0x0000000000000000000000000000000000000001',chainId:'964'});assert.equal(states[0],'PROCESSING');subs.SUCCESS({safeAddress:address,chainId:'1'});assert.equal(states[0],'PROCESSING');subs.SUCCESS({safeAddress:address,chainId:'964'});subs.INDEXED({safeAddress:address,chainId:'964'});pending=[];render();assert.equal(states[0],'SUCCESS');}
assert.equal(pushed.at(-1),`/home?safe=finney:${address}`);console.log('PASS',mode);
}
(async()=>{await test('success-then-indexed');await test('removed')})().catch(e=>{console.error(e);process.exitCode=1});
