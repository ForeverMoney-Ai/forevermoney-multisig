"""Enable canonical, bytecode-checked Finney batches using CGW's existing trust gate."""
import json, subprocess
from pathlib import Path
K=['kubectl','--kubeconfig='+str(Path.home()/'.kube/bg-staging.yaml'),'-n','bittensor-safe']
def get(kind,name): return json.loads(subprocess.check_output(K+['get',kind,name,'-o','json']))
def patch(kind,name,body): subprocess.run(K+['patch',kind,name,'--type=merge','-p',json.dumps(body)],check=True)
cm=get('cm','ui-nginx'); conf=cm['data']['nginx.conf']
start=' # BEGIN FINNEY TRUSTED BATCHES'
end=' # END FINNEY TRUSTED BATCHES'
if start in conf: conf=conf[:conf.index(start)]+conf[conf.index(end)+len(end):]
locations=[]
for addr,version in [('0x40A2aCCbd92BCA938b02010E17A5b8929b49130D','1.3.0'),('0x9641d764fc13c8B624c04430C7356C1C7C8102e2','1.4.1')]:
 c={'address':addr,'name':'MultiSendCallOnly','displayName':'Safe MultiSendCallOnly '+version,'chainId':964,'project':None,'abi':None,'modified':'2026-09-29T00:00:00Z','trustedForDelegateCall':True}
 body=json.dumps({'count':1,'next':None,'previous':None,'results':[c]},separators=(',',':'))
 locations.append(f''' location ~* ^/finney-decoder/api/v1/contracts/{addr}/?$ {{
  default_type application/json;
  if ($arg_chain_ids != "964") {{ return 200 '{{"count":0,"next":null,"previous":null,"results":[]}}'; }}
  return 200 '{body}';
 }}''')
locations.append(''' location /finney-decoder/ {
  proxy_ssl_server_name on;
  proxy_set_header Host safe-decoder.safe.global;
  proxy_pass https://safe-decoder.safe.global/;
 }''')
conf=conf.replace(' location = /healthz',start+'\n'+'\n'.join(locations)+'\n'+end+'\n location = /healthz',1)
Path('artifacts/ui-nginx-trusted-batches.conf').write_text(conf)
patch('cm','ui-nginx',{'data':{'nginx.conf':conf}})
subprocess.run(K+['rollout','restart','deploy/ui'],check=True)
subprocess.run(K+['rollout','status','deploy/ui','--timeout=120s'],check=True)
# No signature or proposal submission: checks runtime hashes, metadata and the actual trust verifier.
with Path('deploy/trusted-batches/verify.cjs').open() as f:
 subprocess.run(K+['exec','-i','deploy/cgw','--','node'],stdin=f,check=True)
patch('cm','cgw',{'data':{'FF_TRUSTED_DELEGATE_CALL':'true','SAFE_DATA_DECODER_BASE_URI':'http://ui:8080/finney-decoder'}})
subprocess.run(K+['rollout','restart','deploy/cgw'],check=True)
subprocess.run(K+['rollout','status','deploy/cgw','--timeout=120s'],check=True)
