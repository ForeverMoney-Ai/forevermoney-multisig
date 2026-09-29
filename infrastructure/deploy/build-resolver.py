import copy
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
resources = json.loads((root / 'manifests.json').read_text())['items']
code = (root / 'address-resolver.py').read_text()
d = copy.deepcopy(next(r for r in resources if r['kind'] == 'Deployment' and r['metadata']['name'] == 'txs'))
d['metadata']['name'] = 'address-resolver'
d['spec']['selector']['matchLabels']['app'] = 'address-resolver'
d['spec']['template']['metadata'] = {'labels': {'app': 'address-resolver'}, 'annotations': {'checksum/code': hashlib.sha256(code.encode()).hexdigest()}}
p = d['spec']['template']['spec']
c = p['containers'][0]
c['name'] = 'address-resolver'
c['command'] = ['python', '/runtime/address-resolver.py']
c['ports'] = [{'containerPort': 8090}]
c['resources'] = {'requests': {'cpu': '50m', 'memory': '128Mi'}, 'limits': {'cpu': '250m', 'memory': '256Mi'}}
c['readinessProbe'] = {'httpGet': {'path': '/healthz', 'port': 8090}, 'initialDelaySeconds': 5, 'periodSeconds': 5}
c['volumeMounts'] = [{'name': 'runtime', 'mountPath': '/runtime', 'readOnly': True}]
p['volumes'] = [{'name': 'runtime', 'configMap': {'name': 'address-resolver-runtime'}}]
meta = {'name': 'address-resolver', 'namespace': 'bittensor-safe'}
nginx = copy.deepcopy(next(r for r in resources if r['kind'] == 'ConfigMap' and r['metadata']['name'] == 'ui-nginx'))
nginx['data']['nginx.conf'] = nginx['data']['nginx.conf'].replace(' location /cgw/', ' location /address-resolver/ { proxy_pass http://address-resolver:8090/; proxy_set_header Host $host; }\n location /cgw/')
items = [
    {'apiVersion': 'v1', 'kind': 'ConfigMap', 'metadata': {'name': 'address-resolver-runtime', 'namespace': 'bittensor-safe'}, 'data': {'address-resolver.py': code}},
    d,
    {'apiVersion': 'v1', 'kind': 'Service', 'metadata': meta, 'spec': {'selector': {'app': 'address-resolver'}, 'ports': [{'port': 8090, 'targetPort': 8090}]}},
    nginx,
]
(root / 'address-resolver.json').write_text(json.dumps({'apiVersion': 'v1', 'kind': 'List', 'items': items}, indent=2) + '\n')
