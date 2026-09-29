/** Reversible, build-time branding. No RPC, contract, storage-key or wallet changes. */
const fs=require('fs'),path=require('path');
const [mode,root,assets]=process.argv.slice(2);
if(!['safe','multisig'].includes(mode)||!root||!assets)throw Error('Usage: mode.cjs safe|multisig WEB_ROOT ASSETS');
const baselinePath=path.join(root,'.forevermoney-brand-baseline.json');
const baseline=fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(baselinePath)):{};
const src=path.join(root,'src'),pub=path.join(root,'public');
function put(file,content){const rel=path.relative(root,file);if(!(rel in baseline))baseline[rel]=fs.existsSync(file)?fs.readFileSync(file).toString('base64'):null;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function edit(rel,fn){const file=path.join(root,rel);if(fs.existsSync(file)){const old=fs.readFileSync(file,'utf8'),s=fn(old);if(s!==old)put(file,s)}}
function copy(a,b){put(path.join(root,b),fs.readFileSync(path.join(assets,a)))}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
// Always restore saved originals first: mode changes are idempotent and reversible.
for(const [rel,data] of Object.entries(baseline)){const f=path.join(root,rel);if(data===null){if(fs.existsSync(f))fs.unlinkSync(f)}else fs.writeFileSync(f,Buffer.from(data,'base64'))}
if(mode==='safe'){console.log('Restored original Safe branding');process.exit(0)}
for(const name of ['icon-white.svg','icon-black.svg','wordmark-white.svg','wordmark-black.svg','favicon.png','opengraph-multisig-v1.jpg'])copy(name,'public/images/forevermoney/'+name);
// All direct and imported upstream primary logos use our transparent original scales.
for(const f of walk(path.join(pub,'images'))){
 const n=path.basename(f),rel=path.relative(root,f);
 if(['logo-no-text.svg','logo-round.svg','safe-shield-logo-no-text.svg'].includes(n))copy('icon-black.svg',rel);
 if(n==='logo.svg')copy('wordmark-black.svg',rel);
 if(n==='safe-logo-green.png')copy('favicon.png',rel);
}
copy('favicon.ico','public/favicon.ico');copy('favicon.ico','public/favicons/favicon.ico');copy('favicon.ico','public/favicons/favicon-dot.ico');
for(const [name,size] of [['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180],['android-chrome-192x192.png',192],['android-chrome-512x512.png',512]])copy(`favicon-${size}.png`,'public/favicons/'+name);
copy('icon-black.svg','public/favicons/safari-pinned-tab.svg');
edit('public/safe.webmanifest',s=>{const m=JSON.parse(s);return JSON.stringify({...m,name:'ForeverMoney Multi-sig',short_name:'Multi-sig',description:'Multisig accounts for TAO and subnet tokens on Bittensor Finney.'},null,2)});
edit('src/config/constants.ts',s=>s.replace(/export const BRAND_NAME =[^\n]+/,"export const BRAND_NAME = 'ForeverMoney Multi-sig'"));
const phrases=[['ForeverMoney Safe','ForeverMoney Multi-sig'],['Loading Safe{Wallet}','Loading Multi-sig'],['Create new Safe account','Create new Multi-sig account'],['Create a Safe','Create a Multi-sig'],['Create Safe','Create Multi-sig'],['Add existing Safe','Add existing Multi-sig'],['Import your Safe data','Import your account data'],["You don’t have any safes yet","You don’t have any accounts yet"],['Safe account','Multi-sig account'],['Safe Account','Multi-sig Account']];
for(const f of walk(src)){
 if(!f.endsWith('.tsx')||/(__tests__|\.test\.|\.stories\.)/.test(f))continue;
 edit(path.relative(root,f),s=>{for(const [a,b]of phrases)s=s.replaceAll(a,b);return s});
}
edit('src/components/common/ForeverMoneyShell.tsx',s=>s.replace('>Safe</a>','>Multi-sig</a>').replaceAll("['Safe', '/welcome/accounts']","['Multi-sig', '/welcome/accounts']").replaceAll("label === 'Safe'","label === 'Multi-sig'").replace('<span className={css.copyright}>','<a href="/about-forevermoney.html" style={{color:"inherit",fontSize:12}}>About</a><span className={css.copyright}>'));
edit('src/components/common/SafeLogo/index.tsx',s=>s.replace('alt="Safe"','alt="ForeverMoney"'));
edit('src/components/common/LaunchScreen/index.tsx',s=>s.replace('alt="Safe"','alt="ForeverMoney"'));
// Preserve light/dark mask behavior, replace the old geometry through the asset above.
edit('src/components/common/QRCode/index.tsx',s=>s.replace("'/images/safe-logo-green.png'","'/images/forevermoney/favicon.png'"));
const spinner=`export enum SpinnerStatus { ERROR='isError', SUCCESS='isSuccess', PROCESSING='isProcessing' }
const LoadingSpinner=({status}:{status:SpinnerStatus})=><div role="status" aria-label={status===SpinnerStatus.SUCCESS?'Account ready':status===SpinnerStatus.ERROR?'Creation failed':'Creating account'} className="flex h-32 items-center justify-center"><img src="/images/forevermoney/icon-black.svg" alt="" width={96} height={80} className="dark:hidden"/><img src="/images/forevermoney/icon-white.svg" alt="" width={96} height={80} className="hidden dark:block"/></div>
export default LoadingSpinner\n`;
put(path.join(src,'components/new-safe/create/steps/StatusStep/LoadingSpinner/index.tsx'),spinner);
edit('src/features/safe-shield/components/SafeShieldDisplay.tsx',s=>s.replace(/import SafeShieldLogoFull[^\n]+\n/g,'').replace("import { useDarkMode } from '@/hooks/useDarkMode'\n",'').replace(/const shieldLogoOnHover = \[[\s\S]*?\]\.join\(' '\)\n/,'').replace(/  const isDarkMode = useDarkMode\(\)\n/,'').replace(/  const SafeShieldLogo =[^\n]+\n/,'').replace(/<SafeShieldLogo[^>]+\/>/,'<span className="text-xs text-muted-foreground">Checks using Safe Shield</span>'));
edit('src/components/common/MetaTags/index.tsx',s=>s.replaceAll('safe-opengraph-v1.jpg','forevermoney/opengraph-multisig-v1.jpg').replace('Your TAO. Your Safe.','Your TAO. Your Multi-sig.').replace('with Safe multisig','with multisig accounts'));
edit('src/components/common/SafeLogo/SafeLogo.module.css',s=>s.replace('background-color: var(--primary)','background-color: var(--color-text-primary)'));
edit('src/components/common/LaunchScreen/LaunchScreen.module.css',s=>s.replace(/background-color: var\([^;]+;/g,'background-color: var(--color-text-primary);'));
const about=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>About ForeverMoney Multi-sig</title></head><body style="background:#090b0e;color:#f8fafc;font:16px/1.6 system-ui;margin:0"><main style="max-width:720px;margin:64px auto;padding:24px"><img src="/images/forevermoney/wordmark-white.svg" width="228" alt="ForeverMoney"><h1>ForeverMoney Multi-sig</h1><p>An independently operated interface for multi-sig accounts on Bittensor Finney, operated by Tortoise Labs Ltd. (ForeverMoney), including native TAO-to-SS58 and subnet stake transfers.</p><p>This interface is built on open-source software. See <a style="color:#95b9ff" href="/licences.html">open-source licences and credits</a>.</p><p><a style="color:#95b9ff" href="/welcome/accounts">Return to accounts</a></p></main></body></html>`;
put(path.join(pub,'about-forevermoney.html'),about);
fs.writeFileSync(baselinePath,JSON.stringify(baseline));console.log('Applied local ForeverMoney Multi-sig mode; originals saved for reversal:',Object.keys(baseline).length);
