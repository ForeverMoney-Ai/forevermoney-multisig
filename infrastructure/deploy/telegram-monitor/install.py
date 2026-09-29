import json,subprocess
from pathlib import Path
root=Path(__file__).parent
k=['kubectl','--kubeconfig',str(Path.home()/'.kube/bg-staging.yaml'),'-n','bittensor-safe']
def apply(o): subprocess.run(k+['apply','-f','-'],input=json.dumps(o),text=True,check=True,stdout=subprocess.DEVNULL)
def obj(kind,name,**kw):return dict(apiVersion='v1',kind=kind,metadata={'name':name,'namespace':'bittensor-safe'},**kw)
apply(obj('ServiceAccount','sync-alert',automountServiceAccountToken=False))
c=json.loads((Path.home()/'.kube/bittensor-safe-telegram.json').read_text())
assert c['chat_id']==-5531617153
apply(obj('Secret','sync-alert-telegram',type='Opaque',stringData={'config.json':json.dumps(c)}))
apply(obj('ConfigMap','sync-alert-code',data={'monitor.py':(root/'monitor.py').read_text()}))
r=obj('CronJob','sync-alert',spec={'schedule':'* * * * *','concurrencyPolicy':'Forbid','startingDeadlineSeconds':40,'successfulJobsHistoryLimit':1,'failedJobsHistoryLimit':2,'jobTemplate':{'spec':{'backoffLimit':1,'activeDeadlineSeconds':55,'template':{'spec':{'serviceAccountName':'sync-alert','automountServiceAccountToken':False,'restartPolicy':'Never','securityContext':{'runAsNonRoot':True,'runAsUser':1000,'runAsGroup':1000,'fsGroup':1000,'seccompProfile':{'type':'RuntimeDefault'}},'containers':[{'name':'monitor','image':'python:3.12-alpine','command':['python','-B','/code/monitor.py'],'resources':{'requests':{'cpu':'10m','memory':'32Mi'},'limits':{'cpu':'100m','memory':'64Mi'}},'securityContext':{'allowPrivilegeEscalation':False,'readOnlyRootFilesystem':True,'capabilities':{'drop':['ALL']}},'volumeMounts':[{'name':'code','mountPath':'/code','readOnly':True},{'name':'telegram','mountPath':'/telegram','readOnly':True}]}],'volumes':[{'name':'code','configMap':{'name':'sync-alert-code'}},{'name':'telegram','secret':{'secretName':'sync-alert-telegram','defaultMode':288}}]}}}}});r['apiVersion']='batch/v1';r['spec']['jobTemplate']['spec']['template']['metadata']={'labels':{'app':'sync-alert'}};apply(r)
(root/'cronjob.json').write_text(json.dumps(r,indent=2)+'\n')
print('Installed monitor restricted to configured group')
