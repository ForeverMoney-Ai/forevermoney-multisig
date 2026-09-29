import json, secrets, pathlib, os
root=pathlib.Path(__file__).parent
private=pathlib.Path.home()/'.kube'/'bittensor-safe-secrets.json'
if private.exists(): s=json.loads(private.read_text())
else:
 s={k:secrets.token_hex(32) for k in ['postgres','txs','cfg','cgw','django','config','auth','jwt','fingerprint']}
 fd=os.open(private,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(s,f)
ns='bittensor-safe'; docs=[]
def add(kind,name,spec=None,**kw):
 o={'apiVersion':'v1','kind':kind,'metadata':{'name':name,'namespace':ns,'labels':{'app.kubernetes.io/part-of':ns}},**kw}
 if spec is not None:o['spec']=spec
 docs.append(o);return o
add('Namespace',ns);docs[-1]['metadata'].pop('namespace')
add('ResourceQuota','safe-budget',{'hard':{'requests.cpu':'3','requests.memory':'3Gi','limits.cpu':'6','limits.memory':'7Gi','requests.storage':'30Gi','pods':'16'}})
add('NetworkPolicy','safe-isolation',{'podSelector':{},'policyTypes':['Ingress','Egress'],'ingress':[{'from':[{'podSelector':{}}]},{'from':[{'namespaceSelector':{'matchLabels':{'kubernetes.io/metadata.name':'ingress-nginx'}}}],'ports':[{'port':8080,'protocol':'TCP'}]}],'egress':[{'to':[{'podSelector':{}}]},{'to':[{'namespaceSelector':{'matchLabels':{'kubernetes.io/metadata.name':'kube-system'}}}],'ports':[{'protocol':'UDP','port':53},{'protocol':'TCP','port':53}]},{'to':[{'ipBlock':{'cidr':'0.0.0.0/0','except':['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','169.254.0.0/16']}}],'ports':[{'port':443,'protocol':'TCP'}]}]},apiVersion='networking.k8s.io/v1')
for name,size in [('postgres','20Gi'),('ui','1Gi')]:add('PersistentVolumeClaim',name,{'accessModes':['ReadWriteOnce'],'storageClassName':'hcloud-volumes','resources':{'requests':{'storage':size}}})
add('Secret','postgres',stringData={'POSTGRES_PASSWORD':s['postgres']})
init='\n'.join(f"CREATE USER {n} WITH PASSWORD '{s[n]}';\nCREATE DATABASE {n} OWNER {n};" for n in ['txs','cfg','cgw'])
add('Secret','db-init',stringData={'init.sql':init})
add('Secret','txs',stringData={'DATABASE_URL':f"psql://txs:{s['txs']}@postgres:5432/txs",'DJANGO_SECRET_KEY':s['django'],'ETHEREUM_NODE_URL':(pathlib.Path.home()/'.kube/bittensor-safe-rpc-url').read_text().strip()})
add('Secret','archive-rpc',stringData={'ETHEREUM_NODE_URL':(pathlib.Path.home()/'.kube/bittensor-safe-archive-rpc-url').read_text().strip()})
add('Secret','cfg',stringData={'POSTGRES_PASSWORD':s['cfg'],'SECRET_KEY':s['config'],'CGW_AUTH_TOKEN':s['auth']})
add('Secret','cgw',stringData={'POSTGRES_PASSWORD':s['cgw'],'AUTH_TOKEN':s['auth'],'JWT_SECRET':s['jwt'],'FINGERPRINT_ENCRYPTION_KEY':s['fingerprint']})
configs={
 'txs':{'PYTHONPATH':'/app/','DJANGO_SETTINGS_MODULE':'config.settings.production','DJANGO_ALLOWED_HOSTS':'*','DEBUG':'0','ETH_L2_NETWORK':'1','REDIS_URL':'redis://redis:6379/0','CELERY_BROKER_URL':'redis://redis:6379/1','CELERYD_CONCURRENCY':'3','CELERYD_PREFETCH_MULTIPLIER':'1','ETH_EVENTS_GET_LOGS_CONCURRENCY':'2','ETH_EVENTS_BLOCK_PROCESS_LIMIT':'100','ETH_EVENTS_BLOCK_PROCESS_LIMIT_MAX':'1000','GUNICORN_WORKERS':'1','ETH_INTERNAL_TX_DECODED_PROCESS_BATCH':'50'},
 'cfg':{'POSTGRES_USER':'cfg','POSTGRES_NAME':'cfg','POSTGRES_HOST':'postgres','POSTGRES_PORT':'5432','DEBUG':'false','ROOT_LOG_LEVEL':'INFO','DJANGO_ALLOWED_HOSTS':'*','WEB_CONCURRENCY':'1','GUNICORN_BIND_PORT':'8001','GUNICORN_BIND_SOCKET':'unix:/tmp/cfg.socket','DOCKER_NGINX_VOLUME_ROOT':'/nginx','DEFAULT_FILE_STORAGE':'django.core.files.storage.FileSystemStorage','DJANGO_OTP_ADMIN':'true','CGW_URL':'http://cgw:3000','CSRF_TRUSTED_ORIGINS':'https://safe.forevermoney.ai,http://localhost:3004'},
 'cgw':{'SAFE_CONFIG_BASE_URI':'http://cfg:8001','REDIS_HOST':'redis','REDIS_PORT':'6379','POSTGRES_HOST':'postgres','POSTGRES_DB':'cgw','POSTGRES_USER':'cgw','POSTGRES_SSL_ENABLED':'false','ALLOW_CORS':'false','USE_TX_SERVICE_VPC_URL':'true','JWT_ISSUER':'safe.forevermoney.ai','CGW_ENV':'development','LOG_LEVEL':'info','NODE_OPTIONS':'--max-old-space-size=512','EXPIRATION_TIME_DEFAULT_SECONDS':'15'}}
for line in (root.parent/'container_env_files/cgw.env').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  k,v=line.split('=',1)
  configs['cgw'].setdefault(k.strip(),v.strip().strip("'\""))
configs['cgw'].pop('AUTH_TOKEN',None)
configs['cgw'].pop('JWT_SECRET',None)
configs['cgw'].pop('FINGERPRINT_ENCRYPTION_KEY',None)
configs['cgw']['AUTH_POST_LOGIN_REDIRECT_URI']='https://safe.forevermoney.ai'
for n,d in configs.items():add('ConfigMap',n,data=d)
def deploy(name,image,port,req,lim,command=None,args=None,envfrom=None,env=None,volumes=None,mounts=None,ready=None):
 c={'name':name,'image':image,'imagePullPolicy':'IfNotPresent','resources':{'requests':{'cpu':'100m','memory':req},'limits':{'cpu':'500m','memory':lim}}}
 if port:c['ports']=[{'containerPort':port}]
 if command:c['command']=command
 if args:c['args']=args
 if envfrom:c['envFrom']=envfrom
 if env:c['env']=[{'name':k,'value':v} for k,v in env.items()]
 if mounts:c['volumeMounts']=mounts
 if ready:c['readinessProbe']={'tcpSocket':{'port':port},'initialDelaySeconds':10,'periodSeconds':10}
 pod={'enableServiceLinks':False,'automountServiceAccountToken':False,'containers':[c]}
 if volumes:pod['volumes']=volumes
 add('Deployment',name,{'replicas':1,'strategy':{'type':'Recreate'},'selector':{'matchLabels':{'app':name}},'template':{'metadata':{'labels':{'app':name}},'spec':pod}},apiVersion='apps/v1')
 if port:add('Service',name,{'selector':{'app':name},'ports':[{'port':port,'targetPort':port}]})
 return docs[-2 if port else -1]
def sources(n):return [{'configMapRef':{'name':n}},{'secretRef':{'name':n}}]
def pvc(n):return {'name':n,'persistentVolumeClaim':{'claimName':n}}
def mount(n,path):return {'name':n,'mountPath':path}
deploy('postgres','postgres:16.10-alpine',5432,'512Mi','1Gi',args=['-c','max_connections=100','-c','shared_buffers=128MB'],envfrom=[{'secretRef':{'name':'postgres'}}],env={'PGDATA':'/var/lib/postgresql/data/pgdata'},volumes=[pvc('postgres'),{'name':'init','secret':{'secretName':'db-init'}}],mounts=[mount('postgres','/var/lib/postgresql/data'),mount('init','/docker-entrypoint-initdb.d')],ready=True)
deploy('redis','redis:7.4.6-alpine',6379,'128Mi','256Mi',args=['redis-server','--maxmemory','160mb','--maxmemory-policy','noeviction','--save',''],ready=True)
deploy('cfg','safeglobal/safe-config-service:v2.91.0@sha256:ec5ac71cce837a1030773590022a5a61afe1b3d065199e8edc21487f5a0edad3',8001,'192Mi','512Mi',envfrom=sources('cfg'),env={'MEDIA_URL':'https://safe.forevermoney.ai/assets/metadata/'},volumes=[{'name':'nginx','emptyDir':{}}],mounts=[mount('nginx','/nginx')],ready=True)
txs='ghcr.io/safe-global/safe-transaction-service:v5.42.1@sha256:5d177ed215decd3525c5757358076a88d24941ca54e2ee8c5afe80f52179b3d6'
deploy('txs','%s'%txs,8888,'256Mi','768Mi',command=['gunicorn','--config','gunicorn.conf.py','--bind','0.0.0.0:8888','config.wsgi:application'],envfrom=sources('txs'),ready=True)
deploy('worker',txs,None,'512Mi','1Gi',command=['docker/web/celery/worker/run.sh'],envfrom=sources('txs')+[{'secretRef':{'name':'archive-rpc'}}],env={'RUN_MIGRATIONS':'0','WORKER_QUEUES':'default,indexing,processing,contracts,tokens,notifications,webhooks'})
# Keep the scheduler off until the Bittensor contract starting blocks are configured.
d=deploy('scheduler',txs,None,'128Mi','384Mi',command=['docker/web/celery/scheduler/run.sh'],envfrom=sources('txs'));d['spec']['replicas']=0
deploy('cgw','safeglobal/safe-client-gateway-nest:v1.101.0@sha256:b8bf3dc3ebc4a905a5a4b24cad0fad68395b75b2b6d754807ebd6b3c38e3ce7a',3000,'256Mi','768Mi',envfrom=sources('cgw'),ready=True)
nginx='''events {}\nhttp {\n include /etc/nginx/mime.types;\n server {\n listen 8080;\n server_tokens off;\n root /usr/share/nginx/html;\n location = /healthz { return 200 'ok'; }\n location /cgw/ { proxy_pass http://cgw:3000/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }\n location ~ ^/txs/api/v1/about/?$ { return 404; }\n location /txs/api/ { proxy_pass http://txs:8888/api/; proxy_set_header Host $host; }\n location / { try_files $uri $uri.html $uri/ =404; }\n }\n}\n'''
add('ConfigMap','ui-nginx',data={'nginx.conf':nginx})
d=deploy('ui','nginx:1.28-alpine',8080,'64Mi','128Mi',volumes=[pvc('ui'),{'name':'nginx','configMap':{'name':'ui-nginx'}}],mounts=[mount('ui','/usr/share/nginx/html'),{'name':'nginx','mountPath':'/etc/nginx/nginx.conf','subPath':'nginx.conf'}],ready=True)
d['spec']['template']['spec']['containers'][0]['readinessProbe']={'httpGet':{'path':'/','port':8080},'periodSeconds':10}
(root/'manifests.json').write_text(json.dumps({'apiVersion':'v1','kind':'List','items':[o for o in docs if o['kind']!='Secret']},indent=2)+'\n')
secretfile=pathlib.Path.home()/'.kube'/'bittensor-safe-k8s-secrets.json'
fd=os.open(secretfile,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:json.dump({'apiVersion':'v1','kind':'List','items':[o for o in docs if o['kind']=='Secret']},f)
print('Generated manifests; secrets saved privately under ~/.kube (not in repository).')
